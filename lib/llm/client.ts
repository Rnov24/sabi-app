import { GoogleGenAI } from '@google/genai'
import { LLMError } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const MODEL = 'gemini-3-flash-preview'
const MAX_RETRIES = 2
const TIMEOUT_MS = 45_000

interface LLMCallOptions {
  model?: string
  temperature?: number
  maxOutputTokens?: number
  userId?: string
  route?: string
}

async function logLLMCall(params: {
  userId?: string
  route?: string
  model: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
  success: boolean
}) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('llm_logs').insert({
      user_id: params.userId || null,
      route: params.route || 'unknown',
      model: params.model,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      duration_ms: params.durationMs,
      success: params.success,
    })
    if (error) {
      console.error('Failed to write LLM log to database:', error)
    }
  } catch (err) {
    console.error('Error in logLLMCall:', err)
  }
}

/**
 * Call Gemini with automatic retry and error normalization.
 * Returns the parsed text response.
 */
export async function callGemini(
  prompt: string,
  options: LLMCallOptions = {}
): Promise<string> {
  const {
    model = MODEL,
    temperature = 0.7,
    maxOutputTokens = 2048,
    userId,
    route,
  } = options

  const startTime = Date.now()
  let lastError: Error | null = null
  let response: any = null

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s
          await sleep(1000 * attempt)
        }

        response = await withTimeout(
          genai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature,
              maxOutputTokens,
            },
          }),
          TIMEOUT_MS
        )

        const text = response.text
        if (!text) {
          throw new LLMError('Empty response from Gemini')
        }

        // Log success
        const durationMs = Date.now() - startTime
        logLLMCall({
          userId,
          route,
          model,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          durationMs,
          success: true,
        })

        return text
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (error instanceof LLMError) throw error

        // Don't retry on auth errors
        if (lastError.message.includes('API key') || lastError.message.includes('401')) {
          throw new LLMError('AI service configuration error')
        }
      }
    }

    throw new LLMError(
      lastError?.message || 'AI service temporarily unavailable'
    )
  } catch (err) {
    // Log failure
    const durationMs = Date.now() - startTime
    logLLMCall({
      userId,
      route,
      model,
      durationMs,
      success: false,
    })
    throw err
  }
}

/**
 * Call Gemini with a PDF document (base64) for parsing.
 */
export async function callGeminiWithDocument(
  prompt: string,
  pdfBase64: string,
  options: LLMCallOptions = {}
): Promise<string> {
  const {
    model = MODEL,
    temperature = 0.3,
    maxOutputTokens = 4096,
    userId,
    route,
  } = options

  const startTime = Date.now()
  let lastError: Error | null = null
  let response: any = null

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(1000 * attempt)
        }

        response = await withTimeout(
          genai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: pdfBase64,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            config: {
              temperature,
              maxOutputTokens,
            },
          }),
          TIMEOUT_MS
        )

        const text = response.text
        if (!text) {
          throw new LLMError('Empty response from Gemini')
        }

        // Log success
        const durationMs = Date.now() - startTime
        logLLMCall({
          userId,
          route,
          model,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          durationMs,
          success: true,
        })

        return text
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (error instanceof LLMError) throw error
        if (lastError.message.includes('API key') || lastError.message.includes('401')) {
          throw new LLMError('AI service configuration error')
        }
      }
    }

    throw new LLMError(
      lastError?.message || 'AI service temporarily unavailable'
    )
  } catch (err) {
    // Log failure
    const durationMs = Date.now() - startTime
    logLLMCall({
      userId,
      route,
      model,
      durationMs,
      success: false,
    })
    throw err
  }
}

/**
 * Extract JSON from LLM response text.
 * Handles cases where the LLM wraps JSON in markdown code blocks.
 */
export function extractJSON(text: string): string {
  // Try to extract from code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  // Otherwise try to find raw JSON
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/)
  if (jsonMatch) {
    return jsonMatch[0].trim()
  }
  return text.trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new LLMError('AI request timed out')), ms)
    ),
  ])
}
