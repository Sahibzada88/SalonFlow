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
  Clock, 
  User, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Scissors,
  LayoutDashboard,
  Users,
  CreditCard
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: { className: 'bg-rose-100 text-rose-800', icon: <Calendar className="h-4 w-4 mr-1" /> },
      completed: { className: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4 mr-1" /> },
      cancelled: { className: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4 mr-1" /> },
      'no-show': { className: 'bg-stone-100 text-stone-800', icon: <AlertCircle className="h-4 w-4 mr-1" /> },
    }
    const variant = variants[status] || variants.scheduled
    return (
      <Badge className={`${variant.className} flex items-center px-3 py-1 text-sm`}>
        {variant.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p>Loading appointment...</p>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">Appointment not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r p-6">
        <div className="flex items-center gap-2 mb-8">
          <Scissors className="h-8 w-8 text-rose-600" />
          <span className="text-xl font-bold text-stone-900">SalonFlow</span>
        </div>
        <nav className="space-y-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start hover:bg-stone-100">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/dashboard/customers">
            <Button variant="ghost" className="w-full justify-start hover:bg-stone-100">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </Button>
          </Link>
          <Link href="/dashboard/appointments">
            <Button variant="default" className="w-full justify-start bg-rose-600 hover:bg-rose-700">
              <Calendar className="h-4 w-4 mr-2" />
              Appointments
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start hover:bg-stone-100">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </Button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/appointments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Appointment Details</h1>
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
                <p className="text-sm text-stone-500">Customer</p>
                <p className="font-medium">{appointment.customer_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Service</p>
                <p className="font-medium">{appointment.title || 'Service'}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Status</p>
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
                <p className="text-sm text-stone-500">Date</p>
                <p className="font-medium">{appointment.date}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-stone-500">Start Time</p>
                  <p className="font-medium">{appointment.start_time}</p>
                </div>
                <div>
                  <p className="text-sm text-stone-500">End Time</p>
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
              <p className="text-stone-700">
                {appointment.notes || 'No notes for this appointment.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}