"use client"

import { useState, useEffect } from "react"
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Zap,
  Target,
  Globe
} from "lucide-react"
import { Skeleton, SkeletonCard } from "@/components/skeleton-loader"

interface StatCardProps {
  title: string
  value: string
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: React.ReactNode
}

function StatCard({ title, value, change, changeType = "neutral", icon }: StatCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-muted-foreground/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {change && (
            <p className={`mt-2 flex items-center gap-1 text-sm ${
              changeType === "positive" ? "text-success" : 
              changeType === "negative" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {changeType === "positive" && <ArrowUpRight className="h-4 w-4" />}
              {change}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-muted p-3 text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          {icon}
        </div>
      </div>
    </div>
  )
}

interface ActivityItemProps {
  title: string
  description: string
  time: string
  status: "running" | "completed" | "alert"
}

function ActivityItem({ title, description, time, status }: ActivityItemProps) {
  const statusIcons = {
    running: <Activity className="h-4 w-4 text-info animate-pulse" />,
    completed: <CheckCircle2 className="h-4 w-4 text-success" />,
    alert: <AlertCircle className="h-4 w-4 text-warning" />
  }

  return (
    <div className="flex items-start gap-4 rounded-lg p-4 transition-colors hover:bg-muted/30">
      <div className="mt-0.5 rounded-lg bg-muted p-2">
        {statusIcons[status]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  )
}

export default function OverviewPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonCard className="h-[400px]" />
          </div>
          <SkeletonCard className="h-[400px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Real-time monitoring of your AI agents and competitive intelligence
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Threads"
          value="12"
          change="+3 from yesterday"
          changeType="positive"
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Signals Detected"
          value="847"
          change="+12% this week"
          changeType="positive"
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          title="Competitors Tracked"
          value="24"
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          title="Pages Analyzed"
          value="3,291"
          change="+156 today"
          changeType="positive"
          icon={<Globe className="h-5 w-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Latest actions from your AI agents</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-live" />
              Live
            </div>
          </div>
          <div className="divide-y divide-border">
            <ActivityItem
              title="Competitor Analysis: Acme Corp"
              description="Scanning pricing page for changes"
              time="2m ago"
              status="running"
            />
            <ActivityItem
              title="Market Signal: TechStart Inc"
              description="Detected new feature announcement"
              time="8m ago"
              status="alert"
            />
            <ActivityItem
              title="Thread Complete: Q1 Report"
              description="Generated competitive landscape report"
              time="15m ago"
              status="completed"
            />
            <ActivityItem
              title="Data Extraction: Rival Co"
              description="Extracted team page information"
              time="23m ago"
              status="completed"
            />
            <ActivityItem
              title="Monitoring: StartupXYZ"
              description="Checking blog for new posts"
              time="31m ago"
              status="running"
            />
          </div>
        </div>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* System Health */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold text-foreground">System Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Status</span>
                <span className="flex items-center gap-2 text-sm text-success">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Agents Online</span>
                <span className="text-sm font-medium text-foreground">8/8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Response</span>
                <span className="text-sm font-medium text-foreground">124ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <span className="text-sm font-medium text-foreground">99.98%</span>
              </div>
            </div>
          </div>

          {/* Top Signals */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Top Signals</h3>
              <span className="text-xs text-muted-foreground">Last 24h</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <div className="rounded-md bg-warning/20 p-2">
                  <TrendingUp className="h-4 w-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Price Change</p>
                  <p className="text-xs text-muted-foreground">Acme Corp lowered prices</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <div className="rounded-md bg-info/20 p-2">
                  <Clock className="h-4 w-4 text-info" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Hiring Surge</p>
                  <p className="text-xs text-muted-foreground">TechStart added 12 roles</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <div className="rounded-md bg-success/20 p-2">
                  <Zap className="h-4 w-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Feature Launch</p>
                  <p className="text-xs text-muted-foreground">Rival Co announced API v2</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
