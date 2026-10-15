-- Supabase Migration: 20240101000011_certificates.sql

-- 1. Certificate Templates Table
CREATE TABLE IF NOT EXISTS public.certificate_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    background_url VARCHAR NOT NULL, -- The base image of the certificate
    signature_url VARCHAR,
    seal_url VARCHAR,
    text_color VARCHAR DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY, -- Used for public verification
    template_id UUID REFERENCES public.certificate_templates(id),
    recipient_name VARCHAR NOT NULL,
    activity_name VARCHAR NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR DEFAULT 'valid', -- 'valid', 'cancelled'
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Policies for Templates
CREATE POLICY "Admins manage templates" ON public.certificate_templates FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
-- Allow public to read templates if needed to render the PDF for verification
CREATE POLICY "Public read templates" ON public.certificate_templates FOR SELECT USING (true);

-- Policies for Certificates
CREATE POLICY "Admins manage certificates" ON public.certificates FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
-- Public verification policy: Anyone can read a certificate to verify its validity
CREATE POLICY "Public verify certificates" ON public.certificates FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_certificates_recipient ON public.certificates(recipient_name);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates(status);
