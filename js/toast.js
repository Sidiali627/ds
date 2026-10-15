// toast.js - Global Unified Toast Notification Engine
export function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
        <span style="font-size:1.2rem;">${icon}</span>
        <span style="flex:1; font-weight:500;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem; opacity:0.7;">&times;</button>
    `;

    toast.style.cssText = `
        pointer-events: auto;
        min-width: 280px;
        max-width: 420px;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--surface-color, #ffffff);
        color: var(--text-primary, #1e293b);
        border: 1px solid var(--border-color, #e2e8f0);
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: inherit;
        font-size: 0.9rem;
        direction: rtl;
        animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: transform 0.2s ease, opacity 0.2s ease;
    `;

    if (type === 'success') toast.style.borderRight = '4px solid #10b981';
    if (type === 'error') toast.style.borderRight = '4px solid #ef4444';
    if (type === 'warning') toast.style.borderRight = '4px solid #f59e0b';
    if (type === 'info') toast.style.borderRight = '4px solid #3b82f6';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

// Global window attachment for non-module compatibility
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}
