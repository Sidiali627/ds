// admin_crm_profile.js
import { supabase } from './supabase.js';

let currentUserId = null;
let userProfile = null;

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; }
}

async function loadProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('id');
    
    if (!currentUserId) {
        alert("لم يتم تحديد مستخدم.");
        window.location.href = 'crm.html';
        return;
    }

    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
        if (error) throw error;
        userProfile = data;

        renderProfile();
        loadTimeline();

    } catch (e) {
        console.error("Profile Load Error:", e);
        alert("حدث خطأ أثناء تحميل بيانات المستخدم.");
    }
}

function renderProfile() {
    if (!userProfile) return;

    document.getElementById('p-avatar').src = userProfile.avatar_url || '../images/default-avatar.png';
    document.getElementById('p-name').innerText = userProfile.full_name || 'بدون اسم';
    
    const badge = document.getElementById('p-role-badge');
    badge.innerText = userProfile.role.toUpperCase();
    if(userProfile.role.includes('admin')) { badge.style.background = 'rgba(139, 92, 246, 0.1)'; badge.style.color = '#8b5cf6'; }
    else if(userProfile.role === 'specialist') { badge.style.background = 'rgba(16, 185, 129, 0.1)'; badge.style.color = '#10b981'; }
    else if(userProfile.role === 'volunteer') { badge.style.background = 'rgba(245, 158, 11, 0.1)'; badge.style.color = '#f59e0b'; }
    else { badge.style.background = 'rgba(59, 130, 246, 0.1)'; badge.style.color = '#3b82f6'; }

    document.getElementById('p-phone').innerText = userProfile.phone || '--';
    document.getElementById('p-wilaya').innerText = userProfile.wilaya || '--';
    document.getElementById('p-birth').innerText = userProfile.birth_date || '--';
    document.getElementById('p-created').innerText = new Date(userProfile.created_at).toLocaleDateString('ar-EG');
    document.getElementById('p-status').value = userProfile.account_status || 'active';
    document.getElementById('p-notes').value = userProfile.internal_notes || '';

    renderTags();
}

function renderTags() {
    const container = document.getElementById('p-tags-container');
    const tags = userProfile.tags || [];
    container.innerHTML = tags.map((t, idx) => `
        <span class="tag">${t} <span class="tag-remove" onclick="removeTag(${idx})">&times;</span></span>
    `).join('');
}

window.handleTagInput = async (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) {
            let tags = userProfile.tags || [];
            if (!tags.includes(val)) {
                tags.push(val);
                const { error } = await supabase.from('profiles').update({ tags }).eq('id', currentUserId);
                if (!error) {
                    userProfile.tags = tags;
                    renderTags();
                    e.target.value = '';
                }
            }
        }
    }
}

window.removeTag = async (idx) => {
    let tags = userProfile.tags || [];
    tags.splice(idx, 1);
    const { error } = await supabase.from('profiles').update({ tags }).eq('id', currentUserId);
    if (!error) {
        userProfile.tags = tags;
        renderTags();
    }
}

window.saveNotes = async () => {
    const notes = document.getElementById('p-notes').value;
    const { error } = await supabase.from('profiles').update({ internal_notes: notes }).eq('id', currentUserId);
    if (!error) {
        alert("تم حفظ الملاحظات بنجاح.");
    } else {
        alert("فشل الحفظ.");
    }
}

window.updateStatus = async (status) => {
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('id', currentUserId);
    if (!error) {
        userProfile.account_status = status;
        alert("تم تحديث حالة الحساب.");
    }
}

async function loadTimeline() {
    const container = document.getElementById('p-timeline');
    try {
        const { data, error } = await supabase.from('audit_logs').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(20);
        
        if (error || !data || data.length === 0) {
            // Fallback since audit_logs might be empty for new users
            container.innerHTML = `
                <div class="timeline-item">
                    <div class="tl-date">${new Date(userProfile.created_at).toLocaleString('ar-EG')}</div>
                    <div class="tl-content"><strong>تم تسجيل الدخول الأول / إنشاء الحساب</strong></div>
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(log => `
            <div class="timeline-item">
                <div class="tl-date">${new Date(log.created_at).toLocaleString('ar-EG')}</div>
                <div class="tl-content"><strong>${log.action_type}</strong> - ${log.entity_type || ''} ${log.entity_id || ''}</div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:red;">تعذر جلب السجل.</div>`;
    }
}

window.openSendEmail = () => {
    alert("سيتم نقلك قريباً لنظام البريد لإرسال إيميل إلى هذا المستخدم.");
    window.location.href = 'notifications.html';
}

window.openSendNotification = () => {
    alert("سيتم إرسال إشعار داخلي...");
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadProfile();
});
