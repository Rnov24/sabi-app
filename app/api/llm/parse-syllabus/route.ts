import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ok, err } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, LLMError } from '@/lib/errors'
import { callGeminiWithDocument, extractJSON } from '@/lib/llm/client'
import { buildParseSyllabusPrompt } from '@/lib/llm/prompts/parse-syllabus'
import { parseSyllabusOutputSchema } from '@/lib/llm/validate'
import { checkRateLimit } from '@/lib/rate-limit'

const inputSchema = z.object({
  course_id: z.string().uuid(),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  await checkRateLimit(user.id, 'parse-syllabus', 3)

  const body = await request.json()
  const { course_id } = inputSchema.parse(body)

  const supabase = await createClient()

  // Verify ownership and get syllabus URL
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, syllabus_url, source_type')
    .eq('id', course_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) throw new NotFoundError('Course')
  if (!course.syllabus_url) {
    return err('NO_SYLLABUS', 'Upload a syllabus PDF first', 422)
  }

  // Download PDF from Supabase Storage
  const adminClient = createAdminClient()
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from('syllabi')
    .download(course.syllabus_url)

  if (downloadError || !fileData) {
    throw new LLMError('Failed to retrieve syllabus PDF')
  }

  // Convert to base64
  const arrayBuffer = await fileData.arrayBuffer()
  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64')

  // Call Gemini with PDF
  const prompt = buildParseSyllabusPrompt()
  let parsed;
  let retried = false;

  try {
    const rawResponse = await callGeminiWithDocument(prompt, pdfBase64, {
      userId: user.id,
      route: 'parse-syllabus',
    })
    const jsonStr = extractJSON(rawResponse)
    parsed = parseSyllabusOutputSchema.parse(JSON.parse(jsonStr))
  } catch (parseError) {
    if (retried) throw new LLMError('Failed to parse syllabus output')
    retried = true
    // Retry once
    try {
      const rawResponse = await callGeminiWithDocument(prompt, pdfBase64, {
        userId: user.id,
        route: 'parse-syllabus',
      })
      const jsonStr = extractJSON(rawResponse)
      parsed = parseSyllabusOutputSchema.parse(JSON.parse(jsonStr))
    } catch {
      throw new LLMError('Failed to parse syllabus after retry')
    }
  }

  // Limit to 30 topics
  const topics = parsed.topics.slice(0, 30)

  // Delete existing topics for this course
  await supabase
    .from('topics')
    .delete()
    .eq('course_id', course_id)

  // Insert new topics in batch
  const topicRows = topics.map(t => ({
    course_id,
    title: t.title,
    parent_topic: t.parent_topic,
    display_order: t.display_order,
  }))

  const { error: insertError } = await supabase
    .from('topics')
    .insert(topicRows)

  if (insertError) throw insertError

  // Update course level and exam date
  await supabase
    .from('courses')
    .update({
      level: parsed.course_level,
      exam_date: parsed.exam_date,
    })
    .eq('id', course_id)

  return ok({
    topics_created: topics.length,
    course_level: parsed.course_level,
    exam_date: parsed.exam_date,
  })
})
