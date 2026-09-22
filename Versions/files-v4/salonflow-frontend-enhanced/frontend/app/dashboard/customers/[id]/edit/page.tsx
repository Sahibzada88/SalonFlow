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
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { customersApi } from '@/services/api'

// Important: This is how params should be received in Next.js App Router
export default function EditCustomerPage() {
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
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  })

  useEffect(() => {
    if (id) {
      fetchCustomer()
    }
  }, [id])

  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getOne(id)
      const data = response.data
      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || ''
      })
    } catch (error) {
      console.error('Error fetching customer:', error)
      router.push('/dashboard/customers')
    } finally {
      setFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await customersApi.update(id, formData)
      router.push(`/dashboard/customers/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update customer')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">Loading customer...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/dashboard/customers/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Edit Customer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Customer Details</CardTitle>
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
              <Label>Full Name *</Label>
              <Input
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Street, City"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any special notes about this customer..."
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
                {loading ? 'Updating...' : 'Update Customer'}
              </Button>
              <Link href={`/dashboard/customers/${id}`}>
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}