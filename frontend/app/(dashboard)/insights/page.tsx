"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ChevronRight,
  FileText,
  Calendar,
  Target,
  TrendingUp,
  BarChart3,
  Trash2,
  X
} from "lucide-react"
import { Skeleton, SkeletonInsightCard } from "@/components/skeleton-loader"
import { supabase } from "@/lib/supabaseClient"

interface CompletedThread {
  id: string
  name: string
  product: string
  completedAt: string
  score: number
  competitorsAnalyzed: number
  signalsDetected: number
}

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
  const [threads, setThreads] = useState<any[]>([])
  // Track which card is in "confirm delete" mode
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadInsights() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const res = await fetch('http://localhost:8000/api/insights', {
          headers: { 'X-User-ID': session.user.id }
        })
        const apiInsights = await res.json()
        
        setThreads(apiInsights.map((r: any) => ({
          ...r,
          reviewsFound: (r.customer_reviews ?? []).length,
          competitorsAnalyzed: (r.competitor_landscape ?? r.competitors ?? []).length,
        })))
        setIsLoading(false)
      } catch (err) {
        console.error(err)
        setIsLoading(false)
      }
    }
    loadInsights()
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      await fetch(`http://localhost:8000/api/insights/${id}`, { 
        method: "DELETE",
        headers: { 'X-User-ID': session.user.id }
      })
      
      setThreads(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const avgScore = threads.length
    ? Math.round(threads.reduce((acc, t) => acc + t.score, 0) / threads.length)
    : 0
  const totalReviews = threads.reduce((acc, t) => acc + (t.reviewsFound || 0), 0)
  const totalCompetitors = threads.reduce((acc, t) => acc + (t.competitorsAnalyzed || 0), 0)

  if (isLoading) {
    return (
      <div className="bg-background p-8">
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
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

  return (
    <div className="bg-background p-8">
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
              <p className="text-sm text-muted-foreground">Reviews Found</p>
              <p className="text-2xl font-semibold text-foreground">{totalReviews}</p>
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

      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Completed Reports</h2>
        <span className="text-sm text-muted-foreground">{threads.length} reports</span>
      </div>

      {threads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No completed reports yet.</p>
          <Link
            href="/create-thread"
            className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start a Thread
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {threads.map((thread) => {
          const isConfirming = confirmDeleteId === thread.id
          const isDeleting = deletingId === thread.id

          return (
            <div
              key={thread.id}
              className="group relative rounded-xl border border-border bg-card transition-all hover:border-muted-foreground/30 hover:bg-muted/20"
            >
              {/* Delete button – top-right corner */}
              {!isConfirming ? (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setConfirmDeleteId(thread.id)
                  }}
                  className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                  title="Delete insight"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                /* Inline confirm strip */
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-card/95 backdrop-blur-sm">
                  <p className="text-sm font-medium text-foreground">Delete this report?</p>
                  <p className="text-xs text-muted-foreground">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(thread.id)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Card content – wrapped in Link */}
              <Link href={`/insights/${thread.id}`} className="block p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getScoreColor(thread.score)}`}>
                      {thread.score}
                    </span>
                    <span className="text-xs text-muted-foreground">{getScoreLabel(thread.score)}</span>
                  </div>
                </div>

                <h3 className="mb-1 font-semibold text-foreground group-hover:text-foreground/90 truncate">
                  {thread.name}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground truncate">{thread.product}</p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />
                      {thread.competitorsAnalyzed} competitors
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {thread.reviewsFound || 0} reviews
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
            </div>
          )
        })}
      </div>

      {/* Bottom padding so last row isn't flush against bottom */}
      <div className="h-8" />
    </div>
  )
}
