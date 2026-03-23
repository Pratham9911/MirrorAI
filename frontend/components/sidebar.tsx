"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  PlusCircle, 
  Activity, 
  BarChart3,
  Hexagon,
  Radar
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Create Thread",
    href: "/create-thread",
    icon: PlusCircle,
  },
  {
    name: "Active Runs",
    href: "/active-runs",
    icon: Activity,
  },
  {
    name: "Insights",
    href: "/insights",
    icon: BarChart3,
  },
  {
    name: "Monitor",
    href: "/monitor",
    icon: Radar,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
          <Hexagon className="h-5 w-5 text-background" strokeWidth={2.5} />
        </div>
        <span className="text-xl font-semibold tracking-tight text-foreground">
          Cortex
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon 
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} 
              />
              {item.name}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            AI
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">System Status</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-live" />
              Operational
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
