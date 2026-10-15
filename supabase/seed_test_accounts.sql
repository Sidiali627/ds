-- ============================================================================
-- Supabase SQL Seed Script: Test Accounts for All Supported Roles (Corrected)
-- Platform: Youth Health Studio | استوديو صحة الشباب
-- Instructions: Run this script in the Supabase Dashboard SQL Editor (SQL Editor -> New Query)
--
-- Security & Integrity Rules:
-- 1. Uses genuine RFC 4122 v4 UUIDs via PostgreSQL core gen_random_uuid() or existing Auth IDs.
-- 2. Never uses invalid hex letters (such as 'p' or 'v') as UUID characters.
-- 3. Profiles and specialist/health profiles are strictly tied to real Auth user UUIDs.
-- 4. Safe and idempotent to rerun: does not create duplicate accounts or throw unique constraint errors.
-- 5. Real production accounts (e.g. sidialiabdouu@gmail.com) are strictly preserved and untouched.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    -- Standard test password for isolated development/staging verification
    default_test_pwd VARCHAR := 'YHS_TestAcc@2026!';
    pwd_hash VARCHAR := crypt(default_test_pwd, gen_salt('bf'));

    -- Dedicated synthetic test email addresses
    email_super_admin VARCHAR := 'test.superadmin@youthhealthstudio.org';
    email_admin       VARCHAR := 'test.admin@youthhealthstudio.org';
    email_doctor      VARCHAR := 'test.doctor@youthhealthstudio.org';
    email_patient     VARCHAR := 'test.patient@youthhealthstudio.org';
    email_volunteer   VARCHAR := 'test.volunteer@youthhealthstudio.org';

    v_user_id UUID;
BEGIN
    -- Temporarily set session_replication_role to replica to allow administrative seeding
    -- without being blocked by client-facing RLS role protection triggers (which check auth.uid()).
    SET LOCAL session_replication_role = 'replica';

    -- ============================================================================
    -- 1. SYNTHETIC SUPER ADMIN (test.superadmin@youthhealthstudio.org)
    -- Note: Real accounts (such as sidialiabdouu@gmail.com) are preserved and untouched.
    -- ============================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = email_super_admin;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            email_super_admin, pwd_hash, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"مدير عام النظام التجريبي (Test Super Admin)","role":"super_admin"}'::jsonb,
            now(), now(), '', '', '', ''
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = pwd_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"مدير عام النظام التجريبي (Test Super Admin)","role":"super_admin"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, email_super_admin)::jsonb,
            'email', now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, account_status, created_at)
    VALUES (v_user_id, 'مدير عام النظام التجريبي (Test Super Admin)', email_super_admin, 'super_admin', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin',
        account_status = 'active',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    -- ============================================================================
    -- 2. OPERATIONS ADMIN (test.admin@youthhealthstudio.org)
    -- ============================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = email_admin;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            email_admin, pwd_hash, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"مدير العمليات التجريبي (Test Admin)","role":"admin"}'::jsonb,
            now(), now(), '', '', '', ''
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = pwd_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"مدير العمليات التجريبي (Test Admin)","role":"admin"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, email_admin)::jsonb,
            'email', now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, account_status, created_at)
    VALUES (v_user_id, 'مدير العمليات التجريبي (Test Admin)', email_admin, 'admin', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        account_status = 'active',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    -- ============================================================================
    -- 3. DOCTOR / SPECIALIST (test.doctor@youthhealthstudio.org)
    -- ============================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = email_doctor;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            email_doctor, pwd_hash, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"د. أحمد المنصوري (Test Doctor)","role":"specialist"}'::jsonb,
            now(), now(), '', '', '', ''
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = pwd_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"د. أحمد المنصوري (Test Doctor)","role":"specialist"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, email_doctor)::jsonb,
            'email', now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, account_status, created_at)
    VALUES (v_user_id, 'د. أحمد المنصوري (Test Doctor)', email_doctor, 'specialist', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        role = 'specialist',
        account_status = 'active',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    -- Ensure specialist extended clinical profile exists and is updated
    INSERT INTO public.specialist_profiles (id, specialty, bio, availability_status, rating)
    VALUES (v_user_id, 'طب عام واستشارات شبابية', 'طبيب استشاري مختص بالصحة العامة وطب اليافعين والشباب.', 'online', 5.0)
    ON CONFLICT (id) DO UPDATE SET
        specialty = EXCLUDED.specialty,
        bio = EXCLUDED.bio,
        availability_status = EXCLUDED.availability_status;

    -- ============================================================================
    -- 4. USER / PATIENT (test.patient@youthhealthstudio.org)
    -- ============================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = email_patient;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            email_patient, pwd_hash, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"يوسف الجزائري (Test Patient)","role":"user"}'::jsonb,
            now(), now(), '', '', '', ''
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = pwd_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"يوسف الجزائري (Test Patient)","role":"user"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, email_patient)::jsonb,
            'email', now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, account_status, created_at)
    VALUES (v_user_id, 'يوسف الجزائري (Test Patient)', email_patient, 'user', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        role = 'user',
        account_status = 'active',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    -- Ensure health profile exists for testing medical/EMR records
    INSERT INTO public.health_profiles (user_id, blood_type, height, weight, allergies, chronic_diseases, medications, vaccinations)
    VALUES (v_user_id, 'O+', 175, 68, 'حساسية البنسلين', 'لا توجد', 'لا توجد', 'مكتملة')
    ON CONFLICT (user_id) DO UPDATE SET
        blood_type = EXCLUDED.blood_type,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        allergies = EXCLUDED.allergies;

    -- ============================================================================
    -- 5. VOLUNTEER (test.volunteer@youthhealthstudio.org)
    -- ============================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = email_volunteer;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            email_volunteer, pwd_hash, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"سارة بلقاسم (Test Volunteer)","role":"volunteer"}'::jsonb,
            now(), now(), '', '', '', ''
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = pwd_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"سارة بلقاسم (Test Volunteer)","role":"volunteer"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            format('{"sub":"%s","email":"%s"}', v_user_id::text, email_volunteer)::jsonb,
            'email', now(), now(), now()
        );
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, account_status, created_at)
    VALUES (v_user_id, 'سارة بلقاسم (Test Volunteer)', email_volunteer, 'volunteer', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        role = 'volunteer',
        account_status = 'active',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    -- Reset session_replication_role back to origin
    SET LOCAL session_replication_role = 'origin';

    RAISE NOTICE 'Seed process completed successfully. All test accounts are provisioned and linked to authentic Auth UUIDs.';
END $$;
