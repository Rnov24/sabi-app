import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

const joinCourseSchema = z.object({
  join_code: z.string().min(1),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  const body = await request.json()
  const validated = joinCourseSchema.parse(body)

  const supabase = await createClient()

  // 1. Query the courses table for an active course matching the join_code
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, name, user_id')
    .eq('join_code', validated.join_code)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) {
    throw new NotFoundError('Course')
  }

  // 2. Ensure a user cannot join their own course
  if (course.user_id === user.id) {
    throw new ForbiddenError('You cannot join your own course')
  }

  // 3. Check if already a member to avoid duplicate membership error
  const { data: existingMember, error: memberCheckError } = await supabase
    .from('course_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()

  if (memberCheckError) throw memberCheckError

  if (existingMember) {
    throw new ValidationError('You are already a member of this course')
  }

  // 4. Check member count
  const { count, error: countError } = await supabase
    .from('course_members')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', course.id)

  if (countError) throw countError

  if ((count ?? 0) >= 50) {
    throw new ValidationError('Course member limit reached')
  }

  // 5. Insert a row into course_members
  const { error: insertError } = await supabase
    .from('course_members')
    .insert({
      user_id: user.id,
      course_id: course.id,
      role: 'student',
    })

  if (insertError) throw insertError

  return created({
    course_id: course.id,
    course_name: course.name,
  })
})
