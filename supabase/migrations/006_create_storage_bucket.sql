-- ============================================================
-- Migration 006: Create Storage Bucket and RLS Policies for Syllabi
-- ============================================================

-- Create the private bucket 'syllabi'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'syllabi',
  'syllabi',
  false,               -- private (no public access)
  10485760,            -- 10MB limit
  '{"application/pdf"}'::text[] -- Only PDF files
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Select policy: users can download their own syllabus
CREATE POLICY "Users can download own syllabus" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Insert policy: users can upload their own syllabus
CREATE POLICY "Users can upload own syllabus" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
    AND (LOWER(storage.extension(name)) = 'pdf')
  );

-- Update policy: users can update their own syllabus
CREATE POLICY "Users can update own syllabus" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
    AND (LOWER(storage.extension(name)) = 'pdf')
  );

-- Delete policy: users can delete their own syllabus
CREATE POLICY "Users can delete own syllabus" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  );
