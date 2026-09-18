'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { authApi } from '@/services/api'
import { AuthShell } from '@/components/auth/AuthShell'

// FIXED: useSearchParams() requires a Suspense boundary somewhere above it
// in the tree - without one, `next build`'s static prerendering fails for
// this route. The actual form is split into CustomerLoginForm below and
// wrapped in <Suspense> here so only the part that reads the query string
// opts out of static rendering, not the whole page.
export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginForm />
    </Suspense>
  )
}

function CustomerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (searchParams?.get('registered')) {
      setSuccess('Registration successful! Please login.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await authApi.login(email, password)
      // See app/auth/login/page.tsx - access_token is now an httpOnly
      // cookie set directly by the backend, not part of this response.
      const { role, user_id, username, email: userEmail } = response.data

      localStorage.setItem('user_role', role)
      localStorage.setItem('user_id', user_id)
      localStorage.setItem('username', username || '')
      localStorage.setItem('user_email', userEmail)

      router.push('/customer/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Customer Login"
      description="Sign in to manage your appointments"
      footer={
        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/auth/register-customer" className="text-primary hover:underline font-medium">
              Register as Customer
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Are you a salon owner or staff member?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in here
            </Link>
          </p>
        </CardFooter>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
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
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
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
          {loading ? 'Signing in...' : 'Sign In as Customer'}
        </Button>
      </form>
    </AuthShell>
  )
}
