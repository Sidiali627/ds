-- Supabase Migration: 20240101000003_fix_articles_rls.sql

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public read articles" ON public.articles;
DROP POLICY IF EXISTS "Public read published articles" ON public.articles;
DROP POLICY IF EXISTS "Admin can insert articles" ON public.articles;
DROP POLICY IF EXISTS "Admin can update articles" ON public.articles;
DROP POLICY IF EXISTS "Admin can delete articles" ON public.articles;
DROP POLICY IF EXISTS "Admin read all articles" ON public.articles;

-- 1. SELECT Policy
-- الزوار والمستخدمون العاديون يقرؤون المقالات المنشورة فقط
CREATE POLICY "Public read published articles" ON public.articles 
FOR SELECT 
USING (status = 'published');

-- المدراء يقرؤون كل شيء (بما فيها المسودات)
CREATE POLICY "Admin read all articles" ON public.articles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 2. INSERT Policy
-- المدراء فقط من يمكنهم إضافة مقال جديد
CREATE POLICY "Admin can insert articles" ON public.articles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 3. UPDATE Policy
-- المدراء فقط من يمكنهم التعديل
CREATE POLICY "Admin can update articles" ON public.articles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 4. DELETE Policy
-- المدراء فقط من يمكنهم الحذف
CREATE POLICY "Admin can delete articles" ON public.articles 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
