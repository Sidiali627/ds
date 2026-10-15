-- Supabase Migration: 20240101000017_appointments_and_notifications_hardening.sql
-- Description: Idempotent Hardening for Appointments, Concurrency Double-Booking Prevention & Realtime In-App Notifications

-- ============================================================================
-- 1. Hardening Appointments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR DEFAULT 'pending', -- pending, confirmed, rescheduled, completed, cancelled, rejected
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist idempotently
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Double-Booking Prevention: Unique Partial Index on (specialist_id, scheduled_at) for active slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment_slot 
ON public.appointments (specialist_id, scheduled_at) 
WHERE (status NOT IN ('cancelled', 'rejected'));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_schedule ON public.appointments(specialist_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_user_schedule ON public.appointments(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- ============================================================================
-- 2. Hardening In-App Notifications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR NOT NULL DEFAULT 'system', -- system, appointment, consultation, reminder, alert
    priority VARCHAR DEFAULT 'normal', -- low, normal, high, urgent
    is_read BOOLEAN DEFAULT false,
    link VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link VARCHAR;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- 3. Row Level Security (RLS) Configuration
-- ============================================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3.1 Appointments RLS Policies
DROP POLICY IF EXISTS "Participants read appointments" ON public.appointments;
CREATE POLICY "Participants read appointments" ON public.appointments FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() = specialist_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Participants insert appointments" ON public.appointments;
CREATE POLICY "Participants insert appointments" ON public.appointments FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR auth.uid() = specialist_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Participants update appointments" ON public.appointments;
CREATE POLICY "Participants update appointments" ON public.appointments FOR UPDATE USING (
    auth.uid() = user_id 
    OR auth.uid() = specialist_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 3.2 Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
CREATE POLICY "Authenticated insert notifications" ON public.notifications FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- 4. Supabase Realtime Publication Registration
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;
