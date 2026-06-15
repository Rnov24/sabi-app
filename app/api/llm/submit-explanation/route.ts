import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { LLMError } from '@/lib/errors'
import { callGemini, extractJSON } from '@/lib/llm/client'
import { buildSubmitExplanationPrompt } from '@/lib/llm/prompts/submit-explanation'
import { submitExplanationOutputSchema } from '@/lib/llm/validate'
import { checkRateLimit } from '@/lib/rate-limit'

const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const inputSchema = z.object({
  topic_id: z.string().uuid(),
  learning_goal: z.string(),
  explanation: z.string().min(10).max(3000),
  round_number: z.number().int().min(1).max(20),
  conversation_history: z.array(conversationMessageSchema).max(20),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  await checkRateLimit(user.id, 'submit-explanation', 100)

  const body = await request.json()
  const {
    topic_id,
    learning_goal,
    explanation,
    round_number,
    conversation_history,
  } = inputSchema.parse(body)

  // Force mastery after 20 rounds (safety valve)
  if (round_number >= 20) {
    return ok({
      status: 'mastery' as const,
      best_explanation: explanation,
      forced: true,
    })
  }

  // Smart short-circuit: skip LLM for low-effort input
  if (explanation.length < 30) {
    return ok({
      status: 'invalid' as const,
      message: 'Penjelasan terlalu pendek. Coba elaborasi lebih detail dengan kata-katamu sendiri.',
    })
  }

  // Check if explanation is just copying the previous question
  const lastAssistantMsg = [...conversation_history]
    .reverse()
    .find(m => m.role === 'assistant')
  if (
    lastAssistantMsg &&
    explanation.trim().toLowerCase() === lastAssistantMsg.content.trim().toLowerCase()
  ) {
    return ok({
      status: 'invalid' as const,
      message: 'Jelaskan dengan kata-katamu sendiri, bukan mengulang pertanyaan.',
    })
  }

  // Trim conversation history to max 10 pairs (20 messages)
  const trimmedHistory = conversation_history.slice(-20)

  // Fetch topic title for prompt context
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('title')
    .eq('id', topic_id)
    .single()

  const topicTitle = topic?.title ?? 'Unknown topic'

  const prompt = buildSubmitExplanationPrompt(
    topicTitle,
    learning_goal,
    explanation,
    round_number,
    trimmedHistory
  )

  let parsed;
  try {
    const rawResponse = await callGemini(prompt, {
      temperature: 0.6,
      userId: user.id,
      route: 'submit-explanation',
    })
    const jsonStr = extractJSON(rawResponse)
    parsed = submitExplanationOutputSchema.parse(JSON.parse(jsonStr))
  } catch {
    throw new LLMError('Failed to evaluate explanation')
  }

  // Enforce: no mastery before round 2
  if (parsed.status === 'mastery' && round_number < 2) {
    return ok({
      status: 'continue' as const,
      socratic_question: 'Bagus, tapi coba jelaskan lebih dalam lagi. Apa yang membuat kamu yakin dengan pemahaman ini?',
    })
  }

  return ok(parsed)
})
