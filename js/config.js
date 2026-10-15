// config.js - مشروع استوديو صحة الشباب
// Central Supabase API Configuration with Environment Variable Fallbacks

// Resolve environment variables from browser (window.__ENV__), Node runtime (process.env), or project defaults
const getEnvVar = (key) => {
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
        return window.__ENV__[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    return null;
};

// Configured Supabase Credentials
export const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
    getEnvVar('SUPABASE_URL') ||
    'https://xsuednrcrzbjdyrdrgat.supabase.co';

export const SUPABASE_ANON_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
