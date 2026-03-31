-- =============================================
-- LEAD → CASE CONVERSION PATCH
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add conversion tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_case_id UUID REFERENCES cases(id) ON DELETE SET NULL;

-- Index for fast UI filtering (hides converted leads from lists)
CREATE INDEX IF NOT EXISTS idx_leads_is_converted ON leads(is_converted);

-- =============================================
-- 2. Create case_files table (quotation uploads for cases)
-- =============================================

CREATE TABLE IF NOT EXISTS case_files (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name   TEXT NOT NULL,
    file_url    TEXT NOT NULL,
    file_size   BIGINT,
    storage_path TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON case_files(case_id);

-- =============================================
-- 3. Row Level Security for case_files
-- =============================================

ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;

-- Users can see files for their own cases
CREATE POLICY "Users view own case files"
  ON case_files FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- Users can upload files to their own cases
CREATE POLICY "Users insert own case files"
  ON case_files FOR INSERT
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own uploaded files
CREATE POLICY "Users delete own case files"
  ON case_files FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR
    case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins manage all case files"
  ON case_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 4. Supabase Storage Bucket
-- NOTE: Run these commands in the Supabase Dashboard → Storage
-- OR via the Supabase CLI / API
--
-- Create bucket: case-quotations
-- The bucket should be set to PRIVATE (files accessed via signed URLs)
--
-- SQL equivalent (Supabase internal schema):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('case-quotations', 'case-quotations', false)
-- ON CONFLICT (id) DO NOTHING;
-- =============================================

-- Confirm changes
SELECT 
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('is_converted', 'converted_at', 'converted_case_id');
