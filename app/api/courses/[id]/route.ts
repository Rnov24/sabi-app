import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

const updateCourseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  level: z.enum(['intro', 'intermediate', 'advanced']).nullable().optional(),
})

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      topics (
        id, title, parent_topic, difficulty, display_order, created_at
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) throw new NotFoundError('Course')

  // Check if owner or member
  if (data.user_id !== user.id) {
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

  return ok(data)
})

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const validated = updateCourseSchema.parse(body)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .update(validated)
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error || !data) throw new NotFoundError('Course')
  return ok(data)
})

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  // Soft delete
  const { error } = await supabase
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error

  // Also soft-delete topics
  await supabase
    .from('topics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('course_id', id)

  return ok({ deleted: true })
})
