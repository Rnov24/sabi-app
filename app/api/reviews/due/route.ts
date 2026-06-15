import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('mastery_events')
    .select(`
      id,
      topic_id,
      next_review_date,
      topics (
        title,
        courses (
          name
        )
      )
    `)
    .eq('user_id', user.id)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true })

  if (error) throw error

  const reviews = (data || []).map((r: any) => {
    const reviewDate = new Date(r.next_review_date)
    const todayDate = new Date(today)
    const daysOverdue = Math.floor(
      (todayDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      mastery_event_id: r.id,
      topic_id: r.topic_id,
      topic_title: r.topics?.title ?? '',
      course_name: r.topics?.courses?.name ?? '',
      next_review_date: r.next_review_date,
      days_overdue: daysOverdue,
    }
  })

  return ok(reviews)
})
