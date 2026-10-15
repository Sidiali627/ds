// admin_consultations.js - Comprehensive Consultation Management Engine
import { supabase } from './supabase.js';
import { createNotification } from './notifications.js';

let allConsultations = [];
let availableSpecialists = [];
let currentAssignConsultationId = null;
let realtimeChannel = null;

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0284c7';
    toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.18);
        font-size: 0.92rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    `;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

async function initAdminConsultations() {
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { 
        window.location.href = 'login.html'; 
        return; 
    }

    // Role check
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        alert('هذه الصفحة مخصصة للمدراء فقط.');
        window.location.href = '../index.html';
        return;
    }

    // Attach listeners
    document.getElementById('cons-search-input')?.addEventListener('input', applyFiltersAndRender);
    document.getElementById('cons-status-filter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('cons-specialty-filter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('btn-refresh-consultations')?.addEventListener('click', () => {
        showToast('جاري تحديث البيانات...', 'info');
        loadAllConsultations();
    });

    // Load initial data
    await Promise.all([
        loadSpecialistsList(),
        loadAllConsultations()
    ]);

    setupRealtime();
}

async function loadSpecialistsList() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['specialist', 'doctor', 'psychologist', 'nutritionist']);

    if (!error && data) {
        availableSpecialists = data;
        const select = document.getElementById('assign-doctor-select');
        if (select) {
            select.innerHTML = '<option value="">-- اختر طبيباً من القائمة --</option>' + 
                data.map(doc => {
                    const roleLabel = doc.role === 'psychologist' ? 'أخصائي نفسي' : (doc.role === 'nutritionist' ? 'أخصائي تغذية' : 'طبيب');
                    return `<option value="${doc.id}">د. ${doc.full_name || 'طبيب'} (${roleLabel})</option>`;
                }).join('');
        }
    }
}

async function loadAllConsultations() {
    const tbody = document.getElementById('admin-consultations-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 3rem 1rem;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                جاري فحص وتحديث سجلات الاستشارات...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading consultations:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    حدث خطأ أثناء تحميل الاستشارات: ${error.message}
                </td>
            </tr>
        `;
        return;
    }

    const rawList = data || [];

    // Fetch related profiles (both patients and specialists)
    const allProfileIds = [...new Set([
        ...rawList.map(c => c.user_id),
        ...rawList.map(c => c.specialist_id)
    ].filter(Boolean))];

    let profilesMap = {};
    if (allProfileIds.length > 0) {
        const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', allProfileIds);
        if (profs) {
            profs.forEach(p => profilesMap[p.id] = p.full_name || p.email || 'مستخدم');
        }
    }

    allConsultations = rawList.map(c => ({
        ...c,
        patient_name: profilesMap[c.user_id] || 'مريض غير مسجل',
        doctor_name: c.specialist_id ? (profilesMap[c.specialist_id] || 'طبيب معتمد') : null
    }));

    updateKpis(allConsultations);
    applyFiltersAndRender();
}

function updateKpis(consultations) {
    const totalEl = document.getElementById('stat-total-consultations');
    const pendingEl = document.getElementById('stat-pending-consultations');
    const activeEl = document.getElementById('stat-active-consultations');
    const completedEl = document.getElementById('stat-completed-consultations');

    if (totalEl) totalEl.innerText = consultations.length;
    if (pendingEl) pendingEl.innerText = consultations.filter(c => c.status === 'pending' || !c.specialist_id).length;
    if (activeEl) activeEl.innerText = consultations.filter(c => c.status === 'in_progress' || c.status === 'accepted').length;
    if (completedEl) completedEl.innerText = consultations.filter(c => c.status === 'completed').length;
}

function applyFiltersAndRender() {
    const searchVal = document.getElementById('cons-search-input')?.value.toLowerCase().trim() || '';
    const statusVal = document.getElementById('cons-status-filter')?.value || 'all';
    const specVal = document.getElementById('cons-specialty-filter')?.value || 'all';

    const filtered = allConsultations.filter(c => {
        // Status filter
        if (statusVal !== 'all') {
            if (statusVal === 'pending' && c.status !== 'pending') return false;
            if (statusVal === 'accepted' && c.status !== 'accepted') return false;
            if (statusVal === 'in_progress' && c.status !== 'in_progress') return false;
            if (statusVal === 'completed' && c.status !== 'completed') return false;
            if (statusVal === 'cancelled' && (c.status !== 'cancelled' && c.status !== 'rejected')) return false;
        }

        // Specialty filter
        if (specVal !== 'all' && c.specialty !== specVal) {
            return false;
        }

        // Search text
        if (searchVal) {
            const matchesCode = c.id && c.id.toLowerCase().includes(searchVal);
            const matchesPatient = c.patient_name && c.patient_name.toLowerCase().includes(searchVal);
            const matchesDesc = c.description && c.description.toLowerCase().includes(searchVal);
            const matchesDoctor = c.doctor_name && c.doctor_name.toLowerCase().includes(searchVal);
            if (!matchesCode && !matchesPatient && !matchesDesc && !matchesDoctor) return false;
        }

        return true;
    });

    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('admin-consultations-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
                    <div style="font-weight: 700; margin-bottom: 4px;">لا توجد استشارات مطابقة لمعايير البحث الحالية</div>
                    <p style="font-size: 0.85rem; margin: 0;">يرجى تجربة تعديل الفلاتر أو مسح شريط البحث.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(c => {
        // Status badge
        let badge = '<span style="background:rgba(245, 158, 11, 0.15); color:#d97706; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.78rem;">جديد / انتظار</span>';
        if (c.status === 'accepted') {
            badge = '<span style="background:rgba(2, 132, 199, 0.15); color:#0284c7; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.78rem;">تم التعيين / مقبول</span>';
        } else if (c.status === 'in_progress') {
            badge = '<span style="background:rgba(16, 185, 129, 0.15); color:#059669; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.78rem;">جلسة جارية 🟢</span>';
        } else if (c.status === 'completed') {
            badge = '<span style="background:rgba(100, 116, 139, 0.15); color:#475569; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.78rem;">مكتملة ✅</span>';
        } else if (c.status === 'cancelled' || c.status === 'rejected') {
            badge = '<span style="background:rgba(239, 68, 68, 0.15); color:#dc2626; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.78rem;">ملغاة ❌</span>';
        }

        // Doctor column
        let doctorDisplay = `
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="color:#d97706; font-size:0.85rem; font-weight:600;">⚠️ غير معين</span>
                <button type="button" class="btn btn-outline" onclick="openAssignModal('${c.id}')" style="padding:2px 8px; font-size:0.78rem; border-radius:6px; border-color:var(--brand-accent); color:var(--brand-accent);">+ تعيين</button>
            </div>
        `;
        if (c.specialist_id && c.doctor_name) {
            doctorDisplay = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <strong style="color:var(--text-primary); font-size:0.88rem;">د. ${c.doctor_name}</strong>
                    <button type="button" class="btn btn-outline" onclick="openAssignModal('${c.id}')" title="تغيير الطبيب" style="padding:2px 6px; font-size:0.75rem; border:none; background:rgba(0,0,0,0.04); cursor:pointer;">✏️</button>
                </div>
            `;
        }

        const specDisplay = c.specialty === 'psychology' ? 'صحة نفسية' : (c.specialty === 'nutrition' ? 'تغذية' : 'طب عام');
        const isUrgent = c.priority === 'urgent' || c.is_urgent;

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 800; font-size: 0.9rem; font-family: monospace;">#${c.id.substring(0, 8).toUpperCase()}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <strong style="font-size:0.92rem; color:var(--text-primary);">${c.patient_name}</strong>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight:700; color:var(--brand-accent); font-size:0.88rem;">${specDisplay}</div>
                    ${isUrgent ? '<span style="background:rgba(239, 68, 68, 0.12); color:#dc2626; padding:2px 6px; border-radius:10px; font-size:0.72rem; font-weight:bold;">🚨 عاجل</span>' : '<span style="font-size:0.75rem; color:var(--text-secondary);">عادي</span>'}
                </td>
                <td style="padding: 12px 16px;">
                    ${doctorDisplay}
                </td>
                <td style="padding: 12px 16px; font-size:0.84rem; color:var(--text-secondary);">
                    ${new Date(c.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td style="padding: 12px 16px;">
                    ${badge}
                </td>
                <td style="padding: 12px 16px; text-align:center;">
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn btn-outline" onclick="openStatusModal('${c.id}', '${c.status}')" style="padding:4px 10px; font-size:0.8rem; border-radius:8px;" title="تعديل الحالة">
                            🔄 الحالة
                        </button>
                        <a href="../user_live_session.html?id=${c.id}" class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; border-radius:8px;" title="معاينة جلسة المحادثة">
                            💬 معاينة
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ----------------------------------------------------
// Assign Specialist Flow
// ----------------------------------------------------
window.openAssignModal = (consId) => {
    currentAssignConsultationId = consId;
    const cons = allConsultations.find(c => c.id === consId);
    if (!cons) return;

    document.getElementById('assign-cons-code').innerText = '#' + cons.id.substring(0, 8).toUpperCase();
    document.getElementById('assign-patient-name').innerText = cons.patient_name;
    document.getElementById('assign-cons-specialty').innerText = cons.specialty === 'psychology' ? 'صحة نفسية' : (cons.specialty === 'nutrition' ? 'تغذية' : 'طب عام');

    const select = document.getElementById('assign-doctor-select');
    if (select) {
        select.value = cons.specialist_id || '';
    }

    document.getElementById('assign-specialist-modal').style.display = 'flex';
};

window.closeAssignModal = () => {
    document.getElementById('assign-specialist-modal').style.display = 'none';
    currentAssignConsultationId = null;
};

window.confirmAssignSpecialist = async () => {
    if (!currentAssignConsultationId) return;
    const selectedDoctorId = document.getElementById('assign-doctor-select').value;
    if (!selectedDoctorId) {
        alert('يرجى اختيار طبيب مختص من القائمة.');
        return;
    }

    const btn = document.getElementById('btn-confirm-assign');
    btn.disabled = true;
    btn.innerText = 'جاري التعيين...';

    // Update in Supabase
    const { error } = await supabase
        .from('consultations')
        .update({
            specialist_id: selectedDoctorId,
            status: 'accepted',
            updated_at: new Date().toISOString()
        })
        .eq('id', currentAssignConsultationId);

    btn.disabled = false;
    btn.innerText = 'تأكيد التعيين وإشعار المختص ✅';

    if (error) {
        showToast('فشل في تعيين الطبيب: ' + error.message, 'error');
    } else {
        showToast('تم تعيين الطبيب المختص وتحديث حالة الاستشارة إلى "مقبولة" بنجاح ✅', 'success');
        
        // Notify both specialist and patient
        const currentCons = allConsultations.find(c => c.id === currentAssignConsultationId);
        try {
            // Notify specialist
            await createNotification(
                selectedDoctorId,
                'استشارة جديدة مسندة إليك 🩺',
                `تم إسناد استشارة جديدة لك لمتابعة حالة المريض (${currentCons?.patient_name || 'مريض'}).`,
                'consultation',
                'specialist/consultations.html'
            );

            // Notify patient
            if (currentCons && currentCons.user_id) {
                await createNotification(
                    currentCons.user_id,
                    'تم قبول استشارتك وتعيين الطبيب المختص 🩺',
                    'يسعدنا إبلاغك بأنه تم قبول طلب استشارتك وتعيين طبيب مختص لبدء رعايتك.',
                    'consultation',
                    'dashboard.html'
                );
            }
        } catch (notifErr) {
            console.warn('Assignment notifications notice:', notifErr);
        }

        closeAssignModal();
        await loadAllConsultations();
    }
};

// ----------------------------------------------------
// Change Status Flow
// ----------------------------------------------------
window.openStatusModal = (consId, currentStatus) => {
    document.getElementById('status-cons-id').value = consId;
    const statusSelect = document.getElementById('select-new-status');
    if (statusSelect) {
        statusSelect.value = currentStatus || 'pending';
    }
    document.getElementById('change-status-modal').style.display = 'flex';
};

window.closeStatusModal = () => {
    document.getElementById('change-status-modal').style.display = 'none';
};

window.confirmUpdateStatus = async () => {
    const consId = document.getElementById('status-cons-id').value;
    const newStatus = document.getElementById('select-new-status').value;
    if (!consId) return;

    const btn = document.getElementById('btn-confirm-status');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';

    const { error } = await supabase
        .from('consultations')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', consId);

    btn.disabled = false;
    btn.innerText = 'حفظ التغييرات';

    if (error) {
        showToast('فشل تحديث الحالة: ' + error.message, 'error');
    } else {
        showToast(`تم تغيير حالة الاستشارة إلى "${newStatus}" بنجاح ✅`, 'success');
        
        // Notify patient of status change
        const currentCons = allConsultations.find(c => c.id === consId);
        if (currentCons && currentCons.user_id) {
            const statusLabel = newStatus === 'accepted' ? 'مقبولة' :
                newStatus === 'in_progress' ? 'جلسة جارية' :
                newStatus === 'completed' ? 'مكتملة' :
                newStatus === 'rejected' ? 'معتذر عنها' : 'ملغاة';

            try {
                await createNotification(
                    currentCons.user_id,
                    'تحديث في حالة استشارتك الطبية 🩺',
                    `تم تحديث حالة استشارتك إلى: "${statusLabel}". يمكنك مراجعة المستجدات في لوحة التحكم.`,
                    'consultation',
                    'dashboard.html'
                );
            } catch (notifErr) {
                console.warn('Status change notification notice:', notifErr);
            }
        }

        closeStatusModal();
        await loadAllConsultations();
    }
};

// ----------------------------------------------------
// Realtime Subscriptions
// ----------------------------------------------------
function setupRealtime() {
    if (realtimeChannel) {
        realtimeChannel.unsubscribe();
    }

    realtimeChannel = supabase
        .channel('admin_consultations_channel')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'consultations'
        }, () => {
            loadAllConsultations();
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', initAdminConsultations);
