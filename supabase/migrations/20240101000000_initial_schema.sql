-- Supabase Migration: 20240101000000_initial_schema.sql

-- 1. Site Settings Table (For CMS)
CREATE TABLE IF NOT EXISTS public.site_settings (
    key VARCHAR PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Allow admins to update site_settings" ON public.site_settings FOR ALL USING (auth.role() = 'authenticated'); -- To be restricted to admin role later

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
('site_title', '"استوديو صحة الشباب"'),
('logo_url', '"images/logo.png"'),
('contact_email', '"contact@youthhealth.dz"'),
('nav_links', '[{"title": "الرئيسية", "url": "index.html"}, {"title": "من نحن", "url": "about.html"}, {"title": "تواصل معنا", "url": "contact.html"}]')
ON CONFLICT (key) DO NOTHING;


-- 2. Pages Content Table (For CMS)
CREATE TABLE IF NOT EXISTS public.pages_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page VARCHAR NOT NULL,
    section VARCHAR NOT NULL,
    content JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(page, section)
);

-- RLS
ALTER TABLE public.pages_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on pages_content" ON public.pages_content FOR SELECT USING (true);
CREATE POLICY "Allow admins to update pages_content" ON public.pages_content FOR ALL USING (auth.role() = 'authenticated');

-- Insert default page content
INSERT INTO public.pages_content (page, section, content) VALUES
('home', 'hero', '{"title": "مرحباً بك في استوديو صحة الشباب", "description": "المنصة الرقمية الأولى للصحة الشبابية والتوعية والعمل التطوعي.", "buttons": [{"title": "ابدأ الآن", "url": "register.html", "type": "primary"}]}'),
('about', 'main', '{"title": "عن الجمعية", "body": "<p>نحن جمعية النور للسلامة المرورية، نهدف إلى نشر الوعي الصحي والمروري بين الشباب.</p>"}')
ON CONFLICT (page, section) DO NOTHING;


-- 3. Users Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name VARCHAR,
    avatar_url VARCHAR,
    phone VARCHAR,
    role VARCHAR DEFAULT 'user', -- 'user', 'admin', 'specialist', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- End of Migration
