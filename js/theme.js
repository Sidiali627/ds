// theme.js - Professional GitHub/Linear Theme Engine (Light / Dark / System)

const THEME_KEY = 'yhs-theme';

export function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
        return saved;
    }
    return 'system';
}

export function getEffectiveTheme(themeSetting = getPreferredTheme()) {
    if (themeSetting === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeSetting;
}

export function applyTheme(themeSetting = getPreferredTheme()) {
    const effective = getEffectiveTheme(themeSetting);
    
    if (effective === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    updateSwitcherUI(effective);
}

export function setTheme(newTheme) {
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
}

export function toggleTheme() {
    const currentEffective = getEffectiveTheme();
    const nextTheme = currentEffective === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
}

function updateSwitcherUI(effectiveTheme) {
    const buttons = document.querySelectorAll('.theme-switcher');
    buttons.forEach(btn => {
        if (effectiveTheme === 'dark') {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
            btn.setAttribute('aria-label', 'التبديل إلى الوضع الفاتح');
            btn.setAttribute('title', 'الوضع الداكن مفعّل');
        } else {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
            btn.setAttribute('aria-label', 'التبديل إلى الوضع الداكن');
            btn.setAttribute('title', 'الوضع الفاتح مفعّل');
        }
    });
}

// Immediately apply theme before rendering to avoid light flash
applyTheme();

// Listen to system theme changes dynamically
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getPreferredTheme() === 'system') {
        applyTheme('system');
    }
});

// Event Delegation for Theme Switcher Buttons & Responsive Controls
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();

    document.body.addEventListener('click', (e) => {
        const switcherBtn = e.target.closest('.theme-switcher');
        if (switcherBtn) {
            e.preventDefault();
            toggleTheme();
            return;
        }

        const mobileMenuBtn = e.target.closest('.mobile-menu-btn');
        if (mobileMenuBtn) {
            e.preventDefault();
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) navLinks.classList.toggle('active');
            return;
        }

        const mobileSidebarBtn = e.target.closest('.mobile-sidebar-toggle');
        if (mobileSidebarBtn) {
            e.preventDefault();
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar) sidebar.classList.toggle('show');
            return;
        }
    });
});
