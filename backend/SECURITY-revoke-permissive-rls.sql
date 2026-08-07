-- ===================================================================
-- SECURITY FIX — REVOKE FULLY-PERMISSIVE RLS POLICIES
-- File: backend/SECURITY-revoke-permissive-rls.sql
--
-- WHY THIS EXISTS
--   backend/fix-all-rls-permissive.sql creates, on every business table:
--       CREATE POLICY allow_all_<table> ... FOR ALL USING (true) WITH CHECK (true)
--   Postgres OR's permissive RLS policies together, so a single `USING (true)`
--   policy overrides every stricter policy on the same table. While it exists,
--   any holder of the public anon key (which ships in assets/js/supabase-client.js
--   and is therefore visible to anyone who opens the site) can read, insert,
--   update and delete every row in that table via the Supabase REST API.
--
-- WHAT THIS SCRIPT DOES
--   STEP 1  Reports which permissive policies currently exist (read-only).
--   STEP 2  Drops them.
--   STEP 3  Re-asserts that RLS is enabled on each table.
--   STEP 4  Verifies the result and fails loudly if anything permissive remains.
--
-- HOW TO RUN
--   Paste into the Supabase SQL Editor and run. Run STEP 1 alone first if you
--   want to see the blast radius before changing anything.
--
-- IMPORTANT
--   Dropping these policies restores the strict per-role policies defined in
--   backend/final-rls-fix.sql and backend/pipeline-schema.sql. Confirm those
--   have been applied — if a table ends up with RLS enabled and NO policies,
--   it denies all access to normal users (service-role callers are unaffected).
--   STEP 4 flags any such table so you can spot it immediately.
-- ===================================================================


-- ===================================================================
-- SCOPE — WHAT THIS SCRIPT DOES *NOT* TOUCH
--   It targets ONLY the `allow_all_<table>` policies created by
--   fix-all-rls-permissive.sql, which apply to the PUBLIC role and are
--   therefore reachable with the anon key.
--
--   It deliberately does NOT drop every policy whose expression is `true`.
--   Several legitimate policies are written as `TO authenticated USING (true)`
--   — "any logged-in user may read this" — which is NOT anon-reachable and is
--   the intended design. Dropping them would break working features:
--       vendors               create-vendors-table.sql:43   → vendor list empties
--       teams                 add-team-system.sql:53        → team pickers empty
--       sequence_counters     pipeline-schema.sql:172       → AM-YYYY-NN generation fails
--       crm_lead_registry     create-missing-tables.sql:50  → non-admin CRM sync breaks
--   Those are reviewed separately in STEP 5, not dropped here.
-- ===================================================================


-- ===================================================================
-- STEP 1 — INSPECT (read-only, changes nothing)
-- ===================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    roles      AS applies_to_roles,
    cmd        AS applies_to,
    qual       AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'allow_all_%'
ORDER BY tablename, policyname;


-- ===================================================================
-- STEP 2 — DROP the fully-permissive allow_all_* policies
-- ===================================================================
DO $$
DECLARE
    pol      RECORD;
    n_dropped INTEGER := 0;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname LIKE 'allow_all_%'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            pol.policyname, pol.tablename
        );
        n_dropped := n_dropped + 1;
        RAISE NOTICE 'Dropped permissive policy %.%', pol.tablename, pol.policyname;
    END LOOP;

    IF n_dropped = 0 THEN
        RAISE NOTICE 'No allow_all_* policies found — nothing to drop.';
    ELSE
        RAISE NOTICE 'Dropped % permissive policy/policies.', n_dropped;
    END IF;
END $$;


-- ===================================================================
-- STEP 2b — RESTORE DELETE FOR ADMINS
-- final-rls-fix.sql defines user_*/admin_* policies for SELECT, INSERT and
-- UPDATE only; the sole DELETE path was `super_admin_all_<table> FOR ALL`.
-- While allow_all_* existed it silently supplied DELETE to everyone else.
-- Removing it means an admin's delete now matches zero rows — and PostgREST
-- returns 204/success for a zero-row delete, so the UI reports "Deleted"
-- while the record actually remains. These policies close that gap.
--
-- Note: most deletes in this app are already SOFT deletes (is_deleted flag),
-- which are UPDATEs and unaffected. This covers the hard-delete paths.
-- ===================================================================
DO $$
DECLARE
    tbl      TEXT;
    del_list TEXT[] := ARRAY[
        'cases', 'case_files', 'case_invoices', 'case_receipts',
        'expenses', 'vendors', 'calls', 'meetings'
    ];
BEGIN
    FOREACH tbl IN ARRAY del_list LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_delete_' || tbl, tbl);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR DELETE USING (public.check_user_is_admin())',
                'admin_delete_' || tbl, tbl
            );
            RAISE NOTICE 'Ensured admin DELETE policy on %', tbl;
        END IF;
    END LOOP;
END $$;


-- ===================================================================
-- STEP 3 — Ensure RLS is enabled on every business table
-- A table with RLS disabled is wide open regardless of its policies.
-- ===================================================================
DO $$
DECLARE
    tbl         TEXT;
    tables_list TEXT[] := ARRAY[
        'users', 'user_details', 'user_permissions',
        'leads', 'lead_history', 'lead_files',
        'medical_assessments', 'quotation_control', 'equipment_checklist',
        'cases', 'case_files', 'case_invoices', 'case_receipts',
        'calls', 'meetings', 'expenses', 'vendors',
        'attendance', 'work_reports', 'activity_log',
        'sequence_counters',
        'hospital_referral', 'embassy_referral', 'insurance_referral',
        'corporate_referral', 'vendor_referral', 'doctor_referral',
        'medical_tourism_partner'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_list LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        ELSE
            RAISE NOTICE 'Table public.% does not exist (skipped)', tbl;
        END IF;
    END LOOP;
END $$;


-- ===================================================================
-- STEP 4 — VERIFY
-- Fails loudly if any allow_all_* policy survived.
-- ===================================================================
DO $$
DECLARE
    n_permissive INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_permissive
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'allow_all_%';

    IF n_permissive > 0 THEN
        RAISE EXCEPTION
            'VERIFICATION FAILED: % allow_all_* policy/policies still present.',
            n_permissive;
    END IF;

    RAISE NOTICE 'VERIFICATION PASSED: no allow_all_* policies remain.';
END $$;


-- ===================================================================
-- STEP 4b — ⚠️ REVIEW THIS RESULT SET — TABLES THAT NOW DENY ALL ACCESS
--
-- A table with RLS enabled and zero policies denies every non-service-role
-- request. This MUST be a query, not RAISE WARNING: the Supabase SQL Editor
-- does not surface NOTICE/WARNING from DO blocks, so a warning here would be
-- invisible in the one environment this script is documented to run in.
--
-- Any row returned = a broken table. Apply backend/final-rls-fix.sql or
-- backend/pipeline-schema.sql for it. Zero rows = healthy.
-- ===================================================================
SELECT
    c.relname AS table_denying_all_access,
    'RLS enabled but no policies — apply final-rls-fix.sql or pipeline-schema.sql' AS action_required
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;


-- ===================================================================
-- STEP 4c — REVIEW: policies granted to the PUBLIC role with a `true`
-- expression. These ARE anon-key-reachable and are worth a human look.
-- Policies scoped `TO authenticated` are intentionally excluded — those
-- mean "any logged-in user", which is a legitimate design in this app.
-- ===================================================================
SELECT
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
  AND ('public' = ANY(roles) OR roles IS NULL OR roles = '{0}')
ORDER BY tablename, policyname;


-- ===================================================================
-- STEP 5 — Final state, for the record
-- ===================================================================
SELECT
    tablename,
    COUNT(*) AS policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
