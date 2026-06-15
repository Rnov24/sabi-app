import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimitError } from './errors'

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxPerDay: number
): Promise<void> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Upsert: increment counter or create new entry
  const { data, error } = await supabase
    .from('rate_limits')
    .upsert(
      { user_id: userId, endpoint, date: today, count: 1 },
      { onConflict: 'user_id,endpoint,date' }
    )
    .select('count')
    .single()

  if (error) {
    // If upsert fails, try to increment existing
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('date', today)
      .single()

    if (existing && existing.count >= maxPerDay) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      throw new RateLimitError(tomorrow.toISOString().split('T')[0])
    }

    // Increment
    await supabase.rpc('increment_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_date: today,
    })
    return
  }

  if (data && data.count > maxPerDay) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    throw new RateLimitError(tomorrow.toISOString().split('T')[0])
  }

  // Increment the counter
  await supabase
    .from('rate_limits')
    .update({ count: (data?.count || 0) + 1 })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .eq('date', today)
}
