// dashboard.js - User Dashboard, Consultations Tracker & Appointment Scheduling
import { requireAuth, signOut } from './auth.js';
import { supabase } from './supabase.js';
import { setupNotificationWidget, createNotification } from './notifications.js';

let realtimeConsultationsSub = null;
let realtimeAppointmentsSub = null;
let currentUserId = null;
let currentUserName = 'المستخدم';

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    currentUserId = session.user.id;

    // Fetch user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
        
    if (profile && profile.full_name) {
        currentUserName = profile.full_name;
        document.getElementById('welcome-msg').innerText = `مرحباً بك، ${profile.full_name} 👋`;
    }

    document.getElementById('logout-btn')?.addEventListener('click', signOut);

    // Setup Notification Bell
    const notifBtn = document.getElementById('user-notif-btn');
    if (notifBtn) {
        setupNotificationWidget(notifBtn, currentUserId);
    }

    // Load Consultations & Appointments
    await Promise.all([
        loadUserConsultations(currentUserId),
        loadUserAppointments(currentUserId)
    ]);

    setupRealtime(currentUserId);
});

async function loadUserConsultations(userId) {
    const tbody = document.getElementById('user-consultations-body');
    const countEl = document.getElementById('count-user-consults');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2rem;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                جاري تحميل بيانات استشاراتك...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        if (countEl) countEl.innerText = '0';
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    <div style="font-size:2.5rem; margin-bottom:8px;">📭</div>
                    <div style="font-weight:700; margin-bottom:4px;">لا توجد طلبات استشارة مسجلة حالياً</div>
                    <p style="font-size:0.85rem; margin-bottom:12px;">يمكنك البدء فوراً بالتواصل مع أحد خبرائنا المعتمدين.</p>
                    <a href="consultations.html" class="btn btn-primary" style="display:inline-block; padding: 6px 16px; font-weight: 700; border-radius: 8px;">+ تقديم طلب استشارة جديدة</a>
                </td>
            </tr>
        `;
        return;
    }

    if (countEl) {
        const activeCount = data.filter(c => c.status !== 'completed' && c.status !== 'cancelled' && c.status !== 'rejected').length;
        countEl.innerText = activeCount;
    }

    // Resolve Specialist Names
    const specialistIds = [...new Set(data.map(c => c.specialist_id).filter(Boolean))];
    let specialistsMap = {};
    if (specialistIds.length > 0) {
        const { data: specialists } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', specialistIds);
        if (specialists) {
            specialists.forEach(s => specialistsMap[s.id] = s.full_name);
        }
    }

    tbody.innerHTML = data.map(c => {
        let statusBadge = '<span class="badge badge-warning" style="background:rgba(245, 158, 11, 0.15); color:#d97706; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">قيد المراجعة والتعيين</span>';
        let actionBtn = '<span style="color: var(--text-secondary); font-size: 0.85rem;">بانتظار موافقة الطبيب</span>';

        const doctorName = c.specialist_id ? (specialistsMap[c.specialist_id] || 'طبيب معتمد') : 'غير معين بعد';

        if (c.status === 'accepted') {
            statusBadge = '<span class="badge badge-brand" style="background:rgba(2, 132, 199, 0.15); color:#0284c7; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">تم التعيين / مقبول</span>';
            actionBtn = `<a href="user_live_session.html?id=${c.id}" class="btn btn-primary" style="padding: 4px 12px; font-size: 0.82rem; border-radius: 8px;">دخول الجلسة 💬</a>`;
        } else if (c.status === 'in_progress') {
            statusBadge = '<span class="badge badge-success" style="background:rgba(16, 185, 129, 0.15); color:#059669; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">جلسة جارية الآن 🟢</span>';
            actionBtn = `<a href="user_live_session.html?id=${c.id}" class="btn btn-primary" style="padding: 5px 14px; font-size: 0.85rem; font-weight:800; border-radius: 8px; box-shadow:0 2px 8px rgba(16,185,129,0.3);">دخول البث المباشر 📹</a>`;
        } else if (c.status === 'completed') {
            statusBadge = '<span class="badge" style="background:rgba(100, 116, 139, 0.15); color:#475569; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">مكتملة ومغلقة ✅</span>';
            actionBtn = `<a href="user_live_session.html?id=${c.id}" class="btn btn-outline" style="padding: 4px 12px; font-size: 0.82rem; border-radius: 8px;">مراجعة السجل 📄</a>`;
        } else if (c.status === 'rejected' || c.status === 'cancelled') {
            statusBadge = '<span class="badge badge-danger" style="background:rgba(239, 68, 68, 0.15); color:#dc2626; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">ملغاة ❌</span>';
            actionBtn = '<span style="color:var(--text-secondary); font-size:0.8rem;">مغلقة</span>';
        }

        const specDisplay = c.specialty === 'psychology' ? 'صحة نفسية' : (c.specialty === 'nutrition' ? 'تغذية' : 'طب عام');
        const isUrgent = c.priority === 'urgent' || c.is_urgent;

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px;">
                    <div style="font-weight: 800; font-size: 0.9rem;">#${c.id.substring(0, 6).toUpperCase()}</div>
                    ${isUrgent ? '<span style="font-size:0.72rem; color:#dc2626; font-weight:bold;">🚨 عاجل</span>' : ''}
                </td>
                <td style="padding: 12px;">
                    <strong style="color:var(--brand-accent);">${specDisplay}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                        الطبيب: <strong>${doctorName}</strong>
                    </div>
                </td>
                <td style="padding: 12px; font-size: 0.85rem; color: var(--text-secondary);">
                    ${new Date(c.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td style="padding: 12px;">${statusBadge}</td>
                <td style="padding: 12px;">${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

async function loadUserAppointments(userId) {
    const tbody = document.getElementById('user-appointments-body');
    const countEl = document.getElementById('count-user-appts');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2rem;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                جاري تحميل مواعيدك الطبية المحجوزة...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: true });

    if (error || !data || data.length === 0) {
        if (countEl) countEl.innerText = '0';
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                    <div style="font-size:2.2rem; margin-bottom:6px;">📅</div>
                    <div style="font-weight:700; margin-bottom:4px;">لا توجد مواعيد محجوزة حالياً</div>
                    <p style="font-size:0.85rem; margin-bottom:0;">يمكنك زيارة الملف التعريفي لأي طبيب واختيار موعد مناسب لك.</p>
                </td>
            </tr>
        `;
        return;
    }

    if (countEl) {
        const upcomingCount = data.filter(a => new Date(a.scheduled_at) >= new Date() && a.status !== 'cancelled').length;
        countEl.innerText = upcomingCount;
    }

    // Resolve Specialist Names
    const specialistIds = [...new Set(data.map(a => a.specialist_id).filter(Boolean))];
    let specialistsMap = {};
    if (specialistIds.length > 0) {
        const { data: specialists } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', specialistIds);
        if (specialists) {
            specialists.forEach(s => specialistsMap[s.id] = s.full_name);
        }
    }

    tbody.innerHTML = data.map(a => {
        const doctorName = specialistsMap[a.specialist_id] || 'طبيب استشاري';
        const dateObj = new Date(a.scheduled_at);
        const dateFormatted = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeFormatted = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        let statusBadge = '<span style="background:rgba(245, 158, 11, 0.15); color:#d97706; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">بانتظار التأكيد</span>';
        let actionBtn = '';

        if (a.status === 'confirmed' || a.status === 'accepted') {
            statusBadge = '<span style="background:rgba(16, 185, 129, 0.15); color:#059669; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">موعد مؤكد ✅</span>';
        } else if (a.status === 'completed') {
            statusBadge = '<span style="background:rgba(100, 116, 139, 0.15); color:#475569; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">مكتمل</span>';
        } else if (a.status === 'cancelled') {
            statusBadge = '<span style="background:rgba(239, 68, 68, 0.15); color:#dc2626; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">ملغى ❌</span>';
        }

        // Action button for cancellation
        const isUpcoming = dateObj >= new Date();
        if (isUpcoming && a.status !== 'cancelled' && a.status !== 'completed') {
            actionBtn = `
                <button type="button" class="btn btn-outline" onclick="window.cancelUserAppointment('${a.id}', '${a.specialist_id}', '${dateFormatted} ${timeFormatted}')" style="padding:3px 10px; font-size:0.78rem; border-color:#ef4444; color:#ef4444; border-radius:6px;">
                    إلغاء الموعد ✕
                </button>
            `;
        } else {
            actionBtn = `<span style="font-size:0.8rem; color:var(--text-tertiary);">${a.notes || 'لا توجد ملاحظات'}</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px;">
                    <strong style="color:var(--text-primary); font-size:0.92rem;">د. ${doctorName}</strong>
                </td>
                <td style="padding: 12px; font-size:0.86rem; color:var(--text-primary);">
                    <div>📅 ${dateFormatted}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">⏰ ${timeFormatted}</div>
                </td>
                <td style="padding: 12px; font-size:0.85rem; color:var(--text-secondary);">
                    ${a.duration_minutes || 30} دقيقة
                </td>
                <td style="padding: 12px;">
                    ${statusBadge}
                </td>
                <td style="padding: 12px;">
                    ${actionBtn}
                </td>
            </tr>
        `;
    }).join('');
}

window.cancelUserAppointment = async (apptId, doctorId, dateStr) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إلغاء هذا الموعد المحدد في ${dateStr}؟`)) return;

    const { error } = await supabase
        .from('appointments')
        .update({
            status: 'cancelled',
            cancellation_reason: 'تم الإلغاء من قبل المريض',
            updated_at: new Date().toISOString()
        })
        .eq('id', apptId)
        .eq('user_id', currentUserId);

    if (error) {
        alert('تعذر إلغاء الموعد: ' + error.message);
    } else {
        // Notify Specialist
        await createNotification(
            doctorId,
            "إلغاء موعد طبي ❌",
            `قام المريض (${currentUserName}) بإلغاء موعده المحدد بتاريخ ${dateStr}.`,
            "appointment",
            "specialist/calendar.html",
            "normal"
        );

        alert('تم إلغاء الموعد وإشعار الطبيب بنجاح.');
        loadUserAppointments(currentUserId);
    }
};

function setupRealtime(userId) {
    if (realtimeConsultationsSub) realtimeConsultationsSub.unsubscribe();
    if (realtimeAppointmentsSub) realtimeAppointmentsSub.unsubscribe();

    realtimeConsultationsSub = supabase
        .channel(`user_consultations_${userId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'consultations',
            filter: `user_id=eq.${userId}`
        }, () => {
            loadUserConsultations(userId);
        })
        .subscribe();

    realtimeAppointmentsSub = supabase
        .channel(`user_appointments_${userId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `user_id=eq.${userId}`
        }, () => {
            loadUserAppointments(userId);
        })
        .subscribe();
}
