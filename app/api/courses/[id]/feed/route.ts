import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors'

const createPeerPostSchema = z.object({
  mastery_event_id: z.string().uuid(),
})

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  // 1. Verify course existence and retrieve user_id of course owner
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) {
    throw new NotFoundError('Course')
  }

  // 2. Check membership: Either course owner or in course_members
  const { data: member, error: memberError } = await supabase
    .from('course_members')
    .select('role')
    .eq('course_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) throw memberError

  if (!member && course.user_id !== user.id) {
    throw new ForbiddenError('You are not a member of this course')
  }

  // 3. Query peer_posts for this course, joining mastery_events and profiles
  const { data: posts, error: postsError } = await supabase
    .from('peer_posts')
    .select(`
      id,
      mastery_event_id,
      course_id,
      is_visible,
      helpful_count,
      unclear_count,
      created_at,
      mastery_events (
        mastery_card_text,
        profiles:user_id (
          display_name
        ),
        topics:topic_id (
          title
        )
      )
    `)
    .eq('course_id', id)
    .eq('is_visible', true)
    .order('helpful_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (postsError) throw postsError

  const formattedPosts = (posts || []).map((post: any) => {
    const me = post.mastery_events
    const profile = Array.isArray(me?.profiles) ? me.profiles[0] : me?.profiles
    const topic = Array.isArray(me?.topics) ? me.topics[0] : me?.topics

    return {
      id: post.id,
      mastery_event_id: post.mastery_event_id,
      course_id: post.course_id,
      is_visible: post.is_visible,
      helpful_count: post.helpful_count,
      unclear_count: post.unclear_count,
      created_at: post.created_at,
      author_display_name: profile?.display_name ?? 'Unknown Student',
      topic_title: topic?.title ?? 'Unknown Topic',
      mastery_card_text: me?.mastery_card_text ?? '',
    }
  })

  return ok(formattedPosts)
})

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const validated = createPeerPostSchema.parse(body)

  const supabase = await createClient()

  // 1. Verify the mastery event exists and is owned by the current user
  const { data: masteryEvent, error: meError } = await supabase
    .from('mastery_events')
    .select(`
      id,
      user_id,
      topic_id,
      topics:topic_id (
        course_id
      )
    `)
    .eq('id', validated.mastery_event_id)
    .single()

  if (meError || !masteryEvent) {
    throw new NotFoundError('Mastery event')
  }

  if (masteryEvent.user_id !== user.id) {
    throw new ForbiddenError('You do not own this mastery event')
  }

  // 2. Check if a peer post already exists for this mastery event
  const { data: existingPost, error: postError } = await supabase
    .from('peer_posts')
    .select('id')
    .eq('mastery_event_id', validated.mastery_event_id)
    .maybeSingle()

  if (postError) throw postError

  if (existingPost) {
    throw new ValidationError('A peer post already exists for this mastery event')
  }

  // 3. Verify the topic's course matches the route parameter
  const topicCourseId = (masteryEvent.topics as any)?.course_id
  if (!topicCourseId) {
    throw new ValidationError('Mastery event topic does not belong to any course')
  }

  if (topicCourseId !== id) {
    throw new ValidationError('Mastery event course does not match route course')
  }

  // 4. Insert a row into peer_posts
  const { data: newPost, error: insertError } = await supabase
    .from('peer_posts')
    .insert({
      mastery_event_id: masteryEvent.id,
      course_id: topicCourseId,
      is_visible: true,
    })
    .select()
    .single()

  if (insertError) throw insertError

  return created(newPost)
})
