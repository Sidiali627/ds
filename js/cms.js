// cms.js - مشروع استوديو صحة الشباب
import { supabase } from './supabase.js';

export async function fetchSiteSettings() {
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('*');
            
        if (error) throw error;
        
        // Convert array of {key, value} to object
        const settings = {};
        data.forEach(item => {
            settings[item.key] = item.value;
        });
        
        return settings;
    } catch (error) {
        console.error("Error fetching site settings:", error);
        return null;
    }
}

export async function fetchPageContent(pageName) {
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from('pages_content')
            .select('*')
            .eq('page', pageName);
            
        if (error) throw error;
        
        // Convert array of {section, content} to object
        const content = {};
        data.forEach(item => {
            content[item.section] = item.content;
        });
        
        return content;
    } catch (error) {
        console.error(`Error fetching page content for ${pageName}:`, error);
        return null;
    }
}

// Function to populate the DOM with data
export async function populateHome() {
    if (!supabase) {
        document.getElementById('hero-title').innerText = "خطأ: لم يتم إعداد قاعدة البيانات.";
        return;
    }

    const [settings, content] = await Promise.all([
        fetchSiteSettings(),
        fetchPageContent('home')
    ]);

    // Apply Settings
    if (settings) {
        if (settings.site_title) {
            document.getElementById('meta-title').innerText = settings.site_title;
        }
        if (settings.logo_url) {
            document.getElementById('site-logo').src = settings.logo_url;
        }
        if (settings.nav_links) {
            const navContainer = document.getElementById('nav-links-container');
            navContainer.innerHTML = '';
            settings.nav_links.forEach(link => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="${link.url}">${link.title}</a>`;
                navContainer.appendChild(li);
            });
        }
    }

    // Apply Content
    if (content) {
        // Hero Section
        if (content.hero) {
            document.getElementById('hero-title').innerText = content.hero.title || '';
            document.getElementById('hero-desc').innerText = content.hero.description || '';
            
            if (content.hero.buttons) {
                const btnContainer = document.getElementById('hero-buttons-container');
                btnContainer.innerHTML = '';
                content.hero.buttons.forEach(btn => {
                    const a = document.createElement('a');
                    a.href = btn.url;
                    a.className = `btn btn-${btn.type || 'primary'}`;
                    a.innerText = btn.title;
                    btnContainer.appendChild(a);
                });
            }
        }

        // About Section
        if (content.about) {
            document.getElementById('about-title').innerText = content.about.title || '';
            document.getElementById('about-desc').innerText = content.about.description || '';
        }
    }
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Very simple router logic based on file name
    const path = window.location.pathname;
    
    if (path.endsWith('/') || path.endsWith('index.html')) {
        populateHome();
    }
});
