"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ChevronRight,
  FileText,
  Calendar,
  Target,
  TrendingUp,
  BarChart3
} from "lucide-react"
import { Skeleton, SkeletonInsightCard } from "@/components/skeleton-loader"

interface CompletedThread {
  id: string
  name: string
  product: string
  completedAt: string
  score: number
  competitorsAnalyzed: number
  signalsDetected: number
}

// mockCompletedThreads moved to state

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success bg-success/20"
  if (score >= 60) return "text-warning bg-warning/20"
  return "text-destructive bg-destructive/20"
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  return "Needs Attention"
}

export default function InsightsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [mockCompletedThreads, setMockCompletedThreads] = useState<any[]>([])

  useEffect(() => {
    fetch('http://localhost:8000/api/insights')
      .then(res => res.json())
      .then(data => {
        setMockCompletedThreads(data.map((r: any) => ({
          ...r,
          signalsDetected: r.signals?.length || 0,
          competitorsAnalyzed: r.competitors?.length || 0,
        })))
        setIsLoading(false)
      })
      .catch(e => {
        console.error(e)
        setIsLoading(false)
      })
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        
        {/* Stats Skeleton */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>

        <Skeleton className="mb-4 h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonInsightCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  const avgScore = mockCompletedThreads.length ? Math.round(mockCompletedThreads.reduce((acc, t) => acc + t.score, 0) / mockCompletedThreads.length) : 0
  const totalSignals = mockCompletedThreads.reduce((acc, t) => acc + t.signalsDetected, 0)
  const totalCompetitors = [...new Set(mockCompletedThreads.flatMap(t => t.competitorsAnalyzed))].length

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Insights</h1>
        <p className="mt-1 text-muted-foreground">
          View detailed reports from completed analysis threads
        </p>
      </div>

      {/* Summary Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-2xl font-semibold text-foreground">{avgScore}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Signals</p>
              <p className="text-2xl font-semibold text-foreground">{totalSignals}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Competitors Tracked</p>
              <p className="text-2xl font-semibold text-foreground">{totalCompetitors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Completed Threads */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Completed Reports</h2>
        <span className="text-sm text-muted-foreground">{mockCompletedThreads.length} reports</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockCompletedThreads.map((thread) => (
          <Link
            key={thread.id}
            href={`/insights/${thread.id}`}
            className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-muted-foreground/30 hover:bg-muted/20"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-lg bg-muted p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getScoreColor(thread.score)}`}>
                {thread.score}
              </span>
            </div>

            <h3 className="mb-1 font-semibold text-foreground group-hover:text-foreground/90">
              {thread.name}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">{thread.product}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  {thread.competitorsAnalyzed} competitors
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {thread.signalsDetected} signals
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {thread.completedAt}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                View Report
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
