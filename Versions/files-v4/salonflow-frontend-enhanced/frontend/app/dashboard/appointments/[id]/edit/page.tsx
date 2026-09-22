'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertCircle, Check } from 'lucide-react'
import { appointmentsApi, customersApi, servicesApi } from '@/services/api'

interface Service {
  id: string
  name: string
  duration: number
  price: number
}

export default function EditAppointmentPage() {
  // FIXED: params is a Promise in newer Next.js (App Router) and
  // must be unwrapped via useParams() in a client component rather
  // than destructured directly as a prop - destructuring it
  // synchronously threw 'params should be unwrapped with React.use()'
  // at runtime.
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    // FIXED: previously defaulted to 'scheduled', which is no longer a
    // valid status in the database (see database/01_fresh_schema.sql) -
    // submitting the form without changing this would fail outright.
    status: 'requested',
    notes: ''
  })

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    try {
      const [customersRes, servicesRes, aptRes] = await Promise.all([
        customersApi.getAll(),
        servicesApi.getAll(),
        appointmentsApi.getOne(id),
      ])
      setCustomers(customersRes.data)
      setServices(servicesRes.data || [])

      const apt = aptRes.data
      setFormData({
        customer_id: apt.customer_id || '',
        title: apt.title || '',
        date: apt.date || '',
        start_time: apt.start_time || '',
        end_time: apt.end_time || '',
        status: apt.status || 'requested',
        notes: apt.notes || ''
      })
      // Pre-select whichever services are already on this appointment.
      const existingServiceIds = (apt.services || []).map((s: any) => s.service_id).filter(Boolean)
      setSelectedServiceIds(existingServiceIds)
    } catch (error) {
      router.push('/dashboard/appointments')
    } finally {
      setFetching(false)
    }
  }

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((sid) => sid !== serviceId) : [...prev, serviceId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await appointmentsApi.update(id, { ...formData, service_ids: selectedServiceIds })
      router.push(`/dashboard/appointments/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update appointment')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/dashboard/appointments/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-serif font-semibold text-foreground">Edit Appointment</h1>
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
                className="w-full px-3 py-2 border rounded-md bg-background"
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
              <Label>Services <span className="font-normal text-muted-foreground">(choose one or more)</span></Label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services in the catalog yet.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                  {services.map((s) => {
                    const checked = selectedServiceIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-secondary' : 'hover:bg-muted'}`}
                      >
                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}
                        >
                          {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleService(s.id)}
                        />
                        <span className="flex-1 text-sm font-medium">{s.name}</span>
                        <span className="text-sm text-muted-foreground">Rs. {s.price} · {s.duration} min</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Title <span className="font-normal text-muted-foreground">(shown in lists)</span></Label>
              <Input
                placeholder="Haircut + Beard Trim"
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
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="requested">Requested (Pending Approval)</option>
                <option value="approved">Approved</option>
                <option value="rescheduled_pending">Reschedule Pending</option>
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
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Appointment'}
              </Button>
              <Link href={`/dashboard/appointments/${id}`}>
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
