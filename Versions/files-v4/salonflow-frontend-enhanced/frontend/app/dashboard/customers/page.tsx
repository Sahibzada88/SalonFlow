'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Search, 
  User,
  Edit,
  Eye,
  Trash2,
  Users
} from 'lucide-react'
import { customersApi } from '@/services/api'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async (searchTerm?: string) => {
    try {
      setLoading(true)
      const response = await customersApi.getAll(searchTerm ? { search: searchTerm } : {})
      setCustomers(response.data || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCustomers(search)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return
    
    try {
      await customersApi.delete(id)
      fetchCustomers(search)
    } catch (error) {
      alert('Failed to delete customer')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">Loading customers...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">Manage your salon customers</p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button className="bg-rose-600 hover:bg-rose-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            {search && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearch('')
                  fetchCustomers()
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No customers found. Add your first customer!
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{customer.total_visits || 0}</Badge>
                    </TableCell>
                    <TableCell>Rs. {customer.total_spent?.toLocaleString() || 0}</TableCell>
                    <TableCell>
                      {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/customers/${customer.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/customers/${customer.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}