-- =====================================================
-- Case Receipts Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add receipt tracking column to cases table
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS receipt_uploaded BOOLEAN NOT NULL DEFAULT false;

-- 2. Create case_receipts table
CREATE TABLE IF NOT EXISTS case_receipts (
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
ALTER TABLE case_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view receipts for their own cases
CREATE POLICY "Users can view own case receipts"
ON case_receipts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_receipts.case_id
          AND cases.user_id = auth.uid()
    )
);

-- Users can insert receipts for their own cases
CREATE POLICY "Users can insert own case receipts"
ON case_receipts FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_receipts.case_id
          AND cases.user_id = auth.uid()
    )
);

-- Users can delete their own receipt uploads
CREATE POLICY "Users can delete own case receipts"
ON case_receipts FOR DELETE
USING (uploaded_by = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins manage all case receipts"
ON case_receipts FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_case_receipts_case_id ON case_receipts(case_id);
CREATE INDEX IF NOT EXISTS idx_case_receipts_uploaded_by ON case_receipts(uploaded_by);
