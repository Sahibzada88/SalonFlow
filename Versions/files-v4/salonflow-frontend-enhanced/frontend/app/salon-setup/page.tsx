'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Scissors, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'

export default function SalonSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    opening_time: '09:00',
    closing_time: '21:00'
  })

  useEffect(() => {
    // NOTE: previously gated on localStorage.getItem('access_token') -
    // that's no longer readable from JS now that the session lives in an
    // httpOnly cookie. If there's no valid session, /salons/my-salon below
    // will 401 and the global axios interceptor redirects to /auth/login.
    api.get('/salons/my-salon')
      .then(response => {
        if (response.data.exists) {
          router.push('/dashboard')
        }
        setChecking(false)
      })
      .catch(() => {
        setChecking(false)
      })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/salons/setup', formData)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Checking your salon status...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-rose-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Scissors className="h-12 w-12 text-rose-600" />
          </div>
          <CardTitle className="text-2xl">Set Up Your Salon</CardTitle>
          <CardDescription>
            Tell us about your salon to get started
          </CardDescription>
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
              <Label>Salon Name</Label>
              <Input
                placeholder="Your Salon Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="salon@email.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Time</Label>
                <Input
                  type="time"
                  value={formData.opening_time}
                  onChange={(e) => setFormData({...formData, opening_time: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Time</Label>
                <Input
                  type="time"
                  value={formData.closing_time}
                  onChange={(e) => setFormData({...formData, closing_time: e.target.value})}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
              {loading ? 'Setting Up...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}