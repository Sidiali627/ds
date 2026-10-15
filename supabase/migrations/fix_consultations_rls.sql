-- Supabase Migration: Create Chat Messages Table & Setup RLS & Realtime
-- Execute this SQL script in Supabase SQL Editor to create the table and allow seamless Realtime Chat & Persistence.

-- 1. Create chat_messages Table if it does not exist
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    sender_role VARCHAR DEFAULT 'user',
    message_type VARCHAR DEFAULT 'text',
    content TEXT,
    file_url VARCHAR,
    status VARCHAR DEFAULT 'sent',
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure Table Columns for Chat Messages if table existed previously
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR DEFAULT 'user';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 2. Enable RLS on Consultations & Chat Messages
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Consultations Policies
DROP POLICY IF EXISTS "Users insert own consultations" ON public.consultations;
CREATE POLICY "Users insert own consultations" ON public.consultations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Unified consultations read policy" ON public.consultations;
CREATE POLICY "Unified consultations read policy" ON public.consultations FOR SELECT TO authenticated USING (
    auth.uid() = user_id 
    OR auth.uid() = specialist_id 
    OR specialist_id IS NULL 
    OR status = 'pending'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('specialist', 'admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Unified consultations update policy" ON public.consultations;
CREATE POLICY "Unified consultations update policy" ON public.consultations FOR UPDATE TO authenticated USING (
    auth.uid() = user_id 
    OR auth.uid() = specialist_id 
    OR specialist_id IS NULL 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('specialist', 'admin', 'super_admin'))
);

-- 4. Chat Messages RLS Policies (Allows complete SELECT, INSERT, and UPDATE for participant users/specialists)
DROP POLICY IF EXISTS "Participants read messages" ON public.chat_messages;
CREATE POLICY "Participants read messages" ON public.chat_messages FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = chat_messages.consultation_id AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('specialist', 'admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Participants insert messages" ON public.chat_messages;
CREATE POLICY "Participants insert messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = chat_messages.consultation_id AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('specialist', 'admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Participants update messages" ON public.chat_messages;
CREATE POLICY "Participants update messages" ON public.chat_messages FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = chat_messages.consultation_id AND (c.user_id = auth.uid() OR c.specialist_id = auth.uid() OR c.specialist_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('specialist', 'admin', 'super_admin'))
);

-- 5. Enable Supabase Realtime Publication for Chat Tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'consultations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
    END IF;
END $$;
