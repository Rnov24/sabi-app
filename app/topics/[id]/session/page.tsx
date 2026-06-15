import { notFound, redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SessionClient from './session-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SocraticSessionPage({ params }: PageProps) {
  const { id } = await params
  
  let user
  try {
    user = await getAuthUser()
  } catch (err) {
    // Redirect to login if unauthorized
    redirect('/login')
  }

  const supabase = await createClient()

  // Query topic and course details, verifying ownership
  const { data: topic, error } = await supabase
    .from('topics')
    .select(`
      id,
      title,
      course_id,
      difficulty,
      courses!inner (
        id,
        name,
        user_id
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !topic) {
    notFound()
  }

  // Double check user ownership or membership
  const course = (topic as any).courses
  if (course.user_id !== user.id) {
    const { data: member, error: memberError } = await supabase
      .from('course_members')
      .select('role')
      .eq('course_id', course.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !member) {
      notFound()
    }
  }

  return (
    <SessionClient
      topicId={topic.id}
      topicTitle={topic.title}
      courseId={course.id}
      courseName={course.name}
      difficulty={topic.difficulty}
    />
  )
}
