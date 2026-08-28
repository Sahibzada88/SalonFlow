import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// ✅ Get app name from environment
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
      <body className={inter.className}>{children}</body>
    </html>
  )
}