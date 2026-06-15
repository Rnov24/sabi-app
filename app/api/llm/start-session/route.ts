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

  // Fetch topic + course context; verify ownership
  const { data: topic, error } = await supabase
    .from('topics')
    .select(`
      title,
      difficulty,
      courses!inner (
        user_id,
        level
      )
    `)
    .eq('id', topic_id)
    .single()

  if (error || !topic) throw new NotFoundError('Topic')
  if ((topic as any).courses?.user_id !== user.id) throw new NotFoundError('Topic')

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
  } catch {
    throw new LLMError('Failed to start session')
  }

  // Return to client — nothing saved to DB (stateless)
  return ok(parsed)
})
