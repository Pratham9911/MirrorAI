"use client"

import { useEffect, useRef, useState } from "react"

type Run = {
  id: string
  status: string
  streaming_url?: string | null
  thread?: any
}

export default function TestRunPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [browserUrl, setBrowserUrl] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  // 🔥 1. CREATE TEST RUN
  const startRun = async () => {
    const res = await fetch("http://localhost:8000/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-thread",
        name: "Test Thread",
        competitors: [
          { url: "https://example.com" } // change if needed
        ]
      })
    })

    const data = await res.json()
    console.log("RUN CREATED:", data)

    setActiveRunId(data.run_id)
    setLogs([])
    setBrowserUrl(null)
  }

  // 🔥 2. FETCH ACTIVE RUNS
  useEffect(() => {
    const fetchRuns = async () => {
      const res = await fetch("http://localhost:8000/runs/active")
      const data = await res.json()
      setRuns(data)
    }

    fetchRuns()
    const interval = setInterval(fetchRuns, 3000)

    return () => clearInterval(interval)
  }, [])

  // 🔥 3. CONNECT SSE (ONLY ONCE PER RUN)
  useEffect(() => {
    if (!activeRunId) return

    if (eventSourceRef.current) return // ✅ prevent multiple calls

    console.log("🔥 CONNECTING STREAM:", activeRunId)

    const es = new EventSource(
      `http://localhost:8000/run/${activeRunId}/stream`
    )

    eventSourceRef.current = es

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)

      console.log("EVENT:", data)

      if (data.type === "log") {
        setLogs(prev => [...prev, data.message])
      }

      if (data.type === "browser") {
        setBrowserUrl(data.url)
      }

      if (data.type === "done") {
        console.log("✅ RUN COMPLETED")

        es.close()
        eventSourceRef.current = null
      }
    }

    es.onerror = () => {
      console.log("❌ SSE ERROR")
      es.close()
      eventSourceRef.current = null
    }

  }, [activeRunId])

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h1>🔥 Test Agent Runner</h1>

      {/* START BUTTON */}
      <button
        onClick={startRun}
        style={{
          padding: "10px 20px",
          marginBottom: 20,
          background: "black",
          color: "white",
          borderRadius: 6
        }}
      >
        ▶ Start Test Run
      </button>

      {/* ACTIVE RUNS */}
      <div style={{ marginBottom: 20 }}>
        <h3>Active Runs</h3>
        {runs.map(run => (
          <div key={run.id}>
            {run.id} — {run.status}
          </div>
        ))}
      </div>

      {/* BROWSER PREVIEW */}
      <div style={{ marginBottom: 20 }}>
        <h3>Browser Preview</h3>
        {browserUrl ? (
          <iframe
            src={browserUrl}
            style={{
              width: "100%",
              height: "400px",
              border: "1px solid #ccc"
            }}
          />
        ) : (
          <p>Waiting for browser...</p>
        )}
      </div>

      {/* LOGS */}
      <div>
        <h3>Logs</h3>
        <div
          style={{
            height: 200,
            overflow: "auto",
            background: "#111",
            color: "#0f0",
            padding: 10
          }}
        >
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}