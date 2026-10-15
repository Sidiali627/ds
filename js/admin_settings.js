// admin_settings.js - Website Management Center Logic
import { supabase } from './supabase.js';

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; }
}

async function loadSettings() {
    try {
        const { data, error } = await supabase.from('site_settings').select('*');
        if (error || !data) return;

        const settings = {};
        data.forEach(row => settings[row.key] = row.value);

        // 1. Identity
        if (settings.identity) {
            document.getElementById('id_platform_name').value = settings.identity.platform_name || '';
            document.getElementById('id_email').value = settings.identity.email || '';
            document.getElementById('id_description').value = settings.identity.description || '';
            document.getElementById('id_phone').value = settings.identity.phone || '';
            document.getElementById('id_address').value = settings.identity.address || '';
            document.getElementById('id_facebook').value = settings.identity.socials?.facebook || '';
            document.getElementById('id_twitter').value = settings.identity.socials?.twitter || '';
            document.getElementById('id_instagram').value = settings.identity.socials?.instagram || '';
        }

        // 2. Homepage
        if (settings.homepage) {
            document.getElementById('hm_hero_title').value = settings.homepage.hero_title || '';
            document.getElementById('hm_hero_desc').value = settings.homepage.hero_desc || '';
            document.getElementById('hm_show_hero').checked = settings.homepage.show_hero;
            document.getElementById('hm_show_features').checked = settings.homepage.show_features;
            document.getElementById('hm_show_articles').checked = settings.homepage.show_latest_articles;
            document.getElementById('hm_show_events').checked = settings.homepage.show_events;
        }

        // 3. Theme
        if (settings.theme) {
            const colors = settings.theme.colors || {};
            ['primary', 'secondary', 'success', 'danger', 'bg', 'text'].forEach(c => {
                const hex = colors[c] || '#ffffff';
                const el = document.getElementById(`th_c_${c}`);
                if(el) {
                    el.value = hex;
                    document.getElementById(`th_c_${c}_hex`).value = hex;
                }
            });
            document.getElementById('th_f_family').value = settings.theme.fonts?.family || 'Inter';
            document.getElementById('th_f_size').value = settings.theme.fonts?.size || '16px';
        }

        // 4. SEO
        if (settings.seo) {
            document.getElementById('seo_title').value = settings.seo.meta_title || '';
            document.getElementById('seo_desc').value = settings.seo.meta_description || '';
            document.getElementById('seo_twitter').value = settings.seo.twitter_card || 'summary_large_image';
        }

        // 5. Maintenance
        if (settings.maintenance) {
            document.getElementById('mt_active').checked = settings.maintenance.is_active;
            document.getElementById('mt_msg').value = settings.maintenance.message || '';
            document.getElementById('mt_date').value = settings.maintenance.end_date || '';
        }

        if (settings.announcement) {
            document.getElementById('ad_active').checked = settings.announcement.show_banner;
            document.getElementById('ad_msg').value = settings.announcement.message || '';
            document.getElementById('ad_link').value = settings.announcement.link || '';
        }

    } catch (e) {
        console.error("Error loading settings:", e);
    }
}

async function saveSettings() {
    const saveBtn = document.getElementById('save-all-btn');
    saveBtn.innerText = 'جاري الحفظ...';
    saveBtn.disabled = true;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const updates = [
            {
                key: 'identity',
                value: {
                    platform_name: document.getElementById('id_platform_name').value,
                    email: document.getElementById('id_email').value,
                    description: document.getElementById('id_description').value,
                    phone: document.getElementById('id_phone').value,
                    address: document.getElementById('id_address').value,
                    socials: {
                        facebook: document.getElementById('id_facebook').value,
                        twitter: document.getElementById('id_twitter').value,
                        instagram: document.getElementById('id_instagram').value
                    }
                },
                updated_by: userId
            },
            {
                key: 'homepage',
                value: {
                    hero_title: document.getElementById('hm_hero_title').value,
                    hero_desc: document.getElementById('hm_hero_desc').value,
                    show_hero: document.getElementById('hm_show_hero').checked,
                    show_features: document.getElementById('hm_show_features').checked,
                    show_latest_articles: document.getElementById('hm_show_articles').checked,
                    show_events: document.getElementById('hm_show_events').checked
                },
                updated_by: userId
            },
            {
                key: 'theme',
                value: {
                    colors: {
                        primary: document.getElementById('th_c_primary').value,
                        secondary: document.getElementById('th_c_secondary').value,
                        success: document.getElementById('th_c_success').value,
                        danger: document.getElementById('th_c_danger').value,
                        bg: document.getElementById('th_c_bg').value,
                        text: document.getElementById('th_c_text').value
                    },
                    fonts: {
                        family: document.getElementById('th_f_family').value,
                        size: document.getElementById('th_f_size').value
                    }
                },
                updated_by: userId
            },
            {
                key: 'seo',
                value: {
                    meta_title: document.getElementById('seo_title').value,
                    meta_description: document.getElementById('seo_desc').value,
                    twitter_card: document.getElementById('seo_twitter').value
                },
                updated_by: userId
            },
            {
                key: 'maintenance',
                value: {
                    is_active: document.getElementById('mt_active').checked,
                    message: document.getElementById('mt_msg').value,
                    end_date: document.getElementById('mt_date').value
                },
                updated_by: userId
            },
            {
                key: 'announcement',
                value: {
                    show_banner: document.getElementById('ad_active').checked,
                    message: document.getElementById('ad_msg').value,
                    link: document.getElementById('ad_link').value
                },
                updated_by: userId
            }
        ];

        // Upsert all records
        const { error } = await supabase.from('site_settings').upsert(updates);

        if (error) throw error;

        const indicator = document.getElementById('save-indicator');
        indicator.style.display = 'block';
        setTimeout(() => indicator.style.display = 'none', 3000);

    } catch (e) {
        console.error("Error saving settings:", e);
        alert("حدث خطأ أثناء حفظ الإعدادات.");
    } finally {
        saveBtn.innerText = 'حفظ جميع التغييرات';
        saveBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    await loadSettings();

    document.getElementById('save-all-btn')?.addEventListener('click', saveSettings);
});
