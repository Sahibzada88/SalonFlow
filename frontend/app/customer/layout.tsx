'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Home, 
  LogOut,
  Scissors,
  Bell
} from 'lucide-react'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/auth/login')
      return
    }
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    router.push('/auth/login')
  }

  if (loading) {
    return <div className="flex justify-center py-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r p-6">
        <div className="flex items-center gap-2 mb-8">
          <Scissors className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">SalonFlow</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Customer</span>
        </div>
        <nav className="space-y-2">
          <Link href="/customer/dashboard">
            <Button variant="ghost" className="w-full justify-start hover:bg-gray-100">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/customer/appointments">
            <Button variant="default" className="w-full justify-start bg-blue-600 hover:bg-blue-700">
              <Calendar className="h-4 w-4 mr-2" />
              My Appointments
            </Button>
          </Link>
          <Link href="/customer/book">
            <Button variant="ghost" className="w-full justify-start hover:bg-gray-100">
              <Calendar className="h-4 w-4 mr-2" />
              Book Appointment
            </Button>
          </Link>
        </nav>
        <div className="absolute bottom-6 left-6 right-6">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        {children}
      </div>
    </div>
  )
}