-- =========================================================
-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR
-- Fixes: cases detail panel not loading, serial no fields,
--        quotation_id, invoice/receipt tracking columns
-- =========================================================

-- 1. Add quotation_id to leads (for Zoho CRM sync)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS quotation_id TEXT;

-- 2. Add quotation_id to cases (for UI display)
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS quotation_id TEXT;

-- 3. Add Serial Number fields to leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS serial_no_1 TEXT,
ADD COLUMN IF NOT EXISTS serial_no_2 TEXT UNIQUE;

-- 4. Add invoice/receipt/proforma tracking flags to cases
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS invoice_requested BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_uploaded   BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_uploaded   BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS proforma_uploaded  BOOLEAN NOT NULL DEFAULT false;

-- 5. Create case_invoices table (if missing)
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

-- 6. Create case_receipts table (if missing)
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

-- 7. RLS for case_invoices
ALTER TABLE case_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can view own case invoices"
ON case_invoices FOR SELECT
USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_invoices.case_id AND cases.user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins manage all case invoices"
ON case_invoices FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 8. RLS for case_receipts
ALTER TABLE case_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can view own case receipts"
ON case_receipts FOR SELECT
USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_receipts.case_id AND cases.user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins manage all case receipts"
ON case_receipts FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
