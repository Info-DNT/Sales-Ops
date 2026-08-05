-- =====================================================
-- 1. Create Vendors Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    org_name TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. Modify Leads Table
-- =====================================================
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- =====================================================
-- 3. Enable RLS
-- =====================================================
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS Policies
-- =====================================================

-- Drop existing policies if they exist to avoid duplication
DROP POLICY IF EXISTS "authenticated_select_vendors" ON public.vendors;
DROP POLICY IF EXISTS "authenticated_insert_vendors" ON public.vendors;
DROP POLICY IF EXISTS "user_update_own_vendors" ON public.vendors;
DROP POLICY IF EXISTS "admin_update_vendors" ON public.vendors;
DROP POLICY IF EXISTS "super_admin_all_vendors" ON public.vendors;

-- Policy A: All authenticated users can view active/inactive vendors to check for duplicates
CREATE POLICY "authenticated_select_vendors" ON public.vendors
    FOR SELECT TO authenticated USING (true);

-- Policy B: Authenticated users can insert vendors linked to themselves
CREATE POLICY "authenticated_insert_vendors" ON public.vendors
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR public.check_user_is_admin() OR public.check_user_is_super_admin());

-- Policy C: Users can edit their own vendors
CREATE POLICY "user_update_own_vendors" ON public.vendors
    FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Policy D: Admins can edit any vendors
CREATE POLICY "admin_update_vendors" ON public.vendors
    FOR UPDATE TO authenticated USING (public.check_user_is_admin());

-- Policy E: Super Admin can do everything
CREATE POLICY "super_admin_all_vendors" ON public.vendors
    FOR ALL TO authenticated USING (public.check_user_is_super_admin());

-- =====================================================
-- 5. Initialize Permissions for existing users
-- =====================================================
INSERT INTO public.user_permissions (user_id, module, enabled, can_view, can_create, can_edit, can_delete)
SELECT id, 'vendors', true, true, true, true, false
FROM public.users
WHERE role = 'user'
ON CONFLICT (user_id, module) DO NOTHING;
