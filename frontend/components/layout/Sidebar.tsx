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
  UserCog
} from 'lucide-react'

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [userRole, setUserRole] = useState('')
  const [mounted, setMounted] = useState(false)

  // ✅ Only run on client side
  useEffect(() => {
    setMounted(true)
    const role = localStorage.getItem('user_role') || ''
    setUserRole(role)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_id')
    router.push('/auth/login')
  }

  // ✅ Get salon name from environment
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'
  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || ''

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/appointments', label: 'Appointments', icon: Calendar },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  ]

  if (userRole === 'owner') {
    navItems.push({ href: '/dashboard/staff', label: 'Staff', icon: UserCog })
  }

  // ✅ Show loading state before mounted
  if (!mounted) {
    return (
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <Scissors className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">{appName}</span>
        </div>
        <div className="flex-1 space-y-2">
          {navItems.map((item) => (
            <div key={item.href} className="h-10 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Scissors className="h-8 w-8 text-blue-600" />
        <div className="flex flex-col">
          <span className="text-xl font-bold text-gray-900">{appName}</span>
          {salonName && (
            <span className="text-xs text-gray-400">{salonName}</span>
          )}
        </div>
        {userRole && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
            {userRole}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}>
              <Button 
                variant={isActive ? 'default' : 'ghost'} 
                className={`w-full justify-start ${isActive ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-gray-100'}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <Button 
        variant="ghost" 
        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 mt-4"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>
    </div>
  )
}