-- Supabase Migration: 20240101000018_emr_and_health_records_hardening.sql
-- Description: Idempotent EMR Hardening for Patient Medical Dossiers, Clinical Notes, and Specialist Access

-- ============================================================================
-- 1. Ensure Table Structure & Constraints
-- ============================================================================

-- 1.1 Health Profiles Table Hardening
CREATE TABLE IF NOT EXISTS public.health_profiles (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    height DECIMAL,
    weight DECIMAL,
    blood_type VARCHAR,
    allergies TEXT,
    chronic_diseases TEXT,
    medications TEXT,
    vaccinations TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS height DECIMAL;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS weight DECIMAL;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS blood_type VARCHAR;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS chronic_diseases TEXT;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS medications TEXT;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS vaccinations TEXT;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.2 Case Files Table Hardening
CREATE TABLE IF NOT EXISTS public.case_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.3 Case Notes Table Hardening
CREATE TABLE IF NOT EXISTS public.case_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES public.profiles(id),
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    note_type VARCHAR DEFAULT 'general', -- general, diagnosis, treatment_plan, prescription
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT true, -- If true: specialist and admins only. If false: patient can view.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL;
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR DEFAULT 'general';
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

-- ============================================================================
-- 2. Indexes for High Performance Querying
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_health_profiles_user_id ON public.health_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON public.case_files(user_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON public.case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_specialist_id ON public.case_notes(specialist_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_note_type ON public.case_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_case_notes_is_private ON public.case_notes(is_private);

-- ============================================================================
-- 3. Row Level Security (RLS) Hardening
-- ============================================================================
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- 3.1 Health Profiles Policies
DROP POLICY IF EXISTS "Users read own health" ON public.health_profiles;
DROP POLICY IF EXISTS "Specialists and admins read patient health profile" ON public.health_profiles;
CREATE POLICY "Unified health_profiles read policy" ON public.health_profiles 
FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.user_id = health_profiles.user_id 
        AND c.specialist_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.user_id = health_profiles.user_id 
        AND a.specialist_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Users update own health" ON public.health_profiles;
CREATE POLICY "Unified health_profiles modify policy" ON public.health_profiles 
FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 3.2 Case Files Policies
DROP POLICY IF EXISTS "Users read own case file" ON public.case_files;
DROP POLICY IF EXISTS "Specialists read case files" ON public.case_files;
CREATE POLICY "Unified case_files read policy" ON public.case_files 
FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.user_id = case_files.user_id 
        AND c.specialist_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.user_id = case_files.user_id 
        AND a.specialist_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Specialists create case files" ON public.case_files;
DROP POLICY IF EXISTS "Users and specialists insert case files" ON public.case_files;
CREATE POLICY "Unified case_files insert policy" ON public.case_files 
FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.user_id = case_files.user_id 
        AND c.specialist_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.user_id = case_files.user_id 
        AND a.specialist_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Admins manage case files" ON public.case_files;
CREATE POLICY "Admins manage case files" ON public.case_files 
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 3.3 Case Notes Policies
DROP POLICY IF EXISTS "Users read public case notes" ON public.case_notes;
DROP POLICY IF EXISTS "Specialists and users read case notes" ON public.case_notes;
CREATE POLICY "Unified case_notes read policy" ON public.case_notes 
FOR SELECT USING (
    -- Patient can view non-private notes belonging to their case
    (
        is_private = false AND EXISTS (
            SELECT 1 FROM public.case_files f 
            WHERE f.id = case_notes.case_id 
            AND f.user_id = auth.uid()
        )
    )
    -- Author specialist or specialist treating patient can view all notes (including private)
    OR specialist_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.case_files f 
        JOIN public.consultations c ON f.user_id = c.user_id 
        WHERE f.id = case_notes.case_id 
        AND c.specialist_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.case_files f 
        JOIN public.appointments a ON f.user_id = a.user_id 
        WHERE f.id = case_notes.case_id 
        AND a.specialist_id = auth.uid()
    )
    -- Admin access
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Specialists manage case notes" ON public.case_notes;
CREATE POLICY "Specialists insert case notes" ON public.case_notes 
FOR INSERT WITH CHECK (
    specialist_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Specialists update own case notes" ON public.case_notes 
FOR UPDATE USING (
    specialist_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Admins manage case notes" ON public.case_notes;
CREATE POLICY "Admins manage case notes" ON public.case_notes 
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- 4. Realtime Publication
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'health_profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.health_profiles;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_notes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.case_notes;
    END IF;
END $$;
