-- Supabase Migration: 20240101000005_control_center.sql

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type VARCHAR NOT NULL, -- e.g., 'user_registered', 'article_published', 'event_created'
    description TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id), -- The user who performed the action
    metadata JSONB DEFAULT '{}'::jsonb, -- Any extra context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to read logs (in a real app, restrict to super_admin via roles)
CREATE POLICY "Admins can view activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- Allow authenticated users to insert their own logs
CREATE POLICY "Users can insert activity logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Optional: Create triggers to auto-log some activities
-- Example: Auto-log when a new article is created
CREATE OR REPLACE FUNCTION log_article_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (action_type, description, user_id, metadata)
    VALUES (
        'article_published', 
        'تم نشر مقال جديد: ' || NEW.title, 
        NEW.author_id,
        jsonb_build_object('article_id', NEW.id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_article_created ON public.articles;
CREATE TRIGGER on_article_created
    AFTER INSERT ON public.articles
    FOR EACH ROW
    EXECUTE FUNCTION log_article_creation();
