'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Trash2,
  Calendar,
  Clock,
  User,
  Lock
} from 'lucide-react'
import { billingApi } from '@/services/api'
import { customersApi } from '@/services/api'
import { appointmentsApi } from '@/services/api'

// FIXED: useSearchParams() needs a Suspense boundary above it or
// `next build`'s static prerendering fails for this route - the actual
// form is split out below and wrapped here.
export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><p className="text-muted-foreground">Loading...</p></div>}>
      <NewInvoiceForm />
    </Suspense>
  )
}

function NewInvoiceForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get pre-filled data from URL
  const appointmentId = searchParams?.get('appointment_id') || ''
  const customerId = searchParams?.get('customer_id') || ''
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [appointment, setAppointment] = useState<any>(null)
  const [appointmentsByCustomer, setAppointmentsByCustomer] = useState([])
  // When true, the appointment has a known service with a fixed price -
  // the item row is locked (read-only) and only discount/tax stay
  // editable, since the owner already set the service's price when they
  // created it in the services catalog.
  const [priceLocked, setPriceLocked] = useState(false)
  const [formData, setFormData] = useState({
    customer_id: customerId || '',
    appointment_id: appointmentId || '',
    date: new Date().toISOString().split('T')[0],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    status: 'pending',
    payment_method: 'cash',
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  })

  useEffect(() => {
    fetchData()
  }, [customerId, appointmentId])

  const fetchData = async () => {
    try {
      setLoadingData(true)
      
      // Fetch customers
      const customersRes = await customersApi.getAll()
      setCustomers(customersRes.data || [])
      
      // If customer_id provided, fetch customer details
      if (customerId) {
        const customerRes = await customersApi.getOne(customerId)
        setSelectedCustomer(customerRes.data)
        
        // Fetch appointments for this customer
        try {
          const aptRes = await appointmentsApi.getByCustomer(customerId)
          setAppointmentsByCustomer(aptRes.data || [])
        } catch (e) {
          setAppointmentsByCustomer([])
        }
      }
      
      // If appointment_id provided, fetch and pre-fill
      if (appointmentId) {
        try {
          const aptRes = await appointmentsApi.getOne(appointmentId)
          setAppointment(aptRes.data)
          
          // Auto-fill date from appointment
          if (aptRes.data.date) {
            setFormData(prev => ({ 
              ...prev, 
              date: aptRes.data.date,
              customer_id: aptRes.data.customer_id || customerId,
              appointment_id: appointmentId
            }))
          }
          
          // FIXED: the service's price is already set by the owner in the
          // services catalog - it used to always come through as 0 here,
          // requiring it to be re-typed by hand every time. Now it's
          // pulled from the appointment's linked service(s) and the item
          // row(s) are locked, since that price shouldn't be freely
          // editable per invoice (the backend enforces this too - see
          // billing.py).
          //
          // An appointment can cover several services at once (e.g. a
          // haircut + a beard trim booked together) - every one of them
          // becomes its own locked line item here, so the invoice still
          // ends up as ONE combined invoice for the whole visit rather
          // than needing to be split up.
          const services: any[] = aptRes.data.services || []
          if (services.length > 0) {
            setFormData(prev => ({
              ...prev,
              items: services.map((s: any) => ({
                description: s.name,
                quantity: 1,
                unit_price: s.price,
              })),
            }))
            setPriceLocked(true)
          } else {
            // Backward compatibility: an older appointment booked before
            // the multi-service feature existed may only have the legacy
            // single service_id/service_name/service_price fields.
            const title = aptRes.data.title || aptRes.data.service_name || 'Service'
            const hasServicePrice = aptRes.data.service_id && aptRes.data.service_price != null
            setFormData(prev => ({
              ...prev,
              items: [{
                description: aptRes.data.service_name || title,
                quantity: 1,
                unit_price: hasServicePrice ? aptRes.data.service_price : 0,
              }]
            }))
            setPriceLocked(!!hasServicePrice)
          }
        } catch (e) {
          // Appointment not found / not linked - fine, the form just
          // starts blank instead of pre-filled.
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // ✅ Fetch appointments when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      fetchAppointmentsByCustomer(formData.customer_id)
    } else {
      setAppointmentsByCustomer([])
    }
  }, [formData.customer_id])

  const fetchAppointmentsByCustomer = async (customerId: string) => {
    try {
      const aptRes = await appointmentsApi.getByCustomer(customerId)
      setAppointmentsByCustomer(aptRes.data || [])
    } catch (error) {
      setAppointmentsByCustomer([])
    }
  }

  // Calculate totals
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)
    
    const discount = formData.discount || 0
    const tax = formData.tax || 0
    const total = subtotal - discount + tax
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      total: total > 0 ? total : 0
    }))
  }, [formData.items, formData.discount, formData.tax])

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0 }]
    }))
  }

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: value }
        }
        return item
      })
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const hasEmptyItems = formData.items.some(item => !item.description.trim())
    if (hasEmptyItems) {
      setError('Please fill in all item descriptions')
      setLoading(false)
      return
    }

    if (!formData.customer_id) {
      setError('Please select a customer')
      setLoading(false)
      return
    }

    try {
      await billingApi.create(formData)
      router.push('/dashboard/billing')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return <div className="flex justify-center py-8"><p className="text-muted-foreground">Loading...</p></div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/billing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">New Invoice</h1>
        {appointment && (
          <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
            ✅ From: {appointment.title}
          </span>
        )}
      </div>

      {/* ✅ Pre-filled Appointment Info */}
      {appointment && selectedCustomer && (
        <Card className="mb-6 bg-rose-50 border-rose-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-rose-600" />
                <span className="font-medium">{selectedCustomer.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-600" />
                <span>{appointment.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-600" />
                <span>{appointment.start_time} - {appointment.end_time}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium ml-1">{appointment.title}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Customer & Appointment */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({...formData, customer_id: e.target.value, appointment_id: ''})}
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Appointment</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.appointment_id}
                  onChange={(e) => setFormData({...formData, appointment_id: e.target.value})}
                  disabled={!formData.customer_id}
                >
                  <option value="">Select an appointment</option>
                  {appointmentsByCustomer.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.date} - {a.title || 'Service'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice Items</CardTitle>
            {!priceLocked && (
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {priceLocked && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 -mt-1 mb-2">
                <Lock className="h-3 w-3" />
                Price is set by the service catalog and can't be changed here - only discount and tax below are editable.
              </p>
            )}
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end border-b pb-4 last:border-0">
                <div className="col-span-5 space-y-1">
                  <Label className="text-sm">Description</Label>
                  <Input
                    placeholder="Service or product"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    disabled={priceLocked}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-sm">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    disabled={priceLocked}
                    required
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-sm">Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                    disabled={priceLocked}
                    required
                  />
                </div>
                <div className="col-span-1 text-right">
                  <p className="text-sm font-medium">Rs. {item.quantity * item.unit_price}</p>
                </div>
                <div className="col-span-1">
                  {!priceLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={formData.items.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  value={formData.subtotal}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({...formData, discount: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.tax}
                  onChange={(e) => setFormData({...formData, tax: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-rose-600">
                  Rs. {formData.total.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button 
            type="submit" 
            className="bg-rose-600 hover:bg-rose-700"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </Button>
          <Link href="/dashboard/billing">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}