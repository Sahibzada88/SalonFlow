'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Plus,
  Check
} from 'lucide-react'
import { appointmentsApi, customersApi, servicesApi } from '@/services/api'

type Customer = {
  id: string | number
  full_name: string
  email?: string
  phone?: string
}

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

export default function NewAppointmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    // FIXED: this used to default to 'scheduled', a status that no longer
    // exists in the database's check constraint (see
    // database/01_fresh_schema.sql's design note on why it was removed) -
    // submitting the form with the default untouched would have failed
    // with a DB error. 'approved' makes more sense as the default here
    // anyway: an owner/staff member creating this directly (e.g. a
    // walk-in) is confirming it on the spot, not requesting approval from
    // themselves.
    status: 'approved',
    notes: ''
  })

  // New states for quick customer add
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    email: '',
    phone: ''
  })
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [endTimeTouched, setEndTimeTouched] = useState(false)

  useEffect(() => {
    fetchCustomers()
    servicesApi.getAll(true)
      .then((res) => setServices(res.data || []))
      .catch(() => setServices([]))
  }, [])

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0)

  // Auto-suggest an end time from the selected services' total duration,
  // but only until the owner manually edits it themselves - after that,
  // their choice is left alone even if the service selection changes.
  useEffect(() => {
    if (!endTimeTouched && selectedServices.length > 0) {
      setFormData((prev) => ({ ...prev, end_time: addMinutes(prev.start_time, totalDuration) }))
    }
  }, [selectedServiceIds.join(','), formData.start_time])

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  const fetchCustomers = async () => {
    try {
      const response = await customersApi.getAll()
      setCustomers(response.data)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  const createCustomerAndSelect = async () => {
    if (!newCustomer.full_name.trim()) {
      alert('Customer name is required')
      return
    }

    setCreatingCustomer(true)
    try {
      const response = await customersApi.create(newCustomer)
      const customerId = response.data.id

      setCustomers(prev => [...prev, response.data])
      setFormData(prev => ({ ...prev, customer_id: customerId }))
      setShowNewCustomerForm(false)
      setNewCustomer({ full_name: '', email: '', phone: '' })
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create customer')
    } finally {
      setCreatingCustomer(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (selectedServiceIds.length === 0) {
      setError('Please choose at least one service')
      setLoading(false)
      return
    }

    try {
      const title = selectedServices.map((s) => s.name).join(' + ')
      await appointmentsApi.create({
        ...formData,
        title,
        service_ids: selectedServiceIds,
      })
      router.push('/dashboard/appointments')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/appointments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-serif font-semibold text-foreground">New Appointment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Customer Section - With Quick Add */}
            <div className="space-y-2">
              <Label>Customer *</Label>

              {!showNewCustomerForm ? (
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 border rounded-md bg-background"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    required
                  >
                    <option value="">Select a customer...</option>
                    {customers.map((c: Customer) => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewCustomerForm(true)}
                    className="whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Customer
                  </Button>
                </div>
              ) : (
                <div className="border p-4 rounded-md space-y-3 bg-muted">
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Full Name *"
                      value={newCustomer.full_name}
                      onChange={(e) => setNewCustomer({...newCustomer, full_name: e.target.value})}
                    />
                    <Input
                      placeholder="Email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                    <Input
                      placeholder="Phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={createCustomerAndSelect}
                      disabled={creatingCustomer}
                    >
                      {creatingCustomer ? 'Creating...' : 'Create & Select'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewCustomerForm(false)
                        setNewCustomer({ full_name: '', email: '', phone: '' })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer will be created and automatically selected
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Services * <span className="font-normal text-muted-foreground">(choose one or more)</span></Label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No services in the catalog yet - add some under Services first.
                </p>
              ) : (
                <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
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
                  onChange={(e) => {
                    setEndTimeTouched(true)
                    setFormData({...formData, end_time: e.target.value})
                  }}
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
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Book Appointment'}
              </Button>
              <Link href="/dashboard/appointments">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
