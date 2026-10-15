-- Supabase Migration: 20240101000021_user_management_and_rbac_hardening.sql
-- Description: Phase 10 - User Management & Role-Based Access Control Hardening
-- Security: Defense-in-depth enforcement for roles, account statuses, and profile modifications

-- ============================================================================
-- 1. Profiles Table Enhancements & Column Idempotency
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tags VARCHAR[] DEFAULT '{}';

-- Performance and Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- ============================================================================
-- 2. Populate Standard Roles in Roles Table
-- ============================================================================
INSERT INTO public.roles (name, permissions) VALUES
('super_admin', '{"all": true, "manage_roles": true, "manage_admins": true, "manage_system": true}'::jsonb),
('admin', '{"manage_users": true, "manage_cms": true, "manage_consultations": true, "view_audit_logs": true}'::jsonb),
('specialist', '{"clinical_access": true, "consultations": true, "emr_access": true, "prescriptions": true}'::jsonb),
('volunteer', '{"volunteer_portal": true, "view_events": true, "participate": true}'::jsonb),
('user', '{"patient_access": true, "book_consultations": true, "view_articles": true, "own_profile": true}'::jsonb)
ON CONFLICT (name) DO UPDATE 
SET permissions = EXCLUDED.permissions;

-- Enable RLS on roles and add policy for authenticated users to view role definitions
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read roles" ON public.roles;
CREATE POLICY "Allow authenticated read roles" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. Profiles RLS Hardening (Allowing Admin Updates while Protecting Integrity)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure select policy exists
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- Ensure insert policy exists
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Secure update policy: User can update their own profile OR admin can update profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;

CREATE POLICY "Profiles update policy" ON public.profiles 
FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
    )
);

-- ============================================================================
-- 4. Database Engine Trigger: Prevent Client-Side Privilege Escalation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_roles_and_status()
RETURNS TRIGGER AS $$
DECLARE
    acting_user_role VARCHAR;
    normalized_acting_role VARCHAR;
    normalized_new_role VARCHAR;
    normalized_old_role VARCHAR;
BEGIN
    -- Only evaluate if role or status is changing
    IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.account_status IS DISTINCT FROM OLD.account_status) THEN
        -- Determine role of the authenticated caller
        SELECT role INTO acting_user_role FROM public.profiles WHERE id = auth.uid();
        
        normalized_acting_role := LOWER(REPLACE(COALESCE(acting_user_role, ''), ' ', '_'));
        normalized_new_role := LOWER(REPLACE(COALESCE(NEW.role, ''), ' ', '_'));
        normalized_old_role := LOWER(REPLACE(COALESCE(OLD.role, ''), ' ', '_'));

        -- 1. Check if role is being modified
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            -- Must be admin or super_admin
            IF normalized_acting_role NOT IN ('admin', 'super_admin') THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles.';
            END IF;

            -- Prevent changing own role (prevents self-lockout and self-privilege escalation)
            IF auth.uid() = OLD.id THEN
                RAISE EXCEPTION 'Access Denied: Administrators cannot modify their own role.';
            END IF;

            -- Only super_admin can grant or revoke super_admin privileges
            IF (normalized_new_role = 'super_admin' OR normalized_old_role = 'super_admin') 
               AND normalized_acting_role != 'super_admin' THEN
                RAISE EXCEPTION 'Access Denied: Only Super Administrators can grant or modify Super Admin privileges.';
            END IF;

            -- Validate role against approved project roles
            IF normalized_new_role NOT IN ('user', 'specialist', 'admin', 'super_admin', 'volunteer') THEN
                RAISE EXCEPTION 'Invalid role: %', NEW.role;
            END IF;
        END IF;

        -- 2. Check if account_status is being modified
        IF (NEW.account_status IS DISTINCT FROM OLD.account_status) THEN
            IF normalized_acting_role NOT IN ('admin', 'super_admin') THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can modify account status.';
            END IF;

            -- Prevent self-banning / self-deactivation
            IF auth.uid() = OLD.id THEN
                RAISE EXCEPTION 'Access Denied: You cannot modify your own account status.';
            END IF;

            -- Validate account status
            IF NEW.account_status NOT IN ('active', 'inactive', 'suspended', 'banned') THEN
                RAISE EXCEPTION 'Invalid account status: %', NEW.account_status;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_roles_and_status ON public.profiles;
CREATE TRIGGER trg_protect_profile_roles_and_status
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_roles_and_status();

-- ============================================================================
-- 5. Stored Procedures / RPC Functions for Secure Admin Operations & Auditing
-- ============================================================================

-- 5.1 Admin Role Management RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_uid UUID;
    calling_role VARCHAR;
    target_current_role VARCHAR;
    norm_calling_role VARCHAR;
    norm_new_role VARCHAR;
    norm_target_role VARCHAR;
BEGIN
    calling_uid := auth.uid();
    IF calling_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT role INTO calling_role FROM public.profiles WHERE id = calling_uid;
    norm_calling_role := LOWER(REPLACE(COALESCE(calling_role, ''), ' ', '_'));

    IF norm_calling_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can modify roles.';
    END IF;

    IF calling_uid = target_user_id THEN
        RAISE EXCEPTION 'Access Denied: Administrators cannot modify their own role.';
    END IF;

    SELECT role INTO target_current_role FROM public.profiles WHERE id = target_user_id;
    IF target_current_role IS NULL THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    norm_target_role := LOWER(REPLACE(target_current_role, ' ', '_'));
    norm_new_role := LOWER(REPLACE(new_role, ' ', '_'));

    IF (norm_target_role = 'super_admin' OR norm_new_role = 'super_admin')
       AND norm_calling_role != 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Super Administrators can manage Super Admin roles.';
    END IF;

    IF norm_new_role NOT IN ('user', 'specialist', 'admin', 'super_admin', 'volunteer') THEN
        RAISE EXCEPTION 'Invalid role specified: %', new_role;
    END IF;

    UPDATE public.profiles
    SET role = norm_new_role
    WHERE id = target_user_id;

    -- Ensure specialist profile stub exists if role changed to specialist
    IF norm_new_role = 'specialist' THEN
        INSERT INTO public.specialist_profiles (id, specialty, availability_status)
        VALUES (target_user_id, 'طب عام', 'online')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Audit Log Entry
    INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, metadata)
    VALUES (
        calling_uid,
        'update_user_role',
        'user',
        target_user_id::text,
        jsonb_build_object('old_role', target_current_role, 'new_role', norm_new_role)
    );

    RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'new_role', norm_new_role);
END;
$$;

-- 5.2 Admin Account Status RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
    target_user_id UUID,
    new_status VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_uid UUID;
    calling_role VARCHAR;
    norm_calling_role VARCHAR;
    target_current_status VARCHAR;
BEGIN
    calling_uid := auth.uid();
    IF calling_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT role INTO calling_role FROM public.profiles WHERE id = calling_uid;
    norm_calling_role := LOWER(REPLACE(COALESCE(calling_role, ''), ' ', '_'));

    IF norm_calling_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can modify account status.';
    END IF;

    IF calling_uid = target_user_id THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify your own account status.';
    END IF;

    SELECT account_status INTO target_current_status FROM public.profiles WHERE id = target_user_id;
    IF target_current_status IS NULL THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    IF new_status NOT IN ('active', 'inactive', 'suspended', 'banned') THEN
        RAISE EXCEPTION 'Invalid account status specified: %', new_status;
    END IF;

    UPDATE public.profiles
    SET account_status = new_status
    WHERE id = target_user_id;

    -- Audit Log Entry
    INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, metadata)
    VALUES (
        calling_uid,
        'update_account_status',
        'user',
        target_user_id::text,
        jsonb_build_object('old_status', target_current_status, 'new_status', new_status)
    );

    RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'new_status', new_status);
END;
$$;

-- 5.3 Admin Profile Update RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    target_user_id UUID,
    full_name_input VARCHAR DEFAULT NULL,
    phone_input VARCHAR DEFAULT NULL,
    wilaya_input VARCHAR DEFAULT NULL,
    gender_input VARCHAR DEFAULT NULL,
    internal_notes_input TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_uid UUID;
    calling_role VARCHAR;
    norm_calling_role VARCHAR;
BEGIN
    calling_uid := auth.uid();
    IF calling_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT role INTO calling_role FROM public.profiles WHERE id = calling_uid;
    norm_calling_role := LOWER(REPLACE(COALESCE(calling_role, ''), ' ', '_'));

    IF norm_calling_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can update user profiles.';
    END IF;

    UPDATE public.profiles
    SET 
        full_name = COALESCE(full_name_input, full_name),
        phone = COALESCE(phone_input, phone),
        wilaya = COALESCE(wilaya_input, wilaya),
        gender = COALESCE(gender_input, gender),
        internal_notes = COALESCE(internal_notes_input, internal_notes)
    WHERE id = target_user_id;

    -- Audit Log Entry
    INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, metadata)
    VALUES (
        calling_uid,
        'update_user_profile',
        'user',
        target_user_id::text,
        jsonb_build_object('full_name', full_name_input, 'phone', phone_input, 'wilaya', wilaya_input)
    );

    RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$;

-- ============================================================================
-- 6. Trigger to keep auth.users.email synchronized with public.profiles.email
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, role, account_status)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
