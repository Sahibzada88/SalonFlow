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
  Calendar, 
  Plus, 
  Search, 
  Clock,
  User,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { appointmentsApi } from '@/services/api'

export default function AppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await appointmentsApi.getAll()
      setAppointments(response.data)
      // ✅ Pending requests count
      const pending = response.data.filter((apt: any) => apt.status === 'requested')
      setPendingCount(pending.length)
    } catch (error) {
      console.error('Failed to fetch appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: { className: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
      requested: { className: 'bg-yellow-100 text-yellow-800', label: '⏳ Pending' },
      approved: { className: 'bg-green-100 text-green-800', label: '✅ Approved' },
      completed: { className: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelled' },
      'no-show': { className: 'bg-gray-100 text-gray-800', label: 'No Show' },
      rescheduled_pending: { className: 'bg-purple-100 text-purple-800', label: '⏳ Reschedule Pending' },
    }
    const variant = variants[status] || variants.scheduled
    return (
      <Badge className={`${variant.className} flex items-center px-2 py-0.5 text-xs font-medium`}>
        {variant.label}
      </Badge>
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return
    
    try {
      await appointmentsApi.delete(id)
      fetchAppointments()
    } catch (error) {
      alert('Failed to delete appointment')
    }
  }

  const filteredAppointments = appointments.filter((apt: any) => {
    if (filter !== 'all' && apt.status !== filter) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return apt.customer_name?.toLowerCase().includes(searchLower) ||
             apt.title?.toLowerCase().includes(searchLower)
    }
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Appointments
            {/* ✅ Pending badge */}
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white hover:bg-red-600 px-3 py-1 text-sm">
                {pendingCount} Pending
              </Badge>
            )}
          </h1>
          <p className="text-sm text-gray-500">Manage your salon appointments</p>
        </div>
        <Link href="/dashboard/appointments/new">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-9">
            <Plus className="h-4 w-4 mr-1.5" />
            New Appointment
          </Button>
        </Link>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by customer or service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          className="px-3 py-1.5 border rounded-md bg-white text-sm h-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="requested">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
          <option value="rescheduled_pending">Reschedule Pending</option>
        </select>
        {(search || filter !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setSearch(''); setFilter('all'); fetchAppointments() }}
            className="h-9 text-sm"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Date & Time
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Customer
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Service
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                    Loading appointments...
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                    No appointments found. Book your first appointment!
                  </TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((apt: any) => (
                  <TableRow key={apt.id} className="hover:bg-gray-50">
                    <TableCell className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900">{apt.date}</div>
                      <div className="text-xs text-gray-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {apt.start_time} - {apt.end_time}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm text-gray-900">{apt.customer_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-sm text-gray-900">
                      {apt.service_name || apt.title || '-'}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {getStatusBadge(apt.status)}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/appointments/${apt.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/appointments/${apt.id}/edit`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(apt.id)}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
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