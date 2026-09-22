'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Scissors } from 'lucide-react'
import { api } from '@/services/api'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // NOTE: previously checked localStorage.getItem('access_token')
        // before even trying this request - now that the session lives in
        // an httpOnly cookie, JS can't read it to pre-check. Calling
        // /auth/me directly and handling the 401 in the catch block below
        // achieves the same result (redirect to login when not signed in).
        const response = await api.get('/auth/me')
        const userData = response.data

        // If customer, redirect to customer dashboard
        if (userData.role === 'customer') {
          localStorage.setItem('user_role', 'customer')
          router.push('/customer/dashboard')
          return
        }

        // Ensure correct role is set
        localStorage.setItem('user_role', userData.role || 'owner')
        setLoading(false)
      } catch (error) {
        localStorage.clear()
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="h-10 w-10 rounded-xl salon-gradient flex items-center justify-center animate-pulse">
          <Scissors className="h-5 w-5 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Loading your salon...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
