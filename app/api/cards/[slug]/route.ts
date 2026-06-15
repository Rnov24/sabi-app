import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { err } from '@/lib/api-response'

// Public endpoint — no auth required
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mastery_events')
    .select(`
      mastery_card_text,
      created_at,
      topics (
        title,
        courses (
          name
        )
      ),
      profiles (
        display_name
      )
    `)
    .eq('public_slug', slug)
    .single()

  if (error || !data) {
    return err('NOT_FOUND', 'Mastery card not found', 404)
  }

  // Privacy: show only first name + last initial
  const fullName = (data as any).profiles?.display_name || 'Anonymous'
  const nameParts = fullName.split(' ')
  const authorName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : nameParts[0]

  const response = NextResponse.json({
    data: {
      topic_title: (data as any).topics?.title ?? '',
      course_name: (data as any).topics?.courses?.name ?? '',
      mastery_card_text: data.mastery_card_text,
      created_at: data.created_at,
      author_display_name: authorName,
    },
  })

  response.headers.set(
    'Cache-Control',
    'public, max-age=3600, stale-while-revalidate=86400'
  )

  return response
}
