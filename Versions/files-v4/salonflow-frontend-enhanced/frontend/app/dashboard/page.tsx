'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, Users, DollarSign, Clock, UserPlus, 
  Scissors, LayoutDashboard, CreditCard, UserCog 
} from 'lucide-react'
import { api } from '@/services/api'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salon, setSalon] = useState<any>(null)
  const [userRole, setUserRole] = useState('')
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayAppointments: 0,
    totalCustomers: 0,
    upcomingAppointments: 0,
    appointmentGrowth: 0,
    customerGrowth: 0,
    nextAppointment: null as string | null
  })

  useEffect(() => {
    // NOTE: previously checked localStorage.getItem('access_token') before
    // fetching - that's no longer possible now that the session lives in
    // an httpOnly cookie the JS can't read. DashboardLayout (the parent)
    // already verified auth via /auth/me before rendering this page at
    // all, and any 401 here is caught below / by the global axios
    // interceptor, so no client-side token check is needed.
    const role = localStorage.getItem('user_role')
    setUserRole(role || '')
    fetchDashboardData()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/stats')
      const data = response.data
      if (!data.salon_exists) {
        router.push('/salon-setup')
        return
      }
      setSalon(data.salon)
      setStats({
        todayRevenue: data.stats?.today_revenue ?? 0,
        todayAppointments: data.stats?.today_appointments ?? 0,
        totalCustomers: data.stats?.total_customers ?? 0,
        upcomingAppointments: data.stats?.upcoming_appointments ?? 0,
        appointmentGrowth: data.stats?.appointment_growth ?? 0,
        customerGrowth: data.stats?.customer_growth ?? 0,
        nextAppointment: data.stats?.next_appointment ?? null
      })
      setRecentAppointments(data.recent_appointments || [])
      setLoading(false)
    } catch (error) {
      console.error(error)
      // The session cookie itself is cleared server-side / by the global
      // 401 interceptor in services/api.ts - nothing to remove from
      // localStorage here anymore.
      router.push('/auth/login')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'bg-rose-100 text-rose-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      'no-show': 'bg-muted text-foreground',
    }
    return variants[status] || variants.scheduled
  }

  if (loading) {
    return <div className="flex justify-center py-8">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to {salon?.name || 'your salon'}! Here's what's happening today
          </p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button className="bg-rose-600 hover:bg-rose-700">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {stats.todayRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-fuchsia-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {stats.nextAppointment ? `Next: ${stats.nextAppointment}` : 'No upcoming'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAppointments.length === 0 ? (
              <p className="text-muted-foreground">No appointments yet.</p>
            ) : (
              recentAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{apt.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{apt.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{apt.start_time}</p>
                    <Badge className={getStatusBadge(apt.status)}>
                      {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}