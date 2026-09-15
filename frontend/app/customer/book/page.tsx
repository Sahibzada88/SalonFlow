'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { api, servicesApi } from '@/services/api'

interface Service {
  id: string
  name: string
  description?: string
  duration: number
  price: number
  category?: string
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export default function BookAppointmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [formData, setFormData] = useState({
    service_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    notes: ''
  })

  useEffect(() => {
    servicesApi.getAll(true)
      .then((res) => setServices(res.data || []))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false))
  }, [])

  const selectedService = services.find((s) => s.id === formData.service_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.service_id) {
      setError('Please choose a service')
      return
    }

    setLoading(true)
    try {
      const userRes = await api.get('/auth/me')
      const customerId = userRes.data.id

      const duration = selectedService?.duration ?? 30
      const end_time = addMinutes(formData.start_time, duration)

      await api.post('/appointments', {
        customer_id: customerId,
        service_id: formData.service_id,
        title: selectedService?.name,
        date: formData.date,
        start_time: formData.start_time,
        end_time,
        notes: formData.notes,
        status: 'requested', // Customer requests, staff approves
      })

      router.push('/customer/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to book appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/customer/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-serif font-semibold text-foreground">Book Appointment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Appointment</CardTitle>
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
              <Label>Service *</Label>
              {servicesLoading ? (
                <p className="text-sm text-muted-foreground">Loading services...</p>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services available yet - please check back later.</p>
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  required
                >
                  <option value="">Choose a service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.price ? `- Rs. ${s.price}` : ''} ({s.duration} min)
                    </option>
                  ))}
                </select>
              )}
              {selectedService?.description && (
                <p className="text-xs text-muted-foreground">{selectedService.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred Time *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
              {selectedService && (
                <p className="text-xs text-muted-foreground">
                  Estimated end time: {addMinutes(formData.start_time, selectedService.duration)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any special requests..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Your request will be sent for approval. You'll receive a notification once confirmed.
            </p>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading || servicesLoading}>
                {loading ? 'Booking...' : 'Request Appointment'}
              </Button>
              <Link href="/customer/dashboard">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
