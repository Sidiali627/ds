-- Supabase Migration: 20240101000012_ai_assistant.sql

-- 1. AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title VARCHAR DEFAULT 'محادثة جديدة',
    type VARCHAR DEFAULT 'user', -- 'admin' or 'user'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. AI Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. AI Prompts Library
CREATE TABLE IF NOT EXISTS public.ai_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR DEFAULT 'general', -- 'seo', 'content', 'analytics'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AI Settings (Strict access)
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider VARCHAR DEFAULT 'openai', -- 'openai' or 'gemini'
    api_key VARCHAR, -- Stored securely (in production, use Edge Functions Vault)
    model VARCHAR DEFAULT 'gpt-4o',
    temperature FLOAT DEFAULT 0.7,
    system_prompt_admin TEXT DEFAULT 'أنت مساعد ذكي لمدير منصة استوديو صحة الشباب. هدفك مساعدته في كتابة المحتوى وتحسين الـ SEO.',
    system_prompt_user TEXT DEFAULT 'أنت المساعد الذكي لمستخدمي منصة استوديو صحة الشباب. أجب عن استفساراتهم ووجههم للمقالات المناسبة بلطف.'
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Policies for Conversations & Messages (Users can only see their own)
CREATE POLICY "Users manage own conversations" ON public.ai_conversations FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own messages" ON public.ai_messages FOR ALL 
USING (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = ai_messages.conversation_id AND user_id = auth.uid()));

-- Policies for Prompts
CREATE POLICY "Admins manage prompts" ON public.ai_prompts FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins read prompts" ON public.ai_prompts FOR SELECT USING (true);

-- Policies for Settings (Only Super Admins)
CREATE POLICY "Super Admins manage AI settings" ON public.ai_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
-- Read access allowed for authenticated users so the client-side JS can fetch the key (Demonstration purposes)
-- WARNING: In a real production environment, this should NOT be readable by public. The API calls should happen via Supabase Edge Functions.
CREATE POLICY "Auth users read AI settings" ON public.ai_settings FOR SELECT USING (auth.role() = 'authenticated');

-- Insert Initial Settings Row if empty
INSERT INTO public.ai_settings (provider, model, temperature) 
SELECT 'openai', 'gpt-4o', 0.7
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings);

-- Insert Default Prompts
INSERT INTO public.ai_prompts (title, content, category) VALUES
('تحسين SEO للمقال', 'قم بمراجعة المقال التالي واستخرج أفضل الكلمات المفتاحية واقترح عنواناً جذاباً ووصف Meta مناسباً:', 'seo'),
('تلخيص إحصائيات', 'لدي البيانات التالية حول أداء المنصة. هل يمكنك تحليلها وإعطائي 3 توصيات قابلة للتنفيذ؟', 'analytics'),
('فكرة حملة تطوعية', 'اقترح لي فكرة حملة تطوعية جديدة تستهدف فئة الشباب في مجال الصحة النفسية، مع وضع خطة من 5 خطوات.', 'content');
