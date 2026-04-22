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
    config: dict = {} # contains {rivalUrl, ourUrl, rivalTask, ourTask, tags, intervalSeconds}
    model_config = {"extra": "allow"}

class StrategicActionCreate(BaseModel):
    monitor_id: str
    title: str
    description: str
    scheduled_date: str
    tasks: List[dict]


def _send_mock_email(monitor_name: str, url: str, change_summary: str, actions: list, opportunities: list):
    """Mocks sending an email notification."""
    recipient = "prathamtiwari0123@gmail.com"
    subject = f"MirrorAI: Competitor Update Detected 🚨 [{monitor_name}]"
    
    actions_list = "\n".join([f"- {a.get('title')}" for a in actions[:3]])
    opps_list = "\n".join([f"- {o}" for o in opportunities[:2]])
    
    body = f"""
MirrorAI | Strategic Intelligence Unit
--------------------------------------
Alert: High-Impact Competitor Shift Detected

Monitor: {monitor_name}
Target Domain: {url}

SUMMARY OF CHANGE:
{change_summary}

PROPOSED STRATEGIC INTERVENTIONS:
{actions_list}

MARKET OPPORTUNITIES:
{opps_list}

View the full execution protocol and activate these actions here:
http://localhost:3000/monitor/

Regards,
MirrorAI Intelligence Engine
--------------------------------------
"""
    print(f"\n[INTELLIGENCE UNIT] Dispatching report to: {recipient}")
    print(body)
    print("[INTELLIGENCE UNIT] Security dispatch complete.\n")

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

def _generate_diff_insights(old_run: dict, new_run: dict, rival_url: str, our_url: str, idea_context: dict) -> dict:
    """Compare rival change + benchmark against our site."""
    if not groq_client:
        return {"changes_detected": False, "summary": "LLM not available.", "change_items": [], "narrative": ""}
    
    our_product = idea_context.get('name', 'Our Product')
    our_current_state = new_run.get('our_data', {})
    rival_prev = old_run.get('rival_data', {})
    rival_curr = new_run.get('rival_data', {})

    try:
        prompt = f"""You are Mirror — a high-velocity strategic benchmark engine for {our_product}.

OBJECTIVE:
Compare the RIVAL'S evolution ({rival_url}) and benchmark it against OUR live state ({our_url}).

--- DATA INPUTS ---
RIVAL PREVIOUS: {json.dumps(rival_prev, indent=2)[:1000]}
RIVAL CURRENT: {json.dumps(rival_curr, indent=2)[:1000]}
OUR CURRENT STATE ({our_url}): {json.dumps(our_current_state, indent=2)[:1000]}

ANALYSIS PROTOCOL:
1. Identify EXACT shifts in Rival (Current vs Previous).
2. Compare those shifts to Our Current State. (If they added Feature X, do we already have it?)
3. Suggest 2-3 "Strategic Interventions" ONLY if the rival move creates a gap we must fill or an advantage we must counter.

RULES:
- Be ruthless and data-driven.
- If Rival changes are cosmetic or don't affect {our_product}'s competitive edge, set "changes_detected": false.
- Actions MUST include 1-3 specific sub-tasks.

Return JSON:
{{
  "changes_detected": true/false,
  "summary": "<Headline of competitor move>",
  "narrative": "<Strategic summary: What they did vs what we have>",
  "impact": "High | Medium | Low",
  "change_items": [
     {{ "type": "feature_changed", "title": "...", "description": "...", "severity": "high" }}
  ],
  "actions": [
    {{
      "id": "<uuid>",
      "title": "<Short title>",
      "description": "<Since Rival did X and we possess Y, we must Z>",
      "type": "Strategy",
      "priority": "High",
      "effort": "Med",
      "tasks": [ {{ "id": "<uuid>", "title": "<task>", "duration": "30m" }} ]
    }}
  ],
  "predictions": ["..."],
  "opportunities": ["..."],
  "intelligence_logic": "Benchmark reasoning"
}}
Return ONLY valid JSON."""

        c = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise strategic analyst for MirrorAI. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1, max_tokens=3000,
            response_format={"type": "json_object"}
        )
        result = json.loads(c.choices[0].message.content)
        result["generatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return result
    except Exception as e:
        print(f"[monitor] diff error: {e}")
        return {"changes_detected": False, "summary": f"Diff failed: {e}", "actions": [], "predictions": [], "opportunities": []}

def _monitor_worker(monitor_id: str):
    """Background worker for a single monitor session."""
    db = SessionLocal()
    db_mon = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
    if not db_mon:
        db.close()
        return

    cfg = db_mon.config or {}
    rival_url = cfg.get("rivalUrl")
    our_url = cfg.get("ourUrl")
    rival_task = cfg.get("rivalTask", "General content").strip()
    our_task = cfg.get("ourTask", "General content").strip()
    db.close()

    if not rival_url or not our_url:
        print(f"[monitor:{monitor_id[:8]}] Error: Missing URLs in config")
        return

    rival_goal = f"STRATEGIC SCAN: Extract up to 10 key data points related to '{rival_task}' from {rival_url}. Visit max 5 pages. Direct JSON return."
    our_goal = f"STRATEGIC SCAN: Extract up to 10 key data points related to '{our_task}' from {our_url}. Visit max 5 pages. Direct JSON return."

    while True:
        db = SessionLocal()
        try:
            db_mon = db.query(models.Monitor).filter(models.Monitor.id == monitor_id).first()
            if not db_mon or db_mon.status != "running":
                break
            
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            db_mon.run_count += 1
            print(f"[monitor:{monitor_id[:8]}] Cycle #{db_mon.run_count} starting...")

            headers = {"X-API-Key": os.getenv("TINYFISH_API_KEY"), "Content-Type": "application/json"}
            
            # 1. Rival Scan
            rival_data = {}
            try:
                r_rival = requests.post("https://agent.tinyfish.ai/v1/automation/run", headers=headers, json={"url": rival_url, "goal": rival_goal}, timeout=180)
                r_rival.raise_for_status()
                rival_data = r_rival.json().get("result", {})
            except Exception as e:
                print(f"[monitor] rival scan failed: {e}")
                rival_data = {"error": str(e)}

            # 2. Our Scan
            our_data = {}
            try:
                r_our = requests.post("https://agent.tinyfish.ai/v1/automation/run", headers=headers, json={"url": our_url, "goal": our_goal}, timeout=180)
                r_our.raise_for_status()
                our_data = r_our.json().get("result", {})
            except Exception as e:
                print(f"[monitor] our scan failed: {e}")
                our_data = {"error": str(e)}

            # 3. Persistence (ONLY KEEP LAST 2 RUNS)
            run_entry = {"timestamp": ts, "rival_data": rival_data, "our_data": our_data, "runNumber": db_mon.run_count}
            existing_runs = list(db_mon.runs or [])
            db_mon.runs = (existing_runs + [run_entry])[-2:]
            db_mon.last_run_at = datetime.now()

            # 4. Strategic Analysis
            if len(db_mon.runs) >= 2:
                prev_run = db_mon.runs[-2]
                curr_run = db_mon.runs[-1]
                diff = _generate_diff_insights(prev_run, curr_run, rival_url, our_url, cfg)
                db_mon.insights = diff
                
                if diff.get("changes_detected"):
                    _send_mock_email(db_mon.name, rival_url, diff.get("summary", "Changes"), diff.get("actions", []), diff.get("opportunities", []))

            db.commit()
            print(f"[monitor:{monitor_id[:8]}] Cycle #{db_mon.run_count} complete.")
        except Exception as e:
            print(f"[monitor] worker loop error: {e}")
            db.rollback()
        finally:
            db.close()

        # 5. Rest
        interval = cfg.get("intervalSeconds", 60)
        evt = stop_events.get(monitor_id)
        if evt and evt.wait(timeout=interval): break
        elif not evt:
            import time
            time.sleep(interval)

    # Final stopped status
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
        config=data.config,
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

@router.post("/monitors/actions")
def save_scheduled_action(data: StrategicActionCreate, db: Session = Depends(get_db)):
    """Persist a scheduled action to the DB."""
    new_action = models.StrategicAction(
        id=str(uuid.uuid4()),
        monitor_id=data.monitor_id,
        title=data.title,
        description=data.description,
        scheduled_date=data.scheduled_date,
        tasks=data.tasks,
        status="scheduled"
    )
    db.add(new_action)
    db.commit()
    return {"success": True, "id": new_action.id}

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
