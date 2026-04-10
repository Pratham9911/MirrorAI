"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login")
      } else {
        setIsAuthorized(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        setIsAuthorized(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-[#E5A1CD] border-r-transparent border-b-transparent border-l-transparent"></div>
      </div>
    )
  }

  return <>{children}</>
}
