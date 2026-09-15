import { Scissors } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthShell({
  title,
  description,
  eyebrow,
  children,
  footer,
}: {
  title: string
  description?: string
  eyebrow?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 salon-gradient opacity-[0.05]" aria-hidden="true" />
      <Card className="w-full max-w-md relative salon-card-shadow border-border/60">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl salon-gradient flex items-center justify-center">
              <Scissors className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          {eyebrow && (
            <span className="text-[11px] font-medium tracking-wide uppercase text-primary mb-1">{eyebrow}</span>
          )}
          <CardTitle className="text-2xl font-serif">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
        {footer}
      </Card>
      <p className="absolute bottom-4 text-center w-full text-xs text-muted-foreground">
        Powered by {process.env.NEXT_PUBLIC_APP_NAME || 'SalonFlow'}
      </p>
    </div>
  )
}
