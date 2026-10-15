// admin_components.js - Unified UI Components for Admin Portal (Doctolib / Practo Design System)
import { signOut } from './auth.js';
import './guard.js';
import { supabase } from './supabase.js';
import { setupNotificationWidget } from './notifications.js';

export function initAdminComponents() {
    const sidebarRoot = document.getElementById('admin-sidebar-root');
    const headerRoot = document.getElementById('admin-header-root');

    if (sidebarRoot) {
        sidebarRoot.innerHTML = getSidebarHTML();
        setupSidebarEvents();
        hydrateAdminProfile();
    }

    if (headerRoot) {
        let pageTitle = document.title.split('-')[0].trim();
        if (pageTitle === 'لوحة القيادة' || pageTitle === 'الإدارة') {
            pageTitle = 'مركز القيادة والتحليلات';
        }
        headerRoot.innerHTML = getHeaderHTML(pageTitle);
        setupHeaderEvents();
        setupNotificationWidget('admin-notifications-bell-container');
    }

    // Mark active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.admin-nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

async function hydrateAdminProfile() {
    if (!supabase) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role, avatar_url')
            .eq('id', session.user.id)
            .single();

        const nameEl = document.getElementById('admin-user-display-name');
        const roleEl = document.getElementById('admin-user-role-badge');
        const avatarEl = document.getElementById('admin-user-avatar');

        const fullName = profile?.full_name || 'مدير المنصة';
        const role = profile?.role || 'admin';
        const isSuper = role.toLowerCase().includes('super');

        if (nameEl) nameEl.textContent = fullName;
        if (roleEl) {
            roleEl.textContent = isSuper ? 'مدير عام (Super Admin)' : 'مسؤول النظام (Admin)';
            roleEl.className = `status-badge ${isSuper ? 'super_admin' : 'admin'}`;
        }
        if (avatarEl) {
            avatarEl.textContent = fullName.trim().charAt(0).toUpperCase();
        }
    } catch (err) {
        console.warn("Could not load admin user profile in sidebar:", err);
    }
}

function getSidebarHTML() {
    return `
        <aside class="admin-sidebar" id="admin-sidebar">
            <!-- Brand & Close Button -->
            <div class="admin-sidebar-header">
                <div class="brand-logo">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </svg>
                    <span>YHS Admin</span>
                </div>
                <button class="mobile-sidebar-toggle d-mobile-only" id="close-sidebar-btn" aria-label="إغلاق القائمة">
                    &times;
                </button>
            </div>

            <!-- Administrator Profile Card (Unified with Specialist Dashboard) -->
            <div class="admin-user-profile" style="background: rgba(2, 132, 199, 0.05); border: 1px solid rgba(2, 132, 199, 0.12); margin: 0.75rem 1rem 0.5rem; border-radius: 16px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; position: relative;">
                <div class="avatar-sm" id="admin-user-avatar" style="width: 44px; height: 44px; font-size: 1.2rem; background: var(--brand-accent, #0284c7); color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);">
                    أ
                </div>
                <div class="status-dot online" title="الحالة: متصل متاح للإشراف" style="position: absolute; top: 12px; right: 12px; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid var(--surface-color, #ffffff);"></div>
                <div class="admin-user-info" style="flex: 1; min-width: 0;">
                    <h4 id="admin-user-display-name" style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        مدير المنصة
                    </h4>
                    <span id="admin-user-role-badge" class="status-badge admin" style="margin-top: 4px; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; display: inline-block;">
                        مدير عام (Super Admin)
                    </span>
                </div>
            </div>
            
            <div class="sidebar-scroll-area">
                <nav class="admin-nav">
                    
                    <!-- Section 1: Control Center -->
                    <div class="nav-section">
                        <div class="nav-section-title">مركز القيادة (Control Center)</div>
                        <a href="index.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">📊</span>
                            <span>لوحة التحليلات والإحصائيات</span>
                        </a>
                        <a href="security.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🛡️</span>
                            <span>مركز الحماية والأمان</span>
                        </a>
                        <a href="settings.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">⚙️</span>
                            <span>إدارة الموقع والنظام</span>
                        </a>
                    </div>

                    <!-- Section 2: Clinical & Operations -->
                    <div class="nav-section">
                        <div class="nav-section-title">العمليات والخدمات السريرية</div>
                        <a href="consultations.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🩺</span>
                            <span>إدارة الاستشارات الطبية</span>
                        </a>
                        <a href="appointments.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">📅</span>
                            <span>إدارة المواعيد السريرية</span>
                        </a>
                        <a href="users.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">👥</span>
                            <span>إدارة المستخدمين والأدوار</span>
                        </a>
                        <a href="crm.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🤝</span>
                            <span>إدارة العملاء (CRM)</span>
                        </a>
                        <a href="support.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🎧</span>
                            <span>مركز الدعم والشكاوى</span>
                        </a>
                    </div>

                    <!-- Section 3: Content & Events -->
                    <div class="nav-section">
                        <div class="nav-section-title">المحتوى والفعاليات</div>
                        <a href="events.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🎟️</span>
                            <span>الفعاليات والملتقيات</span>
                        </a>
                        <a href="articles.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">📝</span>
                            <span>المقالات التوعوية</span>
                        </a>
                        <a href="cms.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">📰</span>
                            <span>نظام المحتوى (CMS)</span>
                        </a>
                        <a href="media.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🖼️</span>
                            <span>مكتبة الوسائط الرقمية</span>
                        </a>
                    </div>

                    <!-- Section 4: Intelligent System Tools -->
                    <div class="nav-section">
                        <div class="nav-section-title">الأدوات والأنظمة الذكية</div>
                        <a href="notifications.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🔔</span>
                            <span>البريد والإشعارات</span>
                        </a>
                        <a href="ai_center.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🤖</span>
                            <span>المساعد الذكي (AI)</span>
                        </a>
                        <a href="certificates.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🎓</span>
                            <span>إدارة الشهادات الرقمية</span>
                        </a>
                        <a href="seo.html" class="nav-item">
                            <span class="nav-icon" style="font-size: 1.1rem;">🌐</span>
                            <span>مركز الـ SEO</span>
                        </a>
                    </div>

                </nav>
            </div>
            
            <!-- Sidebar Footer -->
            <div class="sidebar-footer" style="padding: 1rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                <button class="theme-switcher-btn" id="sidebar-theme-toggle" title="تبديل المظهر" style="width: 100%; height: auto; padding: 8px 12px; border-radius: 10px; display: flex; align-items: center; justify-content: flex-start; gap: 10px; background: transparent; border: 1px solid var(--border-color); font-size: 0.88rem; font-family: inherit; font-weight: 600; cursor: pointer; color: var(--text-secondary);">
                    <span>🌓</span>
                    <span>تبديل المظهر (Dark / Light)</span>
                </button>
                <a href="../index.html" class="nav-item" target="_blank" style="padding: 8px 12px; border-radius: 10px; font-size: 0.88rem; color: var(--brand-accent);">
                    <span>🌐</span>
                    <span>المنصة العامة &nearr;</span>
                </a>
                <a href="#" id="admin-logout-btn" class="nav-item danger" style="padding: 8px 12px; border-radius: 10px; font-size: 0.88rem;">
                    <span>🚪</span>
                    <span>تسجيل الخروج</span>
                </a>
            </div>
        </aside>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;
}

function getHeaderHTML(title) {
    return `
        <header class="admin-header">
            <!-- Left Side: Title & Mobile Hamburger -->
            <div class="admin-header-title" style="display: flex; align-items: center; gap: 14px;">
                <button class="mobile-sidebar-toggle d-mobile-only" id="open-sidebar-btn" aria-label="فتح القائمة">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <div>
                    <h3 style="font-weight: 800; font-size: clamp(1.05rem, 1.25vw, 1.35rem); margin: 0; color: var(--text-primary); line-height: 1.3;">
                        ${title}
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.82rem; margin: 3px 0 0 0;">
                        استوديو صحة الشباب — لوحة الإشراف الإداري والتحكم الشامل
                    </p>
                </div>
            </div>

            <!-- Right Side: Actions, Realtime Pulse, Notification Bell & Dark Mode -->
            <div class="admin-header-actions" style="display: flex; align-items: center; gap: 12px;">
                <div id="admin-notifications-bell-container" style="position: relative;"></div>

                <span class="system-status-indicator" title="المزامنة المباشرة مع قاعدة البيانات نشطة">
                    <span class="pulse-dot"></span>
                    <span>Live Sync</span>
                </span>

                <button class="theme-switcher-btn" id="admin-theme-toggle" title="تبديل المظهر">
                    <svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    <svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:none;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </button>

                <a href="../index.html" class="btn btn-outline d-desktop-only" target="_blank" style="padding: 7px 14px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                    <span>المنصة الرئيسية</span>
                    <span>&nearr;</span>
                </a>
            </div>
        </header>
    `;
}

function setupSidebarEvents() {
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut();
        });
    }

    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleSidebar = () => {
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('mobile-open');
        if (isOpen) {
            sidebar.classList.remove('mobile-open');
            overlay?.classList.remove('show', 'active');
        } else {
            sidebar.classList.add('mobile-open');
            overlay?.classList.add('show', 'active');
        }
    };

    if (openBtn) openBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Global toggle hook
    window.openAdminSidebar = toggleSidebar;
}

function setupHeaderEvents() {
    const themeBtns = [
        document.getElementById('admin-theme-toggle'),
        document.getElementById('sidebar-theme-toggle')
    ].filter(Boolean);

    const updateIcons = (theme) => {
        const isDark = theme === 'dark';
        document.querySelectorAll('#admin-theme-toggle .sun-icon').forEach(el => el.style.display = isDark ? 'none' : 'block');
        document.querySelectorAll('#admin-theme-toggle .moon-icon').forEach(el => el.style.display = isDark ? 'block' : 'none');
    };

    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
    updateIcons(currentTheme);

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            updateIcons(next);
        });
    });
}

// Auto-run when module is loaded
document.addEventListener('DOMContentLoaded', () => {
    initAdminComponents();
});
