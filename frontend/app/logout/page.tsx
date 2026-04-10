"use client"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { LogOut } from "lucide-react"

export default function LogoutPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="w-full max-w-[320px] bg-[#121212] border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 ring-1 ring-white/5 relative overflow-hidden">
        {/* Subtle top glare/gradient for premium feel */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 mb-4 border border-red-500/20">
            <LogOut className="h-6 w-6 text-red-500 ml-1" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-white mb-1">
            Sign Out
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm px-2">
            Are you sure you want to sign out of MirrorAI?
          </CardDescription>
        </CardHeader>
        
        <CardFooter className="flex gap-3 justify-center pb-8 pt-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="flex-1 bg-[#1A1A1A] border-white/10 text-white hover:bg-[#2A2A2A] hover:text-white transition-all h-10"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleLogout}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all h-10 font-medium"
          >
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
