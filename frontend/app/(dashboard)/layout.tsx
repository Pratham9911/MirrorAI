import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="ml-64 flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
