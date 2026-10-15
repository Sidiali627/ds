-- Supabase Migration: 20240101000001_full_schema.sql

-- Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb
);

-- Articles Table
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id),
    category VARCHAR,
    image_url VARCHAR,
    status VARCHAR DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Videos Table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    video_url VARCHAR NOT NULL,
    thumbnail_url VARCHAR,
    category VARCHAR,
    duration INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Podcasts Table
CREATE TABLE IF NOT EXISTS public.podcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    episode_number INT,
    title VARCHAR NOT NULL,
    description TEXT,
    audio_url VARCHAR NOT NULL,
    guest VARCHAR,
    duration INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Health Profiles Table
CREATE TABLE IF NOT EXISTS public.health_profiles (
    user_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
    height DECIMAL,
    weight DECIMAL,
    blood_type VARCHAR,
    allergies TEXT,
    chronic_diseases TEXT,
    medications TEXT,
    vaccinations TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Consultations Table
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    specialist_id UUID REFERENCES public.profiles(id),
    status VARCHAR DEFAULT 'pending',
    report TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR,
    description TEXT,
    capacity INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Volunteers Table
CREATE TABLE IF NOT EXISTS public.volunteers (
    user_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
    status VARCHAR DEFAULT 'pending',
    volunteer_hours INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Apply RLS to all
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

-- Basic Policies (To be restricted later via RBAC)
CREATE POLICY "Public read articles" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "Public read videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Users read own health" ON public.health_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own health" ON public.health_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users read own consultations" ON public.consultations FOR SELECT USING (auth.uid() = user_id OR auth.uid() = specialist_id);
