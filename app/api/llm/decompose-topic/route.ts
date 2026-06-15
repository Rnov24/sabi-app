import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { LLMError } from '@/lib/errors'
import { callGemini, extractJSON } from '@/lib/llm/client'
import { buildDecomposeTopicPrompt } from '@/lib/llm/prompts/decompose-topic'
import { decomposeTopicOutputSchema } from '@/lib/llm/validate'
import { checkRateLimit } from '@/lib/rate-limit'

const inputSchema = z.object({
  topic_string: z.string().min(1).max(200),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  await checkRateLimit(user.id, 'decompose-topic', 10)

  const body = await request.json()
  const { topic_string } = inputSchema.parse(body)

  const prompt = buildDecomposeTopicPrompt(topic_string)
  let parsed;

  try {
    const rawResponse = await callGemini(prompt, {
      temperature: 0.5,
      userId: user.id,
      route: 'decompose-topic',
    })
    const jsonStr = extractJSON(rawResponse)
    parsed = decomposeTopicOutputSchema.parse(JSON.parse(jsonStr))
  } catch {
    // Retry once if count is outside 4-8 or parse fails
    try {
      const rawResponse = await callGemini(prompt, {
        temperature: 0.4,
        userId: user.id,
        route: 'decompose-topic',
      })
      const jsonStr = extractJSON(rawResponse)
      parsed = decomposeTopicOutputSchema.parse(JSON.parse(jsonStr))
    } catch {
      throw new LLMError('Failed to decompose topic')
    }
  }

  return ok({ subtopics: parsed })
})
