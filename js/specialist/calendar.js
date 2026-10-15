// calendar.js - Specialist Appointment Management with Concurrency Conflict Safety & Realtime
import { supabase } from '../supabase.js';
import { showToast } from '../toast.js';
import { createNotification, setupNotificationWidget } from '../notifications.js';

let currentUser = null;
let appointments = [];
let patientsList = [];
let currentView = 'month'; // 'month', 'week', 'day'
let realtimeApptsSub = null;

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }

    const ALLOWED_SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist', 'admin', 'super_admin'];
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile || !ALLOWED_SPECIALIST_ROLES.includes(profile.role)) {
        showToast("هذه الصفحة مخصصة للمختصين فقط.", 'error');
        setTimeout(() => window.location.href = '../index.html', 1500);
        return;
    }
    currentUser = profile;

    const spNameEl = document.getElementById('sp-name');
    if (spNameEl) spNameEl.innerText = profile.full_name || 'طبيب استشاري';
    const spAvatarEl = document.getElementById('sp-avatar');
    if (spAvatarEl && profile.avatar_url) spAvatarEl.src = profile.avatar_url;

    // Attach notification widget to bell button if present in header
    const bellBtn = document.querySelector('.admin-header .btn-outline') || document.getElementById('sp-notif-btn');
    if (bellBtn) {
        setupNotificationWidget(bellBtn, currentUser.id);
    }

    await Promise.all([
        loadPatientsOptions(),
        loadAppointments()
    ]);

    setupRealtime();
}

async function loadPatientsOptions() {
    const { data } = await supabase.from('consultations')
        .select('user_id')
        .eq('specialist_id', currentUser.id);

    const select = document.getElementById('appt-patient');
    if (!select) return;

    if (!data || data.length === 0) {
        select.innerHTML = '<option value="">لا يوجد مرضى مسجلين بالعيادة حالياً</option>';
        return;
    }

    const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p.full_name);
    }

    patientsList = Object.keys(profilesMap).map(id => ({ id, name: profilesMap[id] }));
    select.innerHTML = patientsList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

async function loadAppointments() {
    const container = document.getElementById('appointments-container');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.5;">جاري تحميل جدول المواعيد...</div>';

    const { data, error } = await supabase.from('appointments')
        .select('*')
        .eq('specialist_id', currentUser.id)
        .order('scheduled_at', { ascending: true });

    if (error || !data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:20px; padding:3rem 1.5rem; text-align:center;">
                <div class="empty-state-icon" style="font-size:3rem; margin-bottom:10px;">📅</div>
                <div class="empty-state-title" style="font-weight:800; font-size:1.15rem; margin-bottom:6px;">لا توجد مواعيد مجهزة بالتقويم حالياً</div>
                <div class="empty-state-desc" style="color:var(--text-secondary); font-size:0.9rem; max-width:400px; margin:0 auto 1.25rem;">يمكنك جدولة موعد جديد لمريضك أو انتظار حجوزات المرضى عبر الملف التعريفي.</div>
                <button type="button" class="btn btn-primary" onclick="openApptModal()" style="border-radius:12px; padding:8px 18px;">➕ جدولة موعد الآن</button>
            </div>
        `;
        return;
    }

    const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p.full_name);
    }

    appointments = data.map(a => ({
        ...a,
        patient_name: profilesMap[a.user_id] || 'مريض مسجل'
    }));

    renderAppointments();
}

function renderAppointments() {
    const container = document.getElementById('appointments-container');
    if (!container) return;

    const now = new Date();
    const filtered = appointments.filter(a => {
        const aDate = new Date(a.scheduled_at);
        if (currentView === 'day') {
            return aDate.toDateString() === now.toDateString();
        } else if (currentView === 'week') {
            const diffDays = Math.abs((aDate - now) / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:16px; padding:3rem 1rem; text-align:center; color:var(--text-secondary);">
                <div style="font-size:2rem; margin-bottom:8px;">☕</div>
                <div style="font-weight:700;">لا توجد مواعيد مسجلة في هذا النطاق الزمني (${currentView === 'day' ? 'اليوم' : 'الأسبوع'})</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const dateObj = new Date(a.scheduled_at);
        const dateStr = dateObj.toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        let statusClass = 'status-scheduled';
        let statusText = 'قيد الانتظار';
        let statusStyle = 'background: rgba(245, 158, 11, 0.15); color: #d97706;';

        if (a.status === 'confirmed' || a.status === 'accepted') {
            statusText = 'مؤكد ✅';
            statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #059669;';
        } else if (a.status === 'rescheduled') {
            statusText = 'مُعاد جدولته 🔄';
            statusStyle = 'background: rgba(2, 132, 199, 0.15); color: #0284c7;';
        } else if (a.status === 'completed') {
            statusText = 'مكتمل';
            statusStyle = 'background: rgba(100, 116, 139, 0.15); color: #475569;';
        } else if (a.status === 'cancelled') {
            statusText = 'ملغى ❌';
            statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #dc2626;';
        }

        // Action buttons based on status
        let actionsHtml = '';
        if (a.status !== 'cancelled' && a.status !== 'completed') {
            if (a.status === 'pending') {
                actionsHtml += `
                    <button type="button" class="btn btn-primary" onclick="confirmAppointment('${a.id}', '${a.user_id}', '${dateStr} ${timeStr}')" style="padding:6px 12px; font-size:0.8rem; border-radius:8px;">
                        تأكيد الموعد ✅
                    </button>
                `;
            }
            actionsHtml += `
                <button type="button" class="btn btn-outline" onclick="openRescheduleModal('${a.id}', '${a.user_id}', '${a.patient_name}', '${a.scheduled_at}')" style="padding:6px 12px; font-size:0.8rem; border-radius:8px;">
                    إعادة جدولة 🔄
                </button>
                <button type="button" class="btn btn-outline" onclick="openCancelModal('${a.id}', '${a.user_id}', '${dateStr} ${timeStr}')" style="padding:6px 12px; font-size:0.8rem; border-color:#ef4444; color:#ef4444; border-radius:8px;">
                    إلغاء ✕
                </button>
            `;
        }

        return `
            <div class="appt-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div style="display:flex; gap:16px; align-items:center;">
                    <div style="width:48px; height:48px; border-radius:14px; background:rgba(2, 132, 199, 0.1); color:var(--specialist-primary); display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800;">
                        ${(a.patient_name || 'م').charAt(0)}
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">${a.patient_name}</h3>
                            <span style="${statusStyle} padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">${statusText}</span>
                        </div>
                        <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">
                            <span>📅 ${dateStr}</span> | <span>⏰ ${timeStr}</span> | <span>⏱️ ${a.duration_minutes || 30} دقيقة</span>
                        </div>
                        ${a.notes ? `<div style="color:var(--text-secondary); font-size:0.8rem; margin-top:4px;">📝 ${a.notes}</div>` : ''}
                        ${a.cancellation_reason ? `<div style="color:#dc2626; font-size:0.8rem; margin-top:4px;">سبب الإلغاء: ${a.cancellation_reason}</div>` : ''}
                    </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center;">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

window.switchCalView = (view) => {
    currentView = view;
    document.querySelectorAll('.cal-tab').forEach(t => t.classList.remove('active'));
    event?.target?.classList.add('active');
    renderAppointments();
};

window.openApptModal = () => {
    document.getElementById('appt-modal').style.display = 'flex';
};

window.closeApptModal = () => {
    document.getElementById('appt-modal').style.display = 'none';
};

window.saveAppointment = async (e) => {
    e.preventDefault();
    const patientId = document.getElementById('appt-patient').value;
    const dateVal = document.getElementById('appt-date').value;
    const notes = document.getElementById('appt-notes').value;

    if (!patientId || !dateVal) {
        showToast('يرجى تحديد المريض والتاريخ والوقت.', 'error');
        return;
    }

    const scheduledTimestamp = new Date(dateVal).toISOString();

    // Conflict Check
    const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('specialist_id', currentUser.id)
        .eq('scheduled_at', scheduledTimestamp)
        .not('status', 'in', '("cancelled","rejected")')
        .limit(1);

    if (conflict && conflict.length > 0) {
        showToast('⚠️ يوجد موعد آخر محجوز بالفعل في هذا التوقيت. يرجى اختيار موعد بديل.', 'error');
        return;
    }

    const { error } = await supabase.from('appointments').insert({
        user_id: patientId,
        specialist_id: currentUser.id,
        scheduled_at: scheduledTimestamp,
        duration_minutes: 30,
        status: 'confirmed',
        notes: notes
    });

    if (error) {
        showToast('فشل حفظ الموعد: ' + error.message, 'error');
    } else {
        showToast('تمت جدولة الموعد بنجاح ✅', 'success');
        closeApptModal();

        // Notify Patient
        const formattedDate = new Date(dateVal).toLocaleString('ar-EG');
        await createNotification(
            patientId,
            "موعد طبي مجدول جديد 📅",
            `قام د. ${currentUser.full_name || 'الطبيب'} بجدولة موعد طبي لك بتاريخ ${formattedDate}.`,
            "appointment",
            "dashboard.html",
            "normal"
        );

        await loadAppointments();
    }
};

window.confirmAppointment = async (apptId, patientId, dateStr) => {
    const { error } = await supabase
        .from('appointments')
        .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
        })
        .eq('id', apptId);

    if (error) {
        showToast('تعذر تأكيد الموعد: ' + error.message, 'error');
    } else {
        showToast('تم تأكيد الموعد الطبي بنجاح ✅', 'success');

        // Notify Patient
        await createNotification(
            patientId,
            "تم تأكيد موعدك الطبي ✅",
            `أكّد د. ${currentUser.full_name || 'الطبيب'} موعدك المحدد بتاريخ ${dateStr}. نتمنى لك دوام الصحة والعافية.`,
            "appointment",
            "dashboard.html",
            "normal"
        );

        await loadAppointments();
    }
};

window.openRescheduleModal = (apptId, patientId, patientName, currentDate) => {
    document.getElementById('reschedule-appt-id').value = apptId;
    document.getElementById('reschedule-patient-id').value = patientId;
    document.getElementById('reschedule-patient-name').innerText = patientName;
    
    // Set default value
    const dateObj = new Date(currentDate);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('reschedule-new-date').value = localIso;

    document.getElementById('reschedule-modal').style.display = 'flex';
};

window.closeRescheduleModal = () => {
    document.getElementById('reschedule-modal').style.display = 'none';
};

window.confirmRescheduleAppointment = async (e) => {
    e.preventDefault();
    const apptId = document.getElementById('reschedule-appt-id').value;
    const patientId = document.getElementById('reschedule-patient-id').value;
    const newDateVal = document.getElementById('reschedule-new-date').value;

    if (!newDateVal) return;

    const newTimestamp = new Date(newDateVal).toISOString();

    // Conflict Check
    const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('specialist_id', currentUser.id)
        .eq('scheduled_at', newTimestamp)
        .neq('id', apptId)
        .not('status', 'in', '("cancelled","rejected")')
        .limit(1);

    if (conflict && conflict.length > 0) {
        showToast('⚠️ التوقيت المحدد محجوز بالفعل لموعد آخر.', 'error');
        return;
    }

    const { error } = await supabase
        .from('appointments')
        .update({
            scheduled_at: newTimestamp,
            status: 'rescheduled',
            updated_at: new Date().toISOString()
        })
        .eq('id', apptId);

    if (error) {
        showToast('فشل إعادة الجدولة: ' + error.message, 'error');
    } else {
        showToast('تمت إعادة جدولة الموعد بنجاح 🔄', 'success');
        closeRescheduleModal();

        const formatted = new Date(newDateVal).toLocaleString('ar-EG');
        await createNotification(
            patientId,
            "تم تعديل موعدك الطبي 🔄",
            `قام د. ${currentUser.full_name || 'الطبيب'} بإعادة جدولة موعدك ليصبح بتاريخ ${formatted}.`,
            "appointment",
            "dashboard.html",
            "high"
        );

        await loadAppointments();
    }
};

window.openCancelModal = (apptId, patientId, dateStr) => {
    document.getElementById('cancel-appt-id').value = apptId;
    document.getElementById('cancel-patient-id').value = patientId;
    document.getElementById('cancel-reason').value = '';
    document.getElementById('cancel-modal').style.display = 'flex';
};

window.closeCancelModal = () => {
    document.getElementById('cancel-modal').style.display = 'none';
};

window.confirmCancelAppointment = async (e) => {
    e.preventDefault();
    const apptId = document.getElementById('cancel-appt-id').value;
    const patientId = document.getElementById('cancel-patient-id').value;
    const reason = document.getElementById('cancel-reason').value.trim();

    const { error } = await supabase
        .from('appointments')
        .update({
            status: 'cancelled',
            cancellation_reason: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', apptId);

    if (error) {
        showToast('تعذر إلغاء الموعد: ' + error.message, 'error');
    } else {
        showToast('تم إلغاء الموعد بنجاح', 'info');
        closeCancelModal();

        await createNotification(
            patientId,
            "إلغاء موعد طبي ❌",
            `تم إلغاء موعدك من قبل الطبيب. السبب: ${reason || 'ظرف طارئ'}. يمكنك حجز موعد جديد متى رغبت.`,
            "appointment",
            "dashboard.html",
            "normal"
        );

        await loadAppointments();
    }
};

function setupRealtime() {
    if (realtimeApptsSub) realtimeApptsSub.unsubscribe();

    realtimeApptsSub = supabase
        .channel(`specialist_appts_${currentUser.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `specialist_id=eq.${currentUser.id}`
        }, () => {
            loadAppointments();
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', init);
