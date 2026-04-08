-- =====================================================
-- Case Invoices Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add invoice tracking columns to cases table
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS invoice_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_uploaded  BOOLEAN NOT NULL DEFAULT false;

-- 2. Create case_invoices table (mirrors case_files pattern)
CREATE TABLE IF NOT EXISTS case_invoices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name    TEXT NOT NULL,
    file_url     TEXT NOT NULL,
    file_size    BIGINT,
    uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    storage_path TEXT,
    uploaded_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Row Level Security
ALTER TABLE case_invoices ENABLE ROW LEVEL SECURITY;

-- Users can view invoices for their own cases
CREATE POLICY "Users can view own case invoices"
ON case_invoices FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_invoices.case_id
          AND cases.user_id = auth.uid()
    )
);

-- Users can insert invoices for their own cases
CREATE POLICY "Users can insert own case invoices"
ON case_invoices FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_invoices.case_id
          AND cases.user_id = auth.uid()
    )
);

-- Users can delete their own invoice uploads
CREATE POLICY "Users can delete own case invoices"
ON case_invoices FOR DELETE
USING (uploaded_by = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins manage all case invoices"
ON case_invoices FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_case_invoices_case_id ON case_invoices(case_id);
CREATE INDEX IF NOT EXISTS idx_case_invoices_uploaded_by ON case_invoices(uploaded_by);

-- 5. Supabase Storage bucket (run this or create via Dashboard)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('case-invoices', 'case-invoices', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload
-- CREATE POLICY "Authenticated upload case-invoices"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'case-invoices');

-- Storage policy: authenticated users can read
-- CREATE POLICY "Authenticated read case-invoices"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'case-invoices');

-- Storage policy: owners can delete
-- CREATE POLICY "Owners delete case-invoices"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (bucket_id = 'case-invoices');
