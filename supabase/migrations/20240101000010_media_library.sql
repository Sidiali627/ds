-- Supabase Migration: 20240101000010_media_library.sql

-- 1. Create the media_library table (Digital Asset Management Metadata Index)
CREATE TABLE IF NOT EXISTS public.media_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name VARCHAR NOT NULL,
    bucket_id VARCHAR NOT NULL DEFAULT 'media',
    file_path VARCHAR NOT NULL UNIQUE, -- Path inside the storage bucket (e.g., 'images/2026/file.jpg')
    mime_type VARCHAR NOT NULL, -- e.g., 'image/jpeg', 'application/pdf'
    size_bytes BIGINT DEFAULT 0,
    folder VARCHAR DEFAULT '/', -- Logical folder for UI grouping
    tags VARCHAR[] DEFAULT '{}', -- For search (e.g., 'logo', 'background')
    is_deleted BOOLEAN DEFAULT false, -- Soft delete for Recycle Bin
    deleted_at TIMESTAMP WITH TIME ZONE,
    uploaded_by UUID REFERENCES auth.users(id),
    usage_location VARCHAR, -- Where this file is used (e.g., 'Homepage Hero', 'Article #123')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Allow public read access to media metadata (optional, depends on if frontend needs to list files. Usually only admin lists all)
-- For a strict setup, only admins manage media, but public might need to see some. Let's allow public read for now.
CREATE POLICY "Public can view media metadata" ON public.media_library FOR SELECT USING (is_deleted = false);

-- Only authenticated admins/specialists can manage media metadata
CREATE POLICY "Admins manage media metadata" ON public.media_library FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin', 'moderator', 'specialist')
    )
);

-- Creating indexes for performance on large media libraries
CREATE INDEX IF NOT EXISTS idx_media_folder ON public.media_library(folder);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON public.media_library(is_deleted);
CREATE INDEX IF NOT EXISTS idx_media_mime ON public.media_library(mime_type);

-- IMPORTANT NOTICE:
-- You must manually create a bucket named 'media' in the Supabase Storage UI, 
-- and make it PUBLIC so images can be served to visitors.
