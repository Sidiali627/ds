import { supabase } from './supabase.js';
import { canAccessYouthHouseManager, normalizeRole, validateYouthHousePayload } from './youth_houses_shared.mjs';

let currentSession = null;
let currentRole = 'user';
let currentRecord = null;

const els = {
    state: document.getElementById('my-yh-state'),
    formWrap: document.getElementById('my-yh-form-wrap'),
    form: document.getElementById('my-yh-form'),
    submit: document.getElementById('my-yh-submit')
};

function setState(message, kind = 'info') {
    const color = kind === 'error' ? 'var(--danger-color)' : kind === 'success' ? 'var(--success-color)' : 'var(--text-secondary)';
    els.state.innerHTML = `<p style="color:${color}; margin:0;">${message}</p>`;
}

function fillForm(record) {
    const fields = ['slug', 'name_ar', 'name_fr', 'summary', 'wilaya_code', 'wilaya_name', 'commune_name', 'address_line', 'phone', 'email', 'website_url'];
    fields.forEach((field) => {
        const input = document.getElementById(`yh-${field}`);
        if (input) input.value = record?.[field] || '';
    });
}

async function loadCurrentRecord() {
    const { data, error } = await supabase
        .from('youth_houses')
        .select('id, slug, name_ar, name_fr, summary, wilaya_code, wilaya_name, commune_name, address_line, phone, email, website_url, status, manager_user_id')
        .eq('manager_user_id', currentSession.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function init() {
    if (!supabase) {
        setState('Supabase غير مهيأ.', 'error');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentSession = session;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

    currentRole = normalizeRole(profile?.role || 'user');
    if (!canAccessYouthHouseManager(session, currentRole)) {
        setState('غير مصرح لك بإدارة هذا القسم.', 'error');
        return;
    }

    setState('جاري تحميل ملف المؤسسة...');

    try {
        currentRecord = await loadCurrentRecord();

        if (currentRecord) {
            fillForm(currentRecord);
            setState(`الحالة الحالية: ${currentRecord.status || 'draft'}. أي تعديل سيتم إرساله للمراجعة.`, 'info');
        } else {
            fillForm({});
            setState('لا يوجد ملف مؤسسة مخصص لك بعد. يمكنك إنشاء مسودة جديدة.', 'info');
        }

        els.formWrap.style.display = 'block';
    } catch (err) {
        setState('تعذر تحميل بيانات المؤسسة.', 'error');
    }
}

function getPayloadFromForm() {
    return {
        slug: document.getElementById('yh-slug')?.value,
        name_ar: document.getElementById('yh-name_ar')?.value,
        name_fr: document.getElementById('yh-name_fr')?.value,
        summary: document.getElementById('yh-summary')?.value,
        wilaya_code: document.getElementById('yh-wilaya_code')?.value,
        wilaya_name: document.getElementById('yh-wilaya_name')?.value,
        commune_name: document.getElementById('yh-commune_name')?.value,
        address_line: document.getElementById('yh-address_line')?.value,
        phone: document.getElementById('yh-phone')?.value,
        email: document.getElementById('yh-email')?.value,
        website_url: document.getElementById('yh-website_url')?.value
    };
}

async function onSubmit(e) {
    e.preventDefault();
    const validation = validateYouthHousePayload(getPayloadFromForm());
    if (!validation.isValid) {
        setState(validation.errors.join(' '), 'error');
        return;
    }

    const payload = {
        ...validation.sanitized,
        status: 'pending_review',
        manager_user_id: currentSession.user.id
    };

    els.submit.disabled = true;
    setState('جاري حفظ البيانات وإرسالها للمراجعة...');

    try {
        if (currentRecord?.id) {
            const { error } = await supabase
                .from('youth_houses')
                .update(payload)
                .eq('id', currentRecord.id)
                .eq('manager_user_id', currentSession.user.id);
            if (error) throw error;
        } else {
            const { data, error } = await supabase
                .from('youth_houses')
                .insert([{ ...payload, created_by: currentSession.user.id }])
                .select('id')
                .single();
            if (error) throw error;
            currentRecord = { id: data.id, ...payload };
        }

        setState('تم حفظ الملف وإرساله للمراجعة بنجاح.', 'success');
    } catch (err) {
        setState(`تعذر الحفظ: ${err.message}`, 'error');
    } finally {
        els.submit.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    els.form?.addEventListener('submit', onSubmit);
});
