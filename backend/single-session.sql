-- =============================================
-- SINGLE-SESSION ENFORCEMENT
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- One active session token per user
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own session row (for validation polling)
CREATE POLICY "Users read own session"
    ON public.user_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own session row (on login)
CREATE POLICY "Users insert own session"
    ON public.user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own session row
CREATE POLICY "Users update own session"
    ON public.user_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own session row (on logout)
CREATE POLICY "Users delete own session"
    ON public.user_sessions FOR DELETE
    USING (auth.uid() = user_id);
