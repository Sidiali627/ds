-- Supabase Migration: 20240101000013_seo_center.sql

-- Create SEO Pages Table
CREATE TABLE IF NOT EXISTS public.seo_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path VARCHAR NOT NULL UNIQUE, -- E.g., '/index.html' or '/about.html'
    title VARCHAR,
    description TEXT,
    keywords TEXT,
    og_image VARCHAR,
    canonical_url VARCHAR,
    schema_markup TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can manage SEO
CREATE POLICY "Admins manage SEO" ON public.seo_pages FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Public can read SEO data (required for the injector script)
CREATE POLICY "Public read SEO" ON public.seo_pages FOR SELECT USING (true);

-- Insert Default Data for Index Page
INSERT INTO public.seo_pages (path, title, description, keywords, canonical_url) VALUES 
('/index.html', 'استوديو صحة الشباب - الرئيسية', 'المنصة الأولى لدعم صحة الشباب وتوفير استشارات نفسية ومقالات توعوية.', 'صحة الشباب, استشارات نفسية, توعية', 'https://yhs.com/index.html')
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.seo_pages (path, title, description, keywords, canonical_url) VALUES 
('/about.html', 'من نحن - استوديو صحة الشباب', 'تعرف على رؤية ورسالة استوديو صحة الشباب وفريقنا التطوعي.', 'من نحن, رؤية, رسالة', 'https://yhs.com/about.html')
ON CONFLICT (path) DO NOTHING;
