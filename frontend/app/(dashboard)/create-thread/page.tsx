"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Plus,
  Play,
  Trash2,
  Search,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  X,
  Zap,
  AlertTriangle
} from "lucide-react"
import { Skeleton, SkeletonTable } from "@/components/skeleton-loader"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabaseClient"
import { BACKEND_URL } from "@/lib/config"

interface Thread {
  id: string
  name: string
  product: string
  status: "draft" | "running" | "completed" | "paused"
  createdAt: string
  competitorsCount: number
}

const mockThreads: Thread[] = [
  {
    id: "1",
    name: "Q1 Market Analysis",
    product: "MirrorAI Pro",
    status: "completed",
    createdAt: "2024-03-15",
    competitorsCount: 5
  },
  {
    id: "2",
    name: "Pricing Comparison Study",
    product: "Analytics Suite",
    status: "running",
    createdAt: "2024-03-18",
    competitorsCount: 8
  },
  {
    id: "3",
    name: "Feature Gap Analysis",
    product: "Dashboard Plus",
    status: "draft",
    createdAt: "2024-03-19",
    competitorsCount: 3
  },
  {
    id: "4",
    name: "Competitor Website Monitoring",
    product: "MirrorAI Pro",
    status: "running",
    createdAt: "2024-03-20",
    competitorsCount: 12
  },
  {
    id: "5",
    name: "Social Media Tracking",
    product: "Social Insights",
    status: "paused",
    createdAt: "2024-03-14",
    competitorsCount: 6
  }
]

function StatusBadge({ status }: { status: Thread["status"] }) {
  const styles = {
    draft: "bg-muted text-muted-foreground",
    running: "bg-info/20 text-info",
    completed: "bg-success/20 text-success",
    paused: "bg-warning/20 text-warning"
  }

  const icons = {
    draft: <FileText className="h-3 w-3" />,
    running: <Loader2 className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle2 className="h-3 w-3" />,
    paused: <Clock className="h-3 w-3" />
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  )
}

export default function CreateThreadPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [threads, setThreads] = useState<Thread[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [credits, setCredits] = useState<number | null>(null)
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false)

  useEffect(() => {
    async function loadThreadsAndUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        // Load Threads
        const resp = await fetch(`${BACKEND_URL}/api/threads`, {
          headers: { 
            'X-User-ID': session.user.id,
            'X-User-Email': session.user.email || ''
          }
        })
        const apiThreads = await resp.json()

        // Load User (for credits)
        const uResp = await fetch(`${BACKEND_URL}/api/user/me`, {
          headers: { 
            'X-User-ID': session.user.id,
            'X-User-Email': session.user.email || ''
          }
        })
        const uData = await uResp.json()
        setCredits(uData.credits)

        // Normalize helper
        const normalize = (t: any) => ({
          ...t,
          name: t.name || t.threadName || "Untitled",
          product: t.product || t.productName || "Unknown"
        })

        setThreads(apiThreads.map(normalize))
        setIsLoading(false)
      } catch (err) {
        console.error(err)
        setIsLoading(false)
      }
    }
    loadThreadsAndUser()
  }, [])

  const filteredThreads = threads.filter(thread => {
    const name = (thread.name || (thread as any).threadName || "").toLowerCase()
    const product = (thread.product || (thread as any).productName || "").toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || product.includes(query)
  })

  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      await fetch(`${BACKEND_URL}/api/threads/${id}`, {
        method: 'DELETE',
        headers: { 
          'X-User-ID': session.user.id,
          'X-User-Email': session.user.email || ''
        }
      })
      setThreads(prev => prev.filter(t => t.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleRun = async (id: string) => {
    // Credit Check
    if (credits !== null && credits < 0.8) {
      setShowNoCreditsModal(true)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      await fetch(`${BACKEND_URL}/api/threads/${id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': session.user.id,
          'X-User-Email': session.user.email || ''
        }
      })

      setThreads(prev => prev.map(t =>
        t.id === id ? { ...t, status: "running" as const } : t
      ))

      // Update local credits immediately
      if (credits !== null) setCredits(credits - 0.8)
    } catch (e) { console.error(e) }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="mb-6">
          <Skeleton className="h-10 w-80 rounded-xl" />
        </div>
        <SkeletonTable rows={5} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create Thread</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and create new monitoring threads for your products
          </p>
        </div>
        <Link href="/create-thread/new">
          <Button className="gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" />
            Create Thread
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Thread Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Product
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Competitors
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredThreads.map((thread) => (
              <tr
                key={thread.id}
                className="group transition-colors hover:bg-muted/20"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{thread.name}</p>
                      <p className="text-xs text-muted-foreground">Created {thread.createdAt}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-foreground">{thread.product}</span>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={thread.status} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {thread.competitorsCount} tracked
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRun(thread.id)}
                      disabled={thread.status === "running"}
                      className="gap-1.5 rounded-lg text-xs hover:bg-muted"
                    >
                      {thread.status === "running" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Run
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                        <DropdownMenuItem
                          onClick={() => handleDelete(thread.id)}
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredThreads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">No threads found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Try a different search term" : "Create your first thread to get started"}
            </p>
          </div>
        )}
      </div>

      {/* ─── No Credits Modal ────────────────────────────────────────── */}
      {showNoCreditsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={() => setShowNoCreditsModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-300">
            {/* Top Pattern */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-warning/10 to-transparent pointer-events-none" />

            <div className="relative p-10 flex flex-col items-center text-center">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-warning/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-muted border-2 border-warning/50">
                  <Zap className="h-10 w-10 text-warning fill-warning" />
                </div>
                <div className="absolute -top-2 -right-2 rounded-full bg-destructive p-1.5 shadow-lg">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-black text-foreground tracking-tight mb-3">
                Energy Depleted
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8 px-4">
                You've reached your daily intelligence limit. Your credits will automatically refill in 24 hours, or you can upgrade for a higher capacity.
              </p>

              <div className="w-full space-y-3">
                <a href="https://www.mirror-ai.in/#pricing" target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button
                    className="w-full h-14 rounded-2xl bg-foreground text-background font-bold hover:opacity-90 transition-all text-base"
                  >
                    Upgrade to Pro
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl text-muted-foreground font-medium hover:text-foreground"
                  onClick={() => setShowNoCreditsModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
