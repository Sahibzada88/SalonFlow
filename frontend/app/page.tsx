'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Scissors, Calendar, Users, BarChart3, CheckCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'
  const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Salon Management Made Simple'

  const features = [
    {
      icon: <Calendar className="h-7 w-7 text-primary" />,
      title: "Smart Scheduling",
      description: "Book appointments in seconds with our intuitive calendar"
    },
    {
      icon: <Users className="h-7 w-7 text-primary" />,
      title: "Customer Management",
      description: "Track customer history, preferences, and loyalty"
    },
    {
      icon: <Scissors className="h-7 w-7 text-primary" />,
      title: "Service Catalog",
      description: "Manage services, pricing, and staff expertise"
    },
    {
      icon: <BarChart3 className="h-7 w-7 text-primary" />,
      title: "Business Analytics",
      description: "Real-time insights into revenue and growth"
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl salon-gradient flex items-center justify-center">
              <Scissors className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-serif font-semibold text-foreground">{appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button>Staff / Owner Login</Button>
            </Link>
            {/* FIXED: this previously also linked to /auth/login (the
                staff/owner form), so a customer clicking "Customer Login"
                landed on the wrong login page entirely. */}
            <Link href="/auth/login-customer">
              <Button variant="outline">Customer Login</Button>
            </Link>
            <Link href="/auth/register-customer">
              <Button variant="outline" className="border-primary text-primary hover:bg-secondary">
                Register
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 salon-gradient opacity-[0.04]" aria-hidden="true" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase bg-accent text-accent-foreground px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Built for modern salons
            </div>
            <h1 className="text-5xl md:text-6xl font-serif font-semibold text-foreground mb-6 leading-tight">
              {appDescription}
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              The all-in-one platform for salons to manage appointments,
              customers, billing, and grow your business.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/auth/login">
                <Button size="lg" className="text-base px-8 h-12">
                  Get Started
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-base px-8 h-12">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-semibold text-foreground mb-4">
            Everything You Need to Run Your Salon
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From appointment booking to customer loyalty, we've got you covered.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/60 salon-card-shadow hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <Card className="border-2 border-primary/20 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="inline-block bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-medium mb-4">
                Launch Special
              </div>
              <h3 className="text-3xl font-serif font-semibold text-foreground mb-2">{appName} Pro</h3>
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className="text-4xl font-bold text-foreground">Rs. 2,999</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground mb-6">Everything included. No hidden fees.</p>
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
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-foreground/90">{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/login">
                <Button size="lg" className="w-full h-12">
                  Start Your Free Trial
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Powered by {appName}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 {appName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
