-- Supabase Migration: 20240101000006_security_center.sql

-- 1. Audit Logs (More comprehensive than activity_logs, tracking exact actions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action_type VARCHAR NOT NULL, -- 'login', 'logout', 'create_article', 'update_settings', 'delete_file'
    entity_type VARCHAR, -- 'article', 'file', 'user', 'system'
    entity_id VARCHAR, -- ID of the affected resource
    metadata JSONB DEFAULT '{}'::jsonb, -- e.g., IP address, user agent, old_value, new_value
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User Sessions Tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    device VARCHAR,
    browser VARCHAR,
    os VARCHAR,
    ip_address VARCHAR,
    country VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    logout_time TIMESTAMP WITH TIME ZONE
);

-- 3. Security Threats & Rate Limits Tracking
CREATE TABLE IF NOT EXISTS public.security_threats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    threat_type VARCHAR NOT NULL, -- 'SQL_INJECTION', 'BRUTE_FORCE', 'XSS', 'UNAUTHORIZED_ACCESS', 'RATE_LIMIT'
    ip_address VARCHAR NOT NULL,
    user_id UUID REFERENCES auth.users(id), -- Nullable if attacker is anonymous
    endpoint VARCHAR,
    details TEXT,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_threats ENABLE ROW LEVEL SECURITY;

-- Admins can view everything
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view user sessions" ON public.user_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can view security threats" ON public.security_threats FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Users can insert their own logs and view their own sessions
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);
