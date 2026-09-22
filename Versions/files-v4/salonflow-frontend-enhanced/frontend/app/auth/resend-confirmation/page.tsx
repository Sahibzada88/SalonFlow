'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Mail } from 'lucide-react'
import { api } from '@/services/api'
import { AuthShell } from '@/components/auth/AuthShell'

// NOTE: POST /auth/resend-confirmation does not exist on the backend today
// (staff accounts are created pre-confirmed by an admin, and customer
// sign_up relies on Supabase Auth's own confirmation flow). This page is
// left in place and will show a friendly error until that route is added -
// wiring it up is a small addition to auth.py using
// `supabase_client.auth.resend({"type": "signup", "email": ...})`.
export default function ResendConfirmationPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/auth/resend-confirmation', { email })
      setSuccess('Confirmation email sent! Please check your inbox.')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend confirmation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Resend Confirmation"
      description="Enter your email to receive a new confirmation link"
      footer={
        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          <p className="text-sm text-muted-foreground">
            Already confirmed?{' '}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </CardFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Resend Confirmation'}
        </Button>
      </form>
    </AuthShell>
  )
}
