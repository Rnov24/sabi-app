import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError } from '@/lib/errors'

const updateReviewSchema = z.object({
  rounds_taken: z.number().int().min(1).max(20),
})

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const { rounds_taken } = updateReviewSchema.parse(body)

  const supabase = await createClient()

  // Get current SM-2 values
  const { data: event, error } = await supabase
    .from('mastery_events')
    .select('ease_factor, interval_days')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !event) throw new NotFoundError('Mastery event')

  // Calculate new SM-2 values
  const newEaseFactor = Math.max(1.3, event.ease_factor + (0.1 - rounds_taken * 0.02))
  const newInterval = Math.round(event.interval_days * newEaseFactor)
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

  const { error: updateError } = await supabase
    .from('mastery_events')
    .update({
      ease_factor: newEaseFactor,
      interval_days: newInterval,
      next_review_date: nextReviewDate.toISOString().split('T')[0],
      rounds_taken,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) throw updateError

  return ok({
    next_review_date: nextReviewDate.toISOString().split('T')[0],
    interval_days: newInterval,
  })
})
