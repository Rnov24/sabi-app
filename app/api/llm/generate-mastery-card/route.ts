import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, LLMError } from '@/lib/errors'
import { callGemini } from '@/lib/llm/client'
import { buildGenerateMasteryCardPrompt } from '@/lib/llm/prompts/generate-mastery-card'
import { checkRateLimit } from '@/lib/rate-limit'
import { nanoid } from 'nanoid'

const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const inputSchema = z.object({
  topic_id: z.string().uuid(),
  best_explanation: z.string().min(10),
  rounds_taken: z.number().int().min(1).max(20),
  conversation_history: z.array(conversationMessageSchema),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  await checkRateLimit(user.id, 'generate-mastery-card', 20)

  const body = await request.json()
  const {
    topic_id,
    best_explanation,
    rounds_taken,
    conversation_history,
  } = inputSchema.parse(body)

  const supabase = await createClient()

  // Verify topic ownership
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select(`
      title,
      courses!inner (
        user_id
      )
    `)
    .eq('id', topic_id)
    .single()

  if (topicError || !topic) throw new NotFoundError('Topic')
  if ((topic as any).courses?.user_id !== user.id) throw new NotFoundError('Topic')

  // Generate mastery card text via LLM
  const prompt = buildGenerateMasteryCardPrompt(
    topic.title,
    best_explanation,
    conversation_history
  )

  let masteryCardText: string
  try {
    masteryCardText = await callGemini(prompt, {
      temperature: 0.5,
      maxOutputTokens: 512,
      userId: user.id,
      route: 'generate-mastery-card',
    })
    // Clean up — remove any wrapping quotes or markdown
    masteryCardText = masteryCardText.replace(/^["']|["']$/g, '').trim()
  } catch {
    // Fallback: use the best explanation as-is
    masteryCardText = best_explanation
  }

  // Calculate SM-2
  const easeFactor = Math.max(1.3, 2.5 + (0.1 - rounds_taken * 0.02))
  const intervalDays = 1 // First mastery always 1 day
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays)

  // Generate unique public slug with collision check
  let publicSlug: string = ''
  let attempts = 0
  do {
    publicSlug = nanoid(8)
    const { data: existing } = await supabase
      .from('mastery_events')
      .select('id')
      .eq('public_slug', publicSlug)
      .single()
    if (!existing) break
    attempts++
  } while (attempts < 5)

  // Insert mastery event
  const { data: masteryEvent, error: insertError } = await supabase
    .from('mastery_events')
    .insert({
      user_id: user.id,
      topic_id,
      mastery_card_text: masteryCardText,
      public_slug: publicSlug,
      rounds_taken,
      ease_factor: easeFactor,
      interval_days: intervalDays,
      next_review_date: nextReviewDate.toISOString().split('T')[0],
    })
    .select('id, public_slug, next_review_date, mastery_card_text')
    .single()

  if (insertError || !masteryEvent) throw new LLMError('Failed to save mastery card')

  return ok({
    mastery_event_id: masteryEvent.id,
    public_slug: masteryEvent.public_slug,
    next_review_date: masteryEvent.next_review_date,
    mastery_card_text: masteryEvent.mastery_card_text,
  })
})
