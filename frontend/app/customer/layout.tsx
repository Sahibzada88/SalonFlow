'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, Home, LogOut, Scissors, CalendarPlus, Receipt, Star } from 'lucide-react'
import { api, authApi } from '@/services/api'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // See app/dashboard/layout.tsx - no client-side token pre-check
        // anymore; the cookie isn't readable from JS, so /auth/me's 401
        // (caught below) is what drives the redirect now.
        const response = await api.get('/auth/me')
        const userData = response.data

        if (userData.role !== 'customer') {
          localStorage.setItem('user_role', userData.role)
          router.push('/dashboard')
          return
        }

        localStorage.setItem('user_role', 'customer')
        setLoading(false)
      } catch (error) {
        localStorage.clear()
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    try {
      // Clears the httpOnly session cookie server-side - the frontend has
      // no way to delete it directly.
      await authApi.logout()
    } catch (error) {
      // Even if this call fails (e.g. network hiccup), still clear local
      // UI state and send the user to login below.
    }
    localStorage.clear()
    router.push('/auth/login')
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'

  const navItems = [
    { href: '/customer/dashboard', label: 'Dashboard', icon: Home },
    { href: '/customer/appointments', label: 'My Appointments', icon: Calendar },
    { href: '/customer/book', label: 'Book Appointment', icon: CalendarPlus },
    { href: '/customer/invoices', label: 'My Invoices', icon: Receipt },
    { href: '/customer/feedback', label: 'My Feedback', icon: Star },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="h-10 w-10 rounded-xl salon-gradient flex items-center justify-center animate-pulse">
          <Scissors className="h-5 w-5 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border p-6 flex flex-col">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-9 w-9 rounded-xl salon-gradient flex items-center justify-center shrink-0">
            <Scissors className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold text-foreground">{appName}</span>
        </div>
        <span className="self-start text-[11px] font-medium tracking-wide uppercase bg-accent text-accent-foreground px-2.5 py-1 rounded-full mb-8 mt-3">
          Customer
        </span>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start rounded-lg ${isActive ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="h-4 w-4 mr-2.5" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2.5" />
          Logout
        </Button>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Powered by {appName}
        </p>
      </div>
      <div className="ml-64 flex-1 p-8">
        {children}
      </div>
    </div>
  )
}
