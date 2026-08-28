'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'

export default function CustomerAppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      console.log('🔄 Fetching appointments...')
      
      // ✅ FIXED: Use correct API endpoint
      const response = await api.get('/appointments/customer/appointments')
      console.log('📊 Appointments Response:', response.data)
      
      setAppointments(response.data || [])
    } catch (error) {
      console.error('❌ Error fetching appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      requested: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Confirmed' },
      rescheduled_pending: { className: 'bg-blue-100 text-blue-800', label: 'Reschedule Pending' },
      completed: { className: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelled' },
      'no-show': { className: 'bg-gray-100 text-gray-800', label: 'No Show' },
    }
    const variant = variants[status] || variants.requested
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-gray-500">Loading appointments...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600">View all your appointments</p>
        </div>
        <Link href="/customer/book">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Calendar className="h-4 w-4 mr-2" />
            Book New Appointment
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No appointments found. Book one now!</p>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{apt.title || 'Service'}</h4>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {apt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {apt.start_time} - {apt.end_time}
                      </span>
                    </div>
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