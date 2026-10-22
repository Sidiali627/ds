import { supabase } from './supabase.js';
import { YOUTH_HOUSE_PUBLIC_STATUSES } from './youth_houses_shared.mjs';

const container = document.getElementById('yh-profile-container');

function setState(message, kind = 'info') {
    const icon = kind === 'error' ? '⚠️' : kind === 'empty' ? '📭' : '⏳';
    container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;"><div style="font-size:2rem;">${icon}</div><p>${message}</p></div>`;
}

function escapeHtml(v = '') {
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderProfile(item) {
    container.innerHTML = `
        <article class="card" style="padding:1.5rem; display:grid; gap:1rem;">
            <header>
                <h1 style="margin:0;">${escapeHtml(item.name_ar)}</h1>
                ${item.name_fr ? `<p style="margin:0.25rem 0 0; color:var(--text-secondary);">${escapeHtml(item.name_fr)}</p>` : ''}
                <p style="margin:0.5rem 0 0; color:var(--text-secondary);">${escapeHtml(item.wilaya_name || '—')} / ${escapeHtml(item.commune_name || '—')}</p>
            </header>
            <section>
                <h2 style="font-size:1.1rem; margin-bottom:0.5rem;">نبذة</h2>
                <p style="margin:0; line-height:1.8;">${escapeHtml(item.summary || 'لا توجد نبذة منشورة حتى الآن.')}</p>
            </section>
            <section>
                <h2 style="font-size:1.1rem; margin-bottom:0.5rem;">بيانات الاتصال المنشورة</h2>
                <ul style="margin:0; padding-inline-start:1.25rem;">
                    ${item.address_line ? `<li>العنوان: ${escapeHtml(item.address_line)}</li>` : ''}
                    ${item.phone ? `<li>الهاتف: ${escapeHtml(item.phone)}</li>` : ''}
                    ${item.email ? `<li>البريد: ${escapeHtml(item.email)}</li>` : ''}
                    ${item.website_url ? `<li>الموقع: <a href="${escapeHtml(item.website_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.website_url)}</a></li>` : ''}
                </ul>
            </section>
        </article>`;
}

async function loadProfile() {
    if (!supabase) {
        setState('تعذر الاتصال بالخدمة.', 'error');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
        setState('تعذر تحديد المؤسسة المطلوبة.', 'error');
        return;
    }

    setState('جاري تحميل البيانات...');

    const { data, error } = await supabase
        .from('youth_houses')
        .select('slug, name_ar, name_fr, summary, wilaya_name, commune_name, address_line, phone, email, website_url')
        .eq('slug', slug)
        .in('status', YOUTH_HOUSE_PUBLIC_STATUSES)
        .maybeSingle();

    if (error) {
        setState('حدث خطأ أثناء تحميل بيانات المؤسسة.', 'error');
        return;
    }

    if (!data) {
        setState('المؤسسة غير متاحة للنشر العام حالياً.', 'empty');
        return;
    }

    renderProfile(data);
}

document.addEventListener('DOMContentLoaded', loadProfile);
