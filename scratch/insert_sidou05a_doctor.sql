-- SQL Script: Create / Upgrade a Specialist (Doctor) Account for sidou05a@gmail.com
-- This script creates the user directly in the Supabase Auth schema, bypassing the rate limits.
-- It also sets the correct role in the profiles table and initializes the specialist_profiles data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  doctor_email VARCHAR := 'Abdou@#$2026';
  doctor_password VARCHAR := 'Abdou@#$2026';
BEGIN
  -- 1. Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = doctor_email) THEN
    
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
      doctor_email,
      crypt(doctor_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Sidou"}',
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
      format('{"sub":"%s","email":"%s"}', new_user_id::text, doctor_email)::jsonb,
      'email',
      now(),
      now(),
      now()
    );

    -- 2. Upgrade profile role to 'specialist'
    -- The trigger handle_new_user() will create the profile automatically, so we just update it.
    UPDATE public.profiles 
    SET role = 'specialist' 
    WHERE id = new_user_id;

    -- 3. Ensure specialist_profiles table exists
    CREATE TABLE IF NOT EXISTS public.specialist_profiles (
        id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        specialty VARCHAR NOT NULL,
        bio TEXT,
        rating DECIMAL(3,2) DEFAULT 0.0,
        availability_status VARCHAR DEFAULT 'online',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 4. Insert specialist_profiles data for the doctor
    INSERT INTO public.specialist_profiles (id, specialty, bio, availability_status, rating)
    VALUES (new_user_id, 'طبيب استشاري', 'طبيب مختص في تقديم الاستشارات الطبية للشباب.', 'online', 5.0);

  ELSE
    -- If user already exists, update their role and specialist profile
    SELECT id INTO new_user_id FROM auth.users WHERE email = doctor_email;
    
    UPDATE auth.users 
    SET encrypted_password = crypt(doctor_password, gen_salt('bf')),
        email_confirmed_at = now()
    WHERE id = new_user_id;

    UPDATE public.profiles 
    SET role = 'specialist' 
    WHERE id = new_user_id;

    INSERT INTO public.specialist_profiles (id, specialty, bio, availability_status, rating)
    VALUES (new_user_id, 'طبيب استشاري', 'طبيب مختص في تقديم الاستشارات الطبية للشباب.', 'online', 5.0)
    ON CONFLICT (id) DO UPDATE 
    SET specialty = EXCLUDED.specialty, availability_status = 'online';

  END IF;
END $$;
