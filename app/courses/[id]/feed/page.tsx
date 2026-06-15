import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import FeedPageClient from './feed-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FeedPage({ params }: PageProps) {
  // 1. Await dynamic parameters (Next.js 16 convention)
  const { id } = await params

  let user
  try {
    user = await getAuthUser()
  } catch {
    redirect('/login')
  }

  const supabase = await createClient()

  // 2. Fetch the course and its owner's ID
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, name, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) {
    notFound()
  }

  // 3. Verify membership: either course owner or in course_members
  const { data: member, error: memberError } = await supabase
    .from('course_members')
    .select('role')
    .eq('course_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    throw memberError
  }

  const isOwner = course.user_id === user.id
  if (!member && !isOwner) {
    notFound()
  }

  // 4. Query initial peer feed posts for the course (joining mastery_events and profiles)
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

  if (postsError) {
    throw postsError
  }

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

  // 5. Query user's current reactions for the posts in this course
  const { data: reactionsData, error: reactionsError } = await supabase
    .from('feed_reactions')
    .select('post_id, reaction')
    .eq('user_id', user.id)

  if (reactionsError) {
    throw reactionsError
  }

  const initialUserReactions: Record<string, 'helpful' | 'unclear'> = {}
  if (reactionsData) {
    for (const r of reactionsData) {
      initialUserReactions[r.post_id] = r.reaction as 'helpful' | 'unclear'
    }
  }

  return (
    <FeedPageClient
      courseId={id}
      courseName={course.name}
      initialPosts={formattedPosts}
      initialUserReactions={initialUserReactions}
    />
  )
}
