import json
import uuid
import threading
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import traceback
import os
import requests
from dotenv import load_dotenv

load_dotenv()

from monitoring.router import router as monitor_router

from tinyfish import TinyFish
try:
    from groq import Groq
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
except Exception as e:
    groq_client = None
    print("Groq init failed", e)

tf_client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ThreadCreate(BaseModel):
    id: Optional[str] = None
    threadName: Optional[str] = None
    productName: Optional[str] = None
    name: Optional[str] = None
    product: Optional[str] = None
    description: str = ""
    tags: List[str] = []
    competitors: List[Dict[str, str]] = []
    # Accept and ignore extra fields from localStorage
    model_config = {"extra": "allow"}

def _normalize_thread(t: dict) -> dict:
    """Ensures both 'threadName'/'productName' AND 'name'/'product' exist."""
    t["threadName"] = t.get("threadName") or t.get("name") or "Untitled"
    t["productName"] = t.get("productName") or t.get("product") or "Unknown"
    t["name"] = t["threadName"]
    t["product"] = t["productName"]
    return t

# Memory-only DBs (as requested: No backend persistence on disk)
threads_db = {}
active_runs_db = {}
insights_db = {}


# ─────────────────────────────────────────────────────────────────────────────
# SSE WORKER  — single run-sse call: live logs + final structured result
# ─────────────────────────────────────────────────────────────────────────────
SSE_ENDPOINT = "https://agent.tinyfish.ai/v1/automation/run-sse"

def sse_worker(thread_id: str, url: str, goal: str, logs: list, signals: list) -> tuple[str, dict]:
    """
    Hits TinyFish run-sse once.
    — Streams PROGRESS events live into logs/signals (for the UI)
    — Captures the COMPLETE event result (for the insight engine)
    Returns (combined_purpose_text, run_result_dict)
    """
    combined_purpose_text = ""
    run_result: dict = {}

    headers = {
        "X-API-Key": os.getenv("TINYFISH_API_KEY"),
        "Content-Type": "application/json",
    }
    payload = {"url": url, "goal": goal}
    current_event_type = None

    try:
        with requests.post(SSE_ENDPOINT, headers=headers, json=payload, stream=True, timeout=300) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                decoded = raw_line.decode("utf-8")

                # SSE protocol: "event: TYPE" or "data: {...}"
                if decoded.startswith("event:"):
                    current_event_type = decoded.replace("event:", "").strip()
                    continue

                if not decoded.startswith("data:"):
                    continue

                data_str = decoded[len("data:"):].strip()
                try:
                    data = json.loads(data_str)
                except Exception:
                    continue

                event_type = data.get("type", current_event_type or "")
                ts = datetime.now().strftime("%H:%M:%S")

                if event_type == "STARTED":
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": "Browser session started", "type": "success"
                    })

                elif event_type == "STREAMING_URL":
                    streaming_url = data.get("streaming_url", "")
                    if thread_id in active_runs_db:
                        active_runs_db[thread_id]["currentUrl"] = streaming_url
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": f"Streaming at {streaming_url}", "type": "info"
                    })

                elif event_type == "PROGRESS":
                    purpose = str(data.get("purpose", "Navigating..."))
                    combined_purpose_text += purpose + "\n"
                    if thread_id in active_runs_db:
                        active_runs_db[thread_id]["progress"] = min(
                            90, active_runs_db[thread_id]["progress"] + 4
                        )
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": f"→ {purpose}", "type": "warning"
                    })
                    # Live signal detection
                    pl = purpose.lower()
                    if any(k in pl for k in ["price", "cost", "plan", "pricing", "₹", "$"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "price", "title": "Pricing Info Detected",
                            "description": f"Found pricing data: {purpose[:80]}", "time": ts
                        })
                    elif any(k in pl for k in ["hiring", "job", "career", "recruit"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "hiring", "title": "Hiring Activity Detected",
                            "description": f"Recruitment signal: {purpose[:80]}", "time": ts
                        })
                    elif any(k in pl for k in ["feature", "launch", "new", "update", "release"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "feature", "title": "Feature / Launch Detected",
                            "description": f"Product update signal: {purpose[:80]}", "time": ts
                        })

                elif event_type == "COMPLETE":
                    # This is the gold: structured result from the agent
                    run_result = data.get("result", {})
                    if thread_id in active_runs_db:
                        active_runs_db[thread_id]["progress"] = 95
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": "Agent analysis complete ✓", "type": "success"
                    })

                elif event_type == "HEARTBEAT":
                    pass  # keepalive, ignore

    except Exception as e:
        ts = datetime.now().strftime("%H:%M:%S")
        logs.append({
            "id": str(uuid.uuid4()), "timestamp": ts,
            "message": f"Agent error: {str(e)}", "type": "error"
        })
        print(f"[sse_worker] error: {e}")
        traceback.print_exc()

    return combined_purpose_text, run_result


# ─────────────────────────────────────────────────────────────────────────────
# GROQ INSIGHT BUILDER  — uses SSE agent data to produce a rich Mirror report
# ─────────────────────────────────────────────────────────────────────────────
def build_insight_with_groq(
    thread: dict,
    combined_purpose_text: str,
    run_result: dict,
    signals: list
) -> dict:
    """
    Calls Groq with agent SSE data to generate a comprehensive Mirror report.
    The agent can return any key/value JSON — Groq must interpret it flexibly.
    Strengths = OUR product advantages. Weaknesses = where competitors beat us.
    No signals in the output.
    """
    if not groq_client:
        return {}

    run_result_str = json.dumps(run_result, indent=2) if run_result else "Not available"
    tags_str = ", ".join(thread.get("tags", []))
    competitors_str = ", ".join(
        f"{c.get('name','?')} ({c.get('url','?')})"
        for c in thread.get("competitors", [])
    )

    system_prompt = (
        "You are Mirror — a ruthlessly honest, data-driven competitive-intelligence analyst. "
        "Your audience is the founding team of a startup who needs actionable truth, not fluff. "
        "CRITICAL RULES:\n"
        "(1) The agent data below can have ANY structure — interpret every key/value regardless of nesting or naming.\n"
        "(2) STRENGTHS = things OUR product does well that competitors don't match. "
        "WEAKNESSES (for us) = things competitors do better or have that we currently lack.\n"
        "(3) Never hallucinate — every claim must trace back to the data below.\n"
        "(4) Be specific: cite actual prices, feature names, quotes, ratings from the data.\n"
        "(5) Recommendations = concrete steps the team can act on this week.\n"
        "Return ONLY valid JSON — no markdown, no prose outside JSON."
    )

    prompt = f"""
A browser AI agent analysed competitor(s) for the product described below.
The agent returned a structured JSON — it can have ANY keys/nesting (e.g. competitor_analysis,
pricing_tiers, features, hiring_signals, customer_reviews with user/rating/comment, etc.).
Your job: read EVERY field of that JSON and produce a Mirror intelligence report.

═══════════════════════════════════
PRODUCT BEING ANALYSED (our product)
═══════════════════════════════════
Name        : {thread['productName']}
Thread      : {thread['threadName']}
Description : {thread['description']}
Focus Tags  : {tags_str or 'General competitive analysis'}
Competitors : {competitors_str or 'Not specified — agent explored independently'}

═══════════════════════════════════
AGENT EXTRACTED DATA (raw — any structure)
═══════════════════════════════════
{run_result_str}

═══════════════════════════════════
INTERPRETATION GUIDE
═══════════════════════════════════
- Look for pricing in any key (pricing_tiers, price, plans, cost, tiers, etc.)
- Look for features in any key (features, capabilities, tools, offerings, etc.)
- Look for reviews in any key (customer_reviews, testimonials, ratings, comments, etc.)
  — map user/rating/comment fields to → company/sentiment/quote
- Look for hiring signals in any key (hiring_signals, jobs, careers, team_size, etc.)

═══════════════════════════════════
SCORING GUIDE (conservative, data-driven only)
═══════════════════════════════════
product_strength  (0-25): How differentiated and defensible is OUR product vs competitors found?
market_gap        (0-25): How clearly underserved is the market our product targets?
competitor_threat (0-25): How serious is the competitive pressure from analysed competitors?
data_certainty    (0-25): How complete and reliable was the agent data?
Final score = sum of four sub-scores (0-100).

OUTPUT SCHEMA — return ONLY this JSON:
{{
  "score": <0-100>,
  "score_breakdown": {{
    "product_strength": <0-25>,
    "market_gap": <0-25>,
    "competitor_threat": <0-25>,
    "data_certainty": <0-25>,
    "rationale": "<2-3 sentence explanation of how you reached each sub-score, citing specific data points>"
  }},
  "executive_summary": "<3-4 sentences: where OUR product stands vs the competition, biggest opportunity, biggest threat — direct and data-backed>",
  "strengths": [
    "<OUR PRODUCT advantage — what we do better than competitors, e.g. 'Open-source while Competitor X is closed-source'>",
    "..."
  ],
  "weaknesses": [
    "<Where a COMPETITOR beats us — what they have that we lack, e.g. 'Competitor X has 500 integrations; we have none documented'>",
    "..."
  ],
  "competitor_landscape": [
    {{
      "name": "<competitor name from agent data>",
      "url": "<competitor url>",
      "description": "<what they do, drawn from agent data>",
      "threat_level": "<Low | Medium | High>",
      "key_differentiator": "<their strongest advantage>",
      "pricing_summary": "<pricing tiers or model — exact if found, else Not found>"
    }}
  ],
  "pricing_comparison": [
    {{ "company": "<name>", "plan": "<plan name>", "price": "<exact price from data>", "highlights": "<what is included>" }}
  ],
  "feature_matrix": [
    {{ "feature": "<feature name>", "our_product": "<Yes | No | Partial | Unknown>", "competitors_status": "<which competitors have it and how>" }}
  ],
  "customer_reviews": [
    {{ "company": "<competitor name>", "sentiment": "<Positive | Negative | Mixed>", "quote": "<actual quote from the data — user/comment/review field>", "source": "<where it came from>" }}
  ],
  "customer_reviews_summary": "<overall sentiment pattern across all competitors — 2-3 sentences>",
  "market_positioning": "<where our product fits in the landscape relative to competitors — 2-3 sentences>",
  "risk_assessment": [
    {{ "risk": "<specific risk>", "severity": "<Critical | High | Medium | Low>", "mitigation": "<concrete action to reduce this risk>" }}
  ],
  "predictions": ["<evidence-based prediction about market or competition in next 6-12 months>", ...],
  "recommendations": [
    {{ "action": "<specific, actionable next step>", "priority": "<High | Medium | Low>", "rationale": "<why this matters based on the data>" }}
  ],
  "sources": [ {{ "name": "<page or company name>", "url": "<url visited by agent>" }} ]
}}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.12,
            max_tokens=7000,
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"[build_insight] Groq error: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────
def process_thread(thread_id: str, thread: dict):
    print(f"[backend] Starting process_thread for {thread_id}")
    url = thread["competitors"][0]["url"] if thread.get("competitors") else "https://www.google.com"
    logs    = active_runs_db[thread_id]["logs"]
    signals = active_runs_db[thread_id]["signals"]

    comps_str = ", ".join([f"{c['name']}" for c in thread.get("competitors", [])])
    tags_str  = ", ".join(thread.get("tags", []))

    # Single unified goal — the SSE agent does deep work AND returns structured data
    goal = (
        f"You are a competitive intelligence researcher analysing '{thread['productName']}' , description : {thread['description']}. "
        f"Visit the competitor site(s): {comps_str or url}. "
        f"analyse and extract: {tags_str or 'pricing, features, reviews, positioning'}. "
        f"Also gather customer reviews,"
        f"extract data in short and fast"
        f"Return a comprehensive structured JSON with all findings."
    )

    logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": "Starting Analysis...", "type": "info"})

    # ── ONE SSE call does the job of both stream_worker + run_worker ──
    print(f"[backend] Thread {thread_id}: Starting SSE worker (single call)")
    combined_purpose_text, run_result = sse_worker(thread_id, url, goal, logs, signals)
    print(f"[backend] Thread {thread_id}: SSE worker finished — result keys: {list(run_result.keys()) if run_result else 'empty'}")

    print(f"[backend] Thread {thread_id}: Building insight report")
    try:
        report = build_insight_with_groq(thread, combined_purpose_text, run_result, signals)
        report.update({
            "id": thread_id, "name": thread["threadName"], "product": thread["productName"],
            "description": thread["description"], "completedAt": datetime.now().strftime("%Y-%m-%d"),
            "tags": thread["tags"],
            # Store the raw agent output verbatim — frontend renders it directly
            "agent_data": run_result,
        })
        insights_db[thread_id] = report
        if thread_id in threads_db: threads_db[thread_id]["status"] = "completed"
        if thread_id in active_runs_db:
            active_runs_db[thread_id]["status"] = "idle"
            active_runs_db[thread_id]["progress"] = 100
        logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": "Analysis Complete ✓", "type": "success"})
        print(f"[backend] Thread {thread_id}: Processing finished successfully")
    except Exception as e:
        print(f"[backend] Thread {thread_id}: Error building report: {e}")
        traceback.print_exc()
        if thread_id in threads_db: threads_db[thread_id]["status"] = "paused"


# ─────────────────────────────────────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/threads")
def get_threads():
    return list(threads_db.values())

@app.post("/api/threads")
def create_thread(data: ThreadCreate):
    tid = str(uuid.uuid4())
    t = data.model_dump()
    t["id"] = tid
    t["status"] = "draft"
    t["createdAt"] = datetime.now().strftime("%Y-%m-%d")
    t["competitorsCount"] = len(data.competitors)
    t = _normalize_thread(t)
    threads_db[tid] = t
    return t

@app.delete("/api/threads/{tid}")
def delete_thread(tid: str):
    if tid in threads_db: del threads_db[tid]
    return {"success": True}

@app.post("/api/threads/{tid}/run")
def run_thread(tid: str, thread_data: Optional[ThreadCreate] = None):
    # If backend restarted, frontend can re-provide the thread context
    if tid not in threads_db and thread_data:
        t = thread_data.model_dump()
        t["id"] = tid
        t["status"] = "running"
        t["createdAt"] = datetime.now().strftime("%Y-%m-%d")
        t["competitorsCount"] = len(t.get("competitors", []))
        t = _normalize_thread(t)
        threads_db[tid] = t
    elif tid in threads_db:
        threads_db[tid]["status"] = "running"
        threads_db[tid] = _normalize_thread(threads_db[tid])
    else:
        return {"error": "Thread not found"}

    print(f"[backend] run_thread called for ID {tid}")
    t = threads_db[tid]
    active_runs_db[tid] = {
        "id": tid, "name": t["threadName"], "status": "running",
        "currentUrl": "Initializing...", "progress": 3, "logs": [], "signals": []
    }
    threading.Thread(target=process_thread, args=(tid, t), daemon=True).start()
    return {"success": True}

@app.get("/api/runs")
def get_runs(): return list(active_runs_db.values())

@app.get("/api/insights")
def get_insights(): return list(insights_db.values())

@app.get("/api/insights/{tid}")
def get_insight(tid: str): return insights_db.get(tid)

@app.delete("/api/insights/{tid}")
def delete_insight(tid: str):
    if tid in insights_db: del insights_db[tid]
    return {"success": True}


app.include_router(monitor_router, prefix="/api")


""" Database Connection Below """
from db.database import engine
from db.models import Base

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Tables created"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)