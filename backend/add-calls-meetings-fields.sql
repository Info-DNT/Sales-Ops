-- =============================================
-- MIGRATION: Add follow_up_date and email to calls & meetings
-- Run this in Supabase SQL Editor
-- Safe: Uses IF NOT EXISTS, won't break if columns already exist
-- =============================================

-- Add follow_up_date and email to calls table
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- Add follow_up_date and email to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS follow_up_date DATE;
