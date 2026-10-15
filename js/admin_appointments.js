// js/admin_appointments.js - Clinic Appointment Supervision & Management Engine
import { supabase } from './supabase.js';
import { createNotification, setupNotificationWidget } from './notifications.js';

let allAppointments = [];
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

export async function initAdminAppointments() {
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

    // Setup notification widget in admin header if element exists
    const adminNotifRoot = document.getElementById('admin-notification-container');
    if (adminNotifRoot) {
        setupNotificationWidget('admin-notification-container');
    }

    // Event listeners
    document.getElementById('appt-search-input')?.addEventListener('input', applyFiltersAndRender);
    document.getElementById('appt-status-filter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('btn-refresh-appts')?.addEventListener('click', () => {
        showToast('جاري تحديث بيانات المواعيد...', 'info');
        loadAllAppointments();
    });

    await loadAllAppointments();
    setupRealtime();
}

async function loadAllAppointments() {
    const tbody = document.getElementById('admin-appointments-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 3rem 1rem;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                جاري فحص وتحديث سجلات المواعيد الطبية...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: false });

    if (error) {
        console.error("Error loading appointments:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    حدث خطأ أثناء تحميل المواعيد: ${error.message}
                </td>
            </tr>
        `;
        return;
    }

    const rawList = data || [];

    // Fetch related profile details
    const allProfileIds = [...new Set([
        ...rawList.map(a => a.patient_id),
        ...rawList.map(a => a.specialist_id)
    ].filter(Boolean))];

    let profilesMap = {};
    if (allProfileIds.length > 0) {
        const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .in('id', allProfileIds);
        if (profs) {
            profs.forEach(p => {
                profilesMap[p.id] = {
                    name: p.full_name || p.email || 'مستخدم',
                    email: p.email || '',
                    phone: p.phone || ''
                };
            });
        }
    }

    allAppointments = rawList.map(a => ({
        ...a,
        patient_info: profilesMap[a.patient_id] || { name: 'مريض غير مسجل', email: '', phone: '' },
        doctor_info: profilesMap[a.specialist_id] || { name: 'طبيب معتمد', email: '', phone: '' }
    }));

    updateKpis(allAppointments);
    applyFiltersAndRender();
}

function updateKpis(appointments) {
    const totalEl = document.getElementById('stat-total-appts');
    const confirmedEl = document.getElementById('stat-confirmed-appts');
    const pendingEl = document.getElementById('stat-pending-appts');
    const cancelledEl = document.getElementById('stat-cancelled-appts');

    if (totalEl) totalEl.innerText = appointments.length;
    if (confirmedEl) confirmedEl.innerText = appointments.filter(a => a.status === 'confirmed').length;
    if (pendingEl) pendingEl.innerText = appointments.filter(a => a.status === 'pending').length;
    if (cancelledEl) cancelledEl.innerText = appointments.filter(a => a.status === 'cancelled').length;
}

function applyFiltersAndRender() {
    const searchVal = document.getElementById('appt-search-input')?.value.toLowerCase().trim() || '';
    const statusVal = document.getElementById('appt-status-filter')?.value || 'all';

    let filtered = allAppointments.filter(item => {
        const matchStatus = statusVal === 'all' || item.status === statusVal;
        const matchSearch = !searchVal || 
            (item.id && item.id.toLowerCase().includes(searchVal)) ||
            (item.patient_info?.name && item.patient_info.name.toLowerCase().includes(searchVal)) ||
            (item.patient_info?.email && item.patient_info.email.toLowerCase().includes(searchVal)) ||
            (item.doctor_info?.name && item.doctor_info.name.toLowerCase().includes(searchVal)) ||
            (item.reason && item.reason.toLowerCase().includes(searchVal));

        return matchStatus && matchSearch;
    });

    renderAppointmentsTable(filtered);
}

function renderAppointmentsTable(list) {
    const tbody = document.getElementById('admin-appointments-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    لا توجد أي مواعيد طبية تطابق معايير البحث والفلترة المحددة.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const dateObj = new Date(item.scheduled_at);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('ar-EG', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'غير محدد';

        const formattedTime = !isNaN(dateObj) ? dateObj.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        }) : '';

        // Status badge
        let badgeStyle = 'background: #e2e8f0; color: #475569;';
        let statusLabel = item.status;
        if (item.status === 'pending') {
            badgeStyle = 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
            statusLabel = 'بانتظار التأكيد';
        } else if (item.status === 'confirmed') {
            badgeStyle = 'background: #d1fae5; color: #047857; border: 1px solid #a7f3d0;';
            statusLabel = 'مؤكد ومثبت';
        } else if (item.status === 'rescheduled') {
            badgeStyle = 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
            statusLabel = 'مُعاد جدولته';
        } else if (item.status === 'completed') {
            badgeStyle = 'background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;';
            statusLabel = 'مكتمل بنجاح';
        } else if (item.status === 'cancelled') {
            badgeStyle = 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
            statusLabel = 'ملغى';
        }

        const duration = item.duration_minutes || 30;

        return `
            <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
                <td style="padding: 12px 16px; font-family: monospace; font-weight:700; color:var(--text-secondary);">
                    #${item.id.slice(0, 8)}
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 700; color: var(--text-primary);">${item.patient_info?.name || 'مريض'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); direction:ltr; text-align:right;">${item.patient_info?.email || ''}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 700; color: #0284c7;">د. ${item.doctor_info?.name || 'مختص'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${item.doctor_info?.email || ''}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight:700; color:var(--text-primary);">${formattedDate}</div>
                    <div style="font-size:0.82rem; color:#0284c7; font-weight:600;">⏰ ${formattedTime}</div>
                </td>
                <td style="padding: 12px 16px; font-weight:600; color:var(--text-secondary);">
                    ${duration} دقيقة
                </td>
                <td style="padding: 12px 16px;">
                    <span style="display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; ${badgeStyle}">
                        ${statusLabel}
                    </span>
                    ${item.cancellation_reason ? `<div style="font-size:0.75rem; color:#dc2626; margin-top:3px;">سبب الإلغاء: ${item.cancellation_reason}</div>` : ''}
                </td>
                <td style="padding: 12px 16px; text-align:center;">
                    <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                        ${item.status === 'pending' ? `
                            <button class="btn btn-sm" style="background:#10b981; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-size:0.8rem; cursor:pointer;" onclick="adminConfirmAppointment('${item.id}', '${item.patient_id}', '${item.specialist_id}', '${item.scheduled_at}')">
                                تأكيد
                            </button>
                        ` : ''}

                        ${item.status !== 'cancelled' && item.status !== 'completed' ? `
                            <button class="btn btn-sm btn-outline" style="padding:4px 8px; border-radius:6px; font-size:0.8rem; cursor:pointer;" onclick="openAdminRescheduleModal('${item.id}', '${item.scheduled_at}', '${item.specialist_id}', '${item.patient_id}')">
                                جدولة 🔄
                            </button>
                            <button class="btn btn-sm btn-danger" style="padding:4px 8px; border-radius:6px; font-size:0.8rem; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; cursor:pointer;" onclick="adminCancelAppointment('${item.id}', '${item.patient_id}', '${item.specialist_id}', '${item.scheduled_at}')">
                                إلغاء ❌
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Global actions attached to window
window.adminConfirmAppointment = async function(apptId, patientId, doctorId, scheduledAt) {
    if (!confirm('هل أنت متأكد من رغبتك في تأكيد هذا الموعد رسمياً وإشعار المريض والطبيب؟')) return;

    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status: 'confirmed' })
            .eq('id', apptId);

        if (error) throw error;

        // Dispatch notifications to both
        const dtStr = new Date(scheduledAt).toLocaleString('ar-EG');
        await Promise.all([
            createNotification(
                patientId,
                'تأكيد موعدك الطبي ✅',
                `تم تأكيد موعدك الطبي بنجاح بتاريخ ${dtStr} من قبل إدارة العيادة.`,
                'appointment_confirmed',
                `/dashboard.html`
            ),
            createNotification(
                doctorId,
                'تأكيد موعد في جدولك 📅',
                `تم تأكيد الموعد الطبي بتاريخ ${dtStr} وإدراجه في جدول مواعيدك.`,
                'appointment_confirmed',
                `/specialist/calendar.html`
            )
        ]);

        showToast('تم تأكيد الموعد بنجاح وإشعار جميع الأطراف! ✅', 'success');
        await loadAllAppointments();
    } catch (err) {
        console.error("Error confirming appointment:", err);
        showToast('فشل تأكيد الموعد: ' + err.message, 'error');
    }
};

window.openAdminRescheduleModal = function(apptId, currentDatetime, doctorId, patientId) {
    const modal = document.getElementById('admin-reschedule-modal');
    if (!modal) return;

    document.getElementById('adm-reschedule-appt-id').value = apptId;
    document.getElementById('adm-reschedule-doc-id').value = doctorId;
    document.getElementById('adm-reschedule-pat-id').value = patientId;

    if (currentDatetime) {
        const d = new Date(currentDatetime);
        // Format to YYYY-MM-DDTHH:MM local
        const pad = (n) => String(n).padStart(2, '0');
        const localISO = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('adm-reschedule-datetime').value = localISO;
    }

    modal.style.display = 'flex';
};

window.closeAdminRescheduleModal = function() {
    const modal = document.getElementById('admin-reschedule-modal');
    if (modal) modal.style.display = 'none';
};

window.confirmAdminReschedule = async function() {
    const apptId = document.getElementById('adm-reschedule-appt-id').value;
    const doctorId = document.getElementById('adm-reschedule-doc-id').value;
    const patientId = document.getElementById('adm-reschedule-pat-id').value;
    const datetimeVal = document.getElementById('adm-reschedule-datetime').value;

    if (!datetimeVal) {
        showToast('يرجى تحديد التاريخ والوقت الجديد أولاً.', 'error');
        return;
    }

    const newDate = new Date(datetimeVal);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
        showToast('يرجى تحديد موعد مستقبلي صالح.', 'error');
        return;
    }

    try {
        // Concurrency / conflict safety check
        const startWindow = new Date(newDate.getTime() - 29 * 60000).toISOString();
        const endWindow = new Date(newDate.getTime() + 29 * 60000).toISOString();

        const { data: conflict, error: confError } = await supabase
            .from('appointments')
            .select('id')
            .eq('specialist_id', doctorId)
            .neq('id', apptId)
            .not('status', 'in', '("cancelled","rejected")')
            .gte('scheduled_at', startWindow)
            .lte('scheduled_at', endWindow);

        if (confError) throw confError;

        if (conflict && conflict.length > 0) {
            showToast('⚠️ يوجد تعارض في هذا التوقيت! الطبيب لديه موعد آخر محجوز بالفعل في هذه الفترة.', 'error');
            return;
        }

        const isoScheduled = newDate.toISOString();
        const { error: updateError } = await supabase
            .from('appointments')
            .update({
                scheduled_at: isoScheduled,
                status: 'rescheduled'
            })
            .eq('id', apptId);

        if (updateError) throw updateError;

        // Dispatch notifications
        const dtStr = newDate.toLocaleString('ar-EG');
        await Promise.all([
            createNotification(
                patientId,
                'إعادة جدولة موعدك الطبي 🔄',
                `تم تعديل موعدك الطبي ليصبح بتاريخ ${dtStr} من قبل إدارة العيادة.`,
                'appointment_rescheduled',
                `/dashboard.html`
            ),
            createNotification(
                doctorId,
                'تحديث في جدول المواعيد 🔄',
                `تمت إعادة جدولة موعد إلى ${dtStr} من قِبل إدارة النظام.`,
                'appointment_rescheduled',
                `/specialist/calendar.html`
            )
        ]);

        showToast('تمت إعادة جدولة الموعد بنجاح وإشعار الطرفين! ✅', 'success');
        window.closeAdminRescheduleModal();
        await loadAllAppointments();
    } catch (err) {
        console.error("Error rescheduling:", err);
        showToast('فشل تعديل الموعد: ' + err.message, 'error');
    }
};

window.adminCancelAppointment = async function(apptId, patientId, doctorId, scheduledAt) {
    const reason = prompt('يرجى كتابة سبب الإلغاء لإخطار المريض والطبيب به:', 'إلغاء تنظيمي من قبل إدارة العيادة');
    if (reason === null) return;

    try {
        const { error } = await supabase
            .from('appointments')
            .update({
                status: 'cancelled',
                cancellation_reason: reason || 'إلغاء من قبل الإدارة'
            })
            .eq('id', apptId);

        if (error) throw error;

        const dtStr = new Date(scheduledAt).toLocaleString('ar-EG');
        await Promise.all([
            createNotification(
                patientId,
                'إلغاء موعد طبي ❌',
                `تم إلغاء موعدك الطبي المحدد سابقاً في ${dtStr}. السبب: ${reason || 'إلغاء إداري'}`,
                'appointment_cancelled',
                `/dashboard.html`
            ),
            createNotification(
                doctorId,
                'إلغاء موعد من جدولك ❌',
                `تم إلغاء الموعد المحدد في ${dtStr}. السبب: ${reason || 'إلغاء إداري'}`,
                'appointment_cancelled',
                `/specialist/calendar.html`
            )
        ]);

        showToast('تم إلغاء الموعد بنجاح وإرسال الإشعارات. ❌', 'info');
        await loadAllAppointments();
    } catch (err) {
        console.error("Error cancelling appointment:", err);
        showToast('فشل إلغاء الموعد: ' + err.message, 'error');
    }
};

function setupRealtime() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel('admin-appointments-sync')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            (payload) => {
                console.log('Realtime appointment change received:', payload);
                loadAllAppointments();
            }
        )
        .subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
    initAdminAppointments();
});
