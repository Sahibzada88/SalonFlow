'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  const router = useRouter()
  const { id: appointmentId } = useParams<{ id: string }>()
  const [appointment, setAppointment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment()
    }
  }, [appointmentId])

  const fetchAppointment = async () => {
    try {
      const response = await appointmentsApi.getOne(appointmentId)
      setAppointment(response.data)
    } catch (error) {
      router.push('/dashboard/appointments')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this appointment?')) return
    
    try {
      await appointmentsApi.delete(appointmentId)
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
            <Link href={`/dashboard/appointments/${appointmentId}/edit`}>
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