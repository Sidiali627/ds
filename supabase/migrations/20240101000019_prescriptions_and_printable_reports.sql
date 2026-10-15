-- Supabase Migration: 20240101000019_prescriptions_and_printable_reports.sql
-- Description: Structured Medication Entries, Consultation Reports & Secure Printable Documentation

-- ============================================================================
-- 1. Ensure Columns on case_notes & consultations
-- ============================================================================

-- 1.1 Support structured medications and clinical metadata on case_notes
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'; -- active, completed, cancelled
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.2 Support formal reports and structured prescription on consultations
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS report TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS structured_prescription JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_case_notes_status ON public.case_notes(status);
CREATE INDEX IF NOT EXISTS idx_case_notes_consultation_id ON public.case_notes(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_user_specialist ON public.consultations(user_id, specialist_id);

-- ============================================================================
-- 3. Row Level Security (RLS) Hardening for Prescriptions & Reports
-- ============================================================================
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- 3.1 Verify Unified Read Policy on case_notes
DROP POLICY IF EXISTS "Unified case_notes read policy" ON public.case_notes;
CREATE POLICY "Unified case_notes read policy" ON public.case_notes 
FOR SELECT USING (
    -- Patient reads public clinical notes and prescriptions belonging to their case
    (
        is_private = false AND EXISTS (
            SELECT 1 FROM public.case_files f 
            WHERE f.id = case_notes.case_id 
            AND f.user_id = auth.uid()
        )
    )
    -- Authoring doctor or assigned specialist treats patient
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

-- 3.2 Verify Unified Insert Policy on case_notes
DROP POLICY IF EXISTS "Specialists insert case notes" ON public.case_notes;
CREATE POLICY "Specialists insert case notes" ON public.case_notes 
FOR INSERT WITH CHECK (
    specialist_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 3.3 Verify Unified Update Policy on case_notes
DROP POLICY IF EXISTS "Specialists update own case notes" ON public.case_notes;
CREATE POLICY "Specialists update own case notes" ON public.case_notes 
FOR UPDATE USING (
    specialist_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- 4. Realtime Subscription Maintenance
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_notes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.case_notes;
    END IF;
END $$;
