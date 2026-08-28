'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Scissors, Calendar, Users, BarChart3, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  // ✅ Get salon name from environment
  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || 'Dev Salon'
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'
  const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Salon Management Made Simple'

  const features = [
    {
      icon: <Calendar className="h-8 w-8 text-blue-600" />,
      title: "Smart Scheduling",
      description: "Book appointments in seconds with our intuitive calendar"
    },
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: "Customer Management",
      description: "Track customer history, preferences, and loyalty"
    },
    {
      icon: <Scissors className="h-8 w-8 text-blue-600" />,
      title: "Service Catalog",
      description: "Manage services, pricing, and staff expertise"
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
      title: "Business Analytics",
      description: "Real-time insights into revenue and growth"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scissors className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Staff / Owner Login
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline">
                Customer Login
              </Button>
            </Link>
            <Link href="/auth/register-customer">
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                Register
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            {appDescription}
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The all-in-one SaaS platform for salons to manage appointments, 
            customers, billing, and grow your business.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth/login">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Run Your Salon
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            From appointment booking to customer loyalty, we have got you covered
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <Card className="border-2 border-blue-200 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-medium mb-4">
                Launch Special
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">{appName} Pro</h3>
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">Rs. 2,999</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 mb-6">Everything included. No hidden fees.</p>
              <div className="space-y-2 text-left max-w-sm mx-auto mb-8">
                {[
                  "Unlimited appointments",
                  "Customer management",
                  "Staff scheduling",
                  "Inventory tracking",
                  "Billing and invoices",
                  "Reports and analytics"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/login">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Your Free Trial
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-gray-900">{appName}</span>
              <span className="text-xs text-gray-400">|</span>
              <Link href="/" className="text-xs text-blue-600 hover:underline font-medium">
                {salonName}
              </Link>
              <span className="text-xs text-gray-400">- Powered by {appName}</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 {appName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}