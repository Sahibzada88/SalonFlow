'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Calendar, Clock, Star } from 'lucide-react'
import { api, feedbackApi } from '@/services/api'

export default function CustomerAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [feedbackDialogApt, setFeedbackDialogApt] = useState<any | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const [aptRes, feedbackRes] = await Promise.all([
        api.get('/appointments/customer/appointments'),
        feedbackApi.getMine().catch(() => ({ data: [] })),
      ])
      setAppointments(aptRes.data || [])
      setFeedbackGiven(new Set((feedbackRes.data || []).map((f: any) => f.appointment_id)))
    } catch (error) {
      console.error('Error fetching appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      requested: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Confirmed' },
      rescheduled_pending: { className: 'bg-rose-100 text-rose-800', label: 'Reschedule Pending' },
      completed: { className: 'bg-muted text-foreground', label: 'Completed' },
      cancelled: { className: 'bg-red-100 text-red-800', label: 'Cancelled' },
      'no-show': { className: 'bg-muted text-foreground', label: 'No Show' },
    }
    const variant = variants[status] || variants.requested
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const openFeedbackDialog = (apt: any) => {
    setFeedbackDialogApt(apt)
    setRating(5)
    setComment('')
    setFeedbackError('')
  }

  const submitFeedback = async () => {
    if (!feedbackDialogApt) return
    setSubmitting(true)
    setFeedbackError('')
    try {
      await feedbackApi.create({
        appointment_id: feedbackDialogApt.id,
        rating,
        comment: comment.trim() || undefined,
      })
      setFeedbackGiven((prev) => new Set(prev).add(feedbackDialogApt.id))
      setFeedbackDialogApt(null)
    } catch (err: any) {
      setFeedbackError(err.response?.data?.detail || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">Loading appointments...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">My Appointments</h1>
          <p className="text-muted-foreground">View all your appointments</p>
        </div>
        <Link href="/customer/book">
          <Button>
            <Calendar className="h-4 w-4 mr-2" />
            Book New Appointment
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No appointments found. Book one now!</p>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{apt.title || 'Service'}</h4>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {apt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {apt.start_time} - {apt.end_time}
                      </span>
                    </div>
                  </div>

                  {apt.status === 'completed' && (
                    feedbackGiven.has(apt.id) ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                        Feedback given
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openFeedbackDialog(apt)}>
                        <Star className="h-4 w-4 mr-1.5" />
                        Leave Feedback
                      </Button>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!feedbackDialogApt} onOpenChange={(open) => !open && setFeedbackDialogApt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Feedback</DialogTitle>
          </DialogHeader>

          {feedbackError && <p className="text-sm text-destructive">{feedbackError}</p>}

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{feedbackDialogApt?.title || 'Service'}</p>

            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}>
                  <Star
                    className={`h-7 w-7 ${n <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/30'}`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Tell us about your experience (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogApt(null)}>Cancel</Button>
            <Button onClick={submitFeedback} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
