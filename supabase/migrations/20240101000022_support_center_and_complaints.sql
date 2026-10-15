-- Supabase Migration: 20240101000022_support_center_and_complaints.sql
-- Description: Phase 11 - Support Center & Complaint Management System
-- Security: Strict user isolation, internal staff note privacy, and RBAC support management

-- ============================================================================
-- 1. Support Tickets Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1001;

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number VARCHAR UNIQUE NOT NULL DEFAULT ('TICK-' || to_char(now(), 'YYYY') || '-' || nextval('public.support_ticket_seq'::regclass)),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category VARCHAR NOT NULL, -- 'technical', 'account', 'appointment', 'consultation', 'inquiry', 'complaint'
    subject VARCHAR NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    status VARCHAR DEFAULT 'open', -- 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    attachment_url TEXT,
    internal_notes TEXT, -- Strictly private to support staff / admins
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table Enhancements & Column Idempotency
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number VARCHAR;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category VARCHAR;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS subject VARCHAR;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'normal';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'open';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Fast query and filtering indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);

-- ============================================================================
-- 2. Support Ticket Messages / Conversation History
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    sender_type VARCHAR NOT NULL DEFAULT 'user', -- 'user', 'support', 'admin'
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- True = internal note, False = visible to user
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_ticket_messages ADD COLUMN IF NOT EXISTS sender_type VARCHAR DEFAULT 'user';
ALTER TABLE public.support_ticket_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
ALTER TABLE public.support_ticket_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_internal ON public.support_ticket_messages(is_internal);

-- ============================================================================
-- 3. Row Level Security (RLS) - Strict User Isolation & Internal Note Privacy
-- ============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- 3.1 Support Tickets RLS Policies
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets" ON public.support_tickets
FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Users insert own support tickets" ON public.support_tickets;
CREATE POLICY "Users insert own support tickets" ON public.support_tickets
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users and Admins update support tickets" ON public.support_tickets;
CREATE POLICY "Users and Admins update support tickets" ON public.support_tickets
FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
    )
);

-- 3.2 Ticket Messages RLS Policies
DROP POLICY IF EXISTS "Users view non-internal ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users view non-internal ticket messages" ON public.support_ticket_messages
FOR SELECT USING (
    (
        EXISTS (
            SELECT 1 FROM public.support_tickets t 
            WHERE t.id = ticket_id AND t.user_id = auth.uid()
        ) 
        AND is_internal = false
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Users and Support insert ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users and Support insert ticket messages" ON public.support_ticket_messages
FOR INSERT WITH CHECK (
    (
        auth.uid() = sender_id AND
        is_internal = false AND
        EXISTS (
            SELECT 1 FROM public.support_tickets t 
            WHERE t.id = ticket_id AND t.user_id = auth.uid()
        )
    )
    OR
    (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND LOWER(REPLACE(role, ' ', '_')) IN ('admin', 'super_admin')
        )
    )
);

-- ============================================================================
-- 4. Database Trigger: Protect Ticket Ownership, Timestamps & Internal Notes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_support_ticket_integrity()
RETURNS TRIGGER AS $$
DECLARE
    acting_user_role VARCHAR;
    norm_acting_role VARCHAR;
BEGIN
    NEW.updated_at := timezone('utc'::text, now());

    -- Determine caller role
    SELECT role INTO acting_user_role FROM public.profiles WHERE id = auth.uid();
    norm_acting_role := LOWER(REPLACE(COALESCE(acting_user_role, ''), ' ', '_'));

    -- Prevent regular users from modifying privileged attributes or stealing ticket
    IF norm_acting_role NOT IN ('admin', 'super_admin') THEN
        -- Prevent changing ownership
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Access Denied: Ticket ownership cannot be altered.';
        END IF;

        -- Prevent user from modifying internal notes
        IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN
            NEW.internal_notes := OLD.internal_notes;
        END IF;

        -- Prevent user from modifying assigned_to
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            NEW.assigned_to := OLD.assigned_to;
        END IF;

        -- Prevent user from modifying ticket_number
        IF NEW.ticket_number IS DISTINCT FROM OLD.ticket_number THEN
            NEW.ticket_number := OLD.ticket_number;
        END IF;

        -- Users can only transition status to 'closed'
        IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'closed' THEN
            RAISE EXCEPTION 'Access Denied: You may only close resolved tickets.';
        END IF;
    END IF;

    -- Manage timestamps for resolution and closing
    IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved' OR OLD.status IS NULL) THEN
        NEW.resolved_at := timezone('utc'::text, now());
    ELSIF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed' OR OLD.status IS NULL) THEN
        NEW.closed_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_support_ticket_integrity ON public.support_tickets;
CREATE TRIGGER trg_protect_support_ticket_integrity
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_support_ticket_integrity();

-- ============================================================================
-- 5. Stored Procedures / RPC Functions for Secure Ticket Operations
-- ============================================================================

-- 5.1 User/Admin Ticket Creation RPC
CREATE OR REPLACE FUNCTION public.create_support_ticket_secure(
    category_input VARCHAR,
    subject_input VARCHAR,
    description_input TEXT,
    priority_input VARCHAR DEFAULT 'normal',
    attachment_url_input TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_uid UUID;
    new_ticket_id UUID;
    generated_ticket_number VARCHAR;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit support tickets.';
    END IF;

    IF category_input NOT IN ('technical', 'account', 'appointment', 'consultation', 'inquiry', 'complaint') THEN
        RAISE EXCEPTION 'Invalid support category: %', category_input;
    END IF;

    IF LENGTH(TRIM(subject_input)) < 3 THEN
        RAISE EXCEPTION 'Ticket subject must be at least 3 characters.';
    END IF;

    IF LENGTH(TRIM(description_input)) < 10 THEN
        RAISE EXCEPTION 'Ticket description must be at least 10 characters.';
    END IF;

    generated_ticket_number := 'TICK-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.support_ticket_seq'::regclass)::text, 4, '0');

    INSERT INTO public.support_tickets (
        ticket_number,
        user_id,
        category,
        subject,
        description,
        priority,
        status,
        attachment_url
    ) VALUES (
        generated_ticket_number,
        caller_uid,
        category_input,
        TRIM(subject_input),
        TRIM(description_input),
        COALESCE(priority_input, 'normal'),
        'open',
        attachment_url_input
    ) RETURNING id INTO new_ticket_id;

    -- Add the initial problem description as the first message
    INSERT INTO public.support_ticket_messages (
        ticket_id,
        sender_id,
        sender_type,
        message,
        is_internal,
        attachment_url
    ) VALUES (
        new_ticket_id,
        caller_uid,
        'user',
        TRIM(description_input),
        false,
        attachment_url_input
    );

    -- Log to audit_logs
    INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, metadata)
    VALUES (
        caller_uid,
        'create_support_ticket',
        'support_ticket',
        new_ticket_id::text,
        jsonb_build_object('ticket_number', generated_ticket_number, 'category', category_input)
    );

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', new_ticket_id,
        'ticket_number', generated_ticket_number
    );
END;
$$;

-- 5.2 Add Message / Reply RPC
CREATE OR REPLACE FUNCTION public.add_ticket_reply_secure(
    ticket_id_input UUID,
    message_input TEXT,
    is_internal_input BOOLEAN DEFAULT false,
    attachment_url_input TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_uid UUID;
    caller_role VARCHAR;
    norm_caller_role VARCHAR;
    ticket_owner_id UUID;
    sender_type_val VARCHAR;
    new_message_id UUID;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT user_id INTO ticket_owner_id FROM public.support_tickets WHERE id = ticket_id_input;
    IF ticket_owner_id IS NULL THEN
        RAISE EXCEPTION 'Ticket not found.';
    END IF;

    SELECT role INTO caller_role FROM public.profiles WHERE id = caller_uid;
    norm_caller_role := LOWER(REPLACE(COALESCE(caller_role, ''), ' ', '_'));

    -- Permissions check
    IF norm_caller_role IN ('admin', 'super_admin') THEN
        sender_type_val := 'support';
    ELSIF caller_uid = ticket_owner_id THEN
        sender_type_val := 'user';
        is_internal_input := false; -- Users can never post internal notes
    ELSE
        RAISE EXCEPTION 'Access Denied: Not authorized to post to this ticket.';
    END IF;

    INSERT INTO public.support_ticket_messages (
        ticket_id,
        sender_id,
        sender_type,
        message,
        is_internal,
        attachment_url
    ) VALUES (
        ticket_id_input,
        caller_uid,
        sender_type_val,
        TRIM(message_input),
        is_internal_input,
        attachment_url_input
    ) RETURNING id INTO new_message_id;

    -- If support staff replied publicly, update status to waiting_user
    IF sender_type_val = 'support' AND is_internal_input = false THEN
        UPDATE public.support_tickets
        SET status = 'waiting_user', updated_at = timezone('utc'::text, now())
        WHERE id = ticket_id_input AND status = 'open';
    ELSIF sender_type_val = 'user' THEN
        -- If user replied, set status to in_progress
        UPDATE public.support_tickets
        SET status = 'in_progress', updated_at = timezone('utc'::text, now())
        WHERE id = ticket_id_input AND status IN ('waiting_user', 'resolved');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', new_message_id,
        'sender_type', sender_type_val
    );
END;
$$;
