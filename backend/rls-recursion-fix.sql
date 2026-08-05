-- ===================================================================
-- SUPABASE RLS RECURSION FIX (RUN IN SQL EDITOR)
-- ===================================================================
-- This script fixes the "Error loading users" issue caused by recursive
-- RLS policies on the 'users' table.

-- 1. Create a security-definer function to check roles
-- Security definer functions bypass RLS, which is the key to breaking recursion.

CREATE OR REPLACE FUNCTION public.check_user_is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_user_is_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-apply Admin Policies for 'users' table using the non-recursive function
DROP POLICY IF EXISTS "admin_select_users" ON public.users;
CREATE POLICY "admin_select_users" ON public.users 
    FOR SELECT USING (public.check_user_is_admin());

DROP POLICY IF EXISTS "admin_update_users" ON public.users;
CREATE POLICY "admin_update_users" ON public.users 
    FOR UPDATE USING (public.check_user_is_admin());

-- 3. Re-apply Super Admin Policy for ALL tables using the non-recursive function
DO $$
DECLARE
    t_name TEXT;
    t_list TEXT[] := ARRAY['users', 'user_details', 'leads', 'cases', 'calls', 'meetings', 'attendance', 'expenses', 'vendors', 'quotations', 'work_reports', 'case_files', 'case_invoices', 'case_receipts', 'lead_history'];
BEGIN
    FOREACH t_name IN ARRAY t_list
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "super_admin_all_%I" ON %I', t_name, t_name);
        EXECUTE format('CREATE POLICY "super_admin_all_%I" ON %I FOR ALL USING (public.check_user_is_super_admin())', t_name, t_name);
    END LOOP;
END $$;

-- 4. Fix User Permissions Policy (Only super_admin can manage)
DROP POLICY IF EXISTS "super_admin_manage_permissions" ON public.user_permissions;
CREATE POLICY "super_admin_manage_permissions" ON public.user_permissions
    FOR ALL USING (public.check_user_is_super_admin());

-- Done! This should resolve the "Error loading users" message.
