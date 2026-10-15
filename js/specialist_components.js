// specialist_components.js - Unified UI for Specialist Portal
import { supabase } from './supabase.js';
import { setupNotificationWidget } from './notifications.js';

export async function renderSpecialistSidebar() {
    const sidebarRoot = document.getElementById('specialist-sidebar-root');
    if (!sidebarRoot) return;

    // We can fetch doctor data to show in sidebar
    let doctorName = 'دكتور مختص';
    let specialty = 'أخصائي معتمد';
    
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
            const { data: spec } = await supabase.from('specialist_profiles').select('specialty').eq('id', session.user.id).single();
            if (profile?.full_name) doctorName = profile.full_name;
            if (spec?.specialty) specialty = spec.specialty;
        }
    }

    const currentPath = window.location.pathname;
    
    sidebarRoot.innerHTML = `
        <aside class="admin-sidebar" id="main-sidebar">
            <div class="sidebar-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2>🩺 عيادة المختص</h2>
                <button class="mobile-sidebar-toggle d-mobile-only" id="close-sidebar-btn" style="background:none;border:none;font-size:1.5rem;color:var(--text-tertiary);">&times;</button>
            </div>
            
            <div class="admin-user-profile" style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.1);">
                <div class="avatar-sm" style="width:48px;height:48px;font-size:1.3rem;">${doctorName.charAt(0)}</div>
                <div class="status-dot online" title="الحالة: متصل متاح للجلسات"></div>
                <div class="admin-user-info">
                    <h4>${doctorName}</h4>
                    <span class="status-badge specialist" style="margin-top:4px;">${specialty}</span>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <a href="index.html" class="nav-item ${currentPath.includes('index.html') ? 'active' : ''}"><span class="nav-icon">📊</span> الرئيسية واللوحة</a>
                <a href="consultations.html" class="nav-item ${currentPath.includes('consultations.html') ? 'active' : ''}"><span class="nav-icon">🩺</span> الاستشارات والكانبان</a>
                <a href="patients.html" class="nav-item ${currentPath.includes('patients.html') ? 'active' : ''}"><span class="nav-icon">👥</span> سجل المرضى (EMR)</a>
                <a href="calendar.html" class="nav-item ${currentPath.includes('calendar.html') ? 'active' : ''}"><span class="nav-icon">📅</span> تقويم المواعيد</a>
                <a href="profile.html" class="nav-item ${currentPath.includes('profile.html') ? 'active' : ''}"><span class="nav-icon">👤</span> الملف المهني</a>
                <a href="live_session.html" class="nav-item ${currentPath.includes('live_session.html') ? 'active' : ''}"><span class="nav-icon">🎥</span> الجلسة الحية (Demo)</a>
            </nav>
            
            <div class="sidebar-footer">
                <button class="theme-switcher" title="تبديل المظهر" style="width:100%;text-align:right;padding:10px;background:none;border:none;cursor:pointer;color:var(--text-secondary);font-family:inherit;">🌓 تبديل المظهر</button>
                <a href="#" id="sidebar-logout-btn" class="nav-item danger"><span class="nav-icon">🚪</span> تسجيل الخروج</a>
            </div>
        </aside>
        <div class="drawer-overlay" id="sidebar-overlay"></div>
    `;

    document.getElementById('sidebar-logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if(supabase) await supabase.auth.signOut();
        window.location.href = '../login.html';
    });

    const closeBtn = document.getElementById('close-sidebar-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('main-sidebar');

    const toggleSidebar = () => {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    };

    closeBtn?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);
    
    // We bind a global function so the header can open it
    window.openSpecialistSidebar = toggleSidebar;
}

export function renderSpecialistHeader() {
    const headerRoot = document.getElementById('specialist-header-root');
    if (!headerRoot) return;

    headerRoot.innerHTML = `
        <header class="admin-header" style="display:flex; justify-content:space-between; align-items:center; padding: 1rem 1.5rem; background: var(--surface-color); border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; border-radius: var(--border-radius-lg); box-shadow: var(--box-shadow-sm);">
            <div style="display:flex; align-items:center; gap: 15px;">
                <button class="mobile-sidebar-toggle d-mobile-only" onclick="window.openSpecialistSidebar()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-primary);">☰</button>
                <div>
                    <h3 style="font-weight:800; margin:0;">بوابة المختصين والأطباء</h3>
                    <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:2px;">المنصة الرقمية الموحدة للصحة الشبابية.</p>
                </div>
            </div>
            <div style="display:flex; gap: 10px; align-items:center;">
                <div id="specialist-notifications-container" style="position: relative;"></div>
                <a href="../index.html" class="btn btn-primary" style="padding: 8px 14px; border-radius: 12px; font-size: 0.9rem;" target="_blank">المنصة العامة &nearr;</a>
            </div>
        </header>
    `;

    setupNotificationWidget('specialist-notifications-container');
}

document.addEventListener('DOMContentLoaded', () => {
    renderSpecialistSidebar();
    renderSpecialistHeader();
});
