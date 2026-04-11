"use client"

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Menu } from 'lucide-react'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden relative shadow-[inset_0_0_0_1px_transparent]">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      
      <main className="md:ml-64 flex-1 h-full overflow-y-auto flex flex-col">
        {/* Mobile Header */}
        <div className="flex md:hidden h-16 shrink-0 items-center border-b border-border bg-card px-4 gap-4 sticky top-0 z-20">
          <button 
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-foreground">MirrorAI</span>
        </div>
        
        <ProtectedRoute>
          <div className="flex-1">
            {children}
          </div>
        </ProtectedRoute>
      </main>
    </div>
  )
}
