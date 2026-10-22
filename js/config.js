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
    '';

export const SUPABASE_ANON_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    '';

export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
