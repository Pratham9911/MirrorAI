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

from db.database import SessionLocal
from db import models
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Header

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Memory-only DB for in-memory stop events (not persisted)
stop_events = {}

class MonitorCreate(BaseModel):
    id: Optional[str] = None
    name: str
    url: str
    tags: List[str] = []
    trackWhat: str = ""
    intervalSeconds: int = 60
    model_config = {"extra": "allow"}


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
    db = SessionLocal()
    db_mon = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
    if not db_mon:
        db.close()
        return

    cfg = db_mon.config
    url = cfg["url"]
    tags_str = ", ".join(cfg.get("tags", []))
    track = cfg.get("trackWhat", "").strip()
    db.close()

    focus_parts = []
    if tags_str: focus_parts.append(f"categories ({tags_str})")
    if track: focus_parts.append(f"specific item '{track}'")
    focus_text = " and ".join(focus_parts) if focus_parts else "general site content"

    goal = (
        f"MINIMAL WORK: You are running an automated monitoring sweep at {url}. "
        f"Your ONLY job is to find and extract information strictly related to {focus_text}. "
        f"Do NOT explore unrelated pages. Do NOT summarize the whole company. "
        f"Extract EXACTLY what is needed to observe changes in {focus_text}. "
        f"Return the data in a clean, structured JSON format."
    )

    while True:
        db = SessionLocal()
        db_mon = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
        if not db_mon or db_mon.status != "running":
            db.close()
            break
        
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db_mon.run_count += 1
        print(f"[monitor:{monitor_id[:8]}] Scan #{db_mon.run_count} at {ts}")

        # 1. Run agent
        raw_data = {}
        try:
            headers = {"X-API-Key": os.getenv("TINYFISH_API_KEY"), "Content-Type": "application/json"}
            payload = {"url": url, "goal": goal}
            resp = requests.post("https://agent.tinyfish.ai/v1/automation/run", headers=headers, json=payload, timeout=300)
            resp.raise_for_status()
            raw_data = resp.json().get("result", {})
        except Exception as e:
            raw_data = {"error": str(e)}

        # 2. Generate summary
        summary = _summarize_run_data(raw_data, url, tags_str)
        run_entry = {"timestamp": ts, "data": raw_data, "summary": summary, "runNumber": db_mon.run_count}

        # 3. Store run
        if not db_mon.runs: db_mon.runs = []
        new_runs = list(db_mon.runs) + [run_entry]
        db_mon.runs = new_runs[-10:] # keep last 10
        db_mon.last_run_at = datetime.now()

        # 4. Insights
        if len(new_runs) >= 2:
            prev_run = new_runs[-2]
            curr_run = new_runs[-1]
            db_mon.insights = _generate_diff_insights(prev_run, curr_run, url)

        db.commit()
        db.close()

        # 5. Wait
        interval = cfg.get("intervalSeconds", 60)
        evt = stop_events.get(monitor_id)
        if evt and evt.wait(timeout=interval):
            break
        elif not evt:
            import time
            time.sleep(interval)
            
    db = SessionLocal()
    db_mon = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
    if db_mon:
        db_mon.status = "stopped"
        db.commit()
    db.close()

# ── Monitor API endpoints ────────────────────────────────────────────────────

@router.post("/monitors")
def create_monitor(data: MonitorCreate, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return {"error": "Unauthorized"}
    mid = data.id if data.id else str(uuid.uuid4())
    db_mon = models.Monitor(
        id=mid,
        user_id=x_user_id,
        name=data.name,
        config=data.model_dump(),
        status="idle",
        runs=[],
        insights={},
        run_count=0
    )
    db.add(db_mon)
    db.commit()
    db.refresh(db_mon)
    return _serialize_monitor(db_mon)

@router.get("/monitors")
def get_all_monitors(db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return []
    monitors = db.query(models.Monitor).filter(models.Monitor.user_id == x_user_id).all()
    return [_serialize_monitor(m) for m in monitors]

@router.get("/monitors/{mid}")
def get_monitor(mid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    mon = db.query(models.Monitor).filter(models.Monitor.id == mid, models.Monitor.user_id == x_user_id).first()
    if not mon: return {"error": "not found"}
    return _serialize_monitor(mon)

@router.post("/monitors/{mid}/start")
def start_monitor_session(mid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    mon = db.query(models.Monitor).filter(models.Monitor.id == mid, models.Monitor.user_id == x_user_id).first()
    if not mon: return {"error": "not found"}

    if stop_events.get(mid):
        stop_events[mid].set()

    stop_evt = threading.Event()
    stop_events[mid] = stop_evt
    mon.status = "running"
    db.commit()
    threading.Thread(target=_monitor_worker, args=(mid,), daemon=True).start()
    return {"success": True}

@router.post("/monitors/{mid}/stop")
def stop_monitor_session(mid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    mon = db.query(models.Monitor).filter(models.Monitor.id == mid, models.Monitor.user_id == x_user_id).first()
    if not mon: return {"error": "not found"}
    if stop_events.get(mid):
        stop_events[mid].set()
        del stop_events[mid]
    mon.status = "stopped"
    db.commit()
    return {"success": True}

@router.delete("/monitors/{mid}")
def delete_monitor(mid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    mon = db.query(models.Monitor).filter(models.Monitor.id == mid, models.Monitor.user_id == x_user_id).first()
    if mon:
        if stop_events.get(mid):
            stop_events[mid].set()
        db.delete(mon)
        db.commit()
    return {"success": True}

def _serialize_monitor(m) -> dict:
    """Strip internal fields for API response."""
    # Handle both dict (if any remains) and SQLAlchemy model
    if isinstance(m, dict):
        return m
    return {
        "id": m.id,
        "name": m.name,
        "config": m.config,
        "status": m.status,
        "runs": m.runs,
        "insights": m.insights,
        "lastRunAt": m.last_run_at.strftime("%Y-%m-%d %H:%M:%S") if m.last_run_at else None,
        "runCount": m.run_count,
        "createdAt": m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else "",
    }
