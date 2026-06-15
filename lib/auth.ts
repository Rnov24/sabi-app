import { createClient } from '@/lib/supabase/server'
import { UnauthorizedError } from './errors'
import type { User } from '@supabase/supabase-js'
import { headers } from 'next/headers'

export async function getAuthUser(): Promise<User> {
  const supabase = await createClient()
  let user: User | null = null
  let error: any = null

  try {
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const res = await supabase.auth.getUser(token)
      user = res.data.user
      error = res.error
    }
  } catch (e) {
    // Ignore error if headers() is not available
  }

  if (!user) {
    const res = await supabase.auth.getUser()
    user = res.data.user
    error = res.error
  }

  if (error || !user) {
    throw new UnauthorizedError()
  }

  return user
}
