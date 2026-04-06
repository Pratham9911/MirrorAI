"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Radar, Globe, Play, Square, Trash2, Clock, Plus,
  Activity, Loader2, AlertTriangle, CheckCircle2,
  Search, Tag, MoreHorizontal, Zap, Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const availableTags = [
  "Pricing", "Features", "Marketing", "Product",
  "Team", "Technology", "Funding", "News"
]

interface MonitorSession {
  id: string
  name: string
  config: { url: string; tags: string[]; trackWhat: string; intervalSeconds: number }
  status: "idle" | "running" | "stopped"
  runs: any[]
  insights: any
  lastRunAt: string | null
  runCount: number
  createdAt: string
}

export default function MonitorDashboard() {
  const [monitors, setMonitors] = useState<MonitorSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [trackWhat, setTrackWhat] = useState("")
  const [interval, setIntervalVal] = useState(60)
  const [isCreating, setIsCreating] = useState(false)

  // Poll — localStorage is source of truth for configs, backend is source for live data
  useEffect(() => {
    const load = async () => {
      // 1. Load saved configs from localStorage
      const saved = localStorage.getItem('mirror_monitors')
      const localMonitors: MonitorSession[] = saved ? JSON.parse(saved) : []

      try {
        // 2. Fetch live data from backend
        const res = await fetch("http://localhost:8000/api/monitors")
        const apiMonitors: MonitorSession[] = await res.json()
        const apiIds = new Set(apiMonitors.map(m => m.id))

        // 3. Re-register any local monitors that backend doesn't know about (server restarted)
        for (const lm of localMonitors) {
          if (!apiIds.has(lm.id)) {
            try {
              await fetch("http://localhost:8000/api/monitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...lm.config, name: lm.name, id: lm.id })
              })
            } catch {}
          }
        }

        // 4. Merge: use local configs as base, overlay live backend data
        // Also include any monitors that exist on backend but not locally
        const merged = localMonitors.map(lm => {
          const apiMatch = apiMonitors.find(am => am.id === lm.id)
          if (apiMatch) {
            return { ...lm, status: apiMatch.status, runs: apiMatch.runs, insights: apiMatch.insights, lastRunAt: apiMatch.lastRunAt, runCount: apiMatch.runCount }
          }
          return lm
        })

        // Add backend-only monitors (created this session, already in API but not localStorage yet)
        for (const am of apiMonitors) {
          if (!localMonitors.find(lm => lm.id === am.id)) {
            merged.push(am)
          }
        }

        setMonitors(merged)
        localStorage.setItem('mirror_monitors', JSON.stringify(merged))
      } catch {
        // Backend down — show local data  
        setMonitors(localMonitors)
      }
      setIsLoading(false)
    }
    load()
    const iv = globalThis.setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch("http://localhost:8000/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, tags, trackWhat, intervalSeconds: interval })
      })
      const newMon = await res.json()

      // Save to localStorage
      const saved = localStorage.getItem('mirror_monitors')
      const existing = saved ? JSON.parse(saved) : []
      localStorage.setItem('mirror_monitors', JSON.stringify([...existing, newMon]))

      setShowCreate(false)
      setName(""); setUrl(""); setTags([]); setTrackWhat(""); setIntervalVal(60)
    } catch (e) { console.error(e) }
    setIsCreating(false)
  }

  const handleStart = async (id: string) => {
    await fetch(`http://localhost:8000/api/monitors/${id}/start`, { method: "POST" }).catch(() => {})
    // Update status in localStorage
    const saved = localStorage.getItem('mirror_monitors')
    if (saved) {
      const list = JSON.parse(saved)
      localStorage.setItem('mirror_monitors', JSON.stringify(list.map((m: any) => m.id === id ? { ...m, status: "running" } : m)))
    }
  }

  const handleStop = async (id: string) => {
    await fetch(`http://localhost:8000/api/monitors/${id}/stop`, { method: "POST" }).catch(() => {})
    const saved = localStorage.getItem('mirror_monitors')
    if (saved) {
      const list = JSON.parse(saved)
      localStorage.setItem('mirror_monitors', JSON.stringify(list.map((m: any) => m.id === id ? { ...m, status: "stopped" } : m)))
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`http://localhost:8000/api/monitors/${id}`, { method: "DELETE" }).catch(() => {})
    setMonitors(prev => prev.filter(m => m.id !== id))
    // Remove from localStorage
    const saved = localStorage.getItem('mirror_monitors')
    if (saved) {
      const list = JSON.parse(saved)
      localStorage.setItem('mirror_monitors', JSON.stringify(list.filter((m: any) => m.id !== id)))
    }
  }

  const activeCount = monitors.filter(m => m.status === "running").length
  const totalScans = monitors.reduce((a, m) => a + m.runCount, 0)
  const changesDetected = monitors.filter(m => m.insights?.changes_detected).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-info/20 to-success/20 p-3.5 border border-info/20">
            <Radar className="h-7 w-7 text-info" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Auto Monitor</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Continuous website surveillance with AI-powered change detection
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          New Monitor
        </Button>
      </div>

      {/* ─── Stats Bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-success/10 p-2">
            <Activity className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Monitors</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-info/10 p-2">
            <Eye className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalScans}</p>
            <p className="text-xs text-muted-foreground">Total Scans</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-warning/10 p-2">
            <Zap className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{changesDetected}</p>
            <p className="text-xs text-muted-foreground">Changes Found</p>
          </div>
        </div>
      </div>

      {/* ─── Create Panel (expandable) ───────────────────────────────── */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-info/20 bg-card overflow-hidden animate-in slide-in-from-top-2 duration-300">
          <div className="px-5 py-3 border-b border-border bg-info/5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-info" />
            <span className="text-sm font-semibold text-foreground">Create New Monitor</span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Session Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Stripe Pricing Watch"
                className="h-10 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none transition-all"
              />
            </div>
            {/* URL */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Website URL</label>
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/pricing"
                className="h-10 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none transition-all"
              />
            </div>
            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Tag className="h-3 w-3" />Focus Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map(tag => (
                  <button
                    key={tag} type="button"
                    onClick={() => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                      tags.includes(tag)
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {/* Track What + Interval */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Search className="h-3 w-3" />What to Track
                </label>
                <input
                  value={trackWhat} onChange={e => setTrackWhat(e.target.value)}
                  placeholder="pricing, hero section, feature list"
                  className="h-10 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />Interval
                </label>
                <select
                  value={interval} onChange={e => setIntervalVal(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:border-muted-foreground focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value={60} className="bg-background">Every 1 minute</option>
                  <option value={300} className="bg-background">Every 5 minutes</option>
                  <option value={600} className="bg-background">Every 10 minutes</option>
                  <option value={1800} className="bg-background">Every 30 minutes</option>
                </select>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !url.trim() || isCreating}
              className="gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Monitor
            </Button>
          </div>
        </div>
      )}

      {/* ─── Monitor Sessions List ───────────────────────────────────── */}
      {monitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-muted/50 p-5 mb-5">
            <Radar className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">No Monitors Created</p>
          <p className="text-sm text-muted-foreground max-w-md text-center mb-5">
            Set up your first auto monitor to start tracking website changes in real-time with AI-powered insights.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> Create Your First Monitor
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map(mon => {
            const isRunning = mon.status === "running"
            const hasChanges = mon.insights?.changes_detected

            return (
              <div
                key={mon.id}
                className={cn(
                  "rounded-xl border bg-card overflow-hidden transition-all hover:border-muted-foreground/30",
                  isRunning ? "border-success/30" : "border-border",
                  hasChanges && "border-warning/30"
                )}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Status indicator */}
                  <div className={cn(
                    "h-3 w-3 rounded-full shrink-0",
                    isRunning ? "bg-success animate-pulse-live"
                      : mon.status === "stopped" ? "bg-muted-foreground/40"
                      : "bg-info/40"
                  )} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link
                        href={`/monitor/${mon.id}`}
                        className="text-sm font-semibold text-foreground hover:underline truncate"
                      >
                        {mon.name}
                      </Link>
                      <span className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0",
                        isRunning ? "bg-success/15 text-success"
                          : mon.status === "stopped" ? "bg-muted text-muted-foreground"
                          : "bg-info/15 text-info"
                      )}>
                        {mon.status}
                      </span>
                      {hasChanges && (
                        <span className="rounded-md bg-warning/15 text-warning px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />Changes
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Globe className="h-3 w-3 shrink-0" />{mon.config.url}
                      </span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">{mon.runCount} scans</span>
                      {mon.lastRunAt && (
                        <>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{mon.lastRunAt}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Inline insight summary */}
                    {mon.insights?.summary && (
                      <p className={cn(
                        "text-xs mt-1.5 line-clamp-1",
                        hasChanges ? "text-warning" : "text-muted-foreground"
                      )}>
                        {hasChanges ? "⚡ " : "✓ "}{mon.insights.summary}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="hidden lg:flex items-center gap-1 shrink-0">
                    {mon.config.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {mon.config.tags?.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{mon.config.tags.length - 3}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/monitor/${mon.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 rounded-lg text-xs hover:bg-muted h-8">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
                    {isRunning ? (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleStop(mon.id)}
                        className="gap-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 h-8"
                      >
                        <Square className="h-3.5 w-3.5" />Stop
                      </Button>
                    ) : (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleStart(mon.id)}
                        className="gap-1 rounded-lg text-xs text-success hover:bg-success/10 h-8"
                      >
                        <Play className="h-3.5 w-3.5" />Start
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 bg-card border-border">
                        <DropdownMenuItem
                          onClick={() => handleDelete(mon.id)}
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
