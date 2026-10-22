-- Supabase Migration: 20240101000023_content_workflow_and_youth_houses.sql
-- Milestone 1: Content moderation workflow + Youth House Directory foundation

-- ============================================================================
-- 1) Content workflow hardening (articles + media visibility)
-- ============================================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'draft';

ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'draft';

UPDATE public.articles
SET status = 'draft'
WHERE status IS NULL OR btrim(status) = '';

UPDATE public.videos
SET status = COALESCE(NULLIF(btrim(status), ''), 'published');

UPDATE public.podcasts
SET status = COALESCE(NULLIF(btrim(status), ''), 'published');

ALTER TABLE public.articles
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.videos
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.podcasts
  ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'articles'
      AND constraint_name = 'articles_status_check'
  ) THEN
    ALTER TABLE public.articles DROP CONSTRAINT articles_status_check;
  END IF;
END $$;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'videos'
      AND constraint_name = 'videos_status_check'
  ) THEN
    ALTER TABLE public.videos DROP CONSTRAINT videos_status_check;
  END IF;
END $$;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'podcasts'
      AND constraint_name = 'podcasts_status_check'
  ) THEN
    ALTER TABLE public.podcasts DROP CONSTRAINT podcasts_status_check;
  END IF;
END $$;

ALTER TABLE public.podcasts
  ADD CONSTRAINT podcasts_status_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived'));

CREATE OR REPLACE FUNCTION public.set_article_review_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived') THEN
    NEW.reviewer_id := auth.uid();
    NEW.reviewed_at := timezone('utc'::text, now());

    IF NEW.status IN ('approved', 'published') THEN
      NEW.published_at := timezone('utc'::text, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_article_review_metadata ON public.articles;
CREATE TRIGGER trg_set_article_review_metadata
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.set_article_review_metadata();

DROP POLICY IF EXISTS "Public read published articles" ON public.articles;
DROP POLICY IF EXISTS "Public read articles" ON public.articles;
CREATE POLICY "Public read approved articles" ON public.articles
FOR SELECT
USING (status IN ('approved', 'published'));

DROP POLICY IF EXISTS "Public read videos" ON public.videos;
CREATE POLICY "Public read approved videos" ON public.videos
FOR SELECT
USING (status IN ('approved', 'published'));

DROP POLICY IF EXISTS "Public read podcasts" ON public.podcasts;
CREATE POLICY "Public read approved podcasts" ON public.podcasts
FOR SELECT
USING (status IN ('approved', 'published'));

DROP POLICY IF EXISTS "Admin manage videos" ON public.videos;
CREATE POLICY "Admin manage videos" ON public.videos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Admin manage podcasts" ON public.podcasts;
CREATE POLICY "Admin manage podcasts" ON public.podcasts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- 2) Youth House Directory Foundation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.youth_houses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug VARCHAR UNIQUE NOT NULL,
    name_ar VARCHAR NOT NULL,
    name_fr VARCHAR,
    summary TEXT,
    wilaya_code VARCHAR,
    wilaya_name VARCHAR,
    commune_name VARCHAR,
    address_line TEXT,
    phone VARCHAR,
    email VARCHAR,
    website_url VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'draft',
    manager_user_id UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    submitted_for_review_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT youth_houses_status_check CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived')),
    CONSTRAINT youth_houses_slug_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_youth_houses_status ON public.youth_houses(status);
CREATE INDEX IF NOT EXISTS idx_youth_houses_slug ON public.youth_houses(slug);
CREATE INDEX IF NOT EXISTS idx_youth_houses_wilaya ON public.youth_houses(wilaya_code, wilaya_name);
CREATE INDEX IF NOT EXISTS idx_youth_houses_commune ON public.youth_houses(commune_name);
CREATE INDEX IF NOT EXISTS idx_youth_houses_manager ON public.youth_houses(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_youth_houses_updated_at ON public.youth_houses(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.youth_house_communes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wilaya_code VARCHAR NOT NULL,
    commune_name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (wilaya_code, commune_name)
);

ALTER TABLE public.youth_house_communes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read youth house communes" ON public.youth_house_communes;
CREATE POLICY "Public read youth house communes" ON public.youth_house_communes
FOR SELECT USING (true);

ALTER TABLE public.youth_houses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved youth houses" ON public.youth_houses;
CREATE POLICY "Public read approved youth houses" ON public.youth_houses
FOR SELECT
USING (status IN ('approved', 'published'));

DROP POLICY IF EXISTS "Managers read own youth houses" ON public.youth_houses;
CREATE POLICY "Managers read own youth houses" ON public.youth_houses
FOR SELECT
USING (manager_user_id = auth.uid());

DROP POLICY IF EXISTS "Managers insert own youth houses" ON public.youth_houses;
CREATE POLICY "Managers insert own youth houses" ON public.youth_houses
FOR INSERT
WITH CHECK (
  manager_user_id = auth.uid()
  AND created_by = auth.uid()
  AND status IN ('draft', 'pending_review', 'rejected', 'changes_requested')
);

DROP POLICY IF EXISTS "Managers update own youth houses" ON public.youth_houses;
CREATE POLICY "Managers update own youth houses" ON public.youth_houses
FOR UPDATE
USING (manager_user_id = auth.uid())
WITH CHECK (
  manager_user_id = auth.uid()
  AND status IN ('draft', 'pending_review', 'rejected', 'changes_requested')
);

DROP POLICY IF EXISTS "Admin manage youth houses" ON public.youth_houses;
CREATE POLICY "Admin manage youth houses" ON public.youth_houses
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin', 'coordinator', 'association_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin', 'coordinator', 'association_manager')
  )
);

CREATE OR REPLACE FUNCTION public.set_youth_house_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.manager_user_id IS NULL THEN
      NEW.manager_user_id := NEW.created_by;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived') THEN
      NEW.reviewed_at := timezone('utc'::text, now());
      NEW.reviewed_by := auth.uid();
    END IF;

    IF NEW.status IN ('approved', 'published') THEN
      NEW.approved_at := timezone('utc'::text, now());
      NEW.approved_by := auth.uid();
    END IF;

    IF NEW.status = 'pending_review' THEN
      NEW.submitted_for_review_at := timezone('utc'::text, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_youth_house_audit_fields ON public.youth_houses;
CREATE TRIGGER trg_set_youth_house_audit_fields
BEFORE INSERT OR UPDATE ON public.youth_houses
FOR EACH ROW
EXECUTE FUNCTION public.set_youth_house_audit_fields();
