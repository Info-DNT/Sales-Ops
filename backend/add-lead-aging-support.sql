-- =============================================
-- LEAD AGING SUPPORT: UPDATED_AT COLUMN & TRIGGER
-- =============================================

-- 1. Add updated_at column if not exists
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Initialize updated_at for existing records
UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create the trigger (drop if exists first to be safe)
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ✅ SAFE: Does not modify business data
-- ✅ SAFE: Zoho CRM integration uses service role and will correctly trigger this on updates
