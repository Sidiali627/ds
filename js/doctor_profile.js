// doctor_profile.js - Public Doctor Profile & Conflict-Safe Appointment Booking
import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { createNotification } from './notifications.js';
import { isSpecialistRole, normalizeRole } from './roles.js';

let currentDoctorId = null;
let currentDoctorProfile = null;
let bookedTimesOnDate = new Set();
const DEFAULT_SLOTS = [
    '09:00', '10:00', '11:00', '12:00',
    '14:00', '15:00', '16:00', '17:00'
];

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    currentDoctorId = urlParams.get('id');

    const skeleton = document.getElementById('doctor-skeleton');
    const content = document.getElementById('doctor-content');
    const errorBox = document.getElementById('doctor-error');

    if (!currentDoctorId) {
        showError(skeleton, errorBox);
        return;
    }

    try {
        // Fetch base profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentDoctorId)
            .single();

        if (profileError || !profile) throw new Error("Doctor not found");

        // Validate role is actually a specialist
        if (!isSpecialistRole(normalizeRole(profile.role))) {
            throw new Error("Invalid role for doctor profile");
        }
        currentDoctorProfile = profile;

        // Fetch specialist extended profile
        const { data: spData } = await supabase
            .from('specialist_profiles')
            .select('*')
            .eq('id', currentDoctorId)
            .maybeSingle();

        renderDoctorData(profile, spData);
        initBookingWidget();

        if (skeleton) skeleton.style.display = 'none';
        if (content) content.style.display = 'grid';
        
    } catch (err) {
        console.error("Error loading doctor profile:", err);
        showError(skeleton, errorBox);
    }
}

function renderDoctorData(profile, spData) {
    document.getElementById('doc-name').innerText = `د. ${profile.full_name || 'غير محدد'}`;
    if (profile.avatar_url) {
        document.getElementById('doc-image').src = profile.avatar_url;
    }

    const spec = spData?.specialty || 'طبيب أخصائي';
    document.getElementById('doc-specialty').innerText = spec;
    
    let bio = spData?.bio;
    if (!bio || bio.trim() === '') {
        bio = `يسعدني تقديم الاستشارات الطبية والنصائح المتخصصة في مجال ${spec}. أهتم بتوفير الرعاية الصحية الأفضل لمراجعي استوديو صحة الشباب.`;
    }
    document.getElementById('doc-bio').innerText = bio;
    document.getElementById('doc-spec-list').innerText = `متخصص ومعتمد في ${spec}`;
}

function initBookingWidget() {
    const dateInput = document.getElementById('book-date');
    if (!dateInput) return;

    // Minimum date is today
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;

    // Handle date selection change
    dateInput.addEventListener('change', () => loadSlotsForDate(dateInput.value));
    
    // Load slots for initial date
    loadSlotsForDate(today);

    // Form submission
    const form = document.getElementById('appointment-booking-form');
    form?.addEventListener('submit', handleBookingSubmit);
}

async function loadSlotsForDate(selectedDate) {
    const container = document.getElementById('slots-container');
    const submitBtn = document.getElementById('btn-confirm-booking');
    const selectedSlotInput = document.getElementById('selected-slot-time');
    
    if (!container) return;
    
    selectedSlotInput.value = '';
    if (submitBtn) submitBtn.disabled = true;

    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:12px; font-size:0.82rem; color:var(--text-secondary);">جاري التحقق من أوقات الطبيب المتاحة... ⏳</div>';

    bookedTimesOnDate.clear();

    if (supabase) {
        const startOfDay = new Date(`${selectedDate}T00:00:00Z`).toISOString();
        const endOfDay = new Date(`${selectedDate}T23:59:59Z`).toISOString();

        const { data: existingAppts } = await supabase
            .from('appointments')
            .select('scheduled_at, status')
            .eq('specialist_id', currentDoctorId)
            .gte('scheduled_at', startOfDay)
            .lte('scheduled_at', endOfDay)
            .not('status', 'in', '("cancelled","rejected")');

        if (existingAppts) {
            existingAppts.forEach(a => {
                const timeStr = new Date(a.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                bookedTimesOnDate.add(timeStr);
            });
        }
    }

    renderSlotsGrid(selectedDate);
}

function renderSlotsGrid(selectedDate) {
    const container = document.getElementById('slots-container');
    if (!container) return;

    const selectedSlotInput = document.getElementById('selected-slot-time');
    const submitBtn = document.getElementById('btn-confirm-booking');

    container.innerHTML = DEFAULT_SLOTS.map(timeStr => {
        const isBooked = bookedTimesOnDate.has(timeStr);
        if (isBooked) {
            return `
                <button type="button" disabled style="padding:8px 4px; border:1px solid var(--border-color); border-radius:8px; background:rgba(239,68,68,0.06); color:var(--text-tertiary); font-size:0.8rem; font-weight:700; cursor:not-allowed; text-decoration:line-through; font-family:monospace;">
                    ${timeStr} ✕
                </button>
            `;
        } else {
            return `
                <button type="button" class="slot-btn" data-time="${timeStr}" onclick="selectTimeSlot('${timeStr}', this)" style="padding:8px 4px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); color:var(--text-primary); font-size:0.84rem; font-weight:700; cursor:pointer; font-family:monospace; transition:all 0.15s;">
                    ${timeStr}
                </button>
            `;
        }
    }).join('');
}

window.selectTimeSlot = (timeStr, btnEl) => {
    document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.style.background = 'var(--surface-color)';
        btn.style.color = 'var(--text-primary)';
        btn.style.borderColor = 'var(--border-color)';
    });

    btnEl.style.background = 'var(--brand-accent)';
    btnEl.style.color = 'white';
    btnEl.style.borderColor = 'var(--brand-accent)';

    document.getElementById('selected-slot-time').value = timeStr;
    const submitBtn = document.getElementById('btn-confirm-booking');
    if (submitBtn) submitBtn.disabled = false;
};

async function handleBookingSubmit(e) {
    e.preventDefault();

    const feedbackBox = document.getElementById('book-feedback-box');
    const submitBtn = document.getElementById('btn-confirm-booking');
    const selectedDate = document.getElementById('book-date').value;
    const selectedTime = document.getElementById('selected-slot-time').value;
    const notes = document.getElementById('book-notes').value.trim();

    if (!selectedDate || !selectedTime) {
        showFeedback(feedbackBox, "يرجى اختيار اليوم والتوقيت المناسب من القائمة.", "error");
        return;
    }

    // Require Auth
    const session = await requireAuth();
    if (!session) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>جاري التحقق وتأكيد الحجز... ⏳</span>';

    const scheduledTimestamp = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

    // 1. Concurrency Double-Booking Protection Check
    const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('specialist_id', currentDoctorId)
        .eq('scheduled_at', scheduledTimestamp)
        .not('status', 'in', '("cancelled","rejected")')
        .limit(1);

    if (conflict && conflict.length > 0) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>تأكيد حجز الموعد 📅</span>';
        showFeedback(feedbackBox, "⚠️ عذراً، هذا التوقيت تم حجزه مسبقاً من قبل مريض آخر. يرجى اختيار موعد بديل.", "error");
        await loadSlotsForDate(selectedDate);
        return;
    }

    // 2. Insert Appointment
    const { data: newAppt, error: insertError } = await supabase
        .from('appointments')
        .insert({
            user_id: session.user.id,
            specialist_id: currentDoctorId,
            scheduled_at: scheduledTimestamp,
            duration_minutes: 30,
            status: 'pending',
            notes: notes
        })
        .select()
        .single();

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>تأكيد حجز الموعد 📅</span>';

    if (insertError) {
        console.error("Booking error:", insertError);
        showFeedback(feedbackBox, "تعذر إتمام الحجز: " + insertError.message, "error");
        return;
    }

    // 3. Dispatch In-App Notifications
    const patientName = session.user.user_metadata?.full_name || 'مريض';
    const doctorName = currentDoctorProfile?.full_name || 'الطبيب';
    const dateFormatted = `${selectedDate} الساعة ${selectedTime}`;

    // Notification to Specialist
    await createNotification(
        currentDoctorId,
        "طلب موعد طبي جديد 📅",
        `طلب المريض (${patientName}) موعداً معك بتاريخ ${dateFormatted}.`,
        "appointment",
        "specialist/calendar.html",
        "high"
    );

    // Notification to Patient
    await createNotification(
        session.user.id,
        "تم تسجيل طلب موعدك الطبي بنجاح ✅",
        `تم حجز موعد مبدئي مع د. ${doctorName} بتاريخ ${dateFormatted}. بانتظار التأكيد النهائي.`,
        "appointment",
        "dashboard.html",
        "normal"
    );

    showFeedback(feedbackBox, "🎉 تم حجز موعدك بنجاح! سيتم توجيهك إلى لوحة التحكم لمتابعة الحالة.", "success");
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1800);
}

function showFeedback(boxEl, message, type = 'success') {
    if (!boxEl) return;
    boxEl.style.display = 'block';
    if (type === 'error') {
        boxEl.style.background = 'rgba(239, 68, 68, 0.12)';
        boxEl.style.color = '#dc2626';
        boxEl.style.border = '1px solid rgba(239, 68, 68, 0.25)';
    } else {
        boxEl.style.background = 'rgba(16, 185, 129, 0.12)';
        boxEl.style.color = '#059669';
        boxEl.style.border = '1px solid rgba(16, 185, 129, 0.25)';
    }
    boxEl.innerText = message;
}

function showError(skeleton, errorBox) {
    if (skeleton) skeleton.style.display = 'none';
    if (errorBox) errorBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', init);
