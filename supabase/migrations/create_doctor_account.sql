-- SQL Script: Create / Upgrade a Specialist (Doctor) Account
-- Replace 'doctor@example.com' with the email of the registered account.

-- 1. Upgrade profile role to 'specialist'
UPDATE public.profiles 
SET role = 'specialist' 
WHERE email = 'joji00158@gmail.com';

-- 2. Ensure specialist_profiles table exists
CREATE TABLE IF NOT EXISTS public.specialist_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialty VARCHAR NOT NULL,
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.0,
    availability_status VARCHAR DEFAULT 'online',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Insert or Update specialist_profiles data for the doctor
INSERT INTO public.specialist_profiles (id, specialty, bio, availability_status)
SELECT id, 'طب عام', 'دكتور استشاري متخصص', 'online'
FROM public.profiles
WHERE email = 'joji00158@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET specialty = EXCLUDED.specialty, availability_status = 'online';
