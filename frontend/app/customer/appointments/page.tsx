'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
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
      const response = await api.get('/customer/appointments')
      setAppointments(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (appointmentId: string, accept: boolean) => {
    try {
      await api.patch(`/customer/appointments/${appointmentId}/respond`, { accept })
      fetchAppointments()
    } catch (error) {
      alert('Failed to respond')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      requested: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Confirmed' },
      rescheduled_pending: { className: 'bg-blue-100 text-blue-800', label: 'Reschedule Pending' },
      completed: { className: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelled' },
    }
    const variant = variants[status] || variants.requested
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  if (loading) {
    return <div className="flex justify-center py-8">Loading appointments...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">My Appointments</h1>
      
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              No appointments found. Book one now!
            </CardContent>
          </Card>
        ) : (
          appointments.map((apt: any) => (
            <Card key={apt.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{apt.title || 'Service'}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <Calendar className="h-4 w-4" />
                      {apt.date}
                      <Clock className="h-4 w-4 ml-2" />
                      {apt.start_time} - {apt.end_time}
                    </div>
                    {apt.original_date && apt.status === 'rescheduled_pending' && (
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Original: {apt.original_date} at {apt.original_start_time}</p>
                        <p className="text-blue-600">Reason: {apt.reschedule_reason || 'Staff request'}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {getStatusBadge(apt.status)}
                    
                    {/* Show action buttons for reschedule pending */}
                    {apt.status === 'rescheduled_pending' && (
                      <div className="mt-3 flex gap-2">
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8">
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push('/customer/book')}
        >
          Book New Appointment
        </Button>
      </div>
    </div>
  )
}