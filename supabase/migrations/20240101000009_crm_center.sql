-- Supabase Migration: 20240101000009_crm_center.sql

-- Alter the profiles table to support advanced CRM capabilities (Profile 360)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS wilaya VARCHAR,
ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'active', -- 'active', 'inactive', 'banned'
ADD COLUMN IF NOT EXISTS tags VARCHAR[] DEFAULT '{}', -- Array of tags (e.g., 'VIP', 'Requires Attention')
ADD COLUMN IF NOT EXISTS internal_notes TEXT, -- Notes visible only to admins/CRM managers
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0; -- Rating/Scoring for the user (0-5 or 0-100)

-- We already have 'role' in profiles.
-- Roles supported by logic: 'super_admin', 'admin', 'moderator', 'specialist', 'volunteer_leader', 'volunteer', 'user'.

-- Create an index for faster CRM search and filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_wilaya ON public.profiles(wilaya);

-- Update the handle_new_user trigger to include some defaults if needed (it already inserts basic data)
-- We will keep the existing trigger, no need to overwrite unless we are mapping meta_data for new fields.
