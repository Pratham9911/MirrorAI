"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { MailCheck } from "lucide-react"

interface AuthFormProps extends React.ComponentPropsWithoutRef<"div"> {
  isRegister?: boolean
}

export function AuthForm({ className, isRegister = false, ...props }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Redirect if already logged in
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/overview")
      }
    })
  }, [router])

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        // Show success confirmation screen
        setIsSubmitted(true)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push("/overview")
      }
    } catch (error: any) {
      setErrorMsg(error.message || "An error occurred during authentication.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/overview`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      setErrorMsg(error.message || "An error occurred with Google login.")
    }
  }

  if (isSubmitted) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-6 w-full max-w-sm px-4 animate-in fade-in zoom-in-95 duration-500", className)} {...props}>
        <Card className="w-full border-white/10 bg-[#121212] shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-2">
              <MailCheck className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              Check your email
            </CardTitle>
            <CardDescription className="text-muted-foreground text-center px-4">
              We've sent a verification link to <span className="text-white font-medium">{email}</span>. Please verify your email to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button 
              type="button" 
              onClick={() => router.push("/login")}
              className="w-full bg-white hover:bg-zinc-200 text-black font-semibold"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 w-full max-w-sm px-4 animate-in fade-in duration-500", className)} {...props}>
      <Link href="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
        <Image src="/icon.png" alt="MirrorAI" width={32} height={32} className="rounded-md" />
        <span className="font-semibold text-xl tracking-tight text-white">MirrorAI</span>
      </Link>
      
      <Card className="w-full border-white/5 bg-[#121212] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        
        <CardHeader className="text-center space-y-2 pt-8">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {isRegister ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isRegister ? "Enter your details to sign up" : "Login with your Google account or email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 pl-8 pr-8">
          <form onSubmit={handleEmailAuth}>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full bg-[#1A1A1A] border border-white/20 text-white hover:bg-[#2A2A2A] hover:border-white/40 transition-all shadow-sm h-11" 
                  onClick={handleGoogleLogin}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-3 h-5 w-5">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {isRegister ? "Sign up with Google" : "Login with Google"}
                </Button>
              </div>
              
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-white/10">
                <span className="relative z-10 bg-[#121212] px-2 text-muted-foreground text-xs uppercase tracking-widest">Or continue with</span>
              </div>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-zinc-300 font-medium text-sm ml-0.5">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="m@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="bg-[#1A1A1A] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#E5A1CD] focus-visible:border-transparent h-11 transition-all"
                  />
                </div>
                
                <div className="grid gap-2">
                  <div className="flex items-center justify-between ml-0.5">
                    <Label htmlFor="password" className="text-zinc-300 font-medium text-sm">Password</Label>
                    {!isRegister && (
                      <Link href="#" className="text-xs text-muted-foreground underline-offset-4 hover:text-[#E5A1CD] transition-colors">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    className="bg-[#1A1A1A] border-white/10 text-white focus-visible:ring-[#E5A1CD] focus-visible:border-transparent h-11 transition-all"
                  />
                </div>
                
                {errorMsg && (
                  <div className="text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-in fade-in zoom-in-95">
                    {errorMsg}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#E5A1CD] hover:bg-[#d48cbb] hover:shadow-[0_0_20px_rgba(229,161,205,0.3)] text-black font-bold h-11 mt-4 transition-all"
                >
                  {loading ? "Please wait..." : (isRegister ? "Sign Up" : "Login")}
                </Button>
              </div>
              
              <div className="text-center text-sm text-muted-foreground mt-2">
                {isRegister ? "Already have an account? " : "Don't have an account? "}
                <Link 
                  href={isRegister ? "/login" : "/register"} 
                  className="text-white hover:text-[#E5A1CD] font-medium transition-colors"
                >
                  {isRegister ? "Log in" : "Sign up"}
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <div className="text-balance text-center text-xs text-muted-foreground max-w-[250px]">
        By clicking continue, you agree to our <br/>
        <Link href="#" className="underline underline-offset-4 hover:text-white transition-colors">Terms of Service</Link> and <Link href="#" className="underline underline-offset-4 hover:text-white transition-colors">Privacy Policy</Link>.
      </div>
    </div>
  )
}
