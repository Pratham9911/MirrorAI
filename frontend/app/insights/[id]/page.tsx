"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Target,
  ExternalLink,
  Calendar,
  Building2,
  Tag,
  BarChart3,
  Shield,
  Zap,
  MessageSquare,
  Layers,
  Radio,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton, SkeletonCard } from "@/components/skeleton-loader"
import { cn } from "@/lib/utils"

interface ReportData {
  id: string
  name: string
  product: string
  description: string
  completedAt: string
  score: number
  score_rationale?: string
  tags: string[]
  strengths: string[]
  weaknesses: string[]
  signals: { type: string; title?: string; description: string; date: string }[]
  predictions: string[]
  recommendations: string[]
  sources: { name: string; url: string }[]
  // New rich fields from run()
  competitor_landscape?: { name: string; url: string; description: string; threat_level: string }[]
  competitors?: { name: string; url: string; description: string }[]
  customer_reviews_summary?: string
  market_positioning?: string
}

function getScoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 80) return { bg: "bg-success/20", text: "text-success", ring: "ring-success/30" }
  if (score >= 60) return { bg: "bg-warning/20", text: "text-warning", ring: "ring-warning/30" }
  return { bg: "bg-destructive/20", text: "text-destructive", ring: "ring-destructive/30" }
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong Position"
  if (score >= 60) return "Moderate Position"
  return "Needs Improvement"
}

function getThreatBadge(level: string) {
  const l = level?.toLowerCase()
  if (l === "high")   return "bg-destructive/20 text-destructive"
  if (l === "medium") return "bg-warning/20 text-warning"
  return "bg-success/20 text-success"
}

function SignalTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    price:   "bg-warning/20 text-warning",
    feature: "bg-success/20 text-success",
    hiring:  "bg-info/20 text-info",
    funding: "bg-purple-500/20 text-purple-400",
    alert:   "bg-destructive/20 text-destructive",
  }
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold uppercase shrink-0", map[type] ?? "bg-muted text-muted-foreground")}>
      {type}
    </span>
  )
}

export default function InsightReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)

  useEffect(() => {
    fetch(`http://localhost:8000/api/insights/${id}`)
      .then(res => res.json())
      .then(data => {
        setReport(data)
        setIsLoading(false)
      })
      .catch(e => {
        console.error(e)
        setIsLoading(false)
      })
  }, [id])

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="border-b border-border bg-card/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <div><Skeleton className="mb-2 h-7 w-64" /><Skeleton className="h-4 w-48" /></div>
          </div>
        </div>
        <div className="p-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <SkeletonCard className="h-48" /><SkeletonCard className="h-64" /><SkeletonCard className="h-64" />
            </div>
            <div className="space-y-6">
              <SkeletonCard className="h-40" /><SkeletonCard className="h-48" /><SkeletonCard className="h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!report) return null

  const scoreColors = getScoreColor(report.score)
  // Prefer competitor_landscape (new) over competitors (old)
  const competitorList = report.competitor_landscape ?? report.competitors ?? []

  return (
    <div className="bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 px-8 py-6">
        <div className="flex items-start gap-4">
          <Link href="/insights">
            <Button variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-muted mt-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{report.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />{report.product}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />{report.completedAt}
              </span>
            </div>
            {/* Score rationale */}
            {report.score_rationale && (
              <p className="mt-2 text-sm text-muted-foreground italic max-w-2xl">{report.score_rationale}</p>
            )}
          </div>
          {/* Score Badge */}
          <div className={cn("flex flex-col items-center rounded-xl p-4 ring-2 shrink-0", scoreColors.bg, scoreColors.ring)}>
            <span className={cn("text-3xl font-bold", scoreColors.text)}>{report.score}</span>
            <span className={cn("text-xs font-medium", scoreColors.text)}>{getScoreLabel(report.score)}</span>
          </div>
        </div>
      </div>

      <div className="p-8 pb-16">
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Description + Tags */}
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-muted-foreground leading-relaxed">{report.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(report.tags ?? []).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Tag className="h-3 w-3" />{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Market Positioning */}
            {report.market_positioning && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-info/20 p-2"><Layers className="h-4 w-4 text-info" /></div>
                  Market Positioning
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{report.market_positioning}</p>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-success/20 p-2"><TrendingUp className="h-4 w-4 text-success" /></div>
                  Strengths
                </h3>
                <ul className="space-y-3">
                  {(report.strengths ?? []).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-warning/20 p-2"><TrendingDown className="h-4 w-4 text-warning" /></div>
                  Weaknesses
                </h3>
                <ul className="space-y-3">
                  {(report.weaknesses ?? []).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <span className="text-foreground">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Customer Reviews Summary */}
            {report.customer_reviews_summary && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-purple-500/20 p-2"><MessageSquare className="h-4 w-4 text-purple-400" /></div>
                  Customer Sentiment
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{report.customer_reviews_summary}</p>
              </div>
            )}

            {/* Signals */}
            {(report.signals ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-info/20 p-2"><Radio className="h-4 w-4 text-info" /></div>
                  Detected Signals
                </h3>
                <div className="space-y-3">
                  {report.signals.map((signal, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <SignalTypeBadge type={signal.type} />
                        <div className="flex-1 min-w-0">
                          {signal.title && (
                            <p className="text-sm font-medium text-foreground mb-0.5">{signal.title}</p>
                          )}
                          <p className="text-sm text-muted-foreground">{signal.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{signal.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Predictions */}
            {(report.predictions ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-chart-4/20 p-2"><BarChart3 className="h-4 w-4 text-chart-4" /></div>
                  Predictions
                </h3>
                <ul className="space-y-3">
                  {report.predictions.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{i + 1}</span>
                      <span className="text-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {(report.recommendations ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-success/20 p-2"><Lightbulb className="h-4 w-4 text-success" /></div>
                  Recommendations
                </h3>
                <ul className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">

            {/* Quick Stats */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Quick Stats</h3>
              <div className="space-y-3">
                {[
                  { label: "Competitors", value: competitorList.length },
                  { label: "Signals", value: (report.signals ?? []).length },
                  { label: "Recommendations", value: (report.recommendations ?? []).length },
                  { label: "Sources", value: (report.sources ?? []).length },
                  { label: "Predictions", value: (report.predictions ?? []).length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Landscape */}
            {competitorList.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Competitor Landscape
                </h3>
                <div className="space-y-3">
                  {competitorList.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-foreground text-sm truncate mr-2">{c.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {"threat_level" in c && c.threat_level && (
                            <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", getThreatBadge(c.threat_level))}>
                              {c.threat_level}
                            </span>
                          )}
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-info hover:text-info/80">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {(report.sources ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">Sources</h3>
                <ul className="space-y-2">
                  {report.sources.map((source, i) => (
                    <li key={i}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-info hover:text-info/80 hover:underline break-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {source.name}
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
