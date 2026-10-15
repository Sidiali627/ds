// admin_crm.js
import { supabase } from './supabase.js';

let allProfiles = [];

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; }
}

async function loadCRMData() {
    try {
        // Fetch all profiles
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allProfiles = data || [];

        updateDashboardStats();
        renderTable(allProfiles);

    } catch (e) {
        console.error("CRM Load Error:", e);
        document.getElementById('crm-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger-color);">حدث خطأ أثناء جلب البيانات.</td></tr>`;
    }
}

function updateDashboardStats() {
    document.getElementById('stat-total').innerText = allProfiles.length;
    
    // Active in last 30 days (simulate or use last_active_at)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = allProfiles.filter(p => p.last_active_at && new Date(p.last_active_at) > thirtyDaysAgo).length;
    document.getElementById('stat-active').innerText = activeUsers || '0';

    const admins = allProfiles.filter(p => ['admin', 'super_admin', 'moderator'].includes(p.role)).length;
    document.getElementById('stat-team').innerText = admins;

    document.getElementById('stat-volunteers').innerText = allProfiles.filter(p => p.role === 'volunteer').length;
    document.getElementById('stat-specialists').innerText = allProfiles.filter(p => p.role === 'specialist').length;
    document.getElementById('stat-banned').innerText = allProfiles.filter(p => p.account_status === 'banned').length;
}

function renderTable(data) {
    const tbody = document.getElementById('crm-tbody');
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--admin-text-muted);">لا يوجد مستخدمين يطابقون البحث.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(p => {
        let roleBadge = 'badge-user';
        let roleName = 'مستخدم';
        if (['admin', 'super_admin'].includes(p.role)) { roleBadge = 'badge-admin'; roleName = 'مدير'; }
        if (p.role === 'specialist') { roleBadge = 'badge-specialist'; roleName = 'مختص'; }
        if (p.role === 'volunteer') { roleBadge = 'badge-volunteer'; roleName = 'متطوع'; }

        let statusBadge = p.account_status === 'banned' ? 'badge-banned' : 'badge-active';
        let statusName = p.account_status === 'banned' ? 'محظور' : 'نشط';

        // Navigate to Profile 360 page
        const profileUrl = `crm_profile.html?id=${p.id}`;

        return `
            <tr>
                <td>
                    <div class="user-cell" onclick="window.location.href='${profileUrl}'">
                        <img src="${p.avatar_url || '../images/default-avatar.png'}" class="avatar" alt="avatar" onerror="this.src='../images/default-avatar.png'">
                        <div>
                            <div class="user-name">${p.full_name || 'بدون اسم'}</div>
                            <div class="user-email">${p.phone || 'بدون هاتف'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${roleBadge}">${roleName}</span></td>
                <td>${p.wilaya || '--'}</td>
                <td style="color:var(--admin-text-muted); font-size:0.85rem;">${new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                <td style="color:var(--admin-text-muted); font-size:0.85rem;">${p.last_active_at ? new Date(p.last_active_at).toLocaleDateString('ar-EG') : 'غير معروف'}</td>
                <td><span class="badge ${statusBadge}">${statusName}</span></td>
            </tr>
        `;
    }).join('');
}

// Filtering Logic
function applyFilters() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const r = document.getElementById('role-filter').value;
    const s = document.getElementById('status-filter').value;

    const filtered = allProfiles.filter(p => {
        const matchQ = (p.full_name || '').toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q);
        const matchR = r === 'all' || p.role === r || (r === 'admin' && ['admin','super_admin','moderator'].includes(p.role));
        const matchS = s === 'all' || p.account_status === s || (!p.account_status && s === 'active'); // null = active
        return matchQ && matchR && matchS;
    });
    renderTable(filtered);
}

document.getElementById('search-input')?.addEventListener('input', applyFilters);
document.getElementById('role-filter')?.addEventListener('change', applyFilters);
document.getElementById('status-filter')?.addEventListener('change', applyFilters);

window.exportCSV = () => {
    if(allProfiles.length === 0) return alert('لا توجد بيانات للتصدير');
    let csv = 'ID,Name,Phone,Role,Wilaya,Status,Registered At\n';
    allProfiles.forEach(p => {
        csv += `${p.id},${p.full_name || ''},${p.phone || ''},${p.role},${p.wilaya || ''},${p.account_status || 'active'},${p.created_at}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'crm_users_export.csv';
    link.click();
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadCRMData();
});
