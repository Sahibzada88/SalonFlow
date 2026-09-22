'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Scissors } from 'lucide-react'
import { servicesApi } from '@/services/api'

interface Service {
  id: string
  name: string
  description?: string
  duration: number
  price: number
  category?: string
  is_active: boolean
}

const emptyForm = { name: '', description: '', duration: 30, price: 0, category: '', is_active: true }

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await servicesApi.getAll()
      setServices(response.data || [])
    } catch (err) {
      console.error('Failed to fetch services:', err)
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditingId(service.id)
    setForm({
      name: service.name,
      description: service.description || '',
      duration: service.duration,
      price: service.price,
      category: service.category || '',
      is_active: service.is_active,
    })
    setError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Service name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await servicesApi.update(editingId, form)
      } else {
        await servicesApi.create(form)
      }
      setDialogOpen(false)
      fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service? This cannot be undone.')) return
    try {
      await servicesApi.delete(id)
      fetchServices()
    } catch (err) {
      console.error('Failed to delete service:', err)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Services</h1>
          <p className="text-muted-foreground">Manage the services your salon offers</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No services yet. Add your first one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.category || '-'}</TableCell>
                    <TableCell>{service.duration} min</TableCell>
                    <TableCell>Rs. {service.price}</TableCell>
                    <TableCell>
                      <Badge className={service.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}>
                        {service.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Haircut" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (Rs.)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Hair, Nails" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active (visible to customers when booking)
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
