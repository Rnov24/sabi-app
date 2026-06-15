import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError } from '@/lib/errors'

const updateProfileSchema = z.object({
  display_name: z.string().max(50).optional(),
  university: z.string().max(100).optional(),
})

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, university, created_at')
    .eq('id', user.id)
    .single()

  if (error || !data) throw new NotFoundError('Profile')
  return ok(data)
})

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser()
  const body = await request.json()
  const validated = updateProfileSchema.parse(body)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(validated)
    .eq('id', user.id)
    .select('id, display_name, university, created_at')
    .single()

  if (error) throw new NotFoundError('Profile')
  return ok(data)
})
