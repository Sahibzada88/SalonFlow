'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
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
      const token = localStorage.getItem('access_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      try {
        // ✅ Verify user role from backend
        const response = await api.get('/auth/me')
        const userData = response.data
        
        // ✅ If customer, redirect to customer dashboard
        if (userData.role === 'customer') {
          localStorage.setItem('user_role', 'customer')
          router.push('/customer/dashboard')
          return
        }
        
        // ✅ Ensure correct role is set
        localStorage.setItem('user_role', userData.role || 'owner')
        setLoading(false)
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.clear()
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return <div className="flex justify-center py-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  )
}