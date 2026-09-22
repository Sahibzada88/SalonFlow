'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Scissors,
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  LogOut,
  UserCog,
  Sparkles,
  Star
} from 'lucide-react'
import { authApi } from '@/services/api'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [userRole, setUserRole] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const role = localStorage.getItem('user_role') || ''
    setUserRole(role)
  }, [])

  const handleLogout = async () => {
    try {
      // Clears the httpOnly session cookie server-side - localStorage.clear()
      // alone no longer logs the user out, since the token isn't stored
      // there anymore.
      await authApi.logout()
    } catch (error) {
      // Proceed to clear local UI state and redirect regardless.
    }
    localStorage.clear()
    router.push('/auth/login')
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/appointments', label: 'Appointments', icon: Calendar },
    { href: '/dashboard/services', label: 'Services', icon: Sparkles },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { href: '/dashboard/feedback', label: 'Feedback', icon: Star },
  ]

  // Restored: this was previously commented out entirely ("Staff page
  // temporarily hidden for all users"), which meant owners had no way to
  // navigate to staff management from the UI at all. The backend now
  // properly restricts staff creation/deletion to owners (see the backend
  // CHANGES.md), so it's safe to surface the link again - staff members
  // themselves just won't see it.
  if (userRole === 'owner') {
    navItems.push({ href: '/dashboard/staff', label: 'Staff', icon: UserCog })
  }

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    staff: 'Staff',
    customer: 'Customer',
  }

  if (!mounted) {
    return (
      <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border p-6 flex flex-col">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl salon-gradient flex items-center justify-center">
            <Scissors className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold text-foreground">{appName}</span>
        </div>
        <div className="flex-1 space-y-2">
          {navItems.map((item) => (
            <div key={item.href} className="h-10 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="h-9 w-9 rounded-xl salon-gradient flex items-center justify-center shrink-0">
          <Scissors className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <span className="text-xl font-serif font-semibold text-foreground leading-tight truncate flex-1">{appName}</span>
        <ThemeToggle />
      </div>

      {userRole && (
        <span className="self-start text-[11px] font-medium tracking-wide uppercase bg-accent text-accent-foreground px-2.5 py-1 rounded-full mb-8 mt-3">
          {roleLabel[userRole] || userRole}
        </span>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
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

      {/* Logout */}
      <Button
        variant="ghost"
        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 mt-4 rounded-lg"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2.5" />
        Logout
      </Button>

      <p className="text-center text-[11px] text-muted-foreground mt-4">
        Powered by {appName}
      </p>
    </div>
  )
}
