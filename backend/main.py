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
                    if thread_id in active_runs_db:
                        active_runs_db[thread_id]["currentUrl"] = event.streaming_url
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": f"Streaming at {event.streaming_url}", "type": "info"
                    })
                elif event.type == "PROGRESS":
                    purpose = str(getattr(event, "purpose", "Navigating..."))
                    combined_purpose_text += purpose + "\n"
                    if thread_id in active_runs_db:
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

                elif event.type == "COMPLETE":
                    logs.append({
                        "id": str(uuid.uuid4()), "timestamp": ts,
                        "message": "Stream analysis complete ✓", "type": "success"
                    })
                    if thread_id in active_runs_db:
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
    Calls Groq with all available data to generate a Mirror report.
    """
    if not groq_client:
        return {}

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
You have TWO real data sources to work with — use ALL of them.

═══════════════════════════════════
PRODUCT BEING ANALYSED
═══════════════════════════════════
Name       : {thread['productName']}
Thread     : {thread['threadName']}
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
SCORING RULES (0-100)
═══════════════════════════════════
1. product_strength (0-25)
2. market_gap (0-25)
3. competitor_threat (0-25)
4. data_certainty (0-25)
Final score = sum of all four sub-scores.

OUTPUT SCHEMA (JSON Only):
{{
  "score": <0-100>,
  "score_breakdown": {{
    "product_strength": <0-25>, "market_gap": <0-25>, "competitor_threat": <0-25>, "data_certainty": <0-25>,
    "rationale": "<reasoning>"
  }},
  "executive_summary": "<summary>",
  "strengths": ["<strength>", ...],
  "weaknesses": ["<weakness>", ...],
  "competitor_landscape": [
    {{ "name": "<name>", "url": "<url>", "description": "<desc>", "threat_level": "<Low | Medium | High>", "key_differentiator": "<diff>" }}
  ],
  "pricing_comparison": [
    {{ "company": "<name>", "plan": "<plan>", "price": "<price>", "highlights": "<desc>" }}
  ],
  "feature_matrix": [
    {{ "feature": "<name>", "our_product": "<Yes | No | Partial>", "competitors_status": "<desc>" }}
  ],
  "customer_reviews": [
    {{ "company": "<name>", "sentiment": "<Positive | Negative>", "quote": "<quote>", "source": "<source>" }}
  ],
  "market_positioning": "<desc>",
  "signals": [
    {{ "type": "<type>", "title": "<title>", "company": "<name>", "description": "<desc>", "date": "<YYYY-MM-DD>" }}
  ],
  "risk_assessment": [
    {{ "risk": "<risk>", "severity": "<severity>", "mitigation": "<mitigation>" }}
  ],
  "customer_reviews_summary": "<summary>",
  "predictions": ["<prediction>", ...],
  "recommendations": [
    {{ "action": "<action>", "priority": "<High | Medium | Low>", "rationale": "<rationale>" }}
  ],
  "sources": [ {{ "name": "<name>", "url": "<url>" }} ]
}}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.15,
            max_tokens=6000,
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
    """
    Runs both agents, builds report, saves to memory-only insights_db.
    """
    url = thread["competitors"][0]["url"] if thread.get("competitors") else "https://www.google.com"
    logs  = active_runs_db[thread_id]["logs"]
    signals = active_runs_db[thread_id]["signals"]

    comps_str = ", ".join([f"{c['name']}" for c in thread.get("competitors", [])])
    tags_str = ", ".join(thread.get("tags", []))

    stream_goal = f"Quickly browse competitors {comps_str} for {thread['productName']} and check: {tags_str}."
    run_goal = f"Deeply analyze competitors {comps_str}. Extract and check: {tags_str} and reviews for {thread['productName']} analysis."

    logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": "Starting Analysis...", "type": "info"})

    s_res = {"text": ""}
    r_res = {"data": {}}

    def do_stream(): s_res["text"] = stream_worker(thread_id, url, stream_goal, logs, signals)
    def do_run(): r_res["data"] = run_worker(url, run_goal)

    t1 = threading.Thread(target=do_stream)
    t2 = threading.Thread(target=do_run)
    t1.start(); t2.start()
    t1.join(); t2.join()

    try:
        report = build_insight_with_groq(thread, s_res["text"], r_res["data"], signals)
        report.update({
            "id": thread_id, "name": thread["threadName"], "product": thread["productName"],
            "description": thread["description"], "completedAt": datetime.now().strftime("%Y-%m-%d"),
            "tags": thread["tags"]
        })
        insights_db[thread_id] = report
        if thread_id in threads_db: threads_db[thread_id]["status"] = "completed"
        if thread_id in active_runs_db:
            active_runs_db[thread_id]["status"] = "idle"
            active_runs_db[thread_id]["progress"] = 100
        logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": "Analysis Complete ✓", "type": "success"})
    except Exception as e:
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


# ═════════════════════════════════════════════════════════════════════════════
# AUTO MONITORING  — multi-session, NLP-powered
# ═════════════════════════════════════════════════════════════════════════════

class MonitorCreate(BaseModel):
    id: Optional[str] = None
    name: str
    url: str
    tags: List[str] = []
    trackWhat: str = ""
    intervalSeconds: int = 60
    model_config = {"extra": "allow"}

monitors_db: dict = {}   # id -> monitor dict


def _summarize_run_data(raw_data: dict, url: str, tags: str) -> dict:
    """Use Groq to turn raw agent JSON into structured bullet points."""
    if not groq_client or not raw_data:
        return {"bullets": ["No data captured."]}
    try:
        prompt = f"""You are a concise website analyst. Below is raw data extracted from {url}.
Focus areas: {tags or 'general'}.

RAW DATA:
{json.dumps(raw_data, indent=2)[:5000]}

Write a brief, easy-to-read summary of the key information found.
Return ONLY a JSON object:
{{
  "bullets": [
    "A short impactful point about pricing",
    "Another key point about features"
  ]
}}
Keep it to 3-5 high-impact points. Be specific with numbers and names. Return ONLY valid JSON."""

        c = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You write concise, factual website summaries. Return JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.15, max_tokens=800,
            response_format={"type": "json_object"}
        )
        return json.loads(c.choices[0].message.content)
    except Exception as e:
        print(f"[monitor] summary error: {e}")
        return {"bullets": ["Summary generation failed."]}


def _generate_diff_insights(old_run: dict, new_run: dict, url: str) -> dict:
    """Compare two runs and return NLP change insights."""
    if not groq_client:
        return {"changes_detected": False, "summary": "LLM not available.", "change_items": [], "narrative": ""}
    try:
        prompt = f"""You are a website change detective for {url}.

PREVIOUS SCAN ({old_run['timestamp']}):
{old_run.get('summary', '')}

---RAW DATA---
{json.dumps(old_run.get('data', {}), indent=2)[:3000]}

CURRENT SCAN ({new_run['timestamp']}):
{new_run.get('summary', '')}

---RAW DATA---
{json.dumps(new_run.get('data', {}), indent=2)[:3000]}

Compare these two snapshots and return a JSON object:
{{
  "changes_detected": true/false,
  "summary": "<one-line headline of what changed>",
  "narrative": "<2-4 sentences explaining the changes in plain English, as if briefing a CEO. Be specific with numbers, names, prices.>",
  "change_items": [
    {{
      "type": "price_changed | content_added | content_removed | content_updated | feature_changed | no_change",
      "title": "<short human-readable title>",
      "description": "<1-2 sentence plain-English explanation of this specific change>",
      "old_value": "<previous value or null>",
      "new_value": "<current value or null>",
      "severity": "high | medium | low"
    }}
  ]
}}
If nothing meaningful changed, set changes_detected to false and return empty change_items.
Return ONLY valid JSON."""

        c = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise change-detection analyst. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1, max_tokens=2000,
            response_format={"type": "json_object"}
        )
        result = json.loads(c.choices[0].message.content)
        result["generatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return result
    except Exception as e:
        print(f"[monitor] diff error: {e}")
        return {"changes_detected": False, "summary": f"Diff failed: {e}", "change_items": [], "narrative": ""}


def _monitor_worker(monitor_id: str):
    """Background worker for a single monitor session."""
    mon = monitors_db.get(monitor_id)
    if not mon:
        return

    stop_event = mon["_stop_event"]
    cfg = mon["config"]
    url = cfg["url"]
    tags_str = ", ".join(cfg.get("tags", []))
    track = cfg.get("trackWhat", "general content")
    goal = (
        f"Visit {url} and extract ALL visible data. "
        f"Focus on: {tags_str or 'everything'}. Track: {track}. "
        f"Return structured JSON with mentioned Items"
    )

    while not stop_event.is_set():
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        mon["runCount"] = mon.get("runCount", 0) + 1
        print(f"[monitor:{monitor_id[:8]}] Scan #{mon['runCount']} at {ts}")

        # 1. Run agent
        raw_data = {}
        try:
            result = tf_client.agent.run(url=url, goal=goal)
            raw_data = result.result if result and result.result else {}
        except Exception as e:
            print(f"[monitor:{monitor_id[:8]}] agent error: {e}")
            raw_data = {"error": str(e)}

        # 2. Generate NLP summary of this run
        summary = _summarize_run_data(raw_data, url, tags_str)

        run_entry = {
            "timestamp": ts,
            "data": raw_data,
            "summary": summary,
            "runNumber": mon["runCount"],
        }

        mon["runs"].append(run_entry)
        if len(mon["runs"]) > 2:
            mon["runs"] = mon["runs"][-2:]
        mon["lastRunAt"] = ts

        # 3. If 2 runs, generate diff insights
        if len(mon["runs"]) == 2:
            diff = _generate_diff_insights(mon["runs"][0], mon["runs"][1], url)
            mon["insights"] = diff
            print(f"[monitor:{monitor_id[:8]}] Changes: {diff.get('summary', 'N/A')}")

        # 4. Wait
        if stop_event.wait(timeout=cfg.get("intervalSeconds", 60)):
            break

    mon["status"] = "stopped"
    print(f"[monitor:{monitor_id[:8]}] Stopped.")


# ── Monitor API endpoints ────────────────────────────────────────────────────

@app.post("/api/monitors")
def create_monitor(data: MonitorCreate):
    mid = data.id if data.id else str(uuid.uuid4())
    mon = {
        "id": mid,
        "name": data.name,
        "config": data.model_dump(),
        "status": "idle",       # idle | running | stopped
        "runs": [],
        "insights": {},
        "lastRunAt": None,
        "runCount": 0,
        "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "_stop_event": None,
    }
    monitors_db[mid] = mon
    return _serialize_monitor(mon)


@app.get("/api/monitors")
def get_all_monitors():
    return [_serialize_monitor(m) for m in monitors_db.values()]


@app.get("/api/monitors/{mid}")
def get_monitor(mid: str):
    mon = monitors_db.get(mid)
    if not mon:
        return {"error": "not found"}
    return _serialize_monitor(mon)


@app.post("/api/monitors/{mid}/start")
def start_monitor_session(mid: str):
    mon = monitors_db.get(mid)
    if not mon:
        return {"error": "not found"}

    # Stop previous if running
    if mon.get("_stop_event"):
        mon["_stop_event"].set()

    stop_evt = threading.Event()
    mon["_stop_event"] = stop_evt
    mon["status"] = "running"
    mon["runs"] = []
    mon["insights"] = {}
    mon["runCount"] = 0

    threading.Thread(target=_monitor_worker, args=(mid,), daemon=True).start()
    return {"success": True}


@app.post("/api/monitors/{mid}/stop")
def stop_monitor_session(mid: str):
    mon = monitors_db.get(mid)
    if not mon:
        return {"error": "not found"}
    if mon.get("_stop_event"):
        mon["_stop_event"].set()
    mon["status"] = "stopped"
    return {"success": True}


@app.delete("/api/monitors/{mid}")
def delete_monitor(mid: str):
    mon = monitors_db.get(mid)
    if mon:
        if mon.get("_stop_event"):
            mon["_stop_event"].set()
        del monitors_db[mid]
    return {"success": True}


def _serialize_monitor(m: dict) -> dict:
    """Strip internal fields for API response."""
    return {
        "id": m["id"],
        "name": m["name"],
        "config": m["config"],
        "status": m["status"],
        "runs": m["runs"],
        "insights": m["insights"],
        "lastRunAt": m["lastRunAt"],
        "runCount": m.get("runCount", 0),
        "createdAt": m.get("createdAt", ""),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)