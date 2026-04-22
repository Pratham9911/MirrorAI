"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Radar, Globe, ArrowLeft, Play, Square, Clock, RefreshCw,
  AlertTriangle, TrendingDown, Plus, Minus, ArrowRight,
  Zap, Eye, CheckCircle2, Activity, Loader2, FileText,
  Tag, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"

interface ChangeItem {
  type: string
  title: string
  description: string
  old_value: string | null
  new_value: string | null
  severity: "high" | "medium" | "low"
}

interface DiffInsight {
  changes_detected: boolean
  summary: string
  narrative: string
  change_items: ChangeItem[]
  generatedAt: string
}

interface RunEntry {
  timestamp: string
  data: Record<string, unknown>
  summary: any
  runNumber: number
}

interface MonitorData {
  id: string
  name: string
  config: { url: string; tags: string[]; trackWhat: string; intervalSeconds: number }
  status: "idle" | "running" | "stopped"
  runs: RunEntry[]
  insights: DiffInsight
  lastRunAt: string | null
  runCount: number
  createdAt: string
}

function getSeverityStyle(s: string) {
  if (s === "high") return { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20", dotColor: "bg-destructive" }
  if (s === "medium") return { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", dotColor: "bg-warning" }
  return { bg: "bg-info/10", text: "text-info", border: "border-info/20", dotColor: "bg-info" }
}

function getChangeIcon(type: string) {
  switch (type) {
    case "price_changed": return <TrendingDown className="h-4 w-4" />
    case "content_added": return <Plus className="h-4 w-4" />
    case "content_removed": return <Minus className="h-4 w-4" />
    case "content_updated": return <RefreshCw className="h-4 w-4" />
    case "feature_changed": return <Zap className="h-4 w-4" />
    default: return <Eye className="h-4 w-4" />
  }
}

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [monitor, setMonitor] = useState<MonitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const res = await fetch(`http://localhost:8000/api/monitors/${id}`, {
          headers: { 'X-User-ID': session.user.id }
        })
        const d = await res.json()
        if (d && !d.error) {
          setMonitor(d)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
    const iv = globalThis.setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [id])

  const handleStart = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      await fetch(`http://localhost:8000/api/monitors/${id}/start`, { 
        method: "POST",
        headers: { 'X-User-ID': session.user.id }
      })
    } catch {}
  }
  const handleStop = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      await fetch(`http://localhost:8000/api/monitors/${id}/stop`, { 
        method: "POST",
        headers: { 'X-User-ID': session.user.id }
      })
    } catch {}
  }

  if (isLoading || !monitor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading monitor...</p>
        </div>
      </div>
    )
  }

  const isRunning = monitor.status === "running"
  const runs = monitor.runs || []
  const insights = monitor.insights as DiffInsight | null
  const hasChanges = insights?.changes_detected ?? false

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/50 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/monitor" className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-xl p-2.5 border",
                isRunning ? "bg-success/10 border-success/20" : "bg-muted border-border"
              )}>
                <Radar className={cn("h-5 w-5", isRunning ? "text-success" : "text-muted-foreground")} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{monitor.name}</h1>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                    isRunning ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    {monitor.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Globe className="h-3 w-3" />
                  <span>{monitor.config.url}</span>
                  <span>·</span>
                  <span>{monitor.runCount} scans</span>
                  {monitor.lastRunAt && (
                    <>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>Last: {monitor.lastRunAt}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tags */}
            <div className="hidden md:flex items-center gap-1 mr-3">
              {monitor.config.tags?.map(tag => (
                <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            {isRunning ? (
              <Button onClick={handleStop} variant="outline" size="sm" className="gap-1.5 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10">
                <Square className="h-3.5 w-3.5" />Stop
              </Button>
            ) : (
              <Button onClick={handleStart} size="sm" className="gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90">
                <Play className="h-3.5 w-3.5" />Start
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* ─── Change Detection Panel ──────────────────────────────── */}
        {insights && (insights as DiffInsight).summary && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className={cn(
              "px-6 py-4 border-b flex items-center justify-between",
              hasChanges ? "border-warning/20 bg-warning/5" : "border-success/20 bg-success/5"
            )}>
              <div className="flex items-center gap-3">
                {hasChanges ? (
                  <div className="rounded-xl bg-warning/15 p-2.5">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                ) : (
                  <div className="rounded-xl bg-success/15 p-2.5">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {hasChanges ? "Changes Detected" : "No Changes Found"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{insights.summary}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{insights.generatedAt}
                </span>
                {hasChanges && (
                  <Link href={`/monitor/${id}/strategy`}>
                    <Button size="sm" className="gap-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-600 font-bold border-none h-8">
                      <Zap className="h-3.5 w-3.5 fill-current" />
                      View Actions
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Narrative */}
            {insights.narrative && (
              <div className="px-6 py-4 border-b border-border">
                <p className="text-sm text-foreground leading-relaxed">
                  {insights.narrative}
                </p>
              </div>
            )}

            {/* Change Items */}
            {insights.change_items && insights.change_items.length > 0 && (
              <div className="divide-y divide-border">
                {insights.change_items.map((item, i) => {
                  const sev = getSeverityStyle(item.severity)
                  return (
                    <div key={i} className="px-6 py-4 hover:bg-muted/5 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={cn("rounded-xl p-2 shrink-0", sev.bg)}>
                          <div className={sev.text}>{getChangeIcon(item.type)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground">{item.title}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", sev.bg, sev.text)}>
                              {item.severity}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>

                          {/* Old → New values */}
                          {(item.old_value || item.new_value) && (
                            <div className="flex items-center gap-2 mt-2.5">
                              {item.old_value && (
                                <div className="rounded-lg bg-destructive/8 border border-destructive/15 px-3 py-1.5">
                                  <span className="text-xs text-destructive line-through">{item.old_value}</span>
                                </div>
                              )}
                              {item.old_value && item.new_value && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              {item.new_value && (
                                <div className="rounded-lg bg-success/8 border border-success/15 px-3 py-1.5">
                                  <span className="text-xs text-success font-medium">{item.new_value}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Waiting for insights */}
        {isRunning && runs.length < 2 && (
          <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4">
            <div className="rounded-xl bg-info/10 p-3">
              <Loader2 className="h-5 w-5 text-info animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {runs.length === 0 ? "First scan in progress..." : "Waiting for second scan..."}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {runs.length === 0
                  ? "The AI agent is currently analyzing the target website."
                  : `Change detection requires 2 scans. Next scan in ~${monitor.config.intervalSeconds}s.`}
              </p>
            </div>
          </div>
        )}

        {/* ─── Scan History ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-bold text-foreground">Scan History</h2>
            <span className="text-xs text-muted-foreground">({runs.length} of 2 retained)</span>
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 flex flex-col items-center justify-center py-14">
              <Radar className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No scans yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRunning ? "First scan is in progress..." : "Start this monitor to begin scanning."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {runs.map((run, idx) => {
                const isLatest = idx === runs.length - 1
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-2xl border bg-card overflow-hidden transition-all",
                      isLatest ? "border-info/30" : "border-border"
                    )}
                  >
                    {/* Run Header */}
                    <div className={cn(
                      "px-5 py-3 border-b flex items-center justify-between",
                      isLatest ? "border-info/20 bg-info/5" : "border-border bg-muted/10"
                    )}>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                          isLatest ? "bg-info/20 text-info" : "bg-muted text-muted-foreground"
                        )}>
                          {isLatest ? "LATEST" : "PREVIOUS"}
                        </span>
                        <span className="text-xs text-muted-foreground">Scan #{run.runNumber}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />{run.timestamp}
                      </span>
                    </div>

                    {/* Data Points */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          Captured Intelligence
                        </h4>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase border border-amber-500/20">
                            {Object.keys((run as any).rival_data || {}).length} Rival Points
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase border border-emerald-500/20">
                            {Object.keys((run as any).our_data || {}).length} Product Points
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-white/5 pl-3 py-1">
                        AI-Benchmarked cycle containing technical snapshots of both domains. Expand below to view raw extraction.
                      </p>
                    </div>

                    {/* Expandable raw data */}
                    <details className="group">
                      <summary className="px-5 py-2.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors border-t border-border flex items-center gap-1 font-bold">
                        <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                        Explore Intelligence Snapshots
                      </summary>
                      <div className="px-5 pb-4 space-y-4 pt-2">
                        <div>
                          <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Rival Scan</p>
                          <pre className="text-[10px] text-muted-foreground font-mono overflow-auto max-h-48 whitespace-pre-wrap rounded-lg bg-black/30 p-3 border border-border">
                            {JSON.stringify((run as any).rival_data || (run as any).data, null, 2)?.slice(0, 3000) || "No data captured"}
                          </pre>
                        </div>
                        {(run as any).our_data && (
                          <div>
                            <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Our Scan</p>
                            <pre className="text-[10px] text-muted-foreground font-mono overflow-auto max-h-48 whitespace-pre-wrap rounded-lg bg-black/30 p-3 border border-border">
                              {JSON.stringify((run as any).our_data, null, 2)?.slice(0, 3000) || "No data captured"}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── Monitor Config Info ──────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Benchmark Strategy</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Rival URL</p>
              <p className="text-sm text-foreground truncate">{monitor.config.rivalUrl || monitor.config.url}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Our URL</p>
              <p className="text-sm text-foreground truncate">{monitor.config.ourUrl}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Frequency</p>
              <p className="text-sm text-foreground">
                {monitor.config.intervalSeconds ? `${monitor.config.intervalSeconds / 60} min` : "1 min"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Cycle Count</p>
              <p className="text-sm text-foreground">{monitor.runCount} cycles</p>
            </div>
          </div>
          {monitor.config.tags?.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {monitor.config.tags.map(tag => (
                <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
