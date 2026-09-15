'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Star } from 'lucide-react'
import { feedbackApi } from '@/services/api'

interface Feedback {
  id: string
  service_name?: string
  rating: number
  comment?: string
  created_at: string
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export default function MyFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    feedbackApi.getMine()
      .then((res) => setFeedback(res.data || []))
      .catch(() => setFeedback([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-semibold text-foreground">My Feedback</h1>
        <p className="text-muted-foreground">Reviews you've left after your appointments</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : feedback.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Star className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              You haven't left any feedback yet - you can leave a review from a completed
              appointment on the My Appointments page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedback.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-foreground">{f.service_name || 'Service'}</p>
                  <StarRow rating={f.rating} />
                </div>
                {f.comment && <p className="text-sm text-foreground/90 mt-2">{f.comment}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(f.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
