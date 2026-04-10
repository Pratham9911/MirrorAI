"use client"

import { useState, useEffect } from "react"
import { 
  Activity, 
  TrendingUp, 
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Target,
  Globe,
  Radar,
  FileText,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"

export default function OverviewPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const features = [
    {
      title: "Async Run Agents",
      desc: "Trigger high-speed agents for deep research, automated data extraction, and bulk analysis without blocking your workflow.",
      icon: <Zap className="h-6 w-6 text-warning" />,
      color: "from-warning/20 to-warning/5",
      border: "border-warning/20"
    },
    {
      title: "Continuous Monitor",
      desc: "Surveil websites 24/7. Detect price changes, feature updates, and layout shifts in real-time with automated surveillance.",
      icon: <Radar className="h-6 w-6 text-info" />,
      color: "from-info/20 to-info/5",
      border: "border-info/20"
    },
    {
      title: "Intelligent Insights",
      desc: "Convert raw website data into human-readable executive summaries and strategic narratives powered by Llama 3.",
      icon: <FileText className="h-6 w-6 text-success" />,
      color: "from-success/20 to-success/5",
      border: "border-success/20"
    },
    {
      title: "Signals & Alarms",
      desc: "Get instant alerts for competitive signals. Know the moment a competitor launches a feature or changes their strategy.",
      icon: <Activity className="h-6 w-6 text-destructive" />,
      color: "from-destructive/20 to-destructive/5",
      border: "border-destructive/20"
    },
    {
      title: "Compare & Audit",
      desc: "Drill down into snapshots. Compare previous and current states to stay ahead and visualize exactly what evolved.",
      icon: <TrendingUp className="h-6 w-6 text-pink-500" />,
      color: "from-pink-500/20 to-pink-500/5",
      border: "border-pink-500/20"
    },
    {
      title: "Strategic Edge",
      desc: "Maintain a perpetual pulse on your market. Use automated intelligence to out-maneuver and out-pace competition.",
      icon: <Target className="h-6 w-6 text-foreground" />,
      color: "from-foreground/10 to-foreground/5",
      border: "border-border"
    }
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          MirrorAI Dashboard
        </h1>
        {user && (
          <div className="flex items-center gap-2 mt-1 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-success"></span>
            <p className="text-sm font-medium text-[#E5A1CD]">
              Connected as {user.user_metadata?.full_name || user.email}
            </p>
          </div>
        )}
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          The ultimate surveillance architecture. Deploy agents, monitor targets, and extract competitive signals with zero latency.
        </p>
      </div>

      {/* ─── Live Stats ─────────────────────────────────────────────── */}
      <div className="mb-12 grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 group transition-all hover:bg-muted/30">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Monitors</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-foreground">12</h3>
            <Activity className="h-5 w-5 text-success animate-pulse-live" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 group transition-all hover:bg-muted/30">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Signals Caught</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-foreground">847</h3>
            <Zap className="h-5 w-5 text-warning" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 group transition-all hover:bg-muted/30">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Scans</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-foreground">3,291</h3>
            <Globe className="h-5 w-5 text-info" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 group transition-all hover:bg-muted/30">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">System Status</p>
          <div className="flex items-end justify-between">
            <h3 className="text-lg font-bold text-success uppercase">Optimal</h3>
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
        </div>
      </div>

      {/* ─── Main Features Grid ──────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-2 px-1">
        <Target className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground tracking-tight">Intelligence Capabilities</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={i}
            className={cn(
              "relative group rounded-3xl border p-8 overflow-hidden transition-all duration-500 hover:scale-[1.02]",
              f.border,
              "bg-card"
            )}
          >
            {/* Ambient Background Gradient */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
              f.color
            )} />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="rounded-2xl bg-muted/50 w-fit p-3.5 mb-6 group-hover:scale-110 transition-transform duration-500">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
              
              <div className="mt-auto pt-8 flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Execute Capability <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Recent signals indicator ───────────────────────────────── */}
      <div className="mt-12 rounded-3xl border border-divider-20 bg-muted/10 p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-full h-12 w-12 bg-success/10 border border-success/20 flex items-center justify-center">
             <Activity className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-bold text-foreground">Perpetual Pulse Active</p>
            <p className="text-sm text-muted-foreground">MirrorAI is scanning 24 targets in the background.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
             <div className="h-8 w-8 rounded-full bg-border border-2 border-background" />
             <div className="h-8 w-8 rounded-full bg-muted border-2 border-background" />
             <div className="h-8 w-8 rounded-full bg-muted-foreground/30 border-2 border-background" />
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">8 Agents Online</span>
        </div>
      </div>
    </div>
  )
}
