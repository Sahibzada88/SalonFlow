'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Calendar,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock3,
} from 'lucide-react'
import { appointmentsApi } from '@/services/api'

export default function AppointmentDetailPage() {
  // FIXED: params is a Promise in newer Next.js (App Router) and
  // must be unwrapped via useParams() in a client component rather
  // than destructured directly as a prop - destructuring it
  // synchronously threw 'params should be unwrapped with React.use()'
  // at runtime.
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [appointment, setAppointment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (id) {
      fetchAppointment()
    }
  }, [id])

  const fetchAppointment = async () => {
    try {
      const response = await appointmentsApi.getOne(id)
      setAppointment(response.data)
    } catch (error) {
      router.push('/dashboard/appointments')
    } finally {
      setLoading(false)
    }
  }

  // Change status right here instead of having to go to the edit page
  // just to change one field.
  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await appointmentsApi.updateStatus(id, newStatus)
      setAppointment((prev: any) => ({ ...prev, status: newStatus }))
    } catch (error) {
      alert('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this appointment?')) return

    try {
      await appointmentsApi.delete(id)
      router.push('/dashboard/appointments')
    } catch (error) {
      alert('Failed to delete appointment')
    }
  }

  // FIXED: previously only had styling for the dead 'scheduled' status and
  // every real status (requested, approved, rescheduled_pending, no-show)
  // fell back to that same look - now each has its own badge.
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      requested: { className: 'bg-yellow-100 text-yellow-800', icon: <Clock3 className="h-4 w-4 mr-1" />, label: 'Pending Approval' },
      approved: { className: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4 mr-1" />, label: 'Approved' },
      rescheduled_pending: { className: 'bg-rose-100 text-rose-800', icon: <Calendar className="h-4 w-4 mr-1" />, label: 'Reschedule Pending' },
      completed: { className: 'bg-stone-100 text-stone-800', icon: <CheckCircle className="h-4 w-4 mr-1" />, label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4 mr-1" />, label: 'Cancelled' },
      'no-show': { className: 'bg-muted text-foreground', icon: <AlertCircle className="h-4 w-4 mr-1" />, label: 'No Show' },
    }
    const variant = variants[status] || variants.requested
    return (
      <Badge className={`${variant.className} flex items-center px-3 py-1 text-sm w-fit`}>
        {variant.icon}
        {variant.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading appointment...</p>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Appointment not found</p>
      </div>
    )
  }

  // Multi-service list, falling back to the single legacy title/service
  // fields for any appointment booked before this feature existed.
  const serviceList: any[] = appointment.services && appointment.services.length > 0
    ? appointment.services
    : (appointment.service_name ? [{ name: appointment.service_name, price: appointment.service_price }] : [])
  const totalPrice = serviceList.reduce((sum, s) => sum + (s.price || 0), 0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/appointments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-serif font-semibold text-foreground">Appointment Details</h1>
        <div className="ml-auto flex gap-2">
          <Link href={`/dashboard/appointments/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <Card>
          <CardHeader>
            <CardTitle>Appointment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{appointment.customer_name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Service{serviceList.length > 1 ? 's' : ''}
              </p>
              {serviceList.length === 0 ? (
                <p className="font-medium">{appointment.title || 'Service'}</p>
              ) : (
                <div className="space-y-1 mt-1">
                  {serviceList.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      {s.price != null && <span className="text-muted-foreground">Rs. {s.price}</span>}
                    </div>
                  ))}
                  {serviceList.length > 1 && (
                    <div className="flex justify-between text-sm pt-1 border-t font-medium">
                      <span>Total</span>
                      <span>Rs. {totalPrice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {getStatusBadge(appointment.status)}
              <select
                className="mt-1 block w-full text-sm border rounded px-2 py-1.5 bg-background disabled:opacity-50"
                value={appointment.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                title="Change status"
              >
                <option value="requested">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rescheduled_pending">Reschedule Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No Show</option>
              </select>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">{appointment.date}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="font-medium">{appointment.start_time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Time</p>
                <p className="font-medium">{appointment.end_time}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              {appointment.notes || 'No notes for this appointment.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
