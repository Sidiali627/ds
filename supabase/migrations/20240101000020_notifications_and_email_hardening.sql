-- Supabase Migration: 20240101000020_notifications_and_email_hardening.sql
-- Description: Phase 8 - In-App Notifications & Privacy-Safe Email Integration Hardening

-- ============================================================================
-- 1. Notifications Table Enhancements & Column Idempotency
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR NOT NULL DEFAULT 'system',
    priority VARCHAR DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    link VARCHAR,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link VARCHAR;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Indexes for ultra-fast unread queries & deduplication
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON public.notifications USING gin(metadata);

-- ============================================================================
-- 2. Email Logs Table Enhancements & Column Idempotency
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    template_key VARCHAR,
    campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    status VARCHAR DEFAULT 'pending', -- pending, sent, failed, pending_configuration, skipped
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_key VARCHAR;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Deduplication & status audit indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_status_created ON public.email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_template ON public.email_logs(recipient_email, template_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_metadata_gin ON public.email_logs USING gin(metadata);

-- ============================================================================
-- 3. Appointments Index for Fast Reminders Scanning
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_scan ON public.appointments(status, scheduled_at);

-- ============================================================================
-- 4. Default System Email Templates (Arabic RTL Privacy-Safe)
-- ============================================================================
INSERT INTO public.email_templates (name, subject, body_content, style_config)
VALUES 
    (
        'consultation_status',
        'تحديث بشأن استشارتك الطبية - استوديو صحة الشباب',
        'مرحباً بك، نود إعلامك بأنه تم تحديث حالة استشارتك الطبية في منصة استوديو صحة الشباب. للمحافظة على خصوصية بياناتك الصحية، يرجى تسجيل الدخول إلى حسابك بأمان لمراجعة المستجدات والتواصل مع فريق الرعاية الصحية.',
        '{"primary_color": "#0284c7", "show_logo": true, "show_footer": true, "category": "consultation"}'::jsonb
    ),
    (
        'appointment_confirmation',
        'تأكيد موعدك الطبي - استوديو صحة الشباب',
        'مرحباً بك، يسعدنا إبلاغك بأنه قد تم تأكيد موعدك الطبي بنجاح. يمكنك الاطلاع على توقيت الجلسة ورابط الاستشارة المباشرة عبر تسجيل الدخول إلى منصة استوديو صحة الشباب.',
        '{"primary_color": "#059669", "show_logo": true, "show_footer": true, "category": "appointment"}'::jsonb
    ),
    (
        'appointment_reminder',
        'تذكير بموعدك الطبي القادم - استوديو صحة الشباب',
        'مرحباً بك، هذا تذكير ودي باقتراب موعد جلستك الطبية القادمة خلال 24 ساعة. يرجى التأكد من جاهزية اتصالك بالإنترنت وتسجيل الدخول إلى حسابك قبل الموعد ببضع دقائق.',
        '{"primary_color": "#d97706", "show_logo": true, "show_footer": true, "category": "reminder"}'::jsonb
    ),
    (
        'medical_record_ready',
        'تحديث جديد في سجلك الطبي (EMR) - استوديو صحة الشباب',
        'مرحباً بك، قام طبيبك المشرف بإضافة تدوين أو تقرير طبي جديد في سجلك الطبي الإلكتروني. لأسباب تتعلق بالسرية الطبية، لا نقوم بإرسال تفاصيل التقرير عبر البريد. يرجى تسجيل الدخول الآمن للاطلاع عليه.',
        '{"primary_color": "#7c3aed", "show_logo": true, "show_footer": true, "category": "medical_record"}'::jsonb
    ),
    (
        'admin_announcement',
        'إعلان رسمي هام - استوديو صحة الشباب',
        'إعلان هام لجميع مستخدمي منصة استوديو صحة الشباب. يرجى مراجعة التفاصيل داخل المنصة.',
        '{"primary_color": "#1a56db", "show_logo": true, "show_footer": true, "category": "announcement"}'::jsonb
    )
ON CONFLICT (name) DO UPDATE 
SET subject = EXCLUDED.subject,
    body_content = EXCLUDED.body_content,
    style_config = EXCLUDED.style_config,
    updated_at = timezone('utc'::text, now());

-- ============================================================================
-- 5. Row Level Security (RLS) Hardening
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- 5.1 Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id IS NULL 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
CREATE POLICY "Authenticated insert notifications" ON public.notifications FOR INSERT WITH CHECK (
    -- Admins can create any notification (including global user_id IS NULL)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    -- Authenticated participants can create targeted notifications (e.g. Booking, Consultation, Prescriptions)
    OR (auth.role() = 'authenticated' AND user_id IS NOT NULL)
);

-- 5.2 Email Logs RLS Policies
DROP POLICY IF EXISTS "Admins manage email logs" ON public.email_logs;
CREATE POLICY "Admins manage email logs" ON public.email_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Authenticated insert email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Allow audit insert email logs" ON public.email_logs;
CREATE POLICY "Allow audit insert email logs" ON public.email_logs FOR INSERT WITH CHECK (
    true
);

-- 5.3 Realtime Publication Registration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;
