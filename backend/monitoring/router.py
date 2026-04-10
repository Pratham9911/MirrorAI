import json
import uuid
import threading
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import os
import requests

from tinyfish import TinyFish
try:
    from groq import Groq
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
except Exception as e:
    groq_client = None
    print("Groq init failed", e)

tf_client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))

router = APIRouter()

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
    track = cfg.get("trackWhat", "").strip()
    
    focus_parts = []
    if tags_str:
        focus_parts.append(f"categories ({tags_str})")
    if track:
        focus_parts.append(f"specific item '{track}'")
        
    focus_text = " and ".join(focus_parts) if focus_parts else "general site content"

    goal = (
        f"MINIMAL WORK: You are running an automated monitoring sweep at {url}. "
        f"Your ONLY job is to find and extract information strictly related to {focus_text}. "
        f"Do NOT explore unrelated pages. Do NOT summarize the whole company. "
        f"Extract EXACTLY what is needed to observe changes in {focus_text}. "
        f"Return the data in a clean, structured JSON format."
    )

    while not stop_event.is_set():
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        mon["runCount"] = mon.get("runCount", 0) + 1
        print(f"[monitor:{monitor_id[:8]}] Scan #{mon['runCount']} at {ts}")

        # 1. Run agent
        raw_data = {}
        try:
            headers = {
                "X-API-Key": os.getenv("TINYFISH_API_KEY"),
                "Content-Type": "application/json"
            }
            payload = {"url": url, "goal": goal}
            resp = requests.post("https://agent.tinyfish.ai/v1/automation/run", headers=headers, json=payload, timeout=300)
            resp.raise_for_status()
            
            data = resp.json()
            raw_data = data.get("result", {})
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

        # 3. Store run (Keep full history now)
        mon["runs"].append(run_entry)
        mon["lastRunAt"] = ts

        # 4. If at least 2 runs exist, generate diff between the MOST RECENT two
        if len(mon["runs"]) >= 2:
            prev_run = mon["runs"][-2]
            curr_run = mon["runs"][-1]
            diff = _generate_diff_insights(prev_run, curr_run, url)
            mon["insights"] = diff
            print(f"[monitor:{monitor_id[:8]}] Changes: {diff.get('summary', 'N/A')}")

        # 5. Wait for next interval
        interval = cfg.get("intervalSeconds", 60)
        if stop_event.wait(timeout=interval):
            break

    mon["status"] = "stopped"
    print(f"[monitor:{monitor_id[:8]}] Stopped.")

# ── Monitor API endpoints ────────────────────────────────────────────────────

@router.post("/monitors")
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

@router.get("/monitors")
def get_all_monitors():
    return [_serialize_monitor(m) for m in monitors_db.values()]

@router.get("/monitors/{mid}")
def get_monitor(mid: str):
    mon = monitors_db.get(mid)
    if not mon:
        return {"error": "not found"}
    return _serialize_monitor(mon)

@router.post("/monitors/{mid}/start")
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
    # Keep historical data!
    threading.Thread(target=_monitor_worker, args=(mid,), daemon=True).start()
    return {"success": True}

@router.post("/monitors/{mid}/stop")
def stop_monitor_session(mid: str):
    mon = monitors_db.get(mid)
    if not mon:
        return {"error": "not found"}
    if mon.get("_stop_event"):
        mon["_stop_event"].set()
        mon["_stop_event"] = None  # Clear it so it's not 'done' the next time we start
    mon["status"] = "stopped"
    return {"success": True}

@router.delete("/monitors/{mid}")
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
