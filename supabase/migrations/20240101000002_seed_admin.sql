-- Supabase Migration: 20240101000002_seed_admin.sql
-- SECURITY NOTE:
-- This migration no longer stores any plaintext seed password or hardcoded production credentials.
-- Provision initial super-admin credentials out-of-band (Supabase Auth UI / secure server automation)
-- and rotate any previously exposed credentials immediately.

-- 1. Add must_change_password column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 2. Insert Super Admin Role
INSERT INTO public.roles (name, permissions)
VALUES ('super_admin', '{"all": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 3. Promote an existing authenticated user to super_admin using secure runtime setting.
-- Set app.settings.seed_super_admin_email before running this migration when needed:
--   select set_config('app.settings.seed_super_admin_email', 'admin@example.org', false);
DO $$
DECLARE
  seed_admin_email TEXT := NULLIF(current_setting('app.settings.seed_super_admin_email', true), '');
  seed_admin_user_id UUID;
BEGIN
  IF seed_admin_email IS NULL THEN
    RAISE NOTICE 'No seed super admin email provided. Skipping credential provisioning in migration.';
    RETURN;
  END IF;

  SELECT id INTO seed_admin_user_id
  FROM auth.users
  WHERE lower(email) = lower(seed_admin_email)
  LIMIT 1;

  IF seed_admin_user_id IS NULL THEN
    RAISE NOTICE 'Auth user % not found. Create this account securely in Supabase Auth first, then rerun promotion SQL.', seed_admin_email;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET role = 'super_admin',
      must_change_password = TRUE
  WHERE id = seed_admin_user_id;
END $$;
