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

from db.database import SessionLocal, engine
from db import models
from sqlalchemy.orm import Session
from fastapi import Depends, Header

models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Memory-only DBs are removed. Using Supabase instead.


# ─────────────────────────────────────────────────────────────────────────────
# SSE WORKER  — single run-sse call: live logs + final structured result
# ─────────────────────────────────────────────────────────────────────────────
SSE_ENDPOINT = "https://agent.tinyfish.ai/v1/automation/run-sse"

def sse_worker(thread_id: str, url: str, goal: str) -> tuple[str, dict]:
    """
    Hits TinyFish run-sse once.
    — Streams PROGRESS events live into logs/signals (for the UI)
    — Captures the COMPLETE event result (for the insight engine)
    Returns (combined_purpose_text, run_result_dict)
    """
    combined_purpose_text = ""
    run_result: dict = {}
    logs = []
    signals = []

    headers = {
        "X-API-Key": os.getenv("TINYFISH_API_KEY"),
        "Content-Type": "application/json",
    }
    payload = {"url": url, "goal": goal}
    current_event_type = None

    db = SessionLocal()
    try:
        with requests.post(SSE_ENDPOINT, headers=headers, json=payload, stream=True, timeout=300) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                decoded = raw_line.decode("utf-8")

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
                    print(f"[sse:{thread_id[:8]}] STARTED")
                    log_id = str(uuid.uuid4())
                    db.add(models.Log(id=log_id, run_id=thread_id, message="Browser session started", type="success", timestamp=ts))
                    db.commit()

                elif event_type == "STREAMING_URL":
                    streaming_url = data.get("streaming_url", "")
                    print(f"[sse:{thread_id[:8]}] STREAMING_URL: {streaming_url}")
                    run = db.query(models.Run).filter(models.Run.id == thread_id).first()
                    if run:
                        run.current_url = streaming_url
                    
                    log_id = str(uuid.uuid4())
                    db.add(models.Log(id=log_id, run_id=thread_id, message=f"Streaming at {streaming_url}", type="info", timestamp=ts))
                    db.commit()

                elif event_type == "PROGRESS":
                    purpose = str(data.get("purpose", "Navigating..."))
                    combined_purpose_text += purpose + "\n"
                    
                    run = db.query(models.Run).filter(models.Run.id == thread_id).first()
                    if run:
                        run.progress = min(90, (run.progress or 0) + 4)
                        
                    log_id = str(uuid.uuid4())
                    db.add(models.Log(id=log_id, run_id=thread_id, message=f"→ {purpose}", type="warning", timestamp=ts))
                    
                    pl = purpose.lower()
                    if any(k in pl for k in ["price", "cost", "plan", "pricing", "₹", "$"]):
                        db.add(models.Signal(id=str(uuid.uuid4()), run_id=thread_id, type="price", title="Pricing Info Detected", description=f"Found pricing data: {purpose[:80]}", time=ts))
                    elif any(k in pl for k in ["hiring", "job", "career", "recruit"]):
                        db.add(models.Signal(id=str(uuid.uuid4()), run_id=thread_id, type="hiring", title="Hiring Activity Detected", description=f"Recruitment signal: {purpose[:80]}", time=ts))
                    elif any(k in pl for k in ["feature", "launch", "new", "update", "release"]):
                        db.add(models.Signal(id=str(uuid.uuid4()), run_id=thread_id, type="feature", title="Feature / Launch Detected", description=f"Product update signal: {purpose[:80]}", time=ts))
                    
                    db.commit()

                elif event_type == "COMPLETE":
                    print(f"[sse:{thread_id[:8]}] COMPLETE")
                    run_result = data.get("result", {})
                    run = db.query(models.Run).filter(models.Run.id == thread_id).first()
                    if run:
                        run.progress = 95
                    
                    log_id = str(uuid.uuid4())
                    db.add(models.Log(id=log_id, run_id=thread_id, message="Agent analysis complete ✓", type="success", timestamp=ts))
                    db.commit()

    except Exception as e:
        print(f"[sse:{thread_id[:8]}] Error: {e}")
        log_id = str(uuid.uuid4())
        ts = datetime.now().strftime("%H:%M:%S")
        db.add(models.Log(id=log_id, run_id=thread_id, message=f"Worker Error: {str(e)}", type="error", timestamp=ts))
        db.commit()
    finally:
        db.close()
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
A browser AI agent analysed rival/competitor(s) for the idea/profile described below.
The agent returned a structured JSON — it can have ANY keys/nesting (e.g. competitor_analysis,
pricing_tiers, features, hiring_signals, customer_reviews with user/rating/comment, etc.).
Your job: read EVERY field of that JSON and produce a Mirror intelligence report.

═══════════════════════════════════
IDEA / PROFILE BEING ANALYSED (us)
═══════════════════════════════════
Name        : {thread['productName']}
Thread      : {thread['threadName']}
Description : {thread['description']}
Focus Tags  : {tags_str or 'General competitive analysis'}
Rivals      : {competitors_str or 'Not specified — agent explored independently'}

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
SCORING GUIDE (Dynamic & Idea-Specific)
═══════════════════════════════════
Based on the specific nature of the idea (e.g., student project vs SAAS vs local shop vs content creator), determine EXACTLY 4 highly relevant criteria to compare (e.g. 'Student Appeal', 'Content Quality', 'Market Demand', 'Pricing Models', 'UX/UI', 'Feature Depth', etc.).
Rate OUR idea (estimated based on description) vs the COMPETITOR out of 100 for each criteria.

OUTPUT SCHEMA — return ONLY this JSON:
{{
  "score": <our_overall_score -> single 0-100 number representing us>,
  "score_comparison": {{
    "our_overall_score": <0-100>,
    "competitor_overall_score": <0-100>,
    "criteria": [
      {{
        "name": "<name of criteria>",
        "our_score": <0-100>,
        "competitor_score": <0-100>,
        "rationale": "<1-2 sentences justifying the scores>"
      }}
      // exactly 4 criteria
    ]
  }},
  "executive_summary": "<3-4 sentences: where OUR idea stands vs the competition...>",
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
    signals = []

    tags_str = ", ".join(thread.get("tags", []))
    
    # Ensure competitor details are passed correctly to the agent
    competitors_info = []
    for c in thread.get("competitors", []):
        info = f"URL: {c.get('url')}"
        if c.get("description"):
            info += f" (Context: {c['description']})"
        competitors_info.append(info)
    comps_str = " | ".join(competitors_info)

    goal = (
        f"You are a skilled researcher acting on behalf of my idea/profile: '{thread['productName']}'. "
        f"My goal/description is: '{thread['description']}'. "
        f"Your task is to visit the rival site(s): {comps_str or url}. "
        f"Analyze and extract exactly what we want to compare: {tags_str or 'general info, pricing, features'}. "
        f"Also gather customer reviews where possible. Work fast. "
        f"Look out for their strengths and what they do well vs what I am building. "
        f"Return a comprehensive structured JSON with all findings."
    )

    # ── ONE SSE call does the job of both stream_worker + run_worker ──
    print(f"[backend] Thread {thread_id}: Starting SSE worker (single call)")
    combined_purpose_text, run_result = sse_worker(thread_id, url, goal)
    print(f"[backend] Thread {thread_id}: SSE worker finished — result keys: {list(run_result.keys()) if run_result else 'empty'}")

    db = SessionLocal()
    try:
        report = build_insight_with_groq(thread, combined_purpose_text, run_result, signals)
        # We need user_id here as well
        user_id = thread.get("user_id", "default_user")
        
        report.update({
            "id": thread_id, "name": thread["threadName"], "product": thread["productName"],
            "description": thread["description"], "completedAt": datetime.now().strftime("%Y-%m-%d"),
            "tags": thread["tags"],
            "agent_data": run_result,
        })
        
        # Save insight to DB
        new_insight = models.Insight(
            id=thread_id,
            user_id=user_id,
            name=report.get("name", "Report"),
            product=report["product"],
            score=report.get("score", 0),
            completed_at=report["completedAt"],
            data=report
        )
        db.merge(new_insight) # merge handles update if exists

        # Update thread status
        db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
        if db_thread:
            db_thread.status = "completed"

        # Update run status
        db_run = db.query(models.Run).filter(models.Run.id == thread_id).first()
        if db_run:
            db_run.status = "idle"
            db_run.progress = 100
        
        log_id = str(uuid.uuid4())
        ts = datetime.now().strftime("%H:%M:%S")
        db.add(models.Log(id=log_id, run_id=thread_id, message="Analysis Complete ✓", type="success", timestamp=ts))
        db.commit()
        print(f"[backend] Thread {thread_id}: Processing finished successfully")
    except Exception as e:
        print(f"[backend] Thread {thread_id}: Error building report: {e}")
        traceback.print_exc()
        db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
        if db_thread:
            db_thread.status = "paused"
        db.commit()
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/threads")
def get_threads(db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return []
    threads = db.query(models.Thread).filter(models.Thread.user_id == x_user_id).all()
    # Normalize back for frontend
    res = []
    for t in threads:
        d = {
            "id": t.id,
            "name": t.name,
            "product": t.product,
            "threadName": t.name,
            "productName": t.product,
            "description": t.description,
            "status": t.status,
            "createdAt": t.created_at.strftime("%Y-%m-%d") if t.created_at else None,
            "competitorsCount": t.competitors_count,
            "tags": t.tags,
            "competitors": t.competitors
        }
        res.append(d)
    return res

@app.post("/api/threads")
def create_thread(data: ThreadCreate, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return {"error": "Unauthorized"}
    tid = str(uuid.uuid4())
    t = data.model_dump()
    t = _normalize_thread(t)
    
    db_thread = models.Thread(
        id=tid,
        user_id=x_user_id,
        name=t["threadName"],
        product=t["productName"],
        description=t["description"],
        status="draft",
        competitors_count=len(data.competitors),
        tags=data.tags,
        competitors=data.competitors
    )
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    
    # Return normalized
    return {
        "id": tid,
        "name": db_thread.name,
        "product": db_thread.product,
        "status": db_thread.status,
        "createdAt": db_thread.created_at.strftime("%Y-%m-%d"),
        "competitorsCount": db_thread.competitors_count
    }

@app.delete("/api/threads/{tid}")
def delete_thread(tid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return {"error": "Unauthorized"}
    db_thread = db.query(models.Thread).filter(models.Thread.id == tid, models.Thread.user_id == x_user_id).first()
    if db_thread:
        db.delete(db_thread)
        db.commit()
    return {"success": True}

@app.post("/api/threads/{tid}/run")
def run_thread(tid: str, thread_data: Optional[ThreadCreate] = None, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return {"error": "Unauthorized"}
    
    db_thread = db.query(models.Thread).filter(models.Thread.id == tid, models.Thread.user_id == x_user_id).first()
    
    if not db_thread and thread_data:
        t = thread_data.model_dump()
        t = _normalize_thread(t)
        db_thread = models.Thread(
            id=tid,
            user_id=x_user_id,
            name=t["threadName"],
            product=t["productName"],
            description=t["description"],
            status="running",
            competitors_count=len(t.get("competitors", [])),
            tags=t.get("tags", []),
            competitors=t.get("competitors", [])
        )
        db.add(db_thread)
    elif db_thread:
        db_thread.status = "running"
    else:
        return {"error": "Thread not found"}

    # Initialize Run record
    db_run = db.query(models.Run).filter(models.Run.id == tid).first()
    if db_run:
        db_run.status = "running"
        db_run.progress = 3
        db_run.current_url = "Initializing..."
        # Clear old logs/signals
        db.query(models.Log).filter(models.Log.run_id == tid).delete()
        db.query(models.Signal).filter(models.Signal.run_id == tid).delete()
    else:
        db_run = models.Run(id=tid, user_id=x_user_id, status="running", progress=3, current_url="Initializing...")
        db.add(db_run)
    
    db.commit()

    # Pass dict to worker
    thread_dict = {
        "id": tid, "threadName": db_thread.name, "productName": db_thread.product,
        "description": db_thread.description, "tags": db_thread.tags,
        "competitors": db_thread.competitors, "user_id": x_user_id
    }
    threading.Thread(target=process_thread, args=(tid, thread_dict), daemon=True).start()
    return {"success": True}

@app.get("/api/runs")
def get_runs(db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return []
    runs = db.query(models.Run).filter(models.Run.user_id == x_user_id).all()
    res = []
    for r in runs:
        # Fetch logs and signals
        logs = db.query(models.Log).filter(models.Log.run_id == r.id).order_by(models.Log.created_at.asc()).all()
        signals = db.query(models.Signal).filter(models.Signal.run_id == r.id).order_by(models.Signal.created_at.desc()).all()
        res.append({
            "id": r.id,
            "name": r.thread.name if r.thread else "Unknown",
            "status": r.status,
            "currentUrl": r.current_url,
            "progress": r.progress,
            "logs": [{"id": l.id, "timestamp": l.timestamp, "message": l.message, "type": l.type} for l in logs],
            "signals": [{"id": s.id, "type": s.type, "title": s.title, "description": s.description, "time": s.time} for s in signals]
        })
    return res

@app.get("/api/insights")
def get_insights(db: Session = Depends(get_db), x_user_id: str = Header(None)):
    if not x_user_id: return []
    insights = db.query(models.Insight).filter(models.Insight.user_id == x_user_id).all()
    return [i.data for i in insights]

@app.get("/api/insights/{tid}")
def get_insight(tid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    insight = db.query(models.Insight).filter(models.Insight.id == tid, models.Insight.user_id == x_user_id).first()
    return insight.data if insight else None

@app.delete("/api/insights/{tid}")
def delete_insight(tid: str, db: Session = Depends(get_db), x_user_id: str = Header(None)):
    db.query(models.Insight).filter(models.Insight.id == tid, models.Insight.user_id == x_user_id).delete()
    db.commit()
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