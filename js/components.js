// components.js - Unified Modern Mega Navbar & Footer Component System
import { supabase } from './supabase.js';

export async function renderNavbar() {
    const header = document.getElementById('main-header');
    if (!header) return;

    let userSession = null;
    let userRole = 'user';

    if (supabase) {
        const { data } = await supabase.auth.getSession();
        userSession = data?.session;
        if (userSession) {
            const { data: prof } = await supabase.from('profiles').select('role').eq('id', userSession.user.id).single();
            if (prof) userRole = prof.role;
        }
    }

    let authLinks = '';
    if (userSession) {
        let portalLink = '<a href="dashboard.html" class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.88rem;">لوحة حسابي</a>';
        if (userRole === 'specialist') {
            portalLink += '<a href="specialist/index.html" class="btn btn-outline" style="padding:0.4rem 0.9rem; font-size:0.88rem; font-weight:600;">بوابة المختص</a>';
        }
        if (['admin', 'super_admin'].includes(userRole)) {
            portalLink += '<a href="admin/index.html" class="btn btn-outline" style="padding:0.4rem 0.9rem; font-size:0.88rem; font-weight:600;">لوحة الإدارة</a>';
        }

        authLinks = `
            ${portalLink}
            <button id="nav-logout-btn" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border: 1px solid #ef4444; color: #ef4444;">خروج</button>
        `;
    } else {
        authLinks = `
            <a href="login.html" class="btn" style="padding: 0.4rem 0.9rem; font-size:0.88rem; color: var(--text-primary);">دخول</a>
            <a href="register.html" class="btn btn-primary" style="padding: 0.4rem 0.9rem; font-size:0.88rem;">حساب جديد</a>
        `;
    }

    header.innerHTML = `
        <div class="container navbar">
            <a href="index.html" class="nav-brand" style="display:flex; align-items:center; gap:8px;">
                <img src="images/logo.png" alt="الشعار" id="site-logo" style="height:36px; object-fit:contain;" loading="lazy" decoding="async">
                <span style="font-weight:800; font-size:1.1rem; color:var(--text-primary);">استوديو صحة الشباب</span>
            </a>
            
            <button class="mobile-menu-toggle" id="mobile-menu-btn" aria-label="Toggle Menu">
                <span></span>
                <span></span>
                <span></span>
            </button>

            <nav class="nav-menu" id="nav-menu">
                <ul class="nav-links">
                    <li><a href="index.html">الرئيسية</a></li>
                    <li><a href="consultations.html">الاستشارات والخدمات</a></li>
                    <li><a href="events.html" class="${window.location.pathname.includes('events') ? 'active' : ''}">الفعاليات الوطنية</a></li>
                    <li><a href="articles.html">المقالات والوعي</a></li>
                    <li><a href="ai_assistant.html">المساعد الذكي</a></li>
                    <li><a href="about.html">من نحن</a></li>
                </ul>
                <div class="nav-actions">
                    <button class="theme-switcher" title="تبديل المظهر"></button>
                    ${authLinks}
                </div>
            </nav>
        </div>
    `;

    // Dynamic Logo Fallback
    if (supabase) {
        supabase.from('site_settings').select('value').eq('key', 'logo_url').single().then(({data}) => {
            if (data && data.value) {
                const logoEl = document.getElementById('site-logo');
                if (logoEl) logoEl.src = data.value.replace(/"/g, '');
            }
        }).catch(() => {});
    }

    // Attach Logout Handler
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabase) await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // Attach Mobile Menu Handler
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileMenuBtn.classList.toggle('open');
        });
    }
}

export function renderFooter() {
    const footer = document.getElementById('main-footer');
    if (!footer) return;

    footer.innerHTML = `
        <div class="container" style="padding: 3rem 1.5rem 1.5rem 1.5rem;">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:2rem; margin-bottom:2rem;">
                <div>
                    <h4 style="font-size:1.1rem; margin-bottom:1rem; color:var(--brand-accent);">استوديو صحة الشباب</h4>
                    <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.6;">المنصة الوطنية الرقمية المعتمدة لتقديم الاستشارات الفورية، الجلسات المرئية، والفعاليات الصحية للشباب والمختصين.</p>
                </div>
                <div>
                    <h4 style="font-size:1rem; margin-bottom:1rem; color:var(--text-primary);">روابط سريعة</h4>
                    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:0.9rem;">
                        <li><a href="consultations.html" style="color:var(--text-secondary);">طلب استشارة فورية</a></li>
                        <li><a href="events.html" style="color:var(--text-secondary);">الفعاليات القادمة والتذاكر</a></li>
                        <li><a href="articles.html" style="color:var(--text-secondary);">مكتبة الوعي الطبي</a></li>
                        <li><a href="ai_assistant.html" style="color:var(--text-secondary);">المساعد التوعوي الذكي</a></li>
                    </ul>
                </div>
                <div>
                    <h4 style="font-size:1rem; margin-bottom:1rem; color:var(--text-primary);">البوابات والأدوار</h4>
                    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:0.9rem;">
                        <li><a href="dashboard.html" style="color:var(--text-secondary);">بوابة المستفيد والمريض</a></li>
                        <li><a href="specialist/index.html" style="color:var(--text-secondary);">بوابة المختصين والأطباء</a></li>
                        <li><a href="admin/index.html" style="color:var(--text-secondary);">بوابة الإدارة المركزية</a></li>
                    </ul>
                </div>
            </div>
            <div style="border-top:1px solid var(--border-color); padding-top:1.5rem; text-align:center; font-size:0.85rem; color:var(--text-secondary);">
                جميع الحقوق محفوظة © 2026 - استوديو صحة الشباب 💚
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
});
