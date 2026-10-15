-- Supabase Migration: 20240101000014_specialist_portal.sql
-- Description: Idempotent Specialist Portal Schema, RLS Policies & Realtime Setup

-- ============================================================================
-- 1. Tables Creation & Schema Adjustments (IF NOT EXISTS)
-- ============================================================================

-- 1.1 Specialist Profiles (Extended Profile Data)
CREATE TABLE IF NOT EXISTS public.specialist_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialty VARCHAR NOT NULL,
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.0,
    availability_status VARCHAR DEFAULT 'online', -- online, offline, busy
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was partially created
ALTER TABLE public.specialist_profiles ADD COLUMN IF NOT EXISTS specialty VARCHAR;
ALTER TABLE public.specialist_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.specialist_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE public.specialist_profiles ADD COLUMN IF NOT EXISTS availability_status VARCHAR DEFAULT 'online';
ALTER TABLE public.specialist_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.2 Case Files (Medical Records per User)
CREATE TABLE IF NOT EXISTS public.case_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.3 Consultations (Workflow Table)
-- Note: Table might already exist from 20240101000001_full_schema.sql, so we ensure all columns exist!
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES public.profiles(id),
    specialty VARCHAR NOT NULL DEFAULT 'general',
    priority VARCHAR DEFAULT 'normal', -- normal, urgent, emergency
    description TEXT,
    report TEXT,
    status VARCHAR DEFAULT 'pending', -- pending, assigned, accepted, in_progress, waiting, completed, cancelled, rejected, archived
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crucial: Ensure new columns added by specialist portal exist even if consultations was created earlier
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS specialty VARCHAR DEFAULT 'general';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'normal';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS report TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.4 Chat Messages (Live Realtime Consultations)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    sender_role VARCHAR DEFAULT 'user',
    message_type VARCHAR DEFAULT 'text', -- text, image, file, voice, prescription
    content TEXT,
    file_url VARCHAR,
    status VARCHAR DEFAULT 'sent', -- sent, delivered, read
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR DEFAULT 'user';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 1.5 Case Notes & Prescriptions
CREATE TABLE IF NOT EXISTS public.case_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES public.profiles(id),
    consultation_id UUID REFERENCES public.consultations(id),
    note_type VARCHAR DEFAULT 'general', -- general, diagnosis, treatment_plan, prescription
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT true, -- If true: specialist and admins only. If false: patient can view.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.6 Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR DEFAULT 'pending', -- pending, accepted, rejected, completed, cancelled
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- 2. Performance Indexes (Safe IF NOT EXISTS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON public.consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_specialist_id ON public.consultations(specialist_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation_id ON public.chat_messages(consultation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON public.case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_specialist_id ON public.case_notes(specialist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_id ON public.appointments(specialist_id);

-- ============================================================================
-- 3. Row Level Security (RLS) Activation
-- ============================================================================
ALTER TABLE public.specialist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Idempotent RLS Policies (DROP POLICY IF EXISTS + CREATE POLICY)
-- ============================================================================

-- 4.1 Specialist Profiles Policies
DROP POLICY IF EXISTS "Public read specialist profiles" ON public.specialist_profiles;
CREATE POLICY "Public read specialist profiles" 
ON public.specialist_profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Specialist self edit" ON public.specialist_profiles;
CREATE POLICY "Specialist self edit" 
ON public.specialist_profiles FOR UPDATE 
USING (id = auth.uid());

DROP POLICY IF EXISTS "Specialist self insert" ON public.specialist_profiles;
CREATE POLICY "Specialist self insert" 
ON public.specialist_profiles FOR INSERT 
WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4.2 Consultations Policies
-- Solves ERROR 42710 by dropping pre-existing policy from 20240101000001_full_schema.sql
DROP POLICY IF EXISTS "Users read own consultations" ON public.consultations;
CREATE POLICY "Users read own consultations" 
ON public.consultations FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own consultations" ON public.consultations;
CREATE POLICY "Users insert own consultations" 
ON public.consultations FOR INSERT 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Specialists read assigned consultations" ON public.consultations;
CREATE POLICY "Specialists read assigned consultations" 
ON public.consultations FOR SELECT 
USING (specialist_id = auth.uid() OR status = 'pending');

DROP POLICY IF EXISTS "Specialists update assigned consultations" ON public.consultations;
CREATE POLICY "Specialists update assigned consultations" 
ON public.consultations FOR UPDATE 
USING (specialist_id = auth.uid() OR specialist_id IS NULL);

DROP POLICY IF EXISTS "Admins manage consultations" ON public.consultations;
CREATE POLICY "Admins manage consultations" 
ON public.consultations FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4.3 Chat Messages Policies
DROP POLICY IF EXISTS "Participants read messages" ON public.chat_messages;
CREATE POLICY "Participants read messages" 
ON public.chat_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.id = chat_messages.consultation_id 
        AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Participants insert messages" ON public.chat_messages;
CREATE POLICY "Participants insert messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (
    sender_id = auth.uid() AND (
        EXISTS (
            SELECT 1 FROM public.consultations c 
            WHERE c.id = chat_messages.consultation_id 
            AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL)
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
);

DROP POLICY IF EXISTS "Participants update own messages status" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants update messages" ON public.chat_messages;
CREATE POLICY "Participants update messages" 
ON public.chat_messages FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.id = chat_messages.consultation_id 
        AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 4.4 Case Files Policies
DROP POLICY IF EXISTS "Users read own case file" ON public.case_files;
CREATE POLICY "Users read own case file" 
ON public.case_files FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Specialists read case files" ON public.case_files;
CREATE POLICY "Specialists read case files" 
ON public.case_files FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.user_id = case_files.user_id 
        AND c.specialist_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Specialists create case files" ON public.case_files;
CREATE POLICY "Specialists create case files" 
ON public.case_files FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.consultations c 
        WHERE c.user_id = case_files.user_id 
        AND c.specialist_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Admins manage case files" ON public.case_files;
CREATE POLICY "Admins manage case files" 
ON public.case_files FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4.5 Case Notes & Prescriptions Policies
DROP POLICY IF EXISTS "Users read public case notes" ON public.case_notes;
CREATE POLICY "Users read public case notes" 
ON public.case_notes FOR SELECT 
USING (
    is_private = false AND EXISTS (
        SELECT 1 FROM public.case_files f 
        WHERE f.id = case_notes.case_id 
        AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Specialists manage case notes" ON public.case_notes;
CREATE POLICY "Specialists manage case notes" 
ON public.case_notes FOR ALL 
USING (
    specialist_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.case_files f 
        JOIN public.consultations c ON f.user_id = c.user_id 
        WHERE f.id = case_notes.case_id 
        AND c.specialist_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins manage case notes" ON public.case_notes;
CREATE POLICY "Admins manage case notes" 
ON public.case_notes FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4.6 Appointments Policies
DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Participants read appointments" ON public.appointments;
CREATE POLICY "Participants read appointments" 
ON public.appointments FOR SELECT 
USING (
    user_id = auth.uid() 
    OR specialist_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Specialists manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Participants insert appointments" ON public.appointments;
CREATE POLICY "Participants insert appointments" 
ON public.appointments FOR INSERT 
WITH CHECK (
    user_id = auth.uid() 
    OR specialist_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Admins manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Participants update appointments" ON public.appointments;
CREATE POLICY "Participants update appointments" 
ON public.appointments FOR UPDATE 
USING (
    user_id = auth.uid() 
    OR specialist_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- 5. Safe Supabase Realtime Publication Setup (Idempotent DO block)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'consultations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
    END IF;
END $$;
