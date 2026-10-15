-- Supabase Migration: 20240101000007_site_management.sql

-- Create site_settings table to store dynamic configurations
CREATE TABLE IF NOT EXISTS public.site_settings (
    key VARCHAR PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the website can fetch theme, seo, maintenance mode, etc)
CREATE POLICY "Public read site_settings" 
ON public.site_settings 
FOR SELECT 
USING (true);

-- Allow only admins to update/insert settings
CREATE POLICY "Admins can manage site_settings" 
ON public.site_settings 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- Pre-fill default settings
INSERT INTO public.site_settings (key, value) VALUES
('identity', '{"platform_name": "استوديو صحة الشباب", "description": "منصة رقمية رائدة", "seo_keywords": "صحة, شباب", "email": "contact@yhs.com", "phone": "+21300000000", "address": "الجزائر", "socials": {"facebook": "", "twitter": "", "instagram": ""}}'::jsonb),
('theme', '{"colors": {"primary": "#1a56db", "secondary": "#4f46e5", "accent": "#10b981", "success": "#10b981", "warning": "#f59e0b", "danger": "#ef4444", "background": "#f9fafb", "text": "#111827", "border": "#e5e7eb", "button_text": "#ffffff"}, "fonts": {"family": "Inter", "size": "16px", "weight": "400", "line_height": "1.5"}, "mode": "system"}'::jsonb),
('homepage', '{"hero_title": "مرحباً بكم في استوديو صحة الشباب", "hero_desc": "منصة متكاملة لبناء مستقبل صحي", "show_hero": true, "show_features": true, "show_latest_articles": true, "show_events": true}'::jsonb),
('seo', '{"meta_title": "استوديو صحة الشباب - الرئيسية", "meta_description": "المنصة الأولى للشباب", "og_image": "", "twitter_card": "summary_large_image"}'::jsonb),
('maintenance', '{"is_active": false, "message": "الموقع تحت الصيانة، سنعود قريباً.", "end_date": ""}'::jsonb),
('announcement', '{"show_banner": false, "message": "مرحباً بكم في النسخة الجديدة!", "link": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
