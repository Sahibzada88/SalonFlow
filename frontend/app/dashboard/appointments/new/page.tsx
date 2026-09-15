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
  Calendar,
  Clock,
  User,
  Plus
} from 'lucide-react'
import { appointmentsApi } from '@/services/api'
import { customersApi } from '@/services/api'

type Customer = {
  id: string | number
  full_name: string
  email?: string
  phone?: string
}



export default function NewAppointmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    status: 'scheduled',
    notes: ''
  })

  // ✅ New states for quick customer add
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    email: '',
    phone: ''
  })
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await customersApi.getAll()
      setCustomers(response.data)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  // ✅ Function to create customer and select it
  const createCustomerAndSelect = async () => {
    if (!newCustomer.full_name.trim()) {
      alert('Customer name is required')
      return
    }

    setCreatingCustomer(true)
    try {
      const response = await customersApi.create(newCustomer)
      const customerId = response.data.id
      
      // Update customer list
      setCustomers(prev => [...prev, response.data])
      
      // Select the new customer
      setFormData(prev => ({
        ...prev,
        customer_id: customerId
      }))
      
      // Hide the form
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

    try {
      await appointmentsApi.create(formData)
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
        <h1 className="text-3xl font-bold text-stone-900">New Appointment</h1>
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

            {/* ✅ Customer Section - With Quick Add */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              
              {!showNewCustomerForm ? (
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 border rounded-md"
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
                <div className="border p-4 rounded-md space-y-3 bg-stone-50">
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
                      className="bg-rose-600 hover:bg-rose-700"
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
                  <p className="text-xs text-stone-400">
                    Customer will be created and automatically selected
                  </p>
                </div>
              )}
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
                className="bg-rose-600 hover:bg-rose-700"
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