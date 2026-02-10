-- =====================================================
-- Fix CRM Tables: Add Missing Columns and Foreign Keys
-- =====================================================

-- 1. Add lead_id column to crm_lead_registry (if missing)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_lead_registry' 
        AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE crm_lead_registry ADD COLUMN lead_id UUID;
        RAISE NOTICE 'Added lead_id column to crm_lead_registry';
    ELSE
        RAISE NOTICE 'lead_id column already exists in crm_lead_registry';
    END IF;
END $$;

-- 2. Add lead_id column to lead_history (if missing)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_history' 
        AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE lead_history ADD COLUMN lead_id UUID;
        RAISE NOTICE 'Added lead_id column to lead_history';
    ELSE
        RAISE NOTICE 'lead_id column already exists in lead_history';
    END IF;
END $$;

-- 3. Now add foreign keys (only if columns exist)
DO $$
BEGIN
    -- Add foreign key for lead_history -> leads
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_lead_history_lead'
    ) THEN
        ALTER TABLE lead_history 
        ADD CONSTRAINT fk_lead_history_lead 
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key: lead_history -> leads';
    END IF;

    -- Add foreign key for lead_history -> users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_lead_history_user'
    ) THEN
        ALTER TABLE lead_history 
        ADD CONSTRAINT fk_lead_history_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key: lead_history -> users';
    END IF;

    -- Add foreign key for crm_lead_registry -> leads
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_crm_lead_registry_lead'
    ) THEN
        ALTER TABLE crm_lead_registry 
        ADD CONSTRAINT fk_crm_lead_registry_lead 
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key: crm_lead_registry -> leads';
    END IF;

    -- Add foreign key for crm_lead_registry -> users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_crm_lead_registry_user'
    ) THEN
        ALTER TABLE crm_lead_registry 
        ADD CONSTRAINT fk_crm_lead_registry_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key: crm_lead_registry -> users';
    END IF;
END $$;

-- 4. Verification
SELECT 'Setup complete!' as status;

-- Show final structure
SELECT 'crm_lead_registry columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_lead_registry' 
AND column_name IN ('id', 'lead_id', 'user_id', 'zoho_lead_id')
ORDER BY column_name;

SELECT 'lead_history columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lead_history' 
AND column_name IN ('id', 'lead_id', 'user_id', 'action')
ORDER BY column_name;
