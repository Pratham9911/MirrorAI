"use client"

import { useState, useEffect, useRef } from "react"
import { 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Globe,
  Loader2,
  TrendingDown,
  Users,
  Zap,
  AlertTriangle,
  Terminal,
  Maximize2,
  Activity
} from "lucide-react"
import { SkeletonBrowser, SkeletonSignal, SkeletonTerminal, Skeleton } from "@/components/skeleton-loader"
import { cn } from "@/lib/utils"

interface ActiveThread {
  id: string
  name: string
  status: "running" | "idle" | "paused"
  currentUrl: string
  progress: number
  logs: LogEntry[]
  signals: Signal[]
}

interface Signal {
  id: string
  type: "price" | "hiring" | "feature" | "alert"
  title: string
  description: string
  time: string
}

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: "info" | "success" | "warning" | "error"
}

function SignalCard({ signal }: { signal: Signal }) {
  const icons = {
    price: <TrendingDown className="h-4 w-4" />,
    hiring: <Users className="h-4 w-4" />,
    feature: <Zap className="h-4 w-4" />,
    alert: <AlertTriangle className="h-4 w-4" />
  }

  const colors = {
    price: "bg-warning/20 text-warning",
    hiring: "bg-info/20 text-info",
    feature: "bg-success/20 text-success",
    alert: "bg-live/20 text-live"
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all hover:border-muted-foreground/30">
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2", colors[signal.type])}>
          {icons[signal.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{signal.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{signal.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">{signal.time}</p>
        </div>
      </div>
    </div>
  )
}

export default function ActiveRunsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [runs, setRuns] = useState<ActiveThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/runs')
        const data = await res.json()
        setRuns(data)
        if (data.length > 0 && !activeThreadId) {
          setActiveThreadId(data[0].id)
        }
        setIsLoading(false)
      } catch (err) {
        console.error(err)
      }
    }

    fetchRuns()
    const interval = setInterval(fetchRuns, 2000)
    return () => clearInterval(interval)
  }, [activeThreadId])

  const activeThread = runs.find(t => t.id === activeThreadId)
  const logs = activeThread?.logs || []
  const signals = activeThread?.signals || []

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Top Section */}
        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r border-border p-4 space-y-3">
            <Skeleton className="h-6 w-32 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          
          <div className="flex-1 p-4">
            <SkeletonBrowser />
          </div>
          
          <div className="w-80 border-l border-border p-4 space-y-3">
            <Skeleton className="h-6 w-24 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonSignal key={i} />
            ))}
          </div>
        </div>
        
        <div className="h-48 border-t border-border">
          <SkeletonTerminal lines={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex flex-1 min-h-0">
        {/* Left - Thread List */}
        <div className="w-72 border-r border-border bg-card/30 flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Active Threads</h2>
            <p className="text-xs text-muted-foreground">
              {runs.filter(t => t.status === "running").length} running
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {runs.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-all",
                  activeThreadId === thread.id
                    ? "border-muted-foreground/50 bg-muted/50"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {thread.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 text-info animate-spin" />
                  ) : (
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {thread.name}
                  </span>
                </div>
                {thread.status === "running" && (
                  <div className="space-y-1.5">
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-info transition-all duration-500"
                        style={{ width: `${thread.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {thread.currentUrl}
                    </p>
                  </div>
                )}
                {thread.status === "idle" && (
                  <span className="text-xs text-muted-foreground">Completed</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center - Live Browser Preview */}
        <div className="flex-1 flex flex-col min-w-0 p-4">
          <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-1.5">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground truncate">
                  {activeThread?.currentUrl || "Loading..."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-live/20 px-2.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-live animate-pulse-live" />
                  <span className="text-xs font-medium text-live">LIVE</span>
                </div>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative bg-background overflow-hidden">
              {activeThread?.currentUrl?.includes('stream') ? (
                <iframe src={activeThread.currentUrl} className="w-full h-full border-none" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Signals Panel */}
        <div className="w-80 border-l border-border bg-card/30 flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Live Signals</h2>
            <p className="text-xs text-muted-foreground">{signals.length} detected</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
            {signals.length === 0 && (
              <div className="text-sm text-center text-muted-foreground mt-10">
                No signals yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom - Terminal Logs */}
      <div className="h-56 border-t border-border bg-card flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Live Logs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-live" />
            <span className="text-xs text-muted-foreground">Streaming</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          {logs.map((log, index) => (
            <div key={`log-${index}`} className="flex gap-4 py-0.5">
              <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
              <span className={cn(
                log.type === "success" && "text-success",
                log.type === "warning" && "text-warning",
                log.type === "error" && "text-destructive",
                log.type === "info" && "text-foreground"
              )}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>{">"}</span>
            <span className="w-2 h-4 bg-foreground animate-blink" />
          </div>
        </div>
      </div>
    </div>
  )
}
