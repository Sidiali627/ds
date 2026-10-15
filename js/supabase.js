// supabase.js - مشروع استوديو صحة الشباب
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CONFIGURED } from './config.js';

let supabaseClient = null;

if (IS_CONFIGURED) {
    try {
        // @supabase/supabase-js is loaded via CDN in index.html
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized successfully.");
    } catch (error) {
        console.error("Error initializing Supabase client:", error);
    }
} else {
    console.warn("Supabase is not configured. Please set credentials in localStorage or config.js");
}

export const supabase = supabaseClient;
