-- Supabase Migration: 20240101000002_seed_admin.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add must_change_password column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 2. Insert Super Admin Role
INSERT INTO public.roles (name, permissions) 
VALUES ('super_admin', '{"all": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 3. Create the Super Admin User in Auth
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sidialiabdouu@gmail.com') THEN
    -- Insert into auth.users (make sure aud and role are 'authenticated')
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'sidialiabdouu@gmail.com',
      crypt('Admin@bba2005@2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      new_user_id::text,
      format('{"sub":"%s","email":"%s"}', new_user_id::text, 'sidialiabdouu@gmail.com')::jsonb,
      'email',
      now(),
      now(),
      now()
    );

    -- The trigger handle_new_user() will create the profile automatically.
    -- We update it.
    UPDATE public.profiles 
    SET role = 'super_admin', must_change_password = TRUE 
    WHERE id = new_user_id;
  ELSE
    -- If user already exists, update their role, password, and aud just in case it was broken
    UPDATE auth.users 
    SET 
        encrypted_password = crypt('Admin@bba2005@2026!', gen_salt('bf')),
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = now()
    WHERE email = 'sidialiabdouu@gmail.com';

    UPDATE public.profiles 
    SET role = 'super_admin', must_change_password = TRUE 
    WHERE id = (SELECT id FROM auth.users WHERE email = 'sidialiabdouu@gmail.com');
  END IF;
END $$;
