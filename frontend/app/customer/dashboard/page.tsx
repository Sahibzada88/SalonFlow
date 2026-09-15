'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'

export default function CustomerDashboard() {
  const router = useRouter()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      
      // ✅ Correct URL
      const aptRes = await api.get('/appointments/customer/appointments')
      
      // ✅ Set appointments directly
      if (aptRes.data && aptRes.data.length > 0) {
        setAppointments(aptRes.data)
      } else {
        setAppointments([])
      }
      
      // Try notifications separately (don't fail if it errors)
      try {
        const notifRes = await api.get('/appointments/notifications')
        setNotifications(notifRes.data || [])
        setUnreadCount(notifRes.data?.filter((n: any) => !n.read).length || 0)
      } catch (notifError) {
        setNotifications([])
        setUnreadCount(0)
      }
      
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      requested: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Confirmed' },
      rescheduled_pending: { className: 'bg-rose-100 text-rose-800', label: 'Reschedule Pending' },
      completed: { className: 'bg-stone-100 text-stone-800', label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelled' },
      'no-show': { className: 'bg-stone-100 text-stone-800', label: 'No Show' },
    }
    const variant = variants[status] || variants.requested
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const handleRespond = async (appointmentId: string, accept: boolean) => {
    try {
      await api.patch(`/appointments/${appointmentId}/respond`, { accept })
      fetchData()
    } catch (error) {
      alert('Failed to respond')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-stone-500">Loading your appointments...</p>
      </div>
    )
  }

  const pendingReschedules = appointments.filter((a: any) => a.status === 'rescheduled_pending')
  const upcoming = appointments.filter((a: any) => a.status === 'approved' || a.status === 'scheduled')


  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
            My Dashboard
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white px-3 py-1 text-sm">
                {unreadCount} New
              </Badge>
            )}
          </h1>
          <p className="text-stone-600">Manage your appointments and bookings</p>
        </div>
        <Link href="/customer/book">
          <Button className="bg-rose-600 hover:bg-rose-700">
            <Calendar className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Upcoming</p>
                <p className="text-2xl font-bold">{upcoming.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Pending Actions</p>
                <p className="text-2xl font-bold">{pendingReschedules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-fuchsia-100 p-3 rounded-full">
                <Bell className="h-6 w-6 text-fuchsia-600" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Notifications</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>My Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-stone-500 text-center py-4">No appointments found. Book one now!</p>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{apt.title || 'Service'}</h4>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-stone-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {apt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {apt.start_time} - {apt.end_time}
                      </span>
                    </div>

                    {/* Show reschedule info */}
                    {apt.status === 'rescheduled_pending' && apt.original_date && (
                      <div className="mt-2 text-sm text-stone-500">
                        <p>Original: {apt.original_date} at {apt.original_start_time}</p>
                        <p className="text-rose-600">Reason: {apt.reschedule_reason || 'Staff request'}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons for reschedule pending */}
                  {apt.status === 'rescheduled_pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleRespond(apt.id, true)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleRespond(apt.id, false)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}