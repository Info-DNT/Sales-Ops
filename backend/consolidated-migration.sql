-- consolidated-migration.sql
-- 1. Fix missing tables triggering "Loading..." crash
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

-- 2. Add Serial Number fields to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS serial_no_1 TEXT,
ADD COLUMN IF NOT EXISTS serial_no_2 TEXT UNIQUE;

COMMENT ON COLUMN leads.serial_no_1 IS 'Mapped FROM Zoho CRM';
COMMENT ON COLUMN leads.serial_no_2 IS 'Generated 6-digit unique ID; mapped TO Zoho CRM';

-- 3. Ensure columns exist on cases table as well (for tracking)
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS invoice_requested BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_uploaded  BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_uploaded  BOOLEAN NOT NULL DEFAULT false;
