'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertCircle, Check } from 'lucide-react'
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
  // Multiple services can be selected for one appointment (e.g. a haircut
  // + a beard trim in the same visit) - they all end up on this one
  // appointment and later on one combined invoice, rather than needing a
  // separate booking (and separate invoice) per service.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
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

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0)

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (selectedServiceIds.length === 0) {
      setError('Please choose at least one service')
      return
    }

    setLoading(true)
    try {
      const userRes = await api.get('/auth/me')
      const customerId = userRes.data.id

      const end_time = addMinutes(formData.start_time, totalDuration || 30)
      // Combined title shown in lists/dashboards, e.g. "Haircut + Beard Trim"
      const title = selectedServices.map((s) => s.name).join(' + ')

      await api.post('/appointments', {
        customer_id: customerId,
        service_ids: selectedServiceIds,
        title,
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
              <Label>Services * <span className="font-normal text-muted-foreground">(choose one or more)</span></Label>
              {servicesLoading ? (
                <p className="text-sm text-muted-foreground">Loading services...</p>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services available yet - please check back later.</p>
              ) : (
                <div className="border rounded-md divide-y">
                  {services.map((s) => {
                    const checked = selectedServiceIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-secondary' : 'hover:bg-muted'}`}
                      >
                        <div
                          className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}
                        >
                          {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleService(s.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-sm">{s.name}</span>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {s.price ? `Rs. ${s.price}` : ''} · {s.duration} min
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedServices.length > 0 && (
                <p className="text-sm text-muted-foreground flex justify-between pt-1">
                  <span>{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected</span>
                  <span className="font-medium text-foreground">
                    Total: Rs. {totalPrice} · {totalDuration} min
                  </span>
                </p>
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
              {selectedServices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated end time: {addMinutes(formData.start_time, totalDuration)}
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
