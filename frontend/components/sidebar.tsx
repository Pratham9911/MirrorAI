"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  PlusCircle, 
  Activity, 
  BarChart3,
  Hexagon,
  Radar,
  LogOut,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isMobileOpen?: boolean;
  setIsMobileOpen?: (val: boolean) => void;
}

const navItems = [
  {
    name: "Overview",
    href: "/overview",
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
  {
    name: "Log Out",
    href: "/logout",
    icon: LogOut,
  },
]

export function Sidebar({ isMobileOpen, setIsMobileOpen }: SidebarProps = {}) {
  const pathname = usePathname()

  return (
    <>
      <aside className={cn(
        "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 md:translate-x-0 flex-shrink-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
              <Hexagon className="h-5 w-5 text-background" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              MirrorAI
            </span>
          </div>
          {setIsMobileOpen && (
            <button className="md:hidden p-1 rounded-md text-muted-foreground hover:bg-muted" onClick={() => setIsMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          
          return (
            <Link
              onClick={() => setIsMobileOpen?.(false)}
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
    </>
  )
}
