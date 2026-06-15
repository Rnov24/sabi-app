import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

const createTopicSchema = z.object({
  title: z.string().min(1).max(150),
  parent_topic: z.string().max(150).optional().nullable(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']).optional().nullable(),
  display_order: z.number().int().optional(),
})

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  // Verify course ownership or membership
  const { data: course } = await supabase
    .from('courses')
    .select('id, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!course) throw new NotFoundError('Course')

  if (course.user_id !== user.id) {
    const { data: member, error: memberError } = await supabase
      .from('course_members')
      .select('role')
      .eq('course_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError) throw memberError
    if (!member) {
      throw new ForbiddenError('You are not a member of this course')
    }
  }

  // Get topics with mastery status
  const { data: topics, error } = await supabase
    .from('topics')
    .select(`
      id, title, parent_topic, difficulty, display_order, created_at,
      mastery_events (
        id, created_at, next_review_date, public_slug
      )
    `)
    .eq('course_id', id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (error) throw error

  const enriched = (topics || []).map((t: any) => {
    // Sort mastery events by created_at descending to get the latest one
    const latestMastery = t.mastery_events && t.mastery_events.length > 0
      ? [...t.mastery_events].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    return {
      id: t.id,
      title: t.title,
      parent_topic: t.parent_topic,
      difficulty: t.difficulty,
      display_order: t.display_order,
      created_at: t.created_at,
      mastered: !!latestMastery,
      last_mastered_at: latestMastery?.created_at ?? null,
      next_review_date: latestMastery?.next_review_date ?? null,
      public_slug: latestMastery?.public_slug ?? null,
    }
  })

  return ok(enriched)
})

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const validated = createTopicSchema.parse(body)

  const supabase = await createClient()

  // Verify course ownership
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!course) throw new NotFoundError('Course')

  const { data, error } = await supabase
    .from('topics')
    .insert({
      course_id: id,
      title: validated.title,
      parent_topic: validated.parent_topic ?? null,
      difficulty: validated.difficulty ?? null,
      display_order: validated.display_order ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  return created(data)
})
