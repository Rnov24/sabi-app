import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, LLMError } from '@/lib/errors'
import { callGemini, extractJSON } from '@/lib/llm/client'
import { buildStartSessionPrompt } from '@/lib/llm/prompts/start-session'
import { startSessionOutputSchema } from '@/lib/llm/validate'
import { checkRateLimit } from '@/lib/rate-limit'

const inputSchema = z.object({
  topic_id: z.string().uuid(),
  initial_explanation: z.string().min(10).max(2000),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  await checkRateLimit(user.id, 'start-session', 20)

  const body = await request.json()
  const { topic_id, initial_explanation } = inputSchema.parse(body)

  const supabase = await createClient()

  // Fetch topic + course context; verify ownership or membership
  const { data: topic, error } = await supabase
    .from('topics')
    .select(`
      title,
      difficulty,
      courses!inner (
        id,
        user_id,
        level
      )
    `)
    .eq('id', topic_id)
    .single()

  if (error || !topic) throw new NotFoundError('Topic')
  
  const course = (topic as any).courses
  if (course?.user_id !== user.id) {
    const { data: member, error: memberError } = await supabase
      .from('course_members')
      .select('role')
      .eq('course_id', course?.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !member) {
      throw new NotFoundError('Topic')
    }
  }

  const courseLevel = (topic as any).courses?.level || topic.difficulty || null

  const prompt = buildStartSessionPrompt(
    topic.title,
    courseLevel,
    initial_explanation
  )

  let parsed;
  try {
    const rawResponse = await callGemini(prompt, {
      temperature: 0.7,
      userId: user.id,
      route: 'start-session',
    })
    const jsonStr = extractJSON(rawResponse)
    parsed = startSessionOutputSchema.parse(JSON.parse(jsonStr))
  } catch (err) {
    console.warn('First start-session attempt failed. Retrying...', err)
    try {
      const rawResponse = await callGemini(prompt, {
        temperature: 0.5,
        userId: user.id,
        route: 'start-session',
      })
      const jsonStr = extractJSON(rawResponse)
      parsed = startSessionOutputSchema.parse(JSON.parse(jsonStr))
    } catch (retryErr) {
      console.error('Failed to start session after retry:', retryErr)
      throw new LLMError('Failed to start session')
    }
  }

  // Return to client — nothing saved to DB (stateless)
  return ok(parsed)
})
