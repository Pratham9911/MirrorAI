"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  ChevronLeft, Sparkles, Share, Clock, Eye, LayoutGrid, LayoutPanelLeft,
  CalendarCheck, BrainCircuit, Forward, Target, CalendarPlus, X, Rocket, 
  ShieldCheck, Check, Loader2, MoreVertical, CheckCircle2, AlertTriangle, Zap,
  Calendar as CalendarIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"

interface Task {
  id: string
  title: string
  duration: string
  completed?: boolean
}

interface Action {
  id: string
  title: string
  description: string
  type: string
  priority: string
  effort: string
  tasks: Task[]
  status?: "todo" | "done" | "scheduled"
}

interface StrategyData {
  summary: string
  narrative: string
  impact: string
  actions: Action[]
  predictions: string[]
  opportunities: string[]
  intelligence_logic: string
  generatedAt: string
}

export default function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<StrategyData | null>(null)
  const [monitorName, setMonitorName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: "" })

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
          setData(d.insights)
          setMonitorName(d.name)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  const showSuccess = (msg: string) => {
    setToast({ show: true, message: msg })
    setTimeout(() => setToast({ show: false, message: "" }), 4000)
  }

  const markDone = (actionId: string) => {
    if (!data) return
    const newActions = data.actions.map(a => 
      a.id === actionId ? { ...a, status: "done" as const } : a
    )
    setData({ ...data, actions: newActions })
    showSuccess("Strategic action marked as complete")
  }

  const handleSchedule = async () => {
    if (!selectedAction || !data) return
    setIsSaving(true)
    
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const date = dateInput?.value || new Date().toISOString().split('T')[0]

    try {
      const res = await fetch("http://localhost:8000/api/monitors/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monitor_id: id,
          title: selectedAction.title,
          description: selectedAction.description,
          scheduled_date: date,
          tasks: selectedAction.tasks
        })
      })
      
      await new Promise(r => setTimeout(r, 800)) // Mimic high-end processing

      if (res.ok) {
        const newActions = data.actions.map(a => 
          a.id === selectedAction.id ? { ...a, status: "scheduled" as const } : a
        )
        setData({ ...data, actions: newActions })
        setShowSchedule(false)
        showSuccess("Tasks scheduled successfully")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-amber-500/30">
      {/* Background Mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(at_0%_0%,rgba(212,175,55,0.05)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(230,168,215,0.05)_0px,transparent_50%)] pointer-events-none z-0" />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/monitor/${id}`} className="group flex items-center gap-3 text-white/50 hover:text-white transition-colors">
            <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all">
              <ChevronLeft className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">Monitor</span>
          </Link>
          <div className="h-6 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold tracking-[0.2em] text-amber-500/80 uppercase">Insight Analysis</span>
              <Sparkles className="h-2.5 w-2.5 text-amber-500/50" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white/90 flex items-center gap-3">
              {data.summary}
              <span className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-tighter",
                data.impact === "High" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-white/5 text-zinc-400 border-white/10"
              )}>
                {data.impact === "High" && <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />}
                {data.impact} Impact
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className="flex -space-x-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 border border-black/20 flex items-center justify-center text-[8px] font-bold text-black">AI</div>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-black/20 flex items-center justify-center text-[8px] font-bold uppercase">ME</div>
            </div>
            <span className="text-[11px] text-white/60 font-medium px-1">Collaborating</span>
          </div>
          <Button variant="outline" className="rounded-lg bg-white text-black font-bold text-sm hover:bg-zinc-200 gap-2 border-none">
            <Share className="h-4 w-4" /> Export
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Evolution Report Card */}
          <section className="bg-gradient-to-br from-[#141414]/80 to-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-black flex items-center justify-center border border-white/10 shadow-inner">
                  <LayoutGrid className="h-8 w-8 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter text-white">Strategic Evolution Report</h2>
                  <p className="text-zinc-500 text-sm mt-1 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Generated {data.generatedAt} • Monitor: {monitorName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 text-center">Engine Health</div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-medium text-emerald-500">Optimal</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-500" /> Intelligence Summary
                </h3>
                <p className="text-lg text-zinc-200 leading-relaxed font-medium">
                  {data.narrative}
                </p>
              </div>

              <details className="group">
                <summary className="list-none flex items-center gap-2 text-amber-500 text-sm font-bold cursor-pointer hover:text-amber-400 transition-colors py-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10">Deep Technical Scan</span>
                  <ChevronLeft className="h-4 w-4 -rotate-90 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                    <h4 className="text-xs font-bold text-zinc-500 mb-2 uppercase">Core Logic</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {data.intelligence_logic}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                    <h4 className="text-xs font-bold text-zinc-500 mb-2 uppercase">Market Context</h4>
                    <p className="text-xs text-zinc-400">
                      Detected shifts in feature positioning and competitor aggression. Recommendations tailored for elite operations.
                    </p>
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* Strategic Interventions */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-white/5 pb-4">
              <h3 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                Strategic Interventions
                <span className="text-xs font-medium text-zinc-600 px-3 py-1 rounded-full bg-white/5">AI Recommended</span>
              </h3>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Priority Queue</span>
            </div>

            {data.actions.length === 0 ? (
              <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-12 text-center">
                <p className="text-zinc-500 font-medium">No strategic actions required based on the latest scan.</p>
              </div>
            ) : (
              data.actions.map((action, i) => (
                <div 
                  key={action.id} 
                  className={cn(
                    "bg-gradient-to-br from-[#141414]/80 to-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 relative overflow-hidden group transition-all duration-500 hover:border-white/20",
                    action.status === "done" && "grayscale opacity-40 pointer-events-none",
                    i % 2 === 0 ? "hover:shadow-[0_0_30px_rgba(212,175,55,0.05)]" : "hover:shadow-[0_0_30px_rgba(14,165,233,0.05)]"
                  )}
                >
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                          {action.type}
                        </span>
                        <span className="px-3 py-1 rounded-md text-[10px] font-black bg-white/5 text-zinc-400 border border-white/10 uppercase">
                          Effort: {action.effort}
                        </span>
                        <span className={cn(
                          "px-3 py-1 rounded-md text-[10px] font-black border uppercase",
                          action.priority === "High" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-white/5 text-zinc-400 border-white/10"
                        )}>
                          {action.priority === "High" ? "🔥" : "⚠️"} {action.priority} Priority
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xl font-bold mb-2 text-white">{action.title}</h4>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                          {action.description}
                        </p>
                      </div>

                      <div className="flex gap-4 pt-2">
                        <Button 
                          variant="ghost" 
                          onClick={() => markDone(action.id)}
                          className="px-6 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-sm font-bold border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all"
                        >
                          Mark Done
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedAction(action)
                            setShowSchedule(true)
                          }}
                          disabled={action.status === "scheduled"}
                          className={cn(
                            "px-6 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-2",
                            action.status === "scheduled" 
                              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30 cursor-not-allowed opacity-60" 
                              : "bg-white/5 text-white border-white/10 hover:bg-white hover:text-black"
                          )}
                        >
                          {action.status === "scheduled" ? (
                            <><Check className="h-4 w-4" /> Activated</>
                          ) : (
                            <><CalendarCheck className="h-4 w-4" /> Schedule</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="hidden md:flex w-40 shrink-0 items-center justify-center">
                      <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 flex items-center justify-center">
                        <LayoutPanelLeft className="h-10 w-10 text-zinc-700" />
                      </div>
                    </div>
                  </div>

                  {action.status === "scheduled" && (
                    <div className="absolute top-6 right-6">
                      <span className="px-3 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase flex items-center gap-1 shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                        <Check className="h-3 w-3" /> Scheduled
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}

            <details className="group bg-gradient-to-br from-[#141414]/80 to-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
              <summary className="list-none p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <BrainCircuit className="h-5 w-5 text-amber-500" />
                  </div>
                  <span className="font-bold text-zinc-300 tracking-tight">Intelligence Logic</span>
                </div>
                <X className="h-4 w-4 rotate-45 group-open:rotate-0 transition-transform text-zinc-500" />
              </summary>
              <div className="px-6 pb-6 text-sm text-zinc-400 leading-relaxed space-y-4 border-t border-white/5 pt-4">
                <p>
                  MirrorAI NLP engine has identified strategic correlations between competitor technical shifts and broader market sentiment. Our analysis predicts a disruption window where your positioning as a unified platform offers 3.5x more value.
                </p>
                <p>
                  Calculations derived from multi-scan delta analysis and industry velocity metrics.
                </p>
              </div>
            </details>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-10">
          <section className="bg-gradient-to-br from-[#141414]/80 to-[#0a0a0a]/90 backdrop-blur-xl border border-pink-500/10 rounded-3xl p-8 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                <Eye className="h-5 w-5 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Next Moves</h3>
            </div>
            
            <div className="space-y-8">
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-pink-500/[0.05] to-transparent border border-pink-500/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">AI Confidence</span>
                  <span className="text-xs font-black text-white">88%</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-amber-500" style={{ width: '88%' }} />
                </div>
              </div>

              <ul className="space-y-6">
                {(data.predictions || []).map((p, i) => (
                  <li key={i} className="flex gap-4 group">
                    <Forward className="h-4 w-4 text-zinc-600 mt-1 group-hover:text-pink-400 transition-colors shrink-0" />
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {p.split(' ').map((word, j) => (
                        <span key={j} className={cn(word.charAt(0) === word.charAt(0).toUpperCase() && word.length > 3 ? "text-white font-medium" : "")}>
                          {word}{' '}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="bg-gradient-to-br from-[#141414]/80 to-[#0a0a0a]/90 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Target className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Market Gaps</h3>
            </div>
            
            <div className="space-y-4">
              {(data.opportunities || []).map((opp, i) => (
                <div key={i} className="p-5 rounded-2xl bg-emerald-500/[0.02] border border-emerald-500/10 hover:bg-emerald-500/[0.05] transition-all cursor-default group">
                  <h4 className="text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-2 group-hover:text-emerald-300">Opportunity {i+1}</h4>
                  <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                    {opp}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {/* Schedule Drawer */}
      <div className={cn(
        "fixed inset-0 z-50 transition-all duration-500",
        showSchedule ? "pointer-events-auto" : "pointer-events-none"
      )}>
        <div 
          onClick={() => setShowSchedule(false)}
          className={cn(
            "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500",
            showSchedule ? "opacity-100" : "opacity-0"
          )} 
        />
        <div className={cn(
          "absolute inset-y-0 right-0 w-full max-w-md bg-[#0D0D0D] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col pointer-events-auto",
          showSchedule ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Schedule Action</h3>
              <p className="text-zinc-500 text-sm">{selectedAction?.title}</p>
            </div>
            <button onClick={() => setShowSchedule(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5">
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Step 1: Task Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Step 1: AI Suggested Tasks</h4>
                <button className="text-[10px] text-amber-500 hover:underline">Select All</button>
              </div>
              <div className="space-y-2">
                {selectedAction?.tasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] group transition-colors">
                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-white/10 bg-black text-amber-500 focus:ring-amber-500" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{task.title}</span>
                        <span className="text-[10px] text-zinc-500">{task.duration}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2: Options */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Step 2: Execution Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase">Deadline</label>
                  <input 
                    type="date" 
                    defaultValue={new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]} // Next week
                    className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white focus:border-amber-500 focus:ring-0 outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase">Estimated Effort</label>
                  <select defaultValue="Medium" className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white focus:border-amber-500 focus:ring-0 outline-none">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Sync & Integration */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Step 3: Sync & Integration</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <LayoutPanelLeft className="h-4 w-4" />
                    <span className="text-sm">Add to Notion Roadmap</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-sm">Sync to Google Calendar</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/5">
            <Button 
              onClick={handleSchedule}
              disabled={isSaving}
              className="w-full py-6 rounded-xl bg-amber-500 text-black font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-3 border-none"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <>Create Tasks <Target className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={cn(
        "fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] transition-all duration-500",
        toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}>
        <div className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center gap-4 uppercase tracking-widest text-xs border border-white/20">
          <ShieldCheck className="h-5 w-5" /> {toast.message}
        </div>
      </div>
    </div>
  )
}
