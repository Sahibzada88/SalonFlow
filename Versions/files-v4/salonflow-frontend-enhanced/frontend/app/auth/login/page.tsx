'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Mail, User } from 'lucide-react'
import { authApi } from '@/services/api'
import { AuthShell } from '@/components/auth/AuthShell'

export default function LoginPage() {
  const router = useRouter()
  const [loginInput, setLoginInput] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      localStorage.clear()

      const response = await authApi.login(loginInput, password)
      // NOTE: access_token is no longer in this response - the backend
      // sets it as an httpOnly cookie directly, so the browser stores it
      // automatically and JS never sees or touches it. Only non-sensitive
      // display info is kept in localStorage, for quick UI state (e.g. the
      // Sidebar's role badge) without needing an extra /auth/me round trip.
      const { role, user_id, username, email } = response.data

      localStorage.setItem('user_role', role)
      localStorage.setItem('user_id', user_id)
      localStorage.setItem('username', username || '')
      localStorage.setItem('user_email', email)

      if (role === 'owner' || role === 'staff') {
        router.push('/dashboard')
      } else {
        router.push('/customer/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isEmail = loginInput.includes('@')

  return (
    <AuthShell
      title="Welcome back"
      description="Staff & Owner Portal - sign in to your account"
      footer={
        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          {/* Owner/staff self-registration was removed - those accounts
              are provisioned separately (owner via the setup script, staff
              by an owner from the dashboard), so only a login form is
              shown here now. */}
          <p className="text-sm text-muted-foreground text-center">
            Are you a customer?{' '}
            <Link href="/auth/login-customer" className="text-primary hover:underline font-medium">
              Customer login
            </Link>
          </p>
        </CardFooter>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="loginInput">Username or Email</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {isEmail ? <Mail className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <Input
              id="loginInput"
              type="text"
              placeholder="Enter username or email"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/auth/resend-confirmation" className="text-sm text-primary hover:underline">
          Resend confirmation email
        </Link>
      </div>
    </AuthShell>
  )
}
