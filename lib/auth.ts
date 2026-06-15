import { createClient } from '@/lib/supabase/server'
import { UnauthorizedError } from './errors'
import type { User } from '@supabase/supabase-js'

export async function getAuthUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError()
  }

  return user
}
