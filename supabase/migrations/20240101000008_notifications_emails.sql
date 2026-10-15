-- Supabase Migration: 20240101000008_notifications_emails.sql

-- 1. In-App Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id), -- Null means it's a global notification
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR NOT NULL DEFAULT 'system', -- 'system', 'consultation', 'event', 'article'
    priority VARCHAR DEFAULT 'normal', -- 'low', 'normal', 'high'
    is_read BOOLEAN DEFAULT false,
    link VARCHAR, -- Optional URL to redirect to
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    status VARCHAR DEFAULT 'active', -- 'active', 'unsubscribed', 'bounced'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE
);

-- 3. Email Templates (Editor)
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL, -- e.g., 'welcome_email', 'newsletter'
    subject VARCHAR NOT NULL,
    body_content TEXT, -- HTML content
    style_config JSONB DEFAULT '{"primary_color": "#1a56db", "show_logo": true, "show_footer": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Email Campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    template_id UUID REFERENCES public.email_templates(id),
    status VARCHAR DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'completed', 'paused'
    target_audience VARCHAR DEFAULT 'all_subscribers', -- 'all_subscribers', 'users', 'volunteers'
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 5. Email Logs (Audit)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    campaign_id UUID REFERENCES public.email_campaigns(id),
    status VARCHAR DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can see their own, admins can see all
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Subscribers: Public can insert (subscribe), Admins can manage
CREATE POLICY "Public can subscribe" ON public.subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage subscribers" ON public.subscribers FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Email Entities: Only Admins can manage
CREATE POLICY "Admins manage templates" ON public.email_templates FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins manage campaigns" ON public.email_campaigns FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins manage email logs" ON public.email_logs FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
