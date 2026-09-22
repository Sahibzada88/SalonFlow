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
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

// Runs before React hydrates, so the correct theme class is already on
// <html> for the very first paint - without this, the page would flash
// light mode for a frame (or vice versa) every time a user with a saved
// dark-mode preference loads the app.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('salonflow-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
