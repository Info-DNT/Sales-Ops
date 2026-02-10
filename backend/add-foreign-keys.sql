-- =====================================================
-- Add Foreign Keys to CRM Integration Tables
-- These were previously skipped to avoid "column does not exist" errors
-- =====================================================

-- 1. Add foreign keys to lead_history
ALTER TABLE lead_history 
ADD CONSTRAINT fk_lead_history_lead 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE lead_history 
ADD CONSTRAINT fk_lead_history_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add foreign keys to crm_lead_registry
ALTER TABLE crm_lead_registry 
ADD CONSTRAINT fk_crm_lead_registry_lead 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE crm_lead_registry 
ADD CONSTRAINT fk_crm_lead_registry_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Verification
SELECT 'Foreign keys added successfully!' as status;
