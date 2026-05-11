-- =============================================
-- MIGRATION: Add is_deleted column to expenses table
-- Run this in Supabase SQL Editor
-- Safe: Uses IF NOT EXISTS, won't break if column already exists
-- =============================================

ALTER TABLE public.expenses 
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- IMPORTANT: Reload PostgREST schema cache so the API recognizes the new column
NOTIFY pgrst, 'reload schema';

-- Verify the column was added
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'expenses' AND column_name = 'is_deleted';
