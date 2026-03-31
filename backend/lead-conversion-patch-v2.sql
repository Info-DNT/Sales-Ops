-- =============================================
-- LEAD → CASE CONVERSION PATCH (V2 - IDEMPOTENT)
-- Run this in Supabase SQL Editor if V1 failed
-- =============================================

-- 1. Leads Table Modifications
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_case_id UUID REFERENCES cases(id) ON DELETE SET NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_is_converted') THEN
        CREATE INDEX idx_leads_is_converted ON leads(is_converted);
    END IF;
END $$;

-- 2. Case Files Table
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

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_case_files_case_id') THEN
        CREATE INDEX idx_case_files_case_id ON case_files(case_id);
    END IF;
END $$;

-- 3. RLS for Case Files (Idempotent)
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own case files" ON case_files;
CREATE POLICY "Users view own case files" ON case_files FOR SELECT
USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users insert own case files" ON case_files;
CREATE POLICY "Users insert own case files" ON case_files FOR INSERT
WITH CHECK (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users delete own case files" ON case_files;
CREATE POLICY "Users delete own case files" ON case_files FOR DELETE
USING (uploaded_by = auth.uid() OR case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all case files" ON case_files;
CREATE POLICY "Admins manage all case files" ON case_files FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 4. FIX ADMIN LEADS VIEW (IMPORTANT - This allows admins to see others' leads)
DROP POLICY IF EXISTS "Admins view all leads" ON leads;
CREATE POLICY "Admins view all leads" ON leads FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 5. VERIFICATION
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'is_converted';
