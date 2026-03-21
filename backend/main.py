import json
import uuid
import threading
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import traceback
import os
from dotenv import load_dotenv

load_dotenv()

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
    threadName: str
    productName: str
    description: str
    tags: List[str]
    competitors: List[Dict[str, str]]

threads_db = {}
active_runs_db = {}
insights_db = {}


# ─────────────────────────────────────────────────────────────────────────────
# STREAM WORKER  — runs agent.stream() to show live browser + logs to the user
# ─────────────────────────────────────────────────────────────────────────────
def stream_worker(thread_id: str, url: str, stream_goal: str, logs: list, signals: list):
    """
    Runs tinyfish agent.stream() — purely for the live UI.
    Populates logs and signals but does NOT produce the insight.
    Returns combined_purpose_text so the insight worker can use it.
    """
    combined_purpose_text = ""
    import random

    try:
        with tf_client.agent.stream(url=url, goal=stream_goal) as stream:
            for event in stream:
                ts = datetime.now().strftime("%H:%M:%S")
                if event.type == "STARTED":
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": "Browser session started", "type": "success"
                    })
                elif event.type == "STREAMING_URL":
                    active_runs_db[thread_id]["currentUrl"] = event.streaming_url
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": f"Streaming at {event.streaming_url}", "type": "info"
                    })
                elif event.type == "PROGRESS":
                    purpose = str(getattr(event, "purpose", "Navigating..."))
                    combined_purpose_text += purpose + "\n"
                    active_runs_db[thread_id]["progress"] = min(
                        90, active_runs_db[thread_id]["progress"] + 4
                    )
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": f"→ {purpose}", "type": "warning"
                    })
                    # Live signal detection from stream actions
                    pl = purpose.lower()
                    if any(k in pl for k in ["price", "cost", "plan", "pricing", "₹", "$"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "price",
                            "title": "Pricing Info Detected",
                            "description": f"Found pricing data: {purpose[:80]}", "time": ts
                        })
                    elif any(k in pl for k in ["hiring", "job", "career", "recruit"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "hiring",
                            "title": "Hiring Activity Detected",
                            "description": f"Recruitment signal: {purpose[:80]}", "time": ts
                        })
                    elif any(k in pl for k in ["feature", "launch", "new", "update", "release"]):
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "feature",
                            "title": "Feature / Launch Detected",
                            "description": f"Product update signal: {purpose[:80]}", "time": ts
                        })
                    elif random.random() < 0.2:
                        signals.insert(0, {
                            "id": str(uuid.uuid4()), "type": "alert",
                            "title": "Activity Alert",
                            "description": f"Notable activity: {purpose[:80]}", "time": ts
                        })
                elif event.type == "COMPLETE":
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": "Stream analysis complete ✓", "type": "success"
                    })
                    active_runs_db[thread_id]["progress"] = 95

    except Exception as e:
        ts = datetime.now().strftime("%H:%M:%S")
        logs.append({
            "id": str(uuid.uuid4()), "timestamp": ts,
            "message": f"Stream error: {str(e)}", "type": "error"
        })
        print(f"[stream_worker] error: {e}")
        traceback.print_exc()

    return combined_purpose_text


# ─────────────────────────────────────────────────────────────────────────────
# RUN WORKER  — runs agent.run() to get real structured JSON from the agent
# ─────────────────────────────────────────────────────────────────────────────
def run_worker(url: str, run_goal: str) -> dict:
    """
    Runs tinyfish agent.run() — blocking, returns the structured result dict
    (or empty dict on failure).
    """
    try:
        result = tf_client.agent.run(url=url, goal=run_goal)
        if result and result.result:
            return result.result
    except Exception as e:
        print(f"[run_worker] error: {e}")
        traceback.print_exc()
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# GROQ INSIGHT BUILDER  — uses stream logs + run result to produce rich report
# ─────────────────────────────────────────────────────────────────────────────
def build_insight_with_groq(
    thread: dict,
    combined_purpose_text: str,
    run_result: dict,
    signals: list
) -> dict:
    """
    Calls Groq with all available data — stream activity log, structured run
    result, live-detected signals, tags — to generate a comprehensive Mirror
    analysis report.
    """
    if not groq_client:
        print("[build_insight] Groq not available, returning minimal insight")
        return {}

    # Serialise what we have for the prompt
    run_result_str = json.dumps(run_result, indent=2) if run_result else "Not available"
    signals_str = json.dumps(signals[:20], indent=2) if signals else "None detected"
    tags_str = ", ".join(thread.get("tags", []))
    competitors_str = ", ".join(
        f"{c.get('name','?')} ({c.get('url','?')})"
        for c in thread.get("competitors", [])
    )

    system_prompt = (
        "You are Mirror — a ruthlessly honest competitive-intelligence analyst. "
        "Your job is to give the founders of a product a full-truth report of "
        "where they stand vs. competitors. Be specific, data-driven, and candid. "
        "Return ONLY valid JSON — no markdown, no prose outside JSON."
    )

    prompt = f"""
We just ran a live competitor analysis for the product below.
You have THREE real data sources to work with — use ALL of them.

═══════════════════════════════════
PRODUCT BEING ANALYSED
═══════════════════════════════════
Name       : {thread['product']}
Thread     : {thread['name']}
Description: {thread['description']}
Focus Tags : {tags_str}
Competitors: {competitors_str}

═══════════════════════════════════
DATA SOURCE 1 — Live browser actions log (what our agent actually did)
═══════════════════════════════════
{combined_purpose_text or "No stream data captured."}

═══════════════════════════════════
DATA SOURCE 2 — Structured result returned by the research agent (real data)
═══════════════════════════════════
{run_result_str}

═══════════════════════════════════
DATA SOURCE 3 — Live signals detected during browsing
═══════════════════════════════════
{signals_str}

═══════════════════════════════════
OUTPUT SCHEMA — return EXACTLY this JSON structure, no extra keys
═══════════════════════════════════
{{
  "score": <integer 0-100 — honest competitiveness score for {thread['product']}>,
  "score_rationale": "<1-2 sentences explaining the score>",

  "strengths": [
    "<specific strength of {thread['product']} vs competitors — grounded in data>",
    ...  (max 5)
  ],

  "weaknesses": [
    "<specific weakness or gap — be honest, use real data>",
    ...  (max 5)
  ],

  "competitor_landscape": [
    {{
      "name": "<competitor name>",
      "url": "<competitor url>",
      "description": "<what they do and how they compare>",
      "threat_level": "<Low | Medium | High>"
    }}
    ...
  ],

  "signals": [
    {{
      "type": "<feature | price | hiring | funding | alert>",
      "title": "<short signal title>",
      "description": "<detailed description — what it means for {thread['product']}>",
      "date": "<YYYY-MM-DD or 'recent'>"
    }}
    ...  (include all meaningful signals, max 10)
  ],

  "customer_reviews_summary": "<synthesise any review or user sentiment data found — what customers are saying about the competitors and what gaps that reveals for {thread['product']}>",

  "market_positioning": "<where does {thread['product']} sit in the market — premium, budget, niche, etc. vs competitors>",

  "predictions": [
    "<data-driven prediction about competitor moves or market shifts>",
    ...  (max 4)
  ],

  "recommendations": [
    "<specific, actionable recommendation for {thread['product']} team>",
    ...  (max 5)
  ],

  "sources": [
    {{
      "name": "<source/site name>",
      "url": "<url found during research>"
    }}
    ...
  ]
}}

Be highly specific. Reference actual product names, prices, features from the data.
Do NOT make up data that is not in the sources above.
Return ONLY the JSON object.
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.15,
            max_tokens=4096,
            response_format={"type": "json_object"}
        )
        result_text = completion.choices[0].message.content
        return json.loads(result_text)
    except Exception as e:
        print(f"[build_insight] Groq error: {e}")
        traceback.print_exc()
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR  — runs stream + run in parallel, then builds insight
# ─────────────────────────────────────────────────────────────────────────────
def process_thread(thread_id: str, thread: dict):
    """
    Orchestrates the full pipeline:
    1. Start stream() and run() in parallel threads
    2. Wait for both to finish
    3. Feed all data to Groq to generate the insight
    4. Save insight and update statuses
    """
    url = thread["competitors"][0]["url"] if thread.get("competitors") else "https://www.google.com"
    logs  = active_runs_db[thread_id]["logs"]
    signals = active_runs_db[thread_id]["signals"]

    comps_str = ", ".join(
        f"{c.get('name', c['url'])}" for c in thread.get("competitors", [])
    )
    tags_str = ", ".join(thread.get("tags", []))

    # ── Goal for the stream agent (simple — just to drive the browser visually)
    stream_goal = (
        f"Browse and analyse the competitor website for '{thread['product']}'. "
        f"Focus on: {tags_str}. "
        f"Navigate pricing pages, feature pages, and any review sections you can find."
    )

    # ── Goal for the run agent (rich — extract real structured data)
    run_goal = (
        f"You are doing competitive intelligence for a product called '{thread['product']}'. "
        f"Description: {thread['description']}. "
        f"Focus areas: {tags_str}. "
        f"Competitors to analyse: {comps_str} (URLs: {', '.join(c['url'] for c in thread.get('competitors', []))}). "
        f"Extract: pricing tiers and exact prices, key features with details, "
        f"customer reviews and ratings (include specific quotes if available), "
        f"hiring/funding signals, recent product launches or updates, "
        f"market positioning, and any weaknesses mentioned by users. "
        f"Return all findings as structured JSON."
    )

    logs.append({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "message": "Starting analysis — launching stream agent and research agent in parallel...",
        "type": "info"
    })

    # Results containers
    stream_result_container = {"text": ""}
    run_result_container    = {"data": {}}

    # ── Run both calls in parallel threads
    def do_stream():
        text = stream_worker(thread_id, url, stream_goal, logs, signals)
        stream_result_container["text"] = text

    def do_run():
        ts = datetime.now().strftime("%H:%M:%S")
        logs.append({
            "id": str(uuid.uuid4()), "timestamp": ts,
            "message": "Research agent started (collecting structured data)...", "type": "info"
        })
        data = run_worker(url, run_goal)
        run_result_container["data"] = data
        ts2 = datetime.now().strftime("%H:%M:%S")
        if data:
            logs.append({
                "id": str(uuid.uuid4()), "timestamp": ts2,
                "message": f"Research agent completed — {len(json.dumps(data))} bytes of data collected ✓",
                "type": "success"
            })
        else:
            logs.append({
                "id": str(uuid.uuid4()), "timestamp": ts2,
                "message": "Research agent returned no structured data — using stream log only",
                "type": "warning"
            })

    t_stream = threading.Thread(target=do_stream)
    t_run    = threading.Thread(target=do_run)

    t_stream.start()
    t_run.start()

    # Wait for both
    t_stream.join()
    t_run.join()

    logs.append({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "message": "Both agents finished — building Mirror insight report...",
        "type": "info"
    })

    # ── Build insight from all collected data
    try:
        report_data = build_insight_with_groq(
            thread=thread,
            combined_purpose_text=stream_result_container["text"],
            run_result=run_result_container["data"],
            signals=signals
        )

        # Attach metadata
        report_data["id"]          = thread_id
        report_data["name"]        = thread["name"]
        report_data["product"]     = thread["product"]
        report_data["description"] = thread.get("description", "")
        report_data["completedAt"] = datetime.now().strftime("%Y-%m-%d")
        report_data["tags"]        = thread.get("tags", [])
        report_data["competitors_input"] = thread.get("competitors", [])

        insights_db[thread_id] = report_data

        threads_db[thread_id]["status"]     = "completed"
        active_runs_db[thread_id]["status"] = "idle"
        active_runs_db[thread_id]["progress"] = 100

        logs.append({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "message": "Mirror analysis complete — report ready in Insights ✓",
            "type": "success"
        })

    except Exception as e:
        print(f"[process_thread] insight build failed: {e}")
        traceback.print_exc()
        logs.append({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "message": f"Insight build error: {str(e)}", "type": "error"
        })
        threads_db[thread_id]["status"]     = "paused"
        active_runs_db[thread_id]["status"] = "paused"


# ─────────────────────────────────────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/threads")
def get_threads():
    return list(threads_db.values())

@app.post("/api/threads")
def create_thread(data: ThreadCreate):
    tid = str(uuid.uuid4())
    t = {
        "id": tid,
        "name": data.threadName,
        "product": data.productName,
        "description": data.description,
        "tags": data.tags,
        "competitors": data.competitors,
        "status": "draft",
        "createdAt": datetime.now().strftime("%Y-%m-%d"),
        "competitorsCount": len(data.competitors)
    }
    threads_db[tid] = t
    return t

@app.delete("/api/threads/{tid}")
def delete_thread(tid: str):
    if tid in threads_db:
        del threads_db[tid]
    return {"success": True}

@app.post("/api/threads/{tid}/run")
def run_thread(tid: str):
    if tid not in threads_db:
        return {"error": "not found"}

    t = threads_db[tid]
    threads_db[tid]["status"] = "running"

    active_runs_db[tid] = {
        "id": tid,
        "name": t["name"],
        "status": "running",
        "currentUrl": "Initializing...",
        "progress": 3,
        "logs": [],
        "signals": []
    }

    # Fire the full pipeline in a background thread
    worker = threading.Thread(target=process_thread, args=(tid, t), daemon=True)
    worker.start()

    return {"success": True}

@app.get("/api/runs")
def get_runs():
    return list(active_runs_db.values())

@app.get("/api/insights")
def get_insights():
    return list(insights_db.values())

@app.get("/api/insights/{tid}")
def get_insight(tid: str):
    return insights_db.get(tid)

@app.delete("/api/insights/{tid}")
def delete_insight(tid: str):
    if tid in insights_db:
        del insights_db[tid]
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)