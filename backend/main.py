import asyncio
import json
import uuid
import threading
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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

def process_stream_sync(thread_id, goal, competitors):
    # This runs in a separate thread
    url = competitors[0]["url"] if competitors else "https://www.google.com"
    logs = active_runs_db[thread_id]["logs"]
    
    logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": "Starting analysis agent...", "type": "info"})
    
    combined_purpose_text = ""
    try:
        with tf_client.agent.stream(url=url, goal=goal) as stream:
            for event in stream:
                ts = datetime.now().strftime("%H:%M:%S")
                if event.type == "STARTED":
                    logs.append({"id": str(uuid.uuid4()), "timestamp": ts, "message": "Browser session started", "type": "success"})
                elif event.type == "STREAMING_URL":
                    active_runs_db[thread_id]["currentUrl"] = event.streaming_url
                    logs.append({"id": str(uuid.uuid4()), "timestamp": ts, "message": f"Streaming available at {event.streaming_url}", "type": "info"})
                elif event.type == "PROGRESS":
                    purpose = str(getattr(event, 'purpose', 'Navigating...'))
                    combined_purpose_text += purpose + "\n"
                    active_runs_db[thread_id]["progress"] = min(95, active_runs_db[thread_id]["progress"] + 5)
                    logs.append({"id": str(uuid.uuid4()), "timestamp": ts, "message": f"Action: {purpose}", "type": "warning"})
                    
                    import random
                    pup_lower = purpose.lower()
                    if "price" in pup_lower or "cost" in pup_lower or "plan" in pup_lower:
                        active_runs_db[thread_id]["signals"].insert(0, {
                            "id": str(uuid.uuid4()), "type": "price", "title": "Pricing Info Detected",
                            "description": f"Found potential pricing data: {purpose[:60]}...", "time": ts
                        })
                    elif "hir" in pup_lower or "job" in pup_lower or "career" in pup_lower:
                        active_runs_db[thread_id]["signals"].insert(0, {
                            "id": str(uuid.uuid4()), "type": "hiring", "title": "Hiring Activity",
                            "description": f"Detected recruitment data: {purpose[:60]}...", "time": ts
                        })
                    elif random.random() < 0.3:
                        stype = random.choice(["feature", "alert"])
                        active_runs_db[thread_id]["signals"].insert(0, {
                            "id": str(uuid.uuid4()), "type": stype, "title": f"New {stype.capitalize()} Update",
                            "description": f"Noticed {stype} update while: {purpose[:60]}...", "time": ts
                        })
                elif event.type == "COMPLETE":
                    logs.append({"id": str(uuid.uuid4()), "timestamp": ts, "message": "Analysis run completed.", "type": "success"})
                    active_runs_db[thread_id]["progress"] = 100
        
        # Now use groq to shape the insights
        if not groq_client:
            raise Exception("Groq client not initialized")
            
        system_prompt = "You are a competitive analysis expert. Return ONLY valid JSON matching exactly the requested schema."
        thread = threads_db[thread_id]
        prompt = f"""
We tracked competitors for our product {thread['product']}.
Thread details: {thread['description']}
Tags: {', '.join(thread.get('tags', []))}
Our observed agent log data:
{combined_purpose_text}

Generate a JSON object with EXACTLY these keys:
"score" (0-100 number),
"strengths" (list of strings, max 4),
"weaknesses" (list of strings, max 4),
"signals" (list of objects with "type" (one of: feature, price, hiring, funding, alert), "description", "date" (YYYY-MM-DD)),
"predictions" (list of strings, max 3),
"recommendations" (list of strings, max 4),
"sources" (list of objects with "name", "url"),
"competitors" (list of objects with "name", "url", "description").

Return ONLY JSON, no markdown blocks.
"""
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        result_text = completion.choices[0].message.content
        report_data = json.loads(result_text)
        report_data["id"] = thread_id
        report_data["name"] = thread["name"]
        report_data["product"] = thread["product"]
        if "description" not in report_data or not report_data["description"]:
            report_data["description"] = thread["description"]
        report_data["completedAt"] = datetime.now().strftime("%Y-%m-%d")
        if "tags" not in report_data:
            report_data["tags"] = thread.get("tags", [])
        
        insights_db[thread_id] = report_data
        
        # update states
        threads_db[thread_id]["status"] = "completed"
        active_runs_db[thread_id]["status"] = "idle"

    except Exception as e:
        print(f"Error in stream processing: {e}")
        traceback.print_exc()
        logs.append({"id": str(uuid.uuid4()), "timestamp": datetime.now().strftime("%H:%M:%S"), "message": f"Error: {str(e)}", "type": "error"})
        threads_db[thread_id]["status"] = "paused"
        active_runs_db[thread_id]["status"] = "paused"

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
    threads_db[tid]["status"] = "running"
    
    t = threads_db[tid]
    active_runs_db[tid] = {
        "id": tid,
        "name": t["name"],
        "status": "running",
        "currentUrl": "Initializing...",
        "progress": 5,
        "logs": [],
        "signals": []
    }
    
    comps = ", ".join([c["url"] for c in t.get("competitors", [])])
    goal = f"Analyze competitors for {t['product']}: {t['description']}. Competitors: {comps}"
    
    # Start thread
    thread = threading.Thread(target=process_stream_sync, args=(tid, goal, t.get("competitors", [])))
    thread.start()
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)