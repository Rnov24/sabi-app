import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError } from '@/lib/errors'

const updateTopicSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  parent_topic: z.string().max(150).nullable().optional(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']).nullable().optional(),
})

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const validated = updateTopicSchema.parse(body)

  const supabase = await createClient()

  // Verify ownership via course
  const { data: topic } = await supabase
    .from('topics')
    .select('id, course_id, courses!inner(user_id)')
    .eq('id', id)
    .single()

  if (!topic || (topic as any).courses?.user_id !== user.id) {
    throw new NotFoundError('Topic')
  }

  const { data, error } = await supabase
    .from('topics')
    .update(validated)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return ok(data)
})

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  // Verify ownership via course
  const { data: topic } = await supabase
    .from('topics')
    .select('id, course_id, courses!inner(user_id), mastery_events(count)')
    .eq('id', id)
    .single()

  if (!topic || (topic as any).courses?.user_id !== user.id) {
    throw new NotFoundError('Topic')
  }

  const hasMastery = ((topic as any).mastery_events?.[0]?.count ?? 0) > 0

  if (hasMastery) {
    // Soft delete if mastery exists
    await supabase
      .from('topics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  } else {
    // Hard delete if no mastery
    await supabase.from('topics').delete().eq('id', id)
  }

  return ok({ deleted: true })
})
