-- ===================================================================
-- FULL PERMISSIVE RLS FIX FOR SALES OPS PIPELINE (SAFE EXECUTION)
-- Run this script in the Supabase SQL Editor.
-- It safely checks if each table exists before enabling RLS & applying policies.
-- ===================================================================

DO $$
DECLARE
    tbl text;
    pol RECORD;
    tables_list text[] := ARRAY[
        'leads',
        'users',
        'medical_assessments',
        'quotation_control',
        'user_permissions',
        'hospital_referrals',
        'embassy_referrals',
        'tpa_referrals',
        'doctor_referrals',
        'individual_referrals',
        'cases',
        'calls',
        'meetings',
        'expenses',
        'vendors',
        'attendance',
        'work_reports'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_list LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Drop any existing allow_all policy
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_all_' || tbl, tbl);
            
            -- Create universal permissive policy for ALL operations (SELECT, INSERT, UPDATE, DELETE)
            EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', 'allow_all_' || tbl, tbl);
            
            RAISE NOTICE 'Applied permissive RLS policy for table: %', tbl;
        ELSE
            RAISE NOTICE 'Table public.% does not exist yet (skipped safely)', tbl;
        END IF;
    END LOOP;
END $$;
