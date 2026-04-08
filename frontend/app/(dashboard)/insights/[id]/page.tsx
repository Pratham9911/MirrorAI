"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Lightbulb, Target, ExternalLink, Calendar, Building2, Tag,
  BarChart3, Shield, Zap, MessageSquare, Layers, Users,
  DollarSign, GitCompare, Star, AlertOctagon, FlameKindling, Quote,
  Database, ChevronDown, ChevronRight as ChevronRightIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton, SkeletonCard } from "@/components/skeleton-loader"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Recommendation {
  action?: string
  priority?: string
  rationale?: string
}

interface ReportData {
  id: string; name: string; product: string; description: string
  completedAt: string; score: number; tags: string[]
  score_breakdown?: { product_strength: number; market_gap: number; competitor_threat: number; data_certainty: number; rationale: string }
  executive_summary?: string
  strengths: string[]; weaknesses: string[]
  competitor_landscape?: { name: string; url: string; description: string; threat_level: string; key_differentiator?: string; pricing_summary?: string }[]
  competitors?: { name: string; url: string; description: string }[]
  pricing_comparison?: { company: string; plan: string; price: string; highlights: string }[]
  feature_matrix?: { feature: string; our_product: string; competitors_status: string }[]
  customer_reviews?: { company: string; sentiment: string; quote: string; source: string }[]
  customer_reviews_summary?: string
  market_positioning?: string
  risk_assessment?: { risk: string; severity: string; mitigation: string }[]
  predictions: string[]
  recommendations: (string | Recommendation)[]
  sources: { name: string; url: string }[]
  agent_data?: Record<string, any>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 75) return { bg: "bg-success/20", text: "text-success", ring: "ring-success/30", bar: "bg-success" }
  if (score >= 50) return { bg: "bg-warning/20", text: "text-warning", ring: "ring-warning/30", bar: "bg-warning" }
  return { bg: "bg-destructive/20", text: "text-destructive", ring: "ring-destructive/30", bar: "bg-destructive" }
}
function getScoreLabel(s: number) {
  if (s >= 75) return "Strong Position"
  if (s >= 50) return "Moderate Position"
  if (s >= 30) return "Weak Position"
  return "Critical Gap"
}
function getThreatBadge(level: string) {
  const l = level?.toLowerCase()
  if (l === "high" || l === "critical") return "bg-destructive/20 text-destructive"
  if (l === "medium") return "bg-warning/20 text-warning"
  return "bg-success/20 text-success"
}
function SectionCard({ icon, iconBg, title, subtitle, children }: { icon: React.ReactNode; iconBg: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <div className={cn("rounded-lg p-2", iconBg)}>{icon}</div>
          {title}
        </h3>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground ml-10">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Raw Agent Data Renderer ──────────────────────────────────────────────────
// Recursively renders any key/value JSON from the agent beautifully
function AgentValueRenderer({ value, depth = 0 }: { value: any; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)

  if (value === null || value === undefined) return <span className="text-muted-foreground/50 italic text-xs">null</span>

  if (typeof value === "boolean") return (
    <span className={cn("text-xs font-semibold", value ? "text-success" : "text-destructive")}>
      {value ? "Yes" : "No"}
    </span>
  )

  if (typeof value === "number") return <span className="text-info font-mono text-sm">{value}</span>

  if (typeof value === "string") {
    // Detect URLs
    if (value.startsWith("http")) return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-info hover:underline text-sm break-all flex items-center gap-1">
        <ExternalLink className="h-3 w-3 shrink-0" />{value}
      </a>
    )
    return <span className="text-foreground text-sm leading-relaxed">{value}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground/50 italic text-xs">empty</span>
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              {typeof item === "object" && item !== null
                ? <AgentObjectCard value={item} depth={depth + 1} />
                : <AgentValueRenderer value={item} depth={depth + 1} />
              }
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    return <AgentObjectCard value={value} depth={depth} />
  }

  return <span className="text-foreground text-sm">{String(value)}</span>
}

function AgentObjectCard({ value, depth = 0 }: { value: Record<string, any>; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 0)
  const entries = Object.entries(value)
  if (entries.length === 0) return <span className="text-muted-foreground/50 italic text-xs">empty object</span>

  const label = (value.name || value.title || value.company || value.feature || "") as string

  return (
    <div className={cn("rounded-lg border border-border/50 bg-muted/20", depth === 0 ? "" : "")}>
      {depth > 0 && label && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/40 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="truncate">{label}</span>
        </button>
      )}
      {!collapsed && (
        <div className={cn("space-y-2", depth > 0 ? "px-3 pb-3" : "")}>
          {entries.map(([k, v]) => (
            <div key={k} className={cn("grid gap-1", typeof v === "object" && v !== null ? "grid-cols-1" : "grid-cols-[140px_1fr] items-start gap-3")}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-0.5 break-all">
                {k.replace(/_/g, " ")}
              </span>
              <div className="min-w-0">
                <AgentValueRenderer value={v} depth={depth + 1} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentDataSection({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return null

  return (
    <SectionCard icon={<Database className="h-4 w-4 text-purple-400" />} iconBg="bg-purple-500/20" title="Raw Agent Data" subtitle="Exactly what the browser agent extracted — unfiltered">
      <div className="space-y-4">
        {entries.map(([key, val]) => {
          const isComplex = typeof val === "object" && val !== null
          return (
            <div key={key} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/50 bg-muted/40">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {key.replace(/_/g, " ")}
                </span>
              </div>
              <div className="p-4">
                <AgentValueRenderer value={val} depth={0} />
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsightReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)

  useEffect(() => {
    async function loadData() {
      const saved = localStorage.getItem('mirror_insights')
      if (saved) {
        const insights = JSON.parse(saved)
        const found = insights.find((i: any) => i.id === id)
        if (found) { setReport(found); setIsLoading(false); return }
      }
      try {
        const res = await fetch(`http://localhost:8000/api/insights/${id}`)
        if (res.ok) { const data = await res.json(); setReport(data) }
      } catch (e) {
        console.error("Failed to load insight:", e)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id])

  if (isLoading) return (
    <div className="bg-background">
      <div className="border-b border-border bg-card/50 px-8 py-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <div><Skeleton className="mb-2 h-7 w-64" /><Skeleton className="h-4 w-48" /></div>
        </div>
      </div>
      <div className="p-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {[200, 160, 280, 240, 200, 260].map((h, i) => <SkeletonCard key={i} className={`h-${h}`} />)}
        </div>
        <div className="space-y-6">
          {[160, 200, 240, 180].map((h, i) => <SkeletonCard key={i} className={`h-${h}`} />)}
        </div>
      </div>
    </div>
  )
  if (!report) return null

  const sc = getScoreColor(report.score)
  const competitorList = report.competitor_landscape ?? report.competitors ?? []
  const sb = report.score_breakdown

  return (
    <div className="bg-background">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md px-8 py-5">
        <div className="flex items-start gap-4">
          <Link href="/insights">
            <Button variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-muted mt-0.5">
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{report.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{report.product}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{report.completedAt}</span>
            </div>
          </div>
          <div className={cn("flex flex-col items-center rounded-xl px-5 py-3 ring-2 shrink-0", sc.bg, sc.ring)}>
            <span className={cn("text-4xl font-bold tabular-nums", sc.text)}>{report.score}</span>
            <span className={cn("text-xs font-medium mt-0.5", sc.text)}>{getScoreLabel(report.score)}</span>
          </div>
        </div>
      </div>

      <div className="p-8 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ════ MAIN COLUMN ════════════════════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. Executive Summary */}
            {report.executive_summary && (
              <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mirror Verdict</h3>
                <p className="text-base leading-relaxed text-foreground font-medium">{report.executive_summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(report.tags ?? []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Tag className="h-3 w-3" />{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Score Breakdown */}
            {sb && (
              <SectionCard icon={<BarChart3 className="h-4 w-4 text-info" />} iconBg="bg-info/20" title="Score Breakdown">
                <div className="space-y-4">
                  {[
                    { label: "Product Strength", key: "product_strength", max: 25 },
                    { label: "Market Gap Opportunity", key: "market_gap", max: 25 },
                    { label: "Competitor Threat", key: "competitor_threat", max: 25 },
                    { label: "Data Certainty", key: "data_certainty", max: 25 },
                  ].map(({ label, key, max }) => {
                    const val = (sb as any)[key] ?? 0
                    const pct = Math.round((val / max) * 100)
                    const color = pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive"
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold text-foreground">{val} / {max}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  {sb.rationale && (
                    <p className="mt-2 text-sm text-muted-foreground italic border-t border-border pt-3">{sb.rationale}</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* 3. Strengths & Weaknesses */}
            <div className="grid gap-6 md:grid-cols-2">
              <SectionCard
                icon={<TrendingUp className="h-4 w-4 text-success" />}
                iconBg="bg-success/20"
                title="Our Strengths"
                subtitle="Where our product has the advantage"
              >
                <ul className="space-y-3">
                  {(report.strengths ?? []).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{s}</span>
                    </li>
                  ))}
                  {(report.strengths ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground italic">Not enough data to determine strengths.</li>
                  )}
                </ul>
              </SectionCard>
              <SectionCard
                icon={<TrendingDown className="h-4 w-4 text-warning" />}
                iconBg="bg-warning/20"
                title="Competitor Edges"
                subtitle="Where competitors are currently ahead of us"
              >
                <ul className="space-y-3">
                  {(report.weaknesses ?? []).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <span className="text-foreground">{w}</span>
                    </li>
                  ))}
                  {(report.weaknesses ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground italic">No competitor edges identified.</li>
                  )}
                </ul>
              </SectionCard>
            </div>

            {/* 4. Raw Agent Data — the real extracted output */}
            {report.agent_data && Object.keys(report.agent_data).length > 0 && (
              <AgentDataSection data={report.agent_data} />
            )}

            {/* 5. Market Positioning */}
            {report.market_positioning && (
              <SectionCard icon={<Layers className="h-4 w-4 text-info" />} iconBg="bg-info/20" title="Market Positioning">
                <p className="text-sm text-foreground leading-relaxed">{report.market_positioning}</p>
              </SectionCard>
            )}

            {/* 6. Pricing Comparison */}
            {(report.pricing_comparison ?? []).length > 0 && (
              <SectionCard icon={<DollarSign className="h-4 w-4 text-warning" />} iconBg="bg-warning/20" title="Pricing Comparison">
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Company</th>
                        <th className="text-left py-2 px-3 font-medium">Plan</th>
                        <th className="text-left py-2 px-3 font-medium">Price</th>
                        <th className="text-left py-2 px-3 font-medium">Key Highlights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.pricing_comparison!.map((row, i) => (
                        <tr key={i} className={cn(
                          "border-b border-border/50 transition-colors hover:bg-muted/20",
                          row.company.toLowerCase().includes(report.product.toLowerCase()) && "bg-info/5"
                        )}>
                          <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">
                            {row.company}
                            {row.company.toLowerCase().includes(report.product.toLowerCase()) && (
                              <span className="ml-2 text-xs bg-info/20 text-info px-1.5 py-0.5 rounded-md">You</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{row.plan}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-foreground whitespace-nowrap">{row.price}</td>
                          <td className="py-3 px-3 text-muted-foreground text-xs">{row.highlights}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* 7. Feature Matrix */}
            {(report.feature_matrix ?? []).length > 0 && (
              <SectionCard icon={<GitCompare className="h-4 w-4 text-purple-400" />} iconBg="bg-purple-500/20" title="Feature Matrix">
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Feature</th>
                        <th className="text-center py-2 px-3 font-medium">{report.product}</th>
                        <th className="text-left py-2 px-3 font-medium">Competitors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.feature_matrix!.map((row, i) => {
                        const status = row.our_product?.toLowerCase()
                        const badge =
                          status === "yes" ? "bg-success/20 text-success" :
                          status === "partial" ? "bg-warning/20 text-warning" :
                          status === "no" ? "bg-destructive/20 text-destructive" :
                          "bg-muted text-muted-foreground"
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="py-3 px-3 font-medium text-foreground">{row.feature}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", badge)}>
                                {row.our_product}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">{row.competitors_status}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* 8. Customer Reviews */}
            {(report.customer_reviews ?? []).length > 0 && (
              <SectionCard icon={<Quote className="h-4 w-4 text-purple-400" />} iconBg="bg-purple-500/20" title="Customer Voice">
                <div className="space-y-4">
                  {report.customer_reviews!.map((review, i) => {
                    const sentColor =
                      review.sentiment === "Positive" ? "text-success" :
                      review.sentiment === "Negative" ? "text-destructive" : "text-warning"
                    return (
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{review.company}</span>
                            <span className={cn("text-xs font-medium", sentColor)}>· {review.sentiment}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{review.source}</span>
                        </div>
                        <p className="text-sm text-muted-foreground italic leading-relaxed">"{review.quote}"</p>
                      </div>
                    )
                  })}
                </div>
                {report.customer_reviews_summary && (
                  <p className="mt-4 text-sm text-foreground border-t border-border pt-4 leading-relaxed">
                    {report.customer_reviews_summary}
                  </p>
                )}
              </SectionCard>
            )}

            {/* 9. Risk Assessment */}
            {(report.risk_assessment ?? []).length > 0 && (
              <SectionCard icon={<AlertOctagon className="h-4 w-4 text-destructive" />} iconBg="bg-destructive/20" title="Risk Assessment">
                <div className="space-y-3">
                  {report.risk_assessment!.map((r, i) => {
                    const sev = r.severity?.toLowerCase()
                    const sColor = sev === "critical" ? "bg-destructive/20 text-destructive" : sev === "high" ? "bg-destructive/10 text-destructive" : sev === "medium" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                    return (
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-foreground">{r.risk}</p>
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold uppercase shrink-0", sColor)}>{r.severity}</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-success" />
                          {r.mitigation}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}

            {/* 10. Predictions */}
            {(report.predictions ?? []).length > 0 && (
              <SectionCard icon={<FlameKindling className="h-4 w-4 text-orange-400" />} iconBg="bg-orange-500/20" title="Predictions">
                <ul className="space-y-3">
                  {report.predictions.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-semibold text-orange-400">{i + 1}</span>
                      <span className="text-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 11. Recommendations */}
            {(report.recommendations ?? []).length > 0 && (
              <SectionCard icon={<Lightbulb className="h-4 w-4 text-success" />} iconBg="bg-success/20" title="Recommendations">
                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => {
                    if (typeof rec === "string") {
                      return (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span className="text-foreground">{rec}</span>
                        </div>
                      )
                    }
                    const r = rec as Recommendation
                    const pri = r.priority?.toLowerCase()
                    const priColor = pri === "high" ? "bg-destructive/20 text-destructive" : pri === "medium" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                    return (
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <Lightbulb className="h-4 w-4 shrink-0 text-success mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{r.action}</p>
                              {r.priority && <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold uppercase shrink-0", priColor)}>{r.priority}</span>}
                            </div>
                            {r.rationale && <p className="mt-1 text-xs text-muted-foreground">{r.rationale}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}
          </div>

          {/* ════ SIDEBAR ════════════════════════════════════════════════════ */}
          <div className="space-y-6">

            {/* Quick Stats */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">At a Glance</h3>
              <div className="space-y-3">
                {[
                  { label: "Mirror Score", value: `${report.score} / 100` },
                  { label: "Competitors", value: competitorList.length },
                  { label: "Risks Identified", value: (report.risk_assessment ?? []).length },
                  { label: "Recommendations", value: (report.recommendations ?? []).length },
                  { label: "Predictions", value: (report.predictions ?? []).length },
                  { label: "Sources", value: (report.sources ?? []).length },
                  { label: "Reviews Found", value: (report.customer_reviews ?? []).length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Landscape */}
            {competitorList.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Users className="h-5 w-5 text-muted-foreground" />Competitor Landscape
                </h3>
                <div className="space-y-3">
                  {competitorList.map((comp, i) => {
                    const c = comp as { name: string; url: string; description: string; threat_level?: string; key_differentiator?: string; pricing_summary?: string }
                    return (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="font-medium text-foreground text-sm truncate flex-1">{c.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.threat_level && (
                            <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", getThreatBadge(c.threat_level))}>
                              {c.threat_level}
                            </span>
                          )}
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-info hover:text-info/80">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-1">{c.description}</p>
                      {c.key_differentiator && (
                        <p className="text-xs text-warning mt-1.5 flex items-start gap-1">
                          <Zap className="h-3 w-3 shrink-0 mt-0.5" />
                          {c.key_differentiator}
                        </p>
                      )}
                      {c.pricing_summary && c.pricing_summary !== "Not found" && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                          <DollarSign className="h-3 w-3 shrink-0 mt-0.5" />
                          {c.pricing_summary}
                        </p>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sources */}
            {(report.sources ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Sources</h3>
                <ul className="space-y-2">
                  {report.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-info hover:text-info/80 hover:underline break-all">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />{s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
