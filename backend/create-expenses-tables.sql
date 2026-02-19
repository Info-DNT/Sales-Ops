-- =============================================
-- EXPENSES MODULE: FULL DATABASE SETUP
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- ── 1. expenses table ──
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 2. notifications table ──
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense_update',
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 3. expense_audit_logs table ──
CREATE TABLE IF NOT EXISTS public.expense_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
    admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    admin_name TEXT,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 4. Enable RLS on all tables ──
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS: expenses
-- =============================================
CREATE POLICY "Users view own expenses"
    ON public.expenses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own expenses"
    ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending expenses"
    ON public.expenses FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins view all expenses"
    ON public.expenses FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update any expense"
    ON public.expenses FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- =============================================
-- RLS: notifications
-- =============================================
CREATE POLICY "Users view own notifications"
    ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- =============================================
-- RLS: expense_audit_logs
-- =============================================
CREATE POLICY "Admins insert audit logs"
    ON public.expense_audit_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins view audit logs"
    ON public.expense_audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view own expense audit logs"
    ON public.expense_audit_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.expenses
        WHERE expenses.id = expense_audit_logs.expense_id
          AND expenses.user_id = auth.uid()
    ));

-- =============================================
-- 5. Auto-update updated_at on expenses
-- =============================================
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_updated_at_trigger ON public.expenses;
CREATE TRIGGER expenses_updated_at_trigger
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_expenses_updated_at();

-- =============================================
-- 6. Auto-notify all admins when a user submits an expense
-- =============================================
CREATE OR REPLACE FUNCTION fn_notify_admins_on_new_expense()
RETURNS TRIGGER AS $$
DECLARE
    admin_record RECORD;
    submitter_name TEXT;
BEGIN
    SELECT name INTO submitter_name FROM public.users WHERE id = NEW.user_id;
    FOR admin_record IN SELECT id FROM public.users WHERE role = 'admin' LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            admin_record.id,
            'New Expense Submitted 🧾',
            COALESCE(submitter_name, 'A team member') || ' submitted a ' || NEW.category || ' expense of AED ' || NEW.amount || '.',
            'new_expense'
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admins_on_new_expense ON public.expenses;
CREATE TRIGGER trg_notify_admins_on_new_expense
    AFTER INSERT ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION fn_notify_admins_on_new_expense();
