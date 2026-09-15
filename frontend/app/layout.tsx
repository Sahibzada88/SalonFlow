import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

// Two-font system: an elegant serif for headings/branding (salon, boutique
// feel) and a clean sans for body/UI text (readability in dashboards,
// tables, forms). This replaces the previous single-font (Inter-only)
// setup, which read as a generic admin dashboard rather than a salon
// product.
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' })

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Salon Management Made Simple'

export const metadata: Metadata = {
  title: appName + ' - ' + appDescription,
  description: 'Manage your salon appointments, customers, and billing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>{children}</body>
    </html>
  )
}
