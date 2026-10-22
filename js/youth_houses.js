import { supabase } from './supabase.js';
import { YOUTH_HOUSE_PUBLIC_STATUSES } from './youth_houses_shared.mjs';

const state = {
    page: 1,
    pageSize: 9,
    search: '',
    wilaya: '',
    commune: ''
};

const els = {
    search: document.getElementById('yh-search'),
    wilaya: document.getElementById('yh-wilaya-filter'),
    commune: document.getElementById('yh-commune-filter'),
    list: document.getElementById('yh-list'),
    pager: document.getElementById('yh-pagination'),
    count: document.getElementById('yh-count')
};

function renderState(kind, message) {
    if (!els.list) return;
    const icon = kind === 'loading' ? '⏳' : kind === 'error' ? '⚠️' : '📭';
    els.list.innerHTML = `<div class="card" style="grid-column:1/-1; text-align:center; padding:2rem;"><div style="font-size:2rem;">${icon}</div><p>${message}</p></div>`;
}

function escapeHtml(v = '') {
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildCard(item) {
    return `
        <article class="card" style="padding:1rem; display:flex; flex-direction:column; gap:0.75rem;">
            <h3 style="margin:0;">${escapeHtml(item.name_ar)}</h3>
            <p style="margin:0; color:var(--text-secondary);">${escapeHtml(item.wilaya_name || '—')} / ${escapeHtml(item.commune_name || '—')}</p>
            <p style="margin:0; color:var(--text-secondary);">${escapeHtml(item.summary || 'لا توجد نبذة متاحة حالياً.')}</p>
            <a class="btn btn-outline" href="youth-house.html?slug=${encodeURIComponent(item.slug)}" aria-label="عرض تفاصيل ${escapeHtml(item.name_ar)}">عرض الملف</a>
        </article>`;
}

function renderPager(total, page, pageSize) {
    if (!els.pager) return;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const prevDisabled = page <= 1 ? 'disabled' : '';
    const nextDisabled = page >= totalPages ? 'disabled' : '';
    els.pager.innerHTML = `
        <button class="btn btn-outline" ${prevDisabled} data-page="${page - 1}">السابق</button>
        <span aria-live="polite">صفحة ${page} من ${totalPages}</span>
        <button class="btn btn-outline" ${nextDisabled} data-page="${page + 1}">التالي</button>`;
}

async function loadFilters() {
    if (!supabase || !els.wilaya || !els.commune) return;
    const { data, error } = await supabase
        .from('youth_houses')
        .select('wilaya_name, commune_name')
        .in('status', YOUTH_HOUSE_PUBLIC_STATUSES)
        .order('wilaya_name', { ascending: true });

    if (error || !data) return;

    const wilayas = [...new Set(data.map((x) => x.wilaya_name).filter(Boolean))];
    const communes = [...new Set(data.map((x) => x.commune_name).filter(Boolean))];

    els.wilaya.innerHTML = '<option value="">كل الولايات</option>' + wilayas.map((w) => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
    els.commune.innerHTML = '<option value="">كل البلديات</option>' + communes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

async function loadDirectory() {
    if (!supabase) {
        renderState('error', 'تعذر الاتصال بقاعدة البيانات.');
        return;
    }

    renderState('loading', 'جاري تحميل دور الشباب المعتمدة...');

    const from = (state.page - 1) * state.pageSize;
    const to = from + state.pageSize - 1;

    let query = supabase
        .from('youth_houses')
        .select('id, slug, name_ar, name_fr, summary, wilaya_name, commune_name, updated_at', { count: 'exact' })
        .in('status', YOUTH_HOUSE_PUBLIC_STATUSES)
        .order('updated_at', { ascending: false })
        .range(from, to);

    if (state.search) {
        const clean = state.search.replace(/[%,]/g, ' ').trim();
        query = query.or(`name_ar.ilike.%${clean}%,name_fr.ilike.%${clean}%,slug.ilike.%${clean}%`);
    }
    if (state.wilaya) query = query.eq('wilaya_name', state.wilaya);
    if (state.commune) query = query.eq('commune_name', state.commune);

    const { data, count, error } = await query;

    if (error) {
        renderState('error', 'حدث خطأ أثناء تحميل الدليل.');
        return;
    }

    els.count.textContent = `عدد النتائج: ${count || 0}`;

    if (!data || data.length === 0) {
        renderState('empty', 'لا توجد دور شباب معتمدة مطابقة للبحث حالياً.');
        renderPager(count || 0, state.page, state.pageSize);
        return;
    }

    els.list.innerHTML = data.map(buildCard).join('');
    renderPager(count || 0, state.page, state.pageSize);
}

function setupListeners() {
    els.search?.addEventListener('input', (e) => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadDirectory();
    });

    els.wilaya?.addEventListener('change', (e) => {
        state.wilaya = e.target.value;
        state.page = 1;
        loadDirectory();
    });

    els.commune?.addEventListener('change', (e) => {
        state.commune = e.target.value;
        state.page = 1;
        loadDirectory();
    });

    els.pager?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        state.page = Number(btn.dataset.page || state.page);
        loadDirectory();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    setupListeners();
    await loadFilters();
    await loadDirectory();
});
