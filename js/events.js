// events.js - National Events Portal Logic
import { supabase } from './supabase.js';

let allEvents = [];
let currentCategory = 'all';
let isCalendarView = false;

async function init() {
    await loadEvents();
}

async function loadEvents() {
    const grid = document.getElementById('events-grid');
    const skeleton = document.getElementById('events-skeleton');
    
    // Ensure Skeleton is showing, Grid is hidden
    if(skeleton) skeleton.style.display = 'grid';
    if(grid) grid.style.display = 'none';

    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('is_archived', false)
            .order('event_date', { ascending: true });

        if(skeleton) skeleton.style.display = 'none';
        if(grid) grid.style.display = 'grid';

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 1rem;">
                    <div class="empty-state-icon" style="font-size:3.5rem;">🎟️</div>
                    <div class="empty-state-title" style="font-size:1.4rem;">لا توجد فعاليات قادمة حالياً</div>
                    <div class="empty-state-desc">سيتم إضافة فعاليات وملتقيات توعوية جديدة قريباً. تابعنا للحصول على التحديثات.</div>
                </div>
            `;
            return;
        }

        allEvents = data;
        renderEvents();
        renderCalendar();
    } catch (err) {
        console.error("Error loading events:", err);
        if(skeleton) skeleton.style.display = 'none';
        if(grid) {
            grid.style.display = 'grid';
            grid.innerHTML = `
                <div class="error-state" style="grid-column: 1 / -1; padding: 4rem 1rem; border: 1px solid #ef4444; border-radius: 20px; background: rgba(239, 68, 68, 0.05); text-align:center;">
                    <div style="font-size:3.5rem; margin-bottom:1rem; color:#ef4444;">⚠️</div>
                    <h3 style="color:#ef4444; margin-bottom:0.5rem;">تعذر تحميل الفعاليات حالياً</h3>
                    <p style="color:var(--text-secondary); margin-bottom:1.5rem;">يرجى التحقق من اتصالك بالإنترنت أو المحاولة مرة أخرى.</p>
                    <button class="btn btn-outline" style="border-color:#ef4444; color:#ef4444; padding:8px 24px;" onclick="location.reload()">إعادة المحاولة</button>
                </div>
            `;
        }
    }
}

function renderEvents() {
    const grid = document.getElementById('events-grid');
    const searchVal = document.getElementById('search-input')?.value.trim().toLowerCase() || '';

    const filtered = allEvents.filter(ev => {
        const matchCat = currentCategory === 'all' || ev.category === currentCategory;
        const matchSearch = ev.title.toLowerCase().includes(searchVal) || (ev.location && ev.location.toLowerCase().includes(searchVal));
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 1rem;">
                <div class="empty-state-icon" style="font-size:3.5rem;">🔍</div>
                <div class="empty-state-title" style="font-size:1.4rem;">لا توجد فعاليات مطابقة</div>
                <div class="empty-state-desc">جرّب تغيير فئة البحث أو البحث بكلمات أخرى.</div>
                <button class="btn btn-outline" style="margin-top:1rem; border-radius:12px;" onclick="document.getElementById('search-input').value=''; filterEvents('all');">إظهار جميع الفعاليات</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(ev => {
        const total = ev.total_seats || 100;
        const rem = ev.remaining_seats !== undefined ? ev.remaining_seats : total;
        const seatPct = Math.max(0, Math.min(100, Math.round((rem / total) * 100)));
        let catAr = 'استشارة عامة';
        if (ev.category === 'psychology') catAr = 'صحة نفسية';
        else if (ev.category === 'nutrition') catAr = 'تغذية ولياقة';
        else if (ev.category === 'health') catAr = 'توعية صحية';
        else if (ev.category === 'digital') catAr = 'طب رقمي';
        else if (ev.category === 'doctors') catAr = 'فعاليات الأطباء';
        
        let seatColorClass = 'good';
        if(seatPct < 20) seatColorClass = 'full';

        return `
            <div class="event-card">
                <div class="event-img-wrap">
                    <img src="${ev.image_url || 'images/hero-bg.jpg'}" class="event-img" alt="${ev.title}" loading="lazy" decoding="async">
                    <span class="event-category-badge">${catAr}</span>
                </div>
                <div class="event-body">
                    <h3 class="event-title">${ev.title}</h3>
                    
                    <div class="event-meta-list">
                        <div class="event-meta-item">
                            <span>📅</span>
                            <span>${new Date(ev.event_date).toLocaleString('ar-EG', { dateStyle: 'long' })}</span>
                        </div>
                        <div class="event-meta-item">
                            <span>⏰</span>
                            <span>${new Date(ev.event_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="event-meta-item">
                            <span>📍</span>
                            <span>${ev.location || 'فعالية عن بعد (أونلاين)'}</span>
                        </div>
                    </div>
                    
                    <div class="seats-container">
                        <div class="seats-header">
                            <span style="color:var(--text-secondary);">المقاعد المتبقية: <strong style="color:var(--text-primary);">${rem}</strong></span>
                            <span style="color:${seatPct < 20 ? '#ef4444' : '#10b981'};">${seatPct}% متاح</span>
                        </div>
                        <div class="seats-progress">
                            <div class="seats-fill ${seatColorClass}" style="width:${seatPct}%;"></div>
                        </div>
                    </div>

                    <a href="event_details.html?id=${ev.id}" class="btn btn-primary" style="width:100%; border-radius:14px;">عرض التفاصيل ${rem > 0 ? 'والتسجيل' : ''}</a>
                </div>
            </div>
        `;
    }).join('');
}

function renderCalendar() {
    const calList = document.getElementById('calendar-list');
    if (!calList) return;

    calList.innerHTML = allEvents.map(ev => `
        <div style="background:var(--bg-primary); padding:1rem; border-radius:12px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="background:var(--brand-accent); color:white; padding:8px 14px; border-radius:10px; text-align:center; min-width:65px;">
                    <div style="font-size:1.2rem; font-weight:bold;">${new Date(ev.event_date).getDate()}</div>
                    <div style="font-size:0.75rem;">${new Date(ev.event_date).toLocaleString('ar-EG', { month: 'short' })}</div>
                </div>
                <div>
                    <h4 style="margin-bottom:4px;">${ev.title}</h4>
                    <span style="font-size:0.85rem; color:var(--text-secondary);">📍 ${ev.location} | ⏰ ${new Date(ev.event_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
            </div>
            <a href="event_details.html?id=${ev.id}" class="btn btn-outline" style="padding:6px 14px; font-size:0.85rem;">عرض والتسجيل</a>
        </div>
    `).join('');
}

window.filterEvents = (cat) => {
    currentCategory = cat;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderEvents();
};

window.handleSearch = () => {
    renderEvents();
};

window.toggleCalendarView = () => {
    isCalendarView = !isCalendarView;
    const gridContainer = document.getElementById('events-grid-container');
    const cal = document.getElementById('calendar-container');
    const btn = document.getElementById('btn-toggle-view');

    if (isCalendarView) {
        if(gridContainer) gridContainer.style.display = 'none';
        if(cal) cal.style.display = 'block';
        if(btn) btn.innerHTML = '<span>🖼️</span> عرض البطاقات';
    } else {
        if(gridContainer) gridContainer.style.display = 'block';
        if(cal) cal.style.display = 'none';
        if(btn) btn.innerHTML = '<span>📅</span> عرض التقويم';
    }
};

document.addEventListener('DOMContentLoaded', init);
