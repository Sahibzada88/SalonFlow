'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  ArrowLeft, 
  Trash2,
  DollarSign,
  Calendar,
  User,
  Printer,
  Download
} from 'lucide-react'
import { billingApi } from '@/services/api'

export default function InvoiceDetailPage() {
  // FIXED: params is a Promise in newer Next.js (App Router) and
  // must be unwrapped via useParams() in a client component rather
  // than destructured directly as a prop - destructuring it
  // synchronously threw 'params should be unwrapped with React.use()'
  // at runtime.
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  useEffect(() => {
    if (id) {
      fetchInvoice()
    }
  }, [id])

  const fetchInvoice = async () => {
    try {
      const response = await billingApi.getOne(id)
      setInvoice(response.data)
    } catch (error) {
      router.push('/dashboard/billing')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) return
    try {
      await billingApi.delete(id)
      router.push('/dashboard/billing')
    } catch (error) {
      alert('Failed to delete invoice')
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await billingApi.downloadPDF(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Invoice_${invoice.invoice_number}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to download PDF')
    }
  }

  const handlePrint = async () => {
    try {
      const response = await billingApi.printPDF(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      alert('Failed to open print preview')
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseInt(paymentAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    const amount = parseInt(paymentAmount)
    if (amount > invoice.balance_due) {
      alert(`Amount cannot exceed balance due: Rs. ${invoice.balance_due}`)
      return
    }
    setSubmittingPayment(true)
    try {
      await billingApi.addPayment(id, {
        amount: amount,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split('T')[0]
      })
      setPaymentDialogOpen(false)
      setPaymentAmount('')
      fetchInvoice()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to record payment')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      partially_paid: 'bg-rose-100 text-rose-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return variants[status] || variants.pending
  }

  if (loading) {
    return <div className="flex justify-center py-8">Loading invoice...</div>
  }

  if (!invoice) {
    return <div className="text-center py-8 text-stone-500">Invoice not found</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/billing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">
            Invoice #{invoice.invoice_number}
          </h1>
          <Badge className={getStatusBadge(invoice.payment_status || invoice.status)}>
            {(invoice.payment_status || invoice.status).charAt(0).toUpperCase() + 
             (invoice.payment_status || invoice.status).slice(1).replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-rose-600" />
              <div>
                <p className="text-sm text-stone-500">Customer</p>
                <p className="font-medium">{invoice.customer_name || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-rose-600" />
              <div>
                <p className="text-sm text-stone-500">Date</p>
                <p className="font-medium">{invoice.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-stone-500">Amount Paid</p>
                <p className="font-medium text-green-600">Rs. {invoice.amount_paid?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-stone-500">Balance Due</p>
                <p className={`font-medium ${invoice.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Rs. {invoice.balance_due?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.length > 0 ? (
                invoice.items.map((item: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">Rs. {item.unit_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rs. {item.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-stone-500">
                    No items found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between">
              <span className="text-stone-600">Subtotal</span>
              <span>Rs. {invoice.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Discount</span>
              <span>- Rs. {invoice.discount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Tax</span>
              <span>Rs. {invoice.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-lg">
              <span>Total</span>
              <span className="text-rose-600">Rs. {invoice.total.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Button */}
      {invoice.balance_due > 0 && (
        <div className="mt-6 flex justify-end">
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rose-600 hover:bg-rose-700">
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Amount (Rs.)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="1"
                    max={invoice.balance_due}
                  />
                  <p className="text-xs text-stone-500 mt-1">Max: Rs. {invoice.balance_due}</p>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-rose-600 hover:bg-rose-700" 
                  onClick={handleRecordPayment}
                  disabled={submittingPayment}
                >
                  {submittingPayment ? 'Recording...' : 'Record Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.payments.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">Rs. {p.amount.toLocaleString()}</p>
                    <p className="text-sm text-stone-500">{p.payment_method} - {p.payment_date}</p>
                  </div>
                  {p.notes && <p className="text-sm text-stone-400">{p.notes}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}