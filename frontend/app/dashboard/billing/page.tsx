'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  Search, 
  DollarSign, 
  FileText,
  Eye,
  Trash2,
  Calendar,
  Users,
  Printer,
  Download
} from 'lucide-react'
import { api, billingApi } from '@/services/api'

export default function BillingPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_invoices: 0,
    average_invoice: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [invoicesRes, statsRes] = await Promise.all([
        api.get('/billing/invoices'),
        api.get('/billing/stats')
      ])
      setInvoices(invoicesRes.data || [])
      
      // ✅ Set stats with fallback values
      const statsData = statsRes.data || {}
      setStats({
        total_revenue: statsData.total_revenue || 0,
        total_invoices: statsData.total_invoices || 0,
        average_invoice: statsData.average_invoice || 0
      })
    } catch (error) {
      console.error('Failed to fetch billing data:', error)
      // ✅ Set default values on error
      setStats({
        total_revenue: 0,
        total_invoices: 0,
        average_invoice: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return
    try {
      await api.delete(`/billing/invoices/${id}`)
      fetchData()
    } catch (error) {
      alert('Failed to delete invoice')
    }
  }

  const handleDownloadPDF = async (id: string, invoiceNumber: string) => {
    try {
      const response = await billingApi.downloadPDF(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Invoice_${invoiceNumber}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to download PDF')
    }
  }

  const filteredInvoices = invoices.filter((inv: any) => {
    if (search) {
      const searchLower = search.toLowerCase()
      return inv.invoice_number?.toLowerCase().includes(searchLower) ||
             inv.customer_name?.toLowerCase().includes(searchLower)
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      partially_paid: 'bg-rose-100 text-rose-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return variants[status] || variants.pending
  }

  // ✅ Helper function for safe formatting
  const formatCurrency = (value: any) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0'
    }
    return value.toLocaleString()
  }

  // ✅ Helper function for safe rounding
  const roundValue = (value: any) => {
    if (value === undefined || value === null || isNaN(value)) {
      return 0
    }
    return Math.round(value)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Billing</h1>
          <p className="text-stone-600">Manage invoices and payments</p>
        </div>
        <Link href="/dashboard/billing/new">
          <Button className="bg-rose-600 hover:bg-rose-700">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-stone-600">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {formatCurrency(stats.total_revenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-stone-600">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_invoices)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-stone-600">Average Invoice</CardTitle>
            <DollarSign className="h-4 w-4 text-fuchsia-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {formatCurrency(roundValue(stats.average_invoice))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by invoice number or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-stone-500">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-stone-500">
                    No invoices found. Create your first invoice!
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customer_name || 'Unknown'}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>Rs. {(inv.total || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(inv.payment_status || inv.status)}>
                        {(inv.payment_status || inv.status || 'pending').charAt(0).toUpperCase() + 
                         (inv.payment_status || inv.status || 'pending').slice(1).replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/billing/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(inv.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
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