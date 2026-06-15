import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { ValidationError } from '@/lib/errors'

const createCourseSchema = z.object({
  name: z.string().min(1).max(200),
  source_type: z.enum(['syllabus', 'free']),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  level: z.enum(['intro', 'intermediate', 'advanced']).optional().nullable(),
})

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  const supabase = await createClient()

  const typeFilter = request.nextUrl.searchParams.get('type')

  let query = supabase
    .from('courses')
    .select(`
      id, name, source_type, exam_date, level, join_code, created_at,
      topics(
        id,
        mastery_events(id)
      )
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (typeFilter === 'syllabus' || typeFilter === 'free') {
    query = query.eq('source_type', typeFilter)
  }

  const { data, error } = await query

  if (error) throw error

  const courses = (data || []).map((c: any) => {
    const topics = c.topics || []
    const topic_count = topics.length
    let mastery_count = 0
    for (const topic of topics) {
      if (topic.mastery_events) {
        mastery_count += topic.mastery_events.length
      }
    }
    return {
      id: c.id,
      name: c.name,
      source_type: c.source_type,
      exam_date: c.exam_date,
      level: c.level,
      join_code: c.join_code,
      created_at: c.created_at,
      topic_count,
      mastery_count,
    }
  })

  return ok(courses)
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  const body = await request.json()
  const validated = createCourseSchema.parse(body)

  const supabase = await createClient()

  // Check max 5 active courses
  const { count } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if ((count ?? 0) >= 5) {
    throw new ValidationError('Maximum 5 active courses allowed')
  }

  // Generate a random 6-character uppercase alphanumeric join code for syllabus courses
  const join_code = validated.source_type === 'syllabus'
    ? Math.random().toString(36).substring(2, 8).toUpperCase()
    : null

  const { data, error } = await supabase
    .from('courses')
    .insert({
      user_id: user.id,
      name: validated.name,
      source_type: validated.source_type,
      exam_date: validated.exam_date ?? null,
      level: validated.level ?? null,
      join_code,
    })
    .select()
    .single()

  if (error) throw error
  return created(data)
})
