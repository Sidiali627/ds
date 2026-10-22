// homepage.js - Premium Data Fetching with Skeletons
import { supabase } from './supabase.js';

const generateSkeleton = (count = 3, height = '350px') => {
    return Array(count).fill(`
        <div class="card skeleton" style="min-height: ${height}; border: none;"></div>
    `).join('');
};

const getEmptyState = (message) => {
    return `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>لا توجد بيانات</h3>
            <p>${message}</p>
        </div>
    `;
};

async function fetchHomeData() {
    if (!supabase) return;

    // 1. Hero Section
    try {
        const { data: settings } = await supabase.from('site_settings').select('*');
        if (settings) {
            const getVal = (key, fallback) => { const obj = settings.find(s => s.key === key); return obj ? obj.value.replace(/"/g, '') : fallback; };
            document.getElementById('hero-title').innerText = getVal('hero_title', 'استوديو صحة الشباب');
            document.getElementById('hero-desc').innerText = getVal('hero_desc', 'منصة رقمية فائقة التطور للرعاية الصحية الشاملة');
        }
    } catch (e) { console.error('Hero error', e); }

    // Init Skeletons
    document.getElementById('home-articles-container').innerHTML = generateSkeleton(3);
    document.getElementById('home-videos-container').innerHTML = generateSkeleton(3);
    document.getElementById('specialists-container').innerHTML = generateSkeleton(3, '250px');
    document.getElementById('home-events-container').innerHTML = generateSkeleton(3, '200px');
    document.getElementById('campaigns-container').innerHTML = generateSkeleton(3);

    // 3. Articles
    try {
        const { data: articles, error: articlesError } = await supabase.from('articles').select('*').in('status', ['published', 'approved']).limit(3).order('created_at', { ascending: false });
        const container = document.getElementById('home-articles-container');
        if (articlesError) {
            container.innerHTML = getEmptyState('تعذر تحميل المقالات حالياً. يرجى المحاولة لاحقاً.');
            return;
        }
        if (articles && articles.length > 0) {
            container.innerHTML = articles.map(art => `
                <div class="card reveal active">
                    <div class="card-badge">مقالات</div>
                    <div class="card-img-wrapper">
                        ${art.image_url ? `<img src="${art.image_url}" alt="${art.title}">` : '<div class="skeleton" style="height:220px;"></div>'}
                    </div>
                    <div class="card-content">
                        <h3>${art.title}</h3>
                        <p>${art.description || 'اضغط لقراءة المزيد والتفاصيل كاملة'}</p>
                        <div class="card-meta"><span>${new Date(art.created_at).toLocaleDateString('ar')}</span></div>
                        <a href="article.html?id=${art.id}" class="btn btn-outline" style="width: 100%;">اقرأ المقال</a>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = getEmptyState('لم يتم نشر أي مقالات بعد.');
        }
    } catch(e) {
        document.getElementById('home-articles-container').innerHTML = getEmptyState('تعذر تحميل المقالات حالياً.');
    }

    // 4. Videos
    try {
        const { data: videos } = await supabase.from('videos').select('*').in('status', ['published', 'approved']).limit(3).order('created_at', { ascending: false });
        const container = document.getElementById('home-videos-container');
        if (videos && videos.length > 0) {
            container.innerHTML = videos.map(vid => `
                <div class="card reveal active">
                    <div class="card-badge">فيديو</div>
                    <div class="card-img-wrapper">
                        ${vid.thumbnail_url ? `<img src="${vid.thumbnail_url}" alt="${vid.title}">` : '<div class="skeleton" style="height:220px;"></div>'}
                    </div>
                    <div class="card-content">
                        <h3>${vid.title}</h3>
                        <a href="${vid.video_url}" target="_blank" class="btn btn-primary" style="width: 100%; margin-top: auto;">شاهد الآن</a>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = getEmptyState('لا توجد فيديوهات حالياً.');
        }
    } catch(e) {}

    // 6. Specialists
    try {
        const { data: specialists } = await supabase.from('profiles').select('*').in('role', ['specialist', 'admin']);
        const container = document.getElementById('specialists-container');
        if (specialists && specialists.length > 0) {
            container.innerHTML = specialists.map(sp => `
                <div class="card text-center reveal active" style="padding: var(--spacing-xl); background: var(--surface-color);">
                    <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg, var(--border-color), var(--surface-color)); margin:0 auto var(--spacing-md); border: 4px solid var(--background-color); box-shadow: var(--box-shadow-sm);"></div>
                    <h3 style="margin-bottom: 0.5rem;">${sp.full_name}</h3>
                    <p style="color: var(--accent-color); font-weight: 500;">${sp.role === 'admin' ? 'مؤسس المنصة' : 'مختص معتمد'}</p>
                    <button class="btn btn-outline" style="margin-top: 1rem; width: 100%;">الملف الشخصي</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = getEmptyState('سيتم إضافة المختصين قريباً.');
        }
    } catch(e) {}

    // 7. Events
    try {
        const { data: events } = await supabase.from('events').select('*').limit(3).order('event_date', { ascending: true });
        const container = document.getElementById('home-events-container');
        if (events && events.length > 0) {
            container.innerHTML = events.map(ev => `
                <div class="card reveal active" style="padding: var(--spacing-lg);">
                    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
                        <span style="font-weight: bold; color: var(--accent-color); font-size: 1.2rem;">${new Date(ev.event_date).toLocaleDateString('ar', {day:'numeric', month:'short'})}</span>
                        <span style="background: var(--background-color); padding: 0.2rem 0.5rem; border-radius: 4px; font-size:0.8rem;">فعالية</span>
                    </div>
                    <h3>${ev.name}</h3>
                    <a href="events.html" class="btn btn-outline" style="margin-top: 1.5rem; width: 100%;">التفاصيل والتسجيل</a>
                </div>
            `).join('');
        } else {
            container.innerHTML = getEmptyState('لا توجد فعاليات قادمة.');
        }
    } catch(e) {}

    // 8. Campaigns
    try {
        const { data: campaigns } = await supabase.from('campaigns').select('*').limit(3);
        const container = document.getElementById('campaigns-container');
        if (campaigns && campaigns.length > 0) {
            container.innerHTML = campaigns.map(cmp => `
                <div class="card reveal active">
                    <div class="card-img-wrapper">
                        ${cmp.image_url ? `<img src="${cmp.image_url}">` : '<div class="skeleton" style="height:220px;"></div>'}
                    </div>
                    <div class="card-content">
                        <h3>${cmp.title}</h3>
                        <div style="margin-top: auto;">
                            <div style="display:flex; justify-content: space-between; margin-bottom:0.5rem; font-size:0.9rem;">
                                <span>التقدم</span>
                                <span style="font-weight:bold;">${cmp.progress}%</span>
                            </div>
                            <div style="width:100%; height:8px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                                <div style="width:${cmp.progress}%; height:100%; background:var(--accent-color); transition:width 1s;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = getEmptyState('لا توجد حملات نشطة حالياً.');
        }
    } catch(e) {
        document.getElementById('campaigns-container').innerHTML = getEmptyState('قم بتشغيل ملف الهجرة (Migration 4) في Supabase لتفعيل الحملات.');
    }

    // 10. Library
    try {
        const { data: lib } = await supabase.from('digital_library').select('*').limit(4);
        const container = document.getElementById('library-container');
        if (lib && lib.length > 0) {
            container.innerHTML = lib.map(item => `
                <div class="card text-center reveal active" style="padding: var(--spacing-lg); background: var(--surface-color);">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--accent-color)" stroke-width="2" style="margin-bottom:1rem;">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <h3>${item.title}</h3>
                    <a href="${item.url}" target="_blank" class="btn btn-outline" style="margin-top: 1rem; width:100%;">تحميل / عرض</a>
                </div>
            `).join('');
        }
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', fetchHomeData);
