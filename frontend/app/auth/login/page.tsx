'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Scissors, AlertCircle, Mail, User } from 'lucide-react'
import { authApi } from '@/services/api'

export default function LoginPage() {
  const router = useRouter()
  const [loginInput, setLoginInput] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'
  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || ''

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      // ✅ Clear all previous data before login
      localStorage.clear()
      
      const response = await authApi.login(loginInput, password)
      const { access_token, role, user_id, username, email } = response.data
      
      // ✅ Set fresh data
      localStorage.setItem('access_token', access_token)
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
      const errorMsg = err.response?.data?.detail || 'Login failed. Please try again.'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const isEmail = loginInput.includes('@')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Scissors className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">{appName}</CardTitle>
          {salonName && (
            <CardDescription className="text-xs text-gray-400">{salonName}</CardDescription>
          )}
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
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
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
              <p className="text-xs text-gray-400">
                Enter your {isEmail ? 'email' : 'username'}
              </p>
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
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Link href="/auth/resend-confirmation" className="text-sm text-blue-600 hover:underline">
              Resend confirmation email
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/register-customer" className="text-blue-600 hover:underline font-medium">
              Register as Customer
            </Link>
          </p>
          <p className="text-sm text-gray-500 text-center">
            <span className="text-xs text-gray-400">Owners: Contact admin for credentials</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}