'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Phone, MapPin, Edit, Calendar, DollarSign } from 'lucide-react'
import { customersApi } from '@/services/api'

// Important: This is how params should be received in Next.js App Router
export default function CustomerDetailPage() {
  // FIXED: params is a Promise in newer Next.js (App Router) and
  // must be unwrapped via useParams() in a client component rather
  // than destructured directly as a prop - destructuring it
  // synchronously threw 'params should be unwrapped with React.use()'
  // at runtime.
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchCustomer()
    }
  }, [id])

  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getOne(id)
      setCustomer(response.data)
    } catch (error) {
      console.error('Error fetching customer:', error)
      router.push('/dashboard/customers')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-stone-500">Loading customer...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-8">
        <p className="text-stone-500">Customer not found</p>
        <Link href="/dashboard/customers">
          <Button variant="outline" className="mt-4">Go Back</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-stone-900">{customer.full_name}</h1>
        <Link href={`/dashboard/customers/${customer.id}/edit`} className="ml-auto">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Total Visits</p>
                <p className="text-2xl font-bold">{customer.total_visits || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Total Spent</p>
                <p className="text-2xl font-bold">Rs. {customer.total_spent?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-fuchsia-100 p-3 rounded-full">
                <Badge variant="secondary" className="text-lg">
                  {customer.last_visit ? 'Active' : 'New'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-stone-600">Last Visit</p>
                <p className="text-sm font-medium">
                  {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-stone-500" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-stone-500" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-stone-500" />
                <span>{customer.address}</span>
              </div>
            )}
            {!customer.email && !customer.phone && !customer.address && (
              <p className="text-stone-500">No contact information available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-stone-700">
              {customer.notes || 'No notes available for this customer.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}