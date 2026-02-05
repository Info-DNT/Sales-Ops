-- ===================================================================
-- RENAME ADMIN EMAIL SCRIPT
-- ===================================================================
-- Run this in your Supabase SQL Editor to update your profile email.
--
-- Note: This only changes your "Display Profile". You MUST still update
-- your Login Email in Supabase Auth > Users to login with the new email.

UPDATE public.users 
SET email = 'nitin@airmedical24x7.com' 
WHERE email = 'info@digitalnextworld.com';

-- Verify the change
SELECT id, email, name, role 
FROM public.users 
WHERE role = 'admin';
