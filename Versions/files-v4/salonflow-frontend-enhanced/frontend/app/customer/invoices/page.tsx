'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt, Download, CreditCard } from 'lucide-react'
import { billingApi } from '@/services/api'

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await billingApi.getMyInvoices()
      setInvoices(response.data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: { className: 'bg-green-100 text-green-800', label: 'Paid' },
      partially_paid: { className: 'bg-yellow-100 text-yellow-800', label: 'Partially Paid' },
      pending: { className: 'bg-muted text-foreground', label: 'Pending' },
    }
    const variant = variants[status] || variants.pending
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId)
    try {
      const response = await billingApi.downloadMyInvoicePDF(invoiceId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Invoice_${invoiceNumber}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading invoice:', error)
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-semibold text-foreground">My Invoices</h1>
        <p className="text-muted-foreground">Your billing history at a glance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No invoices yet.</p>
              </div>
            ) : (
              invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{inv.invoice_number}</h4>
                      {getStatusBadge(inv.payment_status || inv.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{inv.date}</span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Rs. {inv.total} {inv.balance_due > 0 && `(Rs. ${inv.balance_due} due)`}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(inv.id, inv.invoice_number)}
                    disabled={downloadingId === inv.id}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    {downloadingId === inv.id ? 'Downloading...' : 'PDF'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
