'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Clock,
  UserPlus
} from 'lucide-react'
import { api } from '@/services/api'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salon, setSalon] = useState<any>(null)
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
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    api.get('/dashboard/stats')
      .then(response => {
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
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        router.push('/auth/login')
      })
  }, [router])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      'no-show': 'bg-gray-100 text-gray-800',
    }
    return variants[status] || variants.scheduled
  }

  const formatGrowth = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0%'
    return `${value}%`
  }

  const getGrowthColor = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'text-gray-500'
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const getGrowthIcon = (value: number) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) return ''
    if (value > 0) return '↑'
    if (value < 0) return '↓'
    return ''
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome to {salon?.name || 'your salon'}! Here's what's happening today
          </p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {stats.todayRevenue.toLocaleString()}</div>
            <p className="text-sm text-gray-500 mt-1">Coming soon from billing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Today's Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            <p className={`text-sm mt-1 ${getGrowthColor(stats.appointmentGrowth)}`}>
              {getGrowthIcon(stats.appointmentGrowth)} {formatGrowth(stats.appointmentGrowth)} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className={`text-sm mt-1 ${getGrowthColor(stats.customerGrowth)}`}>
              {getGrowthIcon(stats.customerGrowth)} {formatGrowth(stats.customerGrowth)} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-sm text-gray-500 mt-1 truncate">
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
              <p className="text-gray-500">No appointments yet. Start booking!</p>
            ) : (
              recentAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{apt.customer_name || 'Unknown Customer'}</p>
                    <p className="text-sm text-gray-600">{apt.title || 'Service'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{apt.start_time || '--:--'}</p>
                    <Badge className={getStatusBadge(apt.status)}>
                      {apt.status ? apt.status.charAt(0).toUpperCase() + apt.status.slice(1) : 'Scheduled'}
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