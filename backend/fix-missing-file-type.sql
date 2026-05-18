-- =============================================
-- FIX: ADD MISSING FILE_TYPE COLUMN
-- Ensures that the file-search logic can distinguish between
-- quotations, invoices, and other document types.
-- =============================================

DO $$ 
BEGIN 
    -- 1. Add file_type to lead_files
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lead_files' AND COLUMN_NAME = 'file_type') THEN
        ALTER TABLE lead_files ADD COLUMN file_type TEXT DEFAULT 'quotation';
    END IF;

    -- 2. Add file_type to case_files
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'case_files' AND COLUMN_NAME = 'file_type') THEN
        ALTER TABLE case_files ADD COLUMN file_type TEXT DEFAULT 'quotation';
    END IF;
END $$;
