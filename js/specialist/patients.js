import { supabase } from '../supabase.js';
import { showToast } from '../toast.js';
import { createNotification } from '../notifications.js';
import { canAccessSpecialistPortal, normalizeRole } from '../roles.js';

let currentUser = null;
let patientRecords = {};
let patientRecordsList = [];
let activePatientUid = null;
let activeCaseFileId = null;

const statusLabels = {
    pending: 'قيد الانتظار',
    accepted: 'مقبولة',
    in_progress: 'جارية',
    completed: 'مكتملة',
    cancelled: 'ملغاة'
};

const statusClasses = {
    pending: 'status-pending',
    accepted: 'status-accepted',
    in_progress: 'status-inprogress',
    completed: 'status-completed',
    cancelled: 'status-cancelled'
};

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getAvatarColor(name = '') {
    const colors = [
        { bg: 'rgba(2, 132, 199, 0.12)', text: '#0284c7', border: 'rgba(2, 132, 199, 0.25)' },
        { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
        { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.25)' },
        { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.25)' },
        { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.25)' }
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

function formatArabicDate(dateStr) {
    if (!dateStr) return 'غير محدد';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function formatArabicDateTime(dateStr) {
    if (!dateStr) return 'غير محدد';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function getSpecialtyBadge(specialty) {
    if (!specialty) return { label: 'استشارة عامة', className: 'spec-general' };
    if (specialty === 'psychology') return { label: 'صحة نفسية', className: 'spec-psychology' };
    if (specialty === 'nutrition') return { label: 'تغذية علاجية', className: 'spec-nutrition' };
    return { label: specialty, className: 'spec-general' };
}

function setTableState(title, description = '', icon = '📂', actionHtml = '') {
    const tbody = document.getElementById('patients-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="table-state">
                <div class="table-state-content">
                    <span class="table-state-icon" aria-hidden="true">${icon}</span>
                    <h3 class="table-state-title">${title}</h3>
                    ${description ? `<p class="table-state-desc">${description}</p>` : ''}
                    ${actionHtml ? `<div class="table-state-action">${actionHtml}</div>` : ''}
                </div>
            </td>
        </tr>`;
}

function getStatusMeta(status) {
    const normalizedStatus = status || 'pending';
    return {
        label: statusLabels[normalizedStatus] || normalizedStatus,
        className: statusClasses[normalizedStatus] || 'status-pending'
    };
}

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile || !canAccessSpecialistPortal(normalizeRole(profile.role))) {
        showToast("هذه الصفحة مخصصة للمختصين فقط.", 'error');
        setTimeout(() => window.location.href = '../index.html', 1500);
        return;
    }
    currentUser = profile;

    // Safe profile display if present in page
    const spNameEl = document.getElementById('sp-name');
    if (spNameEl) spNameEl.innerText = profile.full_name || 'طبيب استشاري';
    const spAvatarEl = document.getElementById('sp-avatar');
    if (spAvatarEl && profile.avatar_url) spAvatarEl.src = profile.avatar_url;

    // Search and filter listeners
    const searchInput = document.getElementById('patients-search');
    searchInput?.addEventListener('input', () => renderPatients());

    const statusFilter = document.getElementById('patients-status-filter');
    statusFilter?.addEventListener('change', () => {
        syncQuickChips(statusFilter.value);
        renderPatients();
    });

    // Quick filter chips click handling
    const chipsContainer = document.getElementById('patients-quick-chips');
    if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.chip-btn');
            if (!btn) return;
            const status = btn.getAttribute('data-status') || 'all';
            if (statusFilter) statusFilter.value = status;
            syncQuickChips(status);
            renderPatients();
        });
    }

    // Modal backdrop click to close
    const modal = document.getElementById('emr-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeEmrModal();
        });
    }

    // Escape key to close modal
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeEmrModal();
    });

    await loadPatients();
}

function syncQuickChips(activeStatus) {
    const chips = document.querySelectorAll('#patients-quick-chips .chip-btn');
    chips.forEach(chip => {
        const status = chip.getAttribute('data-status');
        if (status === activeStatus) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

async function loadPatients() {
    setTableState(
        'جاري تحميل البيانات...',
        'يتم استرجاع سجلات المرضى والجلسات السريرية الخاصة بك بأمان.',
        '<div class="table-spinner"></div>'
    );

    const { data, error } = await supabase.from('consultations')
        .select('*')
        .eq('specialist_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading patient records:', error);
        patientRecords = {};
        patientRecordsList = [];
        updateDashboardStats(0, 0, 0, 0);
        setTableState(
            'تعذر تحميل سجل المرضى',
            'حدث خطأ في الاتصال بالخادم. لم يتم تحميل أية بيانات غير مكتملة.',
            '⚠️',
            '<button type="button" class="btn btn-outline btn-sm" onclick="window.retryLoadPatients()">إعادة المحاولة 🔄</button>'
        );
        showToast('تعذر تحميل سجل المرضى. حاول مرة أخرى.', 'error');
        return;
    }

    if (!data || data.length === 0) {
        patientRecords = {};
        patientRecordsList = [];
        updateDashboardStats(0, 0, 0, 0);
        setTableState(
            'لا يوجد مرضى مسجلون بعد',
            'ستظهر سجلات المرضى وملفاتهم السريرية هنا تلقائياً بعد استلام وجدولة استشارات جديدة.',
            '🩺'
        );
        return;
    }

    const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds);
        if (profs) profs.forEach(p => profilesMap[p.id] = p);
    }

    patientRecords = {};
    data.forEach(c => {
        const uId = c.user_id;
        if (!patientRecords[uId]) {
            patientRecords[uId] = {
                profile: profilesMap[uId] || { full_name: 'مريض جديد', email: '' },
                consultations: []
            };
        }
        patientRecords[uId].consultations.push(c);
    });

    patientRecordsList = Object.keys(patientRecords).map(uId => ({ uId, ...patientRecords[uId] }));

    // Calculate metrics for Dashboard Cards
    const totalPatients = patientRecordsList.length;
    const totalConsultations = data.length;
    const activeCases = patientRecordsList.filter(p => 
        p.consultations.some(c => c.status === 'in_progress' || c.status === 'accepted')
    ).length;
    const completedCases = patientRecordsList.filter(p => 
        p.consultations.some(c => c.status === 'completed')
    ).length;

    updateDashboardStats(totalPatients, totalConsultations, activeCases, completedCases);
    renderPatients();
}

function updateDashboardStats(totalPatients, totalConsultations, activeCases, completedCases) {
    const elPatients = document.getElementById('patients-total');
    if (elPatients) elPatients.innerText = totalPatients;

    const elConsults = document.getElementById('stat-consults-total');
    if (elConsults) elConsults.innerText = totalConsultations;

    const elActive = document.getElementById('stat-active-total');
    if (elActive) elActive.innerText = activeCases;

    const elCompleted = document.getElementById('stat-completed-total');
    if (elCompleted) elCompleted.innerText = completedCases;
}

function renderPatients() {
    const tbody = document.getElementById('patients-tbody');
    if (!tbody) return;

    const query = (document.getElementById('patients-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('patients-status-filter')?.value || 'all';

    const filteredRecords = patientRecordsList.filter(record => {
        const name = (record.profile.full_name || 'مريض').toLowerCase();
        const email = (record.profile.email || '').toLowerCase();
        const lastConsultation = record.consultations[0];
        const matchesQuery = !query || name.includes(query) || email.includes(query);
        const matchesStatus = statusFilter === 'all' || lastConsultation.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    if (filteredRecords.length === 0) {
        if (patientRecordsList.length === 0) {
            setTableState(
                'لا يوجد مرضى مسجلون بعد',
                'ستظهر سجلات المرضى هنا بعد إجراء استشارات طبية معهم.',
                '🩺'
            );
        } else {
            setTableState(
                'لم يتم العثور على نتائج مطابقة',
                'جرّب تعديل عبارة البحث أو اختيار حالة أخرى من الفلاتر.',
                '🔍',
                '<button type="button" class="btn btn-outline btn-sm" onclick="window.resetPatientsFilters()">إعادة ضبط البحث والفلاتر</button>'
            );
        }
        return;
    }

    tbody.innerHTML = filteredRecords.map(p => {
        const uId = p.uId;
        const lastConsultation = p.consultations[0];
        const specMeta = getSpecialtyBadge(lastConsultation.specialty);
        const statusMeta = getStatusMeta(lastConsultation.status);
        const patientName = p.profile.full_name || 'مريض';
        const patientEmail = p.profile.email || '';
        const avatarColor = getAvatarColor(patientName);
        const consultCount = p.consultations.length;
        const consultWord = consultCount === 1 ? 'استشارة' : (consultCount === 2 ? 'استشارتان' : (consultCount <= 10 ? 'استشارات' : 'استشارة'));

        return `
            <tr class="patient-table-row">
                <td>
                    <div class="patient-name-cell">
                        <span class="patient-avatar" style="background:${avatarColor.bg}; color:${avatarColor.text}; border:1px solid ${avatarColor.border};">
                            ${escapeHtml(patientName.charAt(0))}
                        </span>
                        <div class="patient-details">
                            <strong class="patient-name">${escapeHtml(patientName)}</strong>
                            ${patientEmail 
                                ? `<small class="patient-meta" title="${escapeHtml(patientEmail)}">${escapeHtml(patientEmail)}</small>` 
                                : `<small class="patient-meta patient-meta-empty">ملف مريض محمي</small>`
                            }
                        </div>
                    </div>
                </td>
                <td>
                    <span class="patient-count">
                        <span class="patient-count-num">${consultCount}</span>
                        <span class="patient-count-label">${consultWord}</span>
                    </span>
                </td>
                <td class="patient-date-cell">
                    <div class="patient-date">
                        <span class="patient-date-icon" aria-hidden="true">📅</span>
                        <span>${formatArabicDate(lastConsultation.created_at)}</span>
                    </div>
                </td>
                <td>
                    <span class="specialty-badge ${specMeta.className}">
                        ${escapeHtml(specMeta.label)}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${statusMeta.className}">
                        <span class="status-dot-indicator"></span>
                        ${escapeHtml(statusMeta.label)}
                    </span>
                </td>
                <td class="patient-action-cell">
                    <button type="button" class="btn btn-primary patient-action" onclick="openEmrRecord('${escapeHtml(uId)}')" title="عرض السجل الطبي وتاريخ الاستشارات">
                        <span class="patient-action-icon">📂</span>
                        <span>فتح السجل الطبي</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.retryLoadPatients = () => {
    loadPatients();
};

window.resetPatientsFilters = () => {
    const searchInput = document.getElementById('patients-search');
    const statusFilter = document.getElementById('patients-status-filter');
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    syncQuickChips('all');
    renderPatients();
};

window.openEmrRecord = async (uId) => {
    activePatientUid = uId;
    const record = patientRecords[uId];
    if (!record) return;

    const patientName = record.profile.full_name || 'مريض';
    const patientEmail = record.profile.email || '';
    const avatarColor = getAvatarColor(patientName);

    // Populate modal patient header
    const nameEl = document.getElementById('emr-patient-name');
    if (nameEl) nameEl.innerText = patientName;

    const emailEl = document.getElementById('emr-patient-email');
    if (emailEl) emailEl.innerText = patientEmail || 'لا يوجد بريد إلكتروني مسجل';

    const avatarEl = document.getElementById('emr-patient-avatar');
    if (avatarEl) {
        avatarEl.innerText = patientName.charAt(0);
        avatarEl.style.background = avatarColor.bg;
        avatarEl.style.color = avatarColor.text;
        avatarEl.style.border = `1px solid ${avatarColor.border}`;
    }

    const consultsCountEl = document.getElementById('emr-patient-consults-count');
    if (consultsCountEl) consultsCountEl.innerText = record.consultations.length;

    const lastVisitEl = document.getElementById('emr-patient-last-date');
    if (lastVisitEl && record.consultations[0]) {
        lastVisitEl.innerText = formatArabicDate(record.consultations[0].created_at);
    }

    // Populate consultation select in Add Note tab
    const consultSelect = document.getElementById('emr-note-consultation-select');
    if (consultSelect) {
        consultSelect.innerHTML = '<option value="">سجل عام للمريض</option>' +
            record.consultations.map(c => `
                <option value="${c.id}">جلسة #${c.id.substring(0,8).toUpperCase()} - ${getSpecialtyBadge(c.specialty).label} (${formatArabicDate(c.created_at)})</option>
            `).join('');
    }

    // Fetch Health Profile & Baseline Vitals
    try {
        const { data: health } = await supabase
            .from('health_profiles')
            .select('*')
            .eq('user_id', uId)
            .maybeSingle();

        const bloodEl = document.getElementById('emr-patient-blood');
        const vitalsEl = document.getElementById('emr-patient-vitals');
        const allergiesBanner = document.getElementById('emr-modal-allergies-banner');
        const allergiesVal = document.getElementById('emr-modal-allergies-val');
        const medsBanner = document.getElementById('emr-modal-meds-banner');
        const medsVal = document.getElementById('emr-modal-meds-val');

        if (health) {
            if (bloodEl) bloodEl.innerText = health.blood_type ? `فصيلة: ${health.blood_type}` : 'غير محدد';
            
            let vitalsStr = '';
            if (health.height) vitalsStr += `${health.height} سم`;
            if (health.weight) vitalsStr += ` / ${health.weight} كغ`;
            if (health.height && health.weight && health.height > 0) {
                const heightM = health.height / 100;
                const bmi = (health.weight / (heightM * heightM)).toFixed(1);
                vitalsStr += ` (BMI: ${bmi})`;
            }
            if (vitalsEl) vitalsEl.innerText = vitalsStr || 'لم تسجل قياسات بعد';

            // Allergies
            if (health.allergies && health.allergies.trim()) {
                if (allergiesVal) allergiesVal.innerText = health.allergies;
                if (allergiesBanner) allergiesBanner.style.display = 'block';
            } else {
                if (allergiesBanner) allergiesBanner.style.display = 'none';
            }

            // Current Meds & Chronic
            let medsDetails = [];
            if (health.medications && health.medications.trim()) medsDetails.push(`الأدوية: ${health.medications}`);
            if (health.chronic_diseases && health.chronic_diseases.trim()) medsDetails.push(`الأمراض المزمنة: ${health.chronic_diseases}`);
            if (medsDetails.length > 0) {
                if (medsVal) medsVal.innerText = medsDetails.join(' | ');
                if (medsBanner) medsBanner.style.display = 'block';
            } else {
                if (medsBanner) medsBanner.style.display = 'none';
            }
        } else {
            if (bloodEl) bloodEl.innerText = 'غير محدد';
            if (vitalsEl) vitalsEl.innerText = 'لم تسجل قياسات بعد';
            if (allergiesBanner) allergiesBanner.style.display = 'none';
            if (medsBanner) medsBanner.style.display = 'none';
        }
    } catch (err) {
        console.error("Error loading health profile:", err);
    }

    // Reset to first tab
    switchEmrTab('history');

    // 1. History Tab
    const historyList = document.getElementById('emr-history-list');
    if (historyList) {
        if (record.consultations.length === 0) {
            historyList.innerHTML = `
                <div class="emr-empty-box">
                    <span class="emr-empty-icon">📂</span>
                    <h4>لا توجد استشارات مسجلة</h4>
                    <p>لم يتم تسجيل أي استشارات سابقة لهذا المريض.</p>
                </div>`;
        } else {
            historyList.innerHTML = record.consultations.map(c => {
                const statusMeta = getStatusMeta(c.status);
                const specMeta = getSpecialtyBadge(c.specialty);
                const shortId = c.id ? c.id.substring(0, 8).toUpperCase() : '---';
                const descText = c.description || c.notes || c.report || 'لا يوجد تفاصيل أو تقرير مضاف لهذه الجلسة.';

                return `
                    <div class="emr-card">
                        <div class="emr-card-header">
                            <div class="emr-card-id-block">
                                <span class="emr-session-code">جلسة #${escapeHtml(shortId)}</span>
                                <span class="specialty-badge ${specMeta.className}">${escapeHtml(specMeta.label)}</span>
                            </div>
                            <div class="emr-card-meta-block">
                                <span class="status-badge ${statusMeta.className}">
                                    <span class="status-dot-indicator"></span>
                                    ${escapeHtml(statusMeta.label)}
                                </span>
                                <span class="emr-date-badge">🕒 ${formatArabicDateTime(c.created_at)}</span>
                            </div>
                        </div>
                        <div class="emr-card-body">
                            <div class="emr-card-title">ملاحظات وشكوى المريض / التقرير:</div>
                            <p class="emr-card-text">${escapeHtml(descText)}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 2. Clinical Notes Tab
    const notesList = document.getElementById('emr-notes-list');
    if (notesList) {
        notesList.innerHTML = `
            <div class="emr-loading-box">
                <div class="table-spinner"></div>
                <span>جاري تحميل الملاحظات السريرية...</span>
            </div>`;

        try {
            const { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', uId).maybeSingle();
            if (caseFile) {
                const { data: notes } = await supabase.from('case_notes')
                    .select('*')
                    .eq('case_id', caseFile.id)
                    .order('created_at', { ascending: false });

                if (notes && notes.length > 0) {
                    notesList.innerHTML = notes.map(n => `
                        <div class="emr-card note-card">
                            <div class="emr-card-header">
                                <span class="emr-note-author">🩺 ملاحظة سريرية</span>
                                <span class="emr-date-badge">🕒 ${formatArabicDateTime(n.created_at)}</span>
                            </div>
                            <div class="emr-card-body">
                                <p class="emr-card-text">${escapeHtml(n.content || '')}</p>
                            </div>
                        </div>
                    `).join('');
                } else {
                    notesList.innerHTML = `
                        <div class="emr-empty-box">
                            <span class="emr-empty-icon">📝</span>
                            <h4>لا توجد ملاحظات سريرية سابقة</h4>
                            <p>لم يتم تدوين ملاحظات سريرية لهذا المريض حتى الآن.</p>
                        </div>`;
                }
            } else {
                notesList.innerHTML = `
                    <div class="emr-empty-box">
                        <span class="emr-empty-icon">📝</span>
                        <h4>لا توجد ملاحظات سريرية سابقة</h4>
                        <p>لم يتم تدوين ملاحظات سريرية لهذا المريض حتى الآن.</p>
                    </div>`;
            }
        } catch (err) {
            console.error("Error loading clinical notes:", err);
            notesList.innerHTML = `
                <div class="emr-empty-box">
                    <span class="emr-empty-icon">⚠️</span>
                    <h4>تعذر تحميل الملاحظات السريرية</h4>
                    <p>حدث خطأ أثناء الاتصال. يرجى المحاولة لاحقاً.</p>
                </div>`;
        }
    }

    // 3. Prescriptions and Reports Tab
    const prescList = document.getElementById('emr-prescriptions-list');
    if (prescList) {
        const consultsWithPresc = record.consultations.filter(c => c.prescription || c.report);
        if (consultsWithPresc.length > 0) {
            prescList.innerHTML = consultsWithPresc.map(c => {
                const shortId = c.id ? c.id.substring(0, 8).toUpperCase() : '---';
                return `
                    <div class="emr-card prescription-card">
                        <div class="emr-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div class="emr-card-id-block">
                                <span class="emr-session-code">وصفة / تقرير جلسة #${escapeHtml(shortId)}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="emr-date-badge">🕒 ${formatArabicDateTime(c.created_at)}</span>
                                ${c.report ? `
                                    <button type="button" class="btn btn-outline btn-sm" onclick="window.openPrintDocument('report', '${c.id}')" style="padding:3px 8px; font-size:0.78rem; border-radius:6px;">
                                        🖨️ طباعة التقرير
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="emr-card-body">
                            ${c.prescription ? `
                                <div class="emr-field-block">
                                    <strong>💊 الوصفة الطبية والعلاج:</strong>
                                    <p class="emr-card-text">${escapeHtml(c.prescription)}</p>
                                </div>
                            ` : ''}
                            ${c.report ? `
                                <div class="emr-field-block">
                                    <strong>📋 التقرير الطبي:</strong>
                                    <p class="emr-card-text">${escapeHtml(c.report)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            prescList.innerHTML = `
                <div class="emr-empty-box">
                    <span class="emr-empty-icon">💊</span>
                    <h4>لا توجد وصفات أو تقارير مدونة</h4>
                    <p>لم يتم تسجيل وصفات علاجية أو تقارير رسمية لهذا المريض حتى الآن.</p>
                </div>`;
        }
    }

    // Ensure case_files exists and load notes
    try {
        let { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', uId).maybeSingle();
        if (!caseFile) {
            const { data: newCase } = await supabase.from('case_files').insert({ user_id: uId }).select().maybeSingle();
            caseFile = newCase;
        }
        activeCaseFileId = caseFile?.id || null;
        if (activeCaseFileId) {
            await loadClinicalNotesList(activeCaseFileId);
        }
    } catch (err) {
        console.error("Error ensuring case file:", err);
    }

    const modalEl = document.getElementById('emr-modal');
    if (modalEl) {
        modalEl.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

async function loadClinicalNotesList(caseFileId) {
    const notesList = document.getElementById('emr-notes-list');
    if (!notesList) return;

    notesList.innerHTML = `
        <div class="emr-loading-box">
            <div class="table-spinner"></div>
            <span>جاري تحميل الملاحظات السريرية...</span>
        </div>`;

    try {
        const { data: notes, error } = await supabase.from('case_notes')
            .select('*')
            .eq('case_id', caseFileId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (notes && notes.length > 0) {
            notesList.innerHTML = notes.map(n => {
                let typeBadge = '🩺 ملاحظة سريرية';
                if (n.note_type === 'diagnosis') typeBadge = '🔬 تشخيص سريري';
                else if (n.note_type === 'prescription') typeBadge = '💊 وصفة علاجية';
                else if (n.note_type === 'treatment_plan') typeBadge = '📋 خطة علاجية';

                const meds = Array.isArray(n.medications) ? n.medications : [];

                return `
                    <div class="emr-card note-card" style="margin-bottom:12px; padding:1.25rem; border-radius:14px; background:var(--surface-color); border:1px solid var(--border-color);">
                        <div class="emr-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="color:var(--specialist-primary); font-size:0.95rem;">${typeBadge}</strong>
                                <span style="font-size:0.75rem; padding:2px 8px; border-radius:999px; ${n.is_private ? 'background:rgba(239,68,68,0.1); color:#dc2626;' : 'background:rgba(16,185,129,0.1); color:#059669;'}">
                                    ${n.is_private ? '🔒 سري للطاقم الطبي' : '👁️ متاح للمريض'}
                                </span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="emr-date-badge" style="font-size:0.8rem; color:var(--text-secondary);">🕒 ${formatArabicDateTime(n.created_at)}</span>
                                ${n.note_type === 'prescription' ? `
                                    <button type="button" class="btn btn-outline btn-sm" onclick="window.openPrintDocument('prescription', '${n.id}')" style="padding:2px 8px; font-size:0.78rem; border-radius:6px; color:var(--specialist-primary);">
                                        🖨️ طباعة الوصفة (A4 / PDF)
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        ${n.diagnosis ? `
                            <div style="margin-bottom:8px; font-size:0.86rem; color:#0284c7; font-weight:700;">
                                🔬 التشخيص السريري: <span style="color:var(--text-primary); font-weight:500;">${escapeHtml(n.diagnosis)}</span>
                            </div>
                        ` : ''}

                        ${meds.length > 0 ? `
                            <div style="margin:8px 0; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow-x:auto;">
                                <div style="font-weight:700; font-size:0.82rem; margin-bottom:6px; color:var(--specialist-primary);">الأدوية الموصوفة والجرعات:</div>
                                <table style="width:100%; font-size:0.8rem; text-align:right; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary);">
                                            <th style="padding:4px 6px;">الدواء</th>
                                            <th style="padding:4px 6px;">الجرعة</th>
                                            <th style="padding:4px 6px;">التكرار</th>
                                            <th style="padding:4px 6px;">المدة</th>
                                            <th style="padding:4px 6px;">إرشادات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${meds.map(m => `
                                            <tr style="border-bottom:1px solid var(--border-color);">
                                                <td style="padding:4px 6px; font-weight:700;">${escapeHtml(m.name || '')}</td>
                                                <td style="padding:4px 6px;">${escapeHtml(m.dosage || '-')}</td>
                                                <td style="padding:4px 6px;">${escapeHtml(m.frequency || '-')}</td>
                                                <td style="padding:4px 6px;">${escapeHtml(m.duration || '-')}</td>
                                                <td style="padding:4px 6px; font-size:0.75rem;">${escapeHtml(m.instructions || '-')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        <div class="emr-card-body">
                            <p class="emr-card-text" style="white-space:pre-wrap; line-height:1.7; margin:0; font-size:0.9rem; color:var(--text-primary);">${escapeHtml(n.content || '')}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            notesList.innerHTML = `
                <div class="emr-empty-box">
                    <span class="emr-empty-icon">📝</span>
                    <h4>لا توجد ملاحظات سريرية سابقة</h4>
                    <p>لم يتم تدوين ملاحظات سريرية لهذا المريض حتى الآن. يمكنك إضافة تدوين من التبويب أعلاه.</p>
                </div>`;
        }
    } catch (err) {
        console.error("Error loading clinical notes:", err);
        notesList.innerHTML = `
            <div class="emr-empty-box">
                <span class="emr-empty-icon">⚠️</span>
                <h4>تعذر تحميل الملاحظات السريرية</h4>
                <p>حدث خطأ أثناء الاتصال. يرجى المحاولة لاحقاً.</p>
            </div>`;
    }
}

window.handleNoteTypeChange = function(type) {
    const medsBox = document.getElementById('emr-structured-meds-box');
    if (medsBox) {
        if (type === 'prescription') {
            medsBox.style.display = 'block';
            const container = document.getElementById('emr-meds-rows-container');
            if (container && container.children.length === 0) {
                window.addMedicationRow();
            }
        } else {
            medsBox.style.display = 'none';
        }
    }
};

window.addMedicationRow = function() {
    const container = document.getElementById('emr-meds-rows-container');
    if (!container) return;
    const rowId = 'med-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const row = document.createElement('div');
    row.className = 'med-entry-row';
    row.id = rowId;
    row.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr auto; gap:6px; align-items:center; background:var(--bg-secondary); padding:8px; border-radius:8px; border:1px solid var(--border-color);';
    row.innerHTML = `
        <input type="text" class="med-input-name" placeholder="اسم الدواء (مثل: Amoxicillin)" required style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="med-input-dosage" placeholder="الجرعة (500mg)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="med-input-freq" placeholder="التكرار (كل 8 ساعات)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="med-input-dur" placeholder="المدة (7 أيام)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="med-input-instructions" placeholder="إرشادات (بعد الطعام)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <button type="button" onclick="window.removeMedicationRow('${rowId}')" title="حذف الدواء" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:0.85rem;">🗑️</button>
    `;
    container.appendChild(row);
};

window.removeMedicationRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
};

window.openPrintDocument = function(type, id) {
    if (!id) {
        showToast('معرف المستند غير متوفر للطباعة', 'error');
        return;
    }
    window.open(`../print_document.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, '_blank');
};

window.printCurrentPatientSummary = function() {
    if (!activePatientUid) {
        showToast('يرجى تحديد مريض لطباعة الملخص الطبي', 'error');
        return;
    }
    window.openPrintDocument('summary', activePatientUid);
};

window.saveClinicalNote = async function(e) {
    e.preventDefault();
    if (!activePatientUid || !activeCaseFileId) {
        showToast('تعذر العثور على ملف المريض.', 'error');
        return;
    }

    const noteType = document.getElementById('emr-note-type-select').value;
    const consultationId = document.getElementById('emr-note-consultation-select').value || null;
    const diagnosis = document.getElementById('emr-note-diagnosis-input')?.value.trim() || null;
    const content = document.getElementById('emr-note-content-input').value.trim();
    const isPatientVisible = document.getElementById('emr-note-is-patient-visible').checked;
    const saveBtn = document.getElementById('btn-save-clinical-note');

    if (!content) {
        showToast('يرجى كتابة محتوى التدوين أو الوصفة الطبية.', 'error');
        return;
    }

    let structuredMeds = [];
    if (noteType === 'prescription') {
        const rowEls = document.querySelectorAll('#emr-meds-rows-container .med-entry-row');
        rowEls.forEach(row => {
            const name = row.querySelector('.med-input-name')?.value.trim();
            const dosage = row.querySelector('.med-input-dosage')?.value.trim();
            const frequency = row.querySelector('.med-input-freq')?.value.trim();
            const duration = row.querySelector('.med-input-dur')?.value.trim();
            const instructions = row.querySelector('.med-input-instructions')?.value.trim();
            if (name) {
                structuredMeds.push({ name, dosage, frequency, duration, instructions });
            }
        });
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ في السجل... ⏳';

    try {
        const { error } = await supabase.from('case_notes').insert({
            case_id: activeCaseFileId,
            specialist_id: currentUser.id,
            consultation_id: consultationId,
            note_type: noteType,
            content: content,
            diagnosis: diagnosis,
            medications: structuredMeds,
            status: 'active',
            instructions: content,
            is_private: !isPatientVisible
        });

        if (error) throw error;

        // If prescription and associated with a consultation, also update consultations.prescription and structured_prescription
        if (noteType === 'prescription' && consultationId) {
            await supabase.from('consultations').update({
                prescription: content,
                structured_prescription: structuredMeds,
                updated_at: new Date().toISOString()
            }).eq('id', consultationId);
        }

        // Send notification to patient if visible
        if (isPatientVisible) {
            const docName = currentUser.full_name || 'الطبيب المشرف';
            const notifTitle = noteType === 'prescription' ? 'وصفة علاجية جديدة 💊' : 'تدوين سريري جديد في ملفك الطبي 📋';
            const notifMsg = `أضاف د. ${docName} تدوينًا جديداً في ملفك الطبي. يمكنك مراجعته الآن في سجلك الطبي (EMR).`;
            
            await createNotification(
                activePatientUid,
                notifTitle,
                notifMsg,
                'medical_record',
                'emr.html'
            );
        }

        showToast('تم حفظ التدوين السريري في السجل الطبي بنجاح! ✅', 'success');
        document.getElementById('emr-note-content-input').value = '';
        if (document.getElementById('emr-note-diagnosis-input')) {
            document.getElementById('emr-note-diagnosis-input').value = '';
        }
        const medsRows = document.getElementById('emr-meds-rows-container');
        if (medsRows) medsRows.innerHTML = '';

        // Refresh notes list and switch to notes tab
        await loadClinicalNotesList(activeCaseFileId);
        switchEmrTab('notes');
    } catch (err) {
        console.error("Error saving clinical note:", err);
        showToast('تعذر حفظ الملاحظة: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ في السجل الطبي 💾';
    }
};

window.closeEmrModal = () => {
    const modalEl = document.getElementById('emr-modal');
    if (modalEl) modalEl.style.display = 'none';
    document.body.style.overflow = '';
};

window.switchEmrTab = (tabName, el) => {
    const tabs = document.querySelectorAll('.emr-tab');
    const contents = document.querySelectorAll('.emr-content');

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.style.display = 'none');

    const activeTab = el || document.querySelector(`.emr-tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active');

    const activeContent = document.getElementById(`emr-tab-${tabName}`);
    if (activeContent) activeContent.style.display = 'block';
};

document.addEventListener('DOMContentLoaded', init);
