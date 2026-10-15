// seo_injector.js
import { supabase } from './supabase.js';

async function injectSEO() {
    // Determine the current path (e.g., /about.html or /)
    let currentPath = window.location.pathname;
    if (currentPath === '' || currentPath.endsWith('/')) {
        currentPath += 'index.html'; // Default to index if root
    }

    // Always ensure it starts with /
    if(!currentPath.startsWith('/')) {
        currentPath = '/' + currentPath;
    }

    try {
        const { data, error } = await supabase.from('seo_pages').select('*').eq('path', currentPath).single();
        if (error || !data) return; // No SEO data for this page

        // Update Document Title
        if (data.title) {
            document.title = data.title;
            setMeta('og:title', data.title);
            setMeta('twitter:title', data.title, 'name');
        }

        // Update Meta Description
        if (data.description) {
            setMeta('description', data.description, 'name');
            setMeta('og:description', data.description);
            setMeta('twitter:description', data.description, 'name');
        }

        // Update Keywords
        if (data.keywords) {
            setMeta('keywords', data.keywords, 'name');
        }

        // Update Open Graph Image
        if (data.og_image) {
            setMeta('og:image', data.og_image);
            setMeta('twitter:image', data.og_image, 'name');
            setMeta('twitter:card', 'summary_large_image', 'name');
        }

        // Update Canonical URL
        if (data.canonical_url) {
            let canonical = document.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', data.canonical_url);
            setMeta('og:url', data.canonical_url);
        }

        // Structured Data (Schema.org)
        if (data.schema_markup) {
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.text = data.schema_markup;
            document.head.appendChild(script);
        }

    } catch (e) {
        console.error("SEO Injection Failed:", e);
    }
}

function setMeta(key, value, attribute = 'property') {
    let meta = document.querySelector(`meta[${attribute}="${key}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', value);
}

// Run immediately
injectSEO();
