// consultations.js - Specialist Consultation Workflow Engine with Strict Scoping & Realtime
import { supabase } from '../supabase.js';
import { showToast } from '../toast.js';

let currentUser = null;
let consultations = [];
let realtimeChannel = null;
let currentScope = 'assigned'; // 'assigned' (default), 'unassigned', 'all'
let currentSearchTerm = '';

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }
    
    currentUser = session.user;

    // Attach search listener
    document.getElementById('sp-cons-search')?.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();
        renderBoard();
    });
    
    // Add initial loading state
    const cols = ['pending', 'accepted', 'inprogress', 'completed'];
    cols.forEach(col => {
        const el = document.getElementById(`col-${col}`);
        if(el) el.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.5;">جاري التحميل...</div>';
    });

    await loadConsultations();
    setupRealtime();
    
    // Check if ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const cId = urlParams.get('id');
    if (cId) openModal(cId);
}

window.setConsultationsScope = (scope) => {
    currentScope = scope;
    ['assigned', 'unassigned', 'all'].forEach(s => {
        const btn = document.getElementById(`btn-tab-${s}`);
        if (btn) {
            if (s === scope) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
    renderBoard();
};

window.refreshConsultations = async () => {
    showToast('جاري تحديث الاستشارات...', 'info', 1500);
    await loadConsultations();
};

async function loadConsultations() {
    // Doctors access consultations assigned to them OR unassigned pending ones
    const { data, error } = await supabase.from('consultations')
        .select('*')
        .or(`specialist_id.eq.${currentUser.id},specialist_id.is.null,status.eq.pending`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading consultations:", error);
        showToast("فشل تحميل الاستشارات: " + error.message, "error");
        return;
    }

    const rawData = data || [];
    const userIds = [...new Set(rawData.map(d => d.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p.full_name);
    }

    consultations = rawData.map(c => ({
        ...c,
        patient_name: profilesMap[c.user_id] || 'مريض جديد'
    }));

    renderBoard();
}

function renderBoard() {
    const cols = {
        pending: document.getElementById('col-pending'),
        accepted: document.getElementById('col-accepted'),
        inprogress: document.getElementById('col-inprogress'),
        completed: document.getElementById('col-completed')
    };

    if (!cols.pending) return;

    Object.values(cols).forEach(col => col.innerHTML = '');

    let counts = { pending: 0, accepted: 0, inprogress: 0, completed: 0 };

    // Apply Scope & Search Filters
    const filteredConsultations = consultations.filter(c => {
        // Scope filter:
        if (currentScope === 'assigned') {
            // Strictly assigned to this specialist
            if (c.specialist_id !== currentUser.id) return false;
        } else if (currentScope === 'unassigned') {
            // Pending requests that are not yet assigned
            if (c.specialist_id || c.status !== 'pending') return false;
        }

        // Search text
        if (currentSearchTerm) {
            const matchCode = c.id && c.id.toLowerCase().includes(currentSearchTerm);
            const matchName = c.patient_name && c.patient_name.toLowerCase().includes(currentSearchTerm);
            const matchDesc = c.description && c.description.toLowerCase().includes(currentSearchTerm);
            if (!matchCode && !matchName && !matchDesc) return false;
        }

        return true;
    });

    filteredConsultations.forEach(c => {
        let statusKey = c.status;
        if (statusKey === 'in_progress') statusKey = 'inprogress';
        if (!cols[statusKey]) statusKey = 'pending';

        counts[statusKey]++;

        const card = document.createElement('div');
        card.className = 'consult-card';
        card.onclick = () => openModal(c.id);

        let statusBadge = '';
        if (statusKey === 'pending') statusBadge = '<span style="background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">انتظار</span>';
        if (statusKey === 'accepted') statusBadge = '<span style="background: rgba(16, 185, 129, 0.15); color: #047857; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">مقبولة</span>';
        if (statusKey === 'inprogress') statusBadge = '<span style="background: rgba(2, 132, 199, 0.15); color: var(--specialist-primary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">جارية 🟢</span>';
        if (statusKey === 'completed') statusBadge = '<span style="background: rgba(100, 116, 139, 0.15); color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">مكتملة</span>';

        const rawDate = new Date(c.created_at);
        const formattedDate = rawDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        const formattedTime = rawDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const isUrgent = c.priority === 'urgent' || c.is_urgent;

        const specDisplay = c.specialty === 'psychology' ? 'صحة نفسية' : (c.specialty === 'nutrition' ? 'تغذية' : 'طب عام');
        const isMyAssigned = c.specialist_id === currentUser.id;

        card.innerHTML = `
            <div class="cc-header">
                <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="cc-id">#${c.id.substring(0,6).toUpperCase()}</span>
                            ${isUrgent ? '<span style="background: rgba(239, 68, 68, 0.15); color: #dc2626; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 800;">عاجل 🚨</span>' : ''}
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem; color:var(--specialist-primary); font-weight:700;">${specDisplay}</span>
                        ${isMyAssigned ? '<span style="font-size:0.72rem; color:#047857; font-weight:bold;">مسندة إليك ✅</span>' : '<span style="font-size:0.72rem; color:#d97706;">شاغرة ⚠️</span>'}
                    </div>
                </div>
            </div>
            
            <div class="cc-patient" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:var(--text-secondary);">${(c.patient_name || 'م').charAt(0)}</div>
                ${c.patient_name}
            </div>
            
            <div class="cc-desc" style="margin-top:6px;">${c.description || 'لا توجد تفاصيل للحالة.'}</div>
            
            <div class="cc-footer">
                <div class="cc-date">
                    <span>📅 ${formattedDate}</span>
                    <span style="margin:0 4px;color:var(--border-color);">|</span>
                    <span>⏰ ${formattedTime}</span>
                </div>
            </div>
        `;
        cols[statusKey].appendChild(card);
    });

    // Update Counts
    document.getElementById('cnt-pending').innerText = counts.pending;
    document.getElementById('cnt-accepted').innerText = counts.accepted;
    document.getElementById('cnt-inprogress').innerText = counts.inprogress;
    document.getElementById('cnt-completed').innerText = counts.completed;

    // Empty States with clear messages
    Object.keys(cols).forEach(key => {
        if(counts[key] === 0) {
            const scopeLabel = currentScope === 'assigned' ? 'مسندة إليك' : (currentScope === 'unassigned' ? 'شاغرة' : '');
            cols[key].innerHTML = `
                <div style="text-align:center; padding:3rem 1rem; color:var(--text-secondary); opacity:0.6; display:flex; flex-direction:column; align-items:center;">
                    <div style="font-size:2.5rem; margin-bottom:10px;">📭</div>
                    <div style="font-size:0.9rem;">لا توجد طلبات ${scopeLabel} هنا</div>
                </div>
            `;
        }
    });
}

function setupRealtime() {
    if(realtimeChannel) {
        realtimeChannel.unsubscribe();
    }
    
    realtimeChannel = supabase.channel('specialist_consultations_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, payload => {
            if (payload.eventType === 'INSERT') {
                showToast('طلب استشارة جديد وصل للمنظومة!', 'info');
                loadConsultations();
            } else if (payload.eventType === 'UPDATE') {
                if (payload.new.specialist_id === currentUser.id || !payload.new.specialist_id || payload.new.status === 'pending') {
                    loadConsultations();
                }
            }
        })
        .subscribe();
}

window.openModal = (id) => {
    const c = consultations.find(item => item.id === id);
    if (!c) return;

    document.getElementById('mod-id').innerText = '#' + c.id.substring(0,8).toUpperCase();
    const patientEl = document.getElementById('mod-patient');
    if (patientEl) patientEl.innerText = c.patient_name;
    const dateEl = document.getElementById('mod-date');
    if (dateEl) dateEl.innerText = new Date(c.created_at).toLocaleString('ar-EG');
    const priorEl = document.getElementById('mod-priority');
    if (priorEl) priorEl.innerHTML = (c.priority === 'urgent' || c.is_urgent) ? '<span style="color:#dc2626; font-weight:bold;">عاجل 🚨</span>' : 'عادي';
    const descEl = document.getElementById('mod-desc');
    if (descEl) descEl.innerText = c.description || 'لا يوجد وصف مضاف.';

    const actions = document.getElementById('mod-actions');
    if(actions) {
        actions.innerHTML = '';

        if (c.status === 'pending') {
            actions.innerHTML = `
                <button class="btn btn-primary" onclick="updateStatus('${c.id}', 'accepted')">قبول الاستشارة وتعيينها لي</button>
                <button class="btn btn-outline" style="border-color:#ef4444; color:#ef4444;" onclick="updateStatus('${c.id}', 'cancelled')">اعتذار عن الحالة</button>
            `;
        } else if (c.status === 'accepted') {
            actions.innerHTML = `
                <button class="btn btn-primary" onclick="updateStatus('${c.id}', 'in_progress')">بدء الجلسة الحية الآن 🟢</button>
                <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
            `;
        } else if (c.status === 'in_progress') {
            actions.innerHTML = `
                <a href="live_session.html?id=${c.id}" class="btn btn-primary">دخول غرف المحادثة والمكالمة 💬📹</a>
                <button class="btn btn-outline" onclick="updateStatus('${c.id}', 'completed')">إنهاء وإغلاق الاستشارة ✅</button>
            `;
        } else {
            let printActions = '';
            if (c.report) {
                printActions += `<a href="../print_document.html?type=report&id=${c.id}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">🖨️ طباعة التقرير</a>`;
            }
            if (c.prescription) {
                printActions += `<a href="../print_document.html?type=prescription&id=${c.id}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">🖨️ طباعة الوصفة</a>`;
            }
            actions.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; gap:6px;">${printActions}</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="color:var(--success-color); font-weight:bold;">الاستشارة مكتملة / مغلقة ✅</span>
                        <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
                    </div>
                </div>
            `;
        }
    }

    document.getElementById('req-modal').style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('req-modal').style.display = 'none';
};

window.updateStatus = async (id, newStatus) => {
    showToast('جاري التحديث...', 'info', 1000);
    const payload = { 
        status: newStatus,
        updated_at: new Date().toISOString()
    };
    if (newStatus === 'accepted') {
        payload.specialist_id = currentUser.id;
    }
    const { error } = await supabase.from('consultations').update(payload).eq('id', id);
    if (error) {
        showToast("حدث خطأ أثناء تحديث الحالة: " + error.message, 'error');
    } else {
        showToast('تم تحديث حالة الاستشارة بنجاح ✅', 'success');
        closeModal();
        await loadConsultations();
        if (newStatus === 'in_progress') {
            window.location.href = `live_session.html?id=${id}`;
        }
    }
};

document.addEventListener('DOMContentLoaded', init);
