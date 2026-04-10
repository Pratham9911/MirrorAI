import React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Authentication | MirrorAI",
  description: "Login or create an account for MirrorAI.",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      {children}
    </div>
  )
}
