// admin_security.js - Security Center Logic
import { supabase } from './supabase.js';

async function checkAuth() {
    if (!supabase) {
        window.location.href = 'login.html';
        return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
    }
}

const emptyState = (msg) => `<li><div class="cc-empty">${msg}</div></li>`;
const emptyRow = (msg, colspan) => `<tr><td colspan="${colspan}"><div class="cc-empty" style="border:none; background:transparent; padding:2rem;">${msg}</div></td></tr>`;

async function loadThreats() {
    const list = document.getElementById('threat-list');
    try {
        const { data, error } = await supabase.from('security_threats').select('*').order('created_at', { ascending: false }).limit(10);
        if (error || !data || data.length === 0) {
            list.innerHTML = emptyState('لا توجد تهديدات أمنية مسجلة. النظام آمن.');
            document.getElementById('rate-normal').innerText = 'تعمل بنجاح (Supabase Gateway)';
            document.getElementById('rate-blocked').innerText = '0';
            return;
        }

        let blockedCount = 0;
        let lastBlockedIp = 'لا يوجد';
        
        list.innerHTML = data.map(t => {
            if (t.is_blocked) {
                blockedCount++;
                if (lastBlockedIp === 'لا يوجد') lastBlockedIp = t.ip_address;
            }
            return `
            <li class="audit-item" style="border-left: 4px solid var(--danger-color);">
                <div>
                    <div class="audit-action">${t.threat_type} محاولة اختراق</div>
                    <div class="audit-meta">IP: ${t.ip_address} | الهدف: ${t.endpoint}</div>
                </div>
                <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${new Date(t.created_at).toLocaleString('ar-EG')}</div>
            </li>
        `}).join('');

        document.getElementById('rate-blocked').innerText = blockedCount.toString();
        document.getElementById('rate-last-ip').innerText = lastBlockedIp;
    } catch {
        list.innerHTML = emptyState('تعذر جلب سجل التهديدات. يرجى التأكد من الجداول.');
    }
}

async function loadSessions() {
    const tbody = document.getElementById('sessions-tbody');
    try {
        const { data, error } = await supabase.from('user_sessions').select('*, profiles(full_name)').order('last_activity', { ascending: false }).limit(20);
        if (error || !data || data.length === 0) {
            tbody.innerHTML = emptyRow('لا توجد جلسات مسجلة في قاعدة البيانات المخصصة.', 6);
            return;
        }

        tbody.innerHTML = data.map(s => `
            <tr>
                <td>
                    <div style="font-weight:600;">${s.device || 'غير معروف'}</div>
                    <div style="font-size:0.8rem; color:var(--admin-text-muted);">${s.os || ''}</div>
                </td>
                <td>${s.browser || 'غير معروف'}</td>
                <td>
                    <div>${s.ip_address || '127.0.0.1'}</div>
                    <div style="font-size:0.8rem; color:var(--admin-text-muted);">${s.country || 'غير محدد'}</div>
                </td>
                <td>${new Date(s.login_time).toLocaleString('ar-EG', {hour12:true})}</td>
                <td><span style="color:${s.is_active ? 'var(--success-color)' : 'var(--admin-text-muted)'}">${s.is_active ? 'نشط الآن' : new Date(s.last_activity).toLocaleString('ar-EG')}</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; color:var(--danger-color); border-color:var(--danger-color);" ${!s.is_active ? 'disabled' : ''} onclick="revokeSession('${s.id}')">
                        ${s.is_active ? 'إنهاء' : 'منتهية'}
                    </button>
                </td>
            </tr>
        `).join('');
    } catch {
        tbody.innerHTML = emptyRow('تعذر جلب الجلسات.', 6);
    }
}

window.revokeSession = async (id) => {
    if(!confirm("هل أنت متأكد من إنهاء هذه الجلسة؟")) return;
    await supabase.from('user_sessions').update({ is_active: false, logout_time: new Date().toISOString() }).eq('id', id);
    loadSessions();
}

async function loadAuditLogs() {
    const list = document.getElementById('audit-list');
    try {
        const { data, error } = await supabase.from('audit_logs').select('*, profiles(full_name, role)').order('created_at', { ascending: false }).limit(30);
        if (error || !data || data.length === 0) {
            list.innerHTML = emptyState('لا توجد سجلات تدقيق حتى الآن.');
            return;
        }

        list.innerHTML = data.map(log => {
            const userName = log.profiles ? log.profiles.full_name : 'النظام';
            let icon = '📝';
            if (log.action_type.includes('delete')) icon = '🗑️';
            if (log.action_type.includes('login')) icon = '🔐';
            if (log.action_type.includes('logout')) icon = '🚪';
            if (log.action_type.includes('settings') || log.action_type.includes('role')) icon = '⚙️';

            return `
            <li class="audit-item">
                <div style="flex:1;">
                    <div class="audit-action"><span>${icon}</span> ${userName} - ${log.action_type}</div>
                    <div class="audit-meta">الكيان (Entity): ${log.entity_type || 'N/A'} | المعرف: ${log.entity_id || 'N/A'}</div>
                </div>
                <div style="font-size: 0.8rem; color: var(--admin-text-muted); text-align: left;">
                    ${new Date(log.created_at).toLocaleString('ar-EG', {dateStyle: 'short', timeStyle: 'short'})}
                </div>
            </li>
        `}).join('');
    } catch {
        list.innerHTML = emptyState('تعذر جلب سجل التدقيق.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    // Check basic headers via JS location (HTTPS)
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const httpsBadge = document.getElementById('sec-https');
        httpsBadge.innerText = 'غير محمي (HTTP)';
        httpsBadge.className = 'status-badge status-danger';
    }

    // Load data
    loadThreats();
    loadSessions();
    loadAuditLogs();
});
