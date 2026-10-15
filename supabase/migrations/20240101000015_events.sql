-- Supabase Migration: 20240101000015_events.sql
-- Create National Events & Ticket Registrations Tables

-- 1. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR DEFAULT 'general', -- health, psychology, nutrition, youth
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR NOT NULL,
    map_url TEXT,
    total_seats INT DEFAULT 100,
    remaining_seats INT DEFAULT 100,
    image_url TEXT,
    video_url TEXT,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Event Registrations Table
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    phone VARCHAR,
    ticket_qr TEXT,
    status VARCHAR DEFAULT 'confirmed', -- confirmed, checked_in, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Public insert registrations" ON public.event_registrations;
CREATE POLICY "Public insert registrations" ON public.event_registrations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users read own registrations" ON public.event_registrations;
CREATE POLICY "Users read own registrations" ON public.event_registrations FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
