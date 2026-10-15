// data.js - التعامل مع البيانات العامة
import { supabase } from './supabase.js';

export async function fetchArticles() {
    if(!supabase) return [];
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
    if(error) console.error(error);
    return data || [];
}

export async function fetchArticleById(id) {
    if(!supabase) return null;
    const { data, error } = await supabase
        .from('articles')
        .select('*, profiles(full_name, avatar_url)')
        .eq('id', id)
        .single();
    if(error) console.error(error);
    return data;
}

export async function fetchEvents() {
    if(!supabase) return [];
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
    if(error) console.error(error);
    return data || [];
}
