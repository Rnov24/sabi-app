import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { NotFoundError, ValidationError } from '@/lib/errors'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  // Verify course ownership
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, syllabus_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) throw new NotFoundError('Course')

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) throw new ValidationError('File is required')
  if (file.type !== 'application/pdf') throw new ValidationError('Only PDF files are accepted')
  if (file.size > MAX_FILE_SIZE) throw new ValidationError('File size must be less than 10MB')

  const storagePath = `${user.id}/${id}/syllabus.pdf`

  // Delete old file if exists
  if (course.syllabus_url) {
    await supabase.storage.from('syllabi').remove([course.syllabus_url])
  }

  // Upload new file
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('syllabi')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) throw uploadError

  // Update course record
  await supabase
    .from('courses')
    .update({ syllabus_url: storagePath })
    .eq('id', id)

  return ok({ syllabus_url: storagePath })
})
