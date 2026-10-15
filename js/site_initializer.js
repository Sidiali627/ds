// site_initializer.js - Global Applier of Website Settings
import { supabase } from './supabase.js';

async function initializeSite() {
    try {
        const { data, error } = await supabase.from('site_settings').select('*');
        if (error || !data || data.length === 0) return;

        const settings = {};
        data.forEach(row => settings[row.key] = row.value);

        // 1. Maintenance Mode
        if (settings.maintenance?.is_active) {
            // Prevent redirect loop if already on maintenance page
            if (!window.location.pathname.includes('maintenance.html') && !window.location.pathname.includes('/admin/')) {
                // Store message in sessionStorage so maintenance.html can read it
                sessionStorage.setItem('maintenance_msg', settings.maintenance.message || 'الموقع تحت الصيانة');
                window.location.href = 'maintenance.html';
                return;
            }
        }

        // 2. Theme & Colors Injection
        if (settings.theme) {
            const root = document.documentElement;
            const colors = settings.theme.colors || {};
            if (colors.primary) root.style.setProperty('--primary-color', colors.primary);
            if (colors.secondary) root.style.setProperty('--secondary-color', colors.secondary);
            if (colors.success) root.style.setProperty('--success-color', colors.success);
            if (colors.danger) root.style.setProperty('--danger-color', colors.danger);
            if (colors.bg) root.style.setProperty('--background-color', colors.bg);
            if (colors.text) root.style.setProperty('--text-color', colors.text);
            
            const fonts = settings.theme.fonts || {};
            if (fonts.family) root.style.setProperty('--font-family', `"${fonts.family}", sans-serif`);
        }

        // 3. SEO Tags
        if (settings.seo) {
            if (settings.seo.meta_title) document.title = settings.seo.meta_title;
            
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && settings.seo.meta_description) {
                metaDesc.setAttribute('content', settings.seo.meta_description);
            }
        }

        // 4. Announcement Banner (Inject at top of body if active)
        if (settings.announcement?.show_banner) {
            const banner = document.createElement('div');
            banner.style.cssText = `
                background: var(--primary-color);
                color: white;
                text-align: center;
                padding: 10px;
                font-weight: 500;
                font-size: 0.95rem;
                z-index: 9999;
                position: relative;
            `;
            const msg = settings.announcement.message;
            const link = settings.announcement.link;
            banner.innerHTML = link ? `<a href="${link}" style="color:white; text-decoration:underline;">${msg}</a>` : msg;
            
            // Wait for body to exist
            if (document.body) {
                document.body.prepend(banner);
            } else {
                document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
            }
        }

        // 5. Homepage Layout
        if (settings.homepage && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/'))) {
            // Wait for DOM to be ready before removing/updating elements
            document.addEventListener('DOMContentLoaded', () => {
                if (settings.homepage.hero_title) {
                    const el = document.getElementById('hero-title');
                    if (el) el.innerText = settings.homepage.hero_title;
                }
                if (settings.homepage.hero_desc) {
                    const el = document.getElementById('hero-desc');
                    if (el) el.innerText = settings.homepage.hero_desc;
                }
                if (settings.homepage.show_hero === false) document.getElementById('hero-section')?.remove();
                if (settings.homepage.show_features === false) document.querySelector('.stats-section')?.remove();
                if (settings.homepage.show_latest_articles === false) document.querySelector('.articles-section')?.remove();
                if (settings.homepage.show_events === false) document.querySelector('.events-section')?.remove();
            });
        }

    } catch (e) {
        console.error("Site Initializer Error:", e);
    }
}

// Run immediately
initializeSite();
