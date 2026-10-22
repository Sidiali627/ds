import { supabase } from '../supabase.js';
import { showToast } from '../toast.js';
import { canAccessSpecialistPortal, normalizeRole, ROLE_GROUPS } from '../roles.js';

let currentUser = null;
let notifCount = 0;

function playChimeSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.warn("Audio chime play blocked by browser policy:", e);
    }
}

async function checkAuth() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }
    
    // Step 1: Fetch Profile safely without nested relation join
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

    // Step 2: Fetch Specialist Profile safely
    let spData = null;
    if (profile) {
        const { data: sp } = await supabase.from('specialist_profiles').select('*').eq('id', session.user.id).maybeSingle();
        spData = sp;
        profile.specialist_profiles = spData;
    }
    
    const role = normalizeRole(profile?.role || 'user');

    console.log("=== Specialist Dashboard Auth Verification ===");
    console.log("Current User ID:", session.user.id);
    console.log("Email:", session.user.email);
    console.log("Profile Loaded:", profile);
    console.log("Specialist Extra Profile:", spData);
    console.log("Profile Error:", error);
    console.log("Current Role:", role);
    console.log("Allowed Roles:", ROLE_GROUPS.specialistPortal);

    if (error || !profile) {
        console.error("Specialist Auth Error: Failed to fetch profile from Supabase.", error);
        showToast(`تعذر قراءة بيانات الملف الشخصي من Supabase: ${error?.message || 'الملف غير موجود'}`, 'error');
        setTimeout(() => window.location.href = '../login.html', 1500);
        return;
    }

    if (!canAccessSpecialistPortal(role)) {
        console.error(`Specialist Auth Error: Access Denied. User role [${role}] is not in allowed specialist roles.`, ROLE_GROUPS.specialistPortal);
        showToast(`هذه البوابة مخصصة للمختصين فقط. دورك المسجل حالياً في Supabase هو: [${role}]`, 'error');
        setTimeout(() => window.location.href = '../index.html', 1500);
        return;
    }
    
    currentUser = profile;
    
    const welcomeEl = document.getElementById('welcome-name');
    if (welcomeEl) welcomeEl.innerText = profile.full_name || 'طبيب استشاري';
    const spNameEl = document.getElementById('sp-name');
    if (spNameEl) spNameEl.innerText = profile.full_name || 'طبيب استشاري';
    const spAvatarEl = document.getElementById('sp-avatar');
    if (spAvatarEl && profile.avatar_url) spAvatarEl.src = profile.avatar_url;
    
    const specTitle = profile.specialist_profiles?.specialty || (role === 'doctor' ? 'طبيب بشرى' : (role === 'psychologist' ? 'أخصائي نفسي' : (role === 'nutritionist' ? 'أخصائي تغذية' : 'أخصائي معتمد')));
    const spSpecEl = document.getElementById('sp-specialty');
    if (spSpecEl) spSpecEl.innerText = specTitle;
}

async function loadDashboardStats() {
    if(!currentUser) return;
    const uid = currentUser.id;
    
    // Add loading state
    document.getElementById('stat-new').innerHTML = '<span style="opacity:0.5; font-size:1rem;">...</span>';
    document.getElementById('stat-active').innerHTML = '<span style="opacity:0.5; font-size:1rem;">...</span>';
    document.getElementById('stat-appointments').innerHTML = '<span style="opacity:0.5; font-size:1rem;">...</span>';
    document.getElementById('stat-rating').innerHTML = '<span style="opacity:0.5; font-size:1rem;">...</span>';
    
    // 1. Pending Consultation Requests
    const { count: newCount } = await supabase.from('consultations')
        .select('*', { count: 'exact', head: true })
        .or(`specialist_id.eq.${uid},specialist_id.is.null,status.eq.pending`)
        .eq('status', 'pending');
        
    // 2. Active Live Sessions
    const { count: activeCount } = await supabase.from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('specialist_id', uid)
        .eq('status', 'in_progress');
        
    // 3. Today's Appointments
    const today = new Date().toISOString().split('T')[0];
    const { count: apptCount } = await supabase.from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('specialist_id', uid)
        .gte('scheduled_at', `${today}T00:00:00Z`)
        .lte('scheduled_at', `${today}T23:59:59Z`);

    // 4. Real Rating from Reviews table
    const { data: reviews } = await supabase.from('reviews').select('rating').eq('specialist_id', uid);
    let avgRating = 5.0;
    if (reviews && reviews.length > 0) {
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        avgRating = (sum / reviews.length).toFixed(1);
    }

    document.getElementById('stat-new').innerText = newCount || 0;
    document.getElementById('stat-active').innerText = activeCount || 0;
    document.getElementById('stat-appointments').innerText = apptCount || 0;
    document.getElementById('stat-rating').innerText = `${avgRating} ⭐`;

    await loadRecentRequests();
    await loadReviews();
}

async function loadRecentRequests() {
    const { data, error } = await supabase.from('consultations')
        .select('*')
        .or(`specialist_id.eq.${currentUser.id},specialist_id.is.null,status.eq.pending`)
        .order('created_at', { ascending: false })
        .limit(10);

    const tbody = document.getElementById('recent-tbody');
    if(error || !data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:3rem; color:var(--text-secondary);">
                    <div style="font-size:3rem; margin-bottom:1rem; opacity:0.5;">📭</div>
                    <div style="font-size:1.1rem; font-weight:bold;">لا توجد طلبات استشارات حالياً</div>
                    <p style="font-size:0.9rem; margin-top:0.5rem;">بمجرد أن يحجز مريض جديد استشارة ستظهر هنا فوراً.</p>
                </td>
            </tr>`;
        return;
    }

    const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p.full_name);
    }

    tbody.innerHTML = data.map(req => {
        let badgeClass = 'status-pending';
        let statusAr = 'قيد الانتظار';
        if(req.status === 'accepted') { badgeClass = 'status-accepted'; statusAr = 'مقبول'; }
        if(req.status === 'in_progress') { badgeClass = 'status-inprogress'; statusAr = 'جلسة جارية الآن 🟢'; }
        if(req.status === 'completed') { badgeClass = 'status-accepted'; statusAr = 'مكتملة ✅'; }

        const specDisplay = req.specialty === 'psychology' ? 'صحة نفسية' : (req.specialty === 'nutrition' ? 'تغذية' : (req.specialty || 'استشارة عامة'));
        const patientName = profilesMap[req.user_id] || 'مريض جديد';

        return `
            <tr>
                <td>#${req.id.substring(0,6).toUpperCase()}</td>
                <td><strong>${patientName}</strong></td>
                <td>${specDisplay}</td>
                <td>${new Date(req.created_at).toLocaleDateString('ar-EG')}</td>
                <td><span class="status-badge ${badgeClass}">${statusAr}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        ${req.status === 'pending' ? `<button class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="acceptRequest('${req.id}')">قبول الطلب</button>` : ''}
                        ${req.status === 'in_progress' ? `<a href="live_session.html?id=${req.id}" class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem;">دخول الجلسة الحية</a>` : ''}
                        <a href="consultations.html?id=${req.id}" class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem;">التفاصيل</a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadReviews() {
    const list = document.getElementById('reviews-list');
    const { data, error } = await supabase.from('reviews')
        .select('*')
        .eq('specialist_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data || data.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-secondary);">
                <div style="font-size:2rem; margin-bottom:0.5rem; opacity:0.5;">⭐</div>
                <div>لا توجد تقييمات مسجلة حتى الآن من المرضى.</div>
            </div>`;
        return;
    }

    const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p.full_name);
    }

    list.innerHTML = data.map(r => `
        <div class="review-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong>${profilesMap[r.user_id] || 'مريض'}</strong>
                <span style="color:#f59e0b;">${'⭐'.repeat(r.rating)} (${r.rating}/5)</span>
            </div>
            <p style="font-size:0.88rem; color:var(--text-primary); margin:0;">${r.comment || 'لا يوجد تعليق مضاف.'}</p>
            <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; display:block;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
        </div>
    `).join('');
}

window.acceptRequest = async (id) => {
    const { error } = await supabase.from('consultations').update({ status: 'accepted', specialist_id: currentUser.id }).eq('id', id);
    if (!error) {
        showToast('تم قبول طلب الاستشارة بنجاح.', 'success');
        await loadDashboardStats();
    } else {
        showToast('حدث خطأ أثناء قبول الطلب: ' + error.message, 'error');
    }
};

function setupRealtimeNotifications() {
    supabase.channel('specialist_dashboard_notifs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'consultations' }, payload => {
            playChimeSound();
            notifCount++;
            const notifEl = document.getElementById('notif-count');
            if (notifEl) notifEl.innerText = notifCount;
            loadDashboardStats();
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboardStats();
    setupRealtimeNotifications();

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
});
