'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'salonflow-theme'

function isDarkActive() {
  return document.documentElement.classList.contains('dark')
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDark(isDarkActive())
  }, [])

  const toggle = () => {
    const next = !isDark
    document.documentElement.classList.toggle('dark', next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    setIsDark(next)
  }

  // Avoid rendering an icon that might not match the real (script-applied)
  // theme until after mount, to prevent a one-frame flash of the wrong icon.
  if (!mounted) {
    return <div className={`h-9 w-9 ${className}`} />
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
