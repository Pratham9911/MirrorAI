import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="ml-64 flex-1 h-full overflow-y-auto">
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </main>
    </div>
  )
}
