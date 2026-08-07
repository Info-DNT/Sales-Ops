-- ===================================================================
-- ⛔ DO NOT RUN THIS SCRIPT — RETAINED FOR REFERENCE ONLY ⛔
-- ===================================================================
-- This script grants `FOR ALL USING (true) WITH CHECK (true)` on every
-- business table. Postgres OR's permissive RLS policies together, so these
-- policies override every stricter policy on the same table and leave the
-- data fully readable AND writable by anyone holding the public anon key —
-- which is embedded in assets/js/supabase-client.js and therefore visible to
-- any visitor. Running it removes the application's only real access control.
--
-- If you are here because something is returning "permission denied" or
-- "Error loading …", the fix is a correct per-role policy, NOT this script:
--     backend/final-rls-fix.sql        — core tables (leads, cases, calls, …)
--     backend/pipeline-schema.sql      — medical_assessments, quotation_control
--
-- To undo the damage if this was previously run:
--     backend/SECURITY-revoke-permissive-rls.sql
--
-- The guard below aborts the script if it is executed.
-- ===================================================================

DO $$
BEGIN
    RAISE EXCEPTION
        'Refusing to run fix-all-rls-permissive.sql: it disables row-level security on every table. Use backend/final-rls-fix.sql instead, or backend/SECURITY-revoke-permissive-rls.sql to revoke policies this script previously created.';
END $$;

-- ─── Original script below (unreachable — the guard above aborts first) ───

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
