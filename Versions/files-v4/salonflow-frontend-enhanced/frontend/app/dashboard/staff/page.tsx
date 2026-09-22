'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, Edit, AlertCircle, Copy, Check, Mail, User, ShieldCheck } from 'lucide-react'
import { api, staffApi } from '@/services/api'

// The full set of permissions an owner can grant/revoke per staff member.
// Kept as one shared list so the create and edit forms can't drift out of
// sync with each other or with what the backend actually checks (see
// require_permission(...) in the backend's appointments.py/billing.py/
// customers.py/services.py).
const PERMISSION_FIELDS: { key: string; label: string; description: string }[] = [
  { key: 'can_book', label: 'Book appointments', description: 'Create/manage appointments on behalf of customers' },
  { key: 'can_approve', label: 'Approve appointments', description: 'Approve, reschedule, or reject appointment requests' },
  { key: 'can_bill', label: 'Billing', description: 'Create invoices and record payments' },
  { key: 'can_manage_customers', label: 'Manage customers', description: 'Add, edit, or delete customer records' },
  { key: 'can_manage_services', label: 'Manage services', description: 'Add, edit, or delete services and their prices' },
]

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_book: true,
  can_approve: true,
  can_bill: true,
  can_manage_customers: true,
  can_manage_services: false,
}

function PermissionCheckboxes({
  value,
  onChange,
}: {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Permissions
      </Label>
      <div className="border rounded-md divide-y">
        {PERMISSION_FIELDS.map((p) => (
          <label key={p.key} className="flex items-start gap-3 p-2.5 cursor-pointer hover:bg-muted">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!value[p.key]}
              onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
            />
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function StaffManagementPage() {
  const router = useRouter()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    position: 'Receptionist',
    username: ''
  })
  const [permissions, setPermissions] = useState<Record<string, boolean>>(DEFAULT_PERMISSIONS)
  const [creating, setCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [newStaffCredentials, setNewStaffCredentials] = useState<{ email: string; username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ position: '', phone: '', is_active: true })
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>(DEFAULT_PERMISSIONS)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const role = localStorage.getItem('user_role')
    if (role !== 'owner') {
      router.push('/dashboard')
      return
    }
    fetchStaff()
  }, [router])

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff')
      setStaff(response.data)
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccessMessage('')
    setNewStaffCredentials(null)

    if (!formData.full_name.trim()) {
      setError('Full name is required')
      setCreating(false)
      return
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      setCreating(false)
      return
    }

    try {
      const response = await api.post('/auth/staff', {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        position: formData.position,
        username: formData.username || undefined,
        permissions,
      })

      setNewStaffCredentials({
        email: response.data.email,
        username: response.data.username,
        password: response.data.temporary_password
      })
      setSuccessMessage('Staff created successfully!')

      setFormData({
        email: '',
        full_name: '',
        phone: '',
        position: 'Receptionist',
        username: ''
      })
      setPermissions(DEFAULT_PERMISSIONS)

      fetchStaff()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create staff')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    try {
      await api.delete(`/staff/${id}`)
      fetchStaff()
    } catch (error) {
      alert('Failed to delete staff')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const openEditStaff = (s: any) => {
    setEditingStaff(s)
    setEditForm({
      position: s.position || '',
      phone: s.phone || '',
      is_active: s.is_active,
    })
    // Fill in any permission keys the staff record doesn't have yet with
    // the defaults, rather than leaving them unchecked - a staff member
    // created before a new permission existed shouldn't silently lose
    // access to it the moment the owner opens (and re-saves) this form.
    setEditPermissions({ ...DEFAULT_PERMISSIONS, ...(s.permissions || {}) })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingStaff) return
    setSavingEdit(true)
    try {
      await staffApi.update(editingStaff.id, { ...editForm, permissions: editPermissions })
      setEditDialogOpen(false)
      fetchStaff()
    } catch (err) {
      alert('Failed to update staff')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground">Manage your salon staff members and what each of them can do</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) {
            setNewStaffCredentials(null)
            setSuccessMessage('')
            setError('')
          }
          setDialogOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            
            {successMessage && !error && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
              </Alert>
            )}

            {newStaffCredentials && (
              <div className="bg-secondary border border-primary/20 rounded-md p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Staff Credentials</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{newStaffCredentials.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Username:</span>
                    <span className="font-medium">{newStaffCredentials.username}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono bg-muted px-2 py-0.5 rounded text-sm">
                        {newStaffCredentials.password}
                      </span>
                      <button
                        onClick={() => copyToClipboard(newStaffCredentials.password)}
                        className="text-primary hover:opacity-80"
                        title="Copy password"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this password with them directly - it's shown only once and no email is sent.
                </p>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Full Name *</Label>
                <Input
                  placeholder="Staff Name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="staff@salon.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for their login - no email is sent automatically</p>
              </div>

              <div>
                <Label>Username (Optional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="staffname (auto-generated if empty)"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave empty to auto-generate from name</p>
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div>
                <Label>Position</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-card"
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                >
                  <option value="Receptionist">Receptionist</option>
                  <option value="Stylist">Stylist</option>
                  <option value="Manager">Manager</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Barber">Barber</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <PermissionCheckboxes value={permissions} onChange={setPermissions} />

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Add Staff'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading staff...
                  </TableCell>
                </TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No staff members yet. Add your first staff member!
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((s: any) => {
                  const grantedCount = PERMISSION_FIELDS.filter((p) => s.permissions?.[p.key]).length
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>
                        <span className="text-sm font-mono text-muted-foreground">@{s.username || '-'}</span>
                      </TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted">
                          {s.position || 'Staff'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {grantedCount} / {PERMISSION_FIELDS.length} granted
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={s.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditStaff(s)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStaff(s.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Position</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
              >
                <option value="Receptionist">Receptionist</option>
                <option value="Stylist">Stylist</option>
                <option value="Manager">Manager</option>
                <option value="Assistant">Assistant</option>
                <option value="Barber">Barber</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                placeholder="03XX-XXXXXXX"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              />
              Active (inactive staff cannot log in)
            </label>

            <PermissionCheckboxes value={editPermissions} onChange={setEditPermissions} />

            <Button className="w-full" onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
