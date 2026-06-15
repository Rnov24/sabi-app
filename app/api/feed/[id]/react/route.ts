import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

const reactSchema = z.object({
  reaction: z.enum(['helpful', 'unclear']),
})

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const body = await request.json()
  const validated = reactSchema.parse(body)

  const supabase = await createClient()

  // 1. Query peer_posts for the post and get the author user_id via mastery_events
  const { data: post, error: postError } = await supabase
    .from('peer_posts')
    .select(`
      id,
      mastery_event_id,
      mastery_events (
        user_id
      )
    `)
    .eq('id', id)
    .single()

  if (postError || !post) {
    throw new NotFoundError('Post')
  }

  // 2. Verify ownership: user cannot react to their own post
  const authorId = (post.mastery_events as any)?.user_id
  if (authorId === user.id) {
    throw new ForbiddenError('You cannot react to your own post')
  }

  // 3. Upsert the reaction into feed_reactions
  const { error: upsertError } = await supabase
    .from('feed_reactions')
    .upsert(
      {
        user_id: user.id,
        post_id: post.id,
        reaction: validated.reaction,
      },
      {
        onConflict: 'user_id,post_id',
      }
    )

  if (upsertError) throw upsertError

  // 4. Query all reactions for this post to count helpful and unclear
  const { data: reactions, error: queryError } = await supabase
    .from('feed_reactions')
    .select('reaction')
    .eq('post_id', post.id)

  if (queryError) throw queryError

  let helpfulCount = 0
  let unclearCount = 0
  for (const r of reactions || []) {
    if (r.reaction === 'helpful') {
      helpfulCount++
    } else if (r.reaction === 'unclear') {
      unclearCount++
    }
  }

  // 5. Update the helpful_count and unclear_count columns on the peer_posts row
  const { error: updateError } = await supabase
    .from('peer_posts')
    .update({
      helpful_count: helpfulCount,
      unclear_count: unclearCount,
    })
    .eq('id', post.id)

  if (updateError) throw updateError

  return ok({
    success: true,
    helpful_count: helpfulCount,
    unclear_count: unclearCount,
  })
})
