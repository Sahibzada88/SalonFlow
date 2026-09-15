'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  AlertCircle,
  Calendar,
  Clock,
  User,
  Scissors,
  LayoutDashboard,
  Users,
  CreditCard
} from 'lucide-react'
import { appointmentsApi } from '@/services/api'
import { customersApi } from '@/services/api'

export default function EditAppointmentPage() {
  const router = useRouter()
  const { id: appointmentId } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState([])
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    status: 'scheduled',
    notes: ''
  })

  useEffect(() => {
    if (appointmentId) {
      fetchData()
    }
  }, [appointmentId])

  const fetchData = async () => {
    try {
      // Fetch customers
      const customersRes = await customersApi.getAll()
      setCustomers(customersRes.data)

      // Fetch appointment
      const aptRes = await appointmentsApi.getOne(appointmentId)
      const apt = aptRes.data
      setFormData({
        customer_id: apt.customer_id || '',
        title: apt.title || '',
        date: apt.date || '',
        start_time: apt.start_time || '',
        end_time: apt.end_time || '',
        status: apt.status || 'scheduled',
        notes: apt.notes || ''
      })
    } catch (error) {
      router.push('/dashboard/appointments')
    } finally {
      setFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await appointmentsApi.update(appointmentId, formData)
      router.push(`/dashboard/appointments/${appointmentId}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update appointment')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p>Loading...</p>
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
      <div className="ml-64 flex-1 p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/dashboard/appointments/${appointmentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Edit Appointment</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Update Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Customer *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Service/Title</Label>
                <Input
                  placeholder="Haircut, Manicure, etc."
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No Show</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any special notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  className="bg-rose-600 hover:bg-rose-700"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Appointment'}
                </Button>
                <Link href={`/dashboard/appointments/${appointmentId}`}>
                  <Button variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}