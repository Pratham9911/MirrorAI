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
  Zap
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
  tags: string[]
  strengths: string[]
  weaknesses: string[]
  signals: { type: string; description: string; date: string }[]
  predictions: string[]
  recommendations: string[]
  sources: { name: string; url: string }[]
  competitors: { name: string; url: string; description: string }[]
}

// Mock reports migrated to API based approach
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
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <div>
              <Skeleton className="mb-2 h-7 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <SkeletonCard className="h-48" />
              <SkeletonCard className="h-64" />
              <SkeletonCard className="h-64" />
            </div>
            <div className="space-y-6">
              <SkeletonCard className="h-40" />
              <SkeletonCard className="h-48" />
              <SkeletonCard className="h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!report) return null

  const scoreColors = getScoreColor(report.score)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/insights">
            <Button variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{report.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {report.product}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {report.completedAt}
              </span>
            </div>
          </div>
          {/* Score Badge */}
          <div className={cn(
            "flex flex-col items-center rounded-xl p-4 ring-2",
            scoreColors.bg,
            scoreColors.ring
          )}>
            <span className={cn("text-3xl font-bold", scoreColors.text)}>{report.score}</span>
            <span className={cn("text-xs font-medium", scoreColors.text)}>{getScoreLabel(report.score)}</span>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-muted-foreground leading-relaxed">{report.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Strengths & Weaknesses Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Strengths */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-success/20 p-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  Strengths
                </h3>
                <ul className="space-y-3">
                  {report.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <div className="rounded-lg bg-warning/20 p-2">
                    <TrendingDown className="h-4 w-4 text-warning" />
                  </div>
                  Weaknesses
                </h3>
                <ul className="space-y-3">
                  {report.weaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <span className="text-foreground">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Signals */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded-lg bg-info/20 p-2">
                  <Zap className="h-4 w-4 text-info" />
                </div>
                Detected Signals
              </h3>
              <div className="space-y-3">
                {report.signals.map((signal, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium uppercase",
                        signal.type === "price" && "bg-warning/20 text-warning",
                        signal.type === "feature" && "bg-success/20 text-success",
                        signal.type === "hiring" && "bg-info/20 text-info",
                        signal.type === "funding" && "bg-chart-4/20 text-chart-4"
                      )}>
                        {signal.type}
                      </div>
                      <span className="text-sm text-foreground">{signal.description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{signal.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictions */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded-lg bg-chart-4/20 p-2">
                  <BarChart3 className="h-4 w-4 text-chart-4" />
                </div>
                Predictions
              </h3>
              <ul className="space-y-3">
                {report.predictions.map((prediction, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{prediction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded-lg bg-success/20 p-2">
                  <Lightbulb className="h-4 w-4 text-success" />
                </div>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Competitors Analyzed */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                <Target className="h-5 w-5 text-muted-foreground" />
                Competitors Analyzed
              </h3>
              <div className="space-y-3">
                {report.competitors.map((competitor, i) => (
                  <div 
                    key={i}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground text-sm">{competitor.name}</span>
                      <a 
                        href={competitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-info hover:text-info/80"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">{competitor.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Sources</h3>
              <ul className="space-y-2">
                {report.sources.map((source, i) => (
                  <li key={i}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-info hover:text-info/80 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Stats */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Competitors</span>
                  <span className="font-medium text-foreground">{report.competitors.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Signals</span>
                  <span className="font-medium text-foreground">{report.signals.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Recommendations</span>
                  <span className="font-medium text-foreground">{report.recommendations.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sources</span>
                  <span className="font-medium text-foreground">{report.sources.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
