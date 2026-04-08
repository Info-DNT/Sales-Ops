-- =============================================
-- FIX: Storage Policies for case-quotations bucket
-- Problem: Bucket exists but has 0 policies — all uploads blocked
-- Run this in Supabase SQL Editor
-- =============================================

-- Allow authenticated users to upload files to case-quotations
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('Authenticated users can upload', 'case-quotations', 'INSERT', 'bucket_id = ''case-quotations'' AND auth.role() = ''authenticated''')
ON CONFLICT DO NOTHING;

-- The above may not work on all Supabase versions. Use this instead:

-- Allow authenticated users to upload (INSERT)
CREATE POLICY "Authenticated users can upload case quotations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-quotations');

-- Allow authenticated users to read/download their files (SELECT)
CREATE POLICY "Authenticated users can view case quotations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'case-quotations');

-- Allow authenticated users to delete their own files (DELETE)
CREATE POLICY "Authenticated users can delete own case quotations"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'case-quotations' AND owner = auth.uid());
