// js/emr.js - Patient Electronic Medical Record (EMR) Engine
import { requireAuth, signOut } from './auth.js';
import { supabase } from './supabase.js';
import { setupNotificationWidget } from './notifications.js';

let currentUser = null;
let currentProfile = null;
let currentHealth = null;

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function calculateBmi(heightCm, weightKg) {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
    const heightM = heightCm / 100;
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);
    let label = 'وزن طبيعي';
    let color = '#10b981';

    if (bmi < 18.5) {
        label = 'نقص في الوزن';
        color = '#0284c7';
    } else if (bmi >= 25 && bmi < 30) {
        label = 'زيادة وزن';
        color = '#f59e0b';
    } else if (bmi >= 30) {
        label = 'سمنة';
        color = '#ef4444';
    }
    return { bmi, label, color };
}

window.switchTab = function(tabName, btnEl) {
    document.querySelectorAll('.emr-nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

    btnEl.classList.add('active');
    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) targetPane.style.display = 'block';
};

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    currentUser = session.user;
    document.getElementById('logout-btn')?.addEventListener('click', signOut);

    // Setup header notification widget
    setupNotificationWidget('user-notifications-container', currentUser.id);

    await loadEmrData();
});

async function loadEmrData() {
    try {
        // 1. Fetch Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        currentProfile = profile || {};

        // 2. Fetch Health Profile
        const { data: health } = await supabase
            .from('health_profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();
        currentHealth = health || {};

        // 3. Fetch Case File (or insert if missing)
        let caseFileId = null;
        let caseCreatedAt = null;
        let caseUpdatedAt = null;
        const { data: caseFile } = await supabase
            .from('case_files')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (caseFile) {
            caseFileId = caseFile.id;
            caseCreatedAt = caseFile.created_at;
            caseUpdatedAt = caseFile.updated_at;
        } else {
            const { data: newCase } = await supabase
                .from('case_files')
                .insert({ user_id: currentUser.id })
                .select()
                .maybeSingle();
            if (newCase) {
                caseFileId = newCase.id;
                caseCreatedAt = newCase.created_at;
                caseUpdatedAt = newCase.updated_at;
            }
        }

        // 4. Fetch Consultations
        const { data: consultations } = await supabase
            .from('consultations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        // 5. Fetch Appointments
        const { data: appointments } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('scheduled_at', { ascending: false });

        // 6. Fetch Public Case Notes
        let caseNotes = [];
        if (caseFileId) {
            const { data: notes } = await supabase
                .from('case_notes')
                .select('*')
                .eq('case_id', caseFileId)
                .eq('is_private', false)
                .order('created_at', { ascending: false });
            if (notes) caseNotes = notes;
        }

        // 7. Map Specialists
        const specialistIds = [...new Set([
            ...(consultations || []).map(c => c.specialist_id),
            ...(appointments || []).map(a => a.specialist_id),
            ...caseNotes.map(n => n.specialist_id)
        ].filter(Boolean))];

        let specialistsMap = {};
        if (specialistIds.length > 0) {
            const { data: specs } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .in('id', specialistIds);
            if (specs) {
                specs.forEach(s => specialistsMap[s.id] = s.full_name || 'طبيب استشاري');
            }
        }

        // Render Header & Vitals
        renderHeaderAndVitals(currentProfile, currentHealth, caseFileId, caseCreatedAt, caseUpdatedAt, (consultations?.length || 0) + (appointments?.length || 0));

        // Render Timeline
        renderClinicalTimeline(consultations || [], appointments || [], specialistsMap);

        // Render Prescriptions
        renderPrescriptions(caseNotes, consultations || [], specialistsMap);

        // Render Reports
        renderReports(consultations || [], specialistsMap);

    } catch (err) {
        console.error("Error loading EMR record:", err);
        const nameEl = document.getElementById('emr-patient-name');
        if (nameEl) nameEl.innerText = 'تعذر تحميل السجل الطبي';
    }
}

function renderHeaderAndVitals(profile, health, caseId, createdAt, updatedAt, encountersCount) {
    const fullName = profile.full_name || 'مريض غير مسجل';
    document.getElementById('emr-patient-name').innerText = fullName;
    document.getElementById('patient-avatar-badge').innerText = fullName.charAt(0);
    document.getElementById('emr-patient-email').innerText = profile.email || currentUser.email || '';
    document.getElementById('emr-patient-phone').innerText = profile.phone || 'غير مسجل';

    const bloodType = health.blood_type || 'غير محدد';
    document.getElementById('emr-blood-badge').innerText = `فصيلة: ${bloodType}`;

    const code = caseId ? `#EMR-${caseId.slice(0, 8).toUpperCase()}` : '#EMR-REG';
    document.getElementById('emr-record-code').innerText = code;
    document.getElementById('emr-created-date').innerText = formatArabicDate(createdAt || profile.created_at);
    document.getElementById('emr-updated-date').innerText = formatArabicDate(updatedAt || health.updated_at || new Date().toISOString());

    // Vitals
    document.getElementById('vital-height').innerText = health.height || '--';
    document.getElementById('vital-weight').innerText = health.weight || '--';
    document.getElementById('vital-encounters-count').innerText = encountersCount;

    const bmiInfo = calculateBmi(health.height, health.weight);
    if (bmiInfo) {
        document.getElementById('vital-bmi').innerText = bmiInfo.bmi;
        const labelEl = document.getElementById('vital-bmi-label');
        labelEl.innerText = `(${bmiInfo.label})`;
        labelEl.style.color = bmiInfo.color;
    } else {
        document.getElementById('vital-bmi').innerText = '--';
        document.getElementById('vital-bmi-label').innerText = '';
    }

    // Allergies Alert
    if (health.allergies && health.allergies.trim()) {
        const box = document.getElementById('emr-allergies-box');
        document.getElementById('emr-allergies-text').innerText = health.allergies;
        box.style.display = 'flex';
    }

    // Medications & Chronic Diseases
    const medsText = [];
    if (health.medications && health.medications.trim()) medsText.push(`<strong>الأدوية الحالية:</strong> ${escapeHtml(health.medications)}`);
    if (health.chronic_diseases && health.chronic_diseases.trim()) medsText.push(`<strong>التاريخ المرضي والأمراض المزمنة:</strong> ${escapeHtml(health.chronic_diseases)}`);
    if (health.vaccinations && health.vaccinations.trim()) medsText.push(`<strong>التطعيمات:</strong> ${escapeHtml(health.vaccinations)}`);

    if (medsText.length > 0) {
        const box = document.getElementById('emr-meds-box');
        document.getElementById('emr-meds-text').innerHTML = medsText.join('<br>');
        box.style.display = 'block';
    }
}

function renderClinicalTimeline(consultations, appointments, specsMap) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // Merge into single timeline
    const timeline = [];

    consultations.forEach(c => {
        timeline.push({
            type: 'consultation',
            timestamp: new Date(c.created_at).getTime(),
            date: c.created_at,
            doctorName: c.specialist_id ? specsMap[c.specialist_id] || 'طبيب استشاري' : 'قيد التعيين',
            title: `استشارة طبية (${c.specialty === 'psychology' ? 'صحة نفسية' : c.specialty === 'nutrition' ? 'تغذية علاجية' : 'عامة'})`,
            status: c.status,
            details: c.description || 'طلب استشارة طبية عن بعد.'
        });
    });

    appointments.forEach(a => {
        timeline.push({
            type: 'appointment',
            timestamp: new Date(a.scheduled_at).getTime(),
            date: a.scheduled_at,
            doctorName: specsMap[a.specialist_id] || 'طبيب مختص',
            title: `موعد كشف عيادي مباشر`,
            status: a.status,
            details: a.notes ? `ملاحظات الموعد: ${a.notes}` : `مدة الموعد: ${a.duration_minutes || 30} دقيقة.`
        });
    });

    timeline.sort((a, b) => b.timestamp - a.timestamp);

    if (timeline.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">📂</div>
                <div style="font-weight: 700; margin-bottom: 4px;">لا توجد زيارات أو استشارات مسجلة بالسجل بعد</div>
                <p style="font-size: 0.85rem; margin: 0;">ستظهر كافة المواعيد والاستشارات الطبية هنا بتسلسل زمني دقيق.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = timeline.map(item => {
        const isConsult = item.type === 'consultation';
        const icon = isConsult ? '🩺' : '📅';
        const dateStr = formatArabicDateTime(item.date);

        let badgeStyle = 'background: rgba(2, 132, 199, 0.12); color: #0284c7;';
        let statusLabel = item.status;
        if (item.status === 'completed') {
            badgeStyle = 'background: rgba(16, 185, 129, 0.12); color: #059669;';
            statusLabel = 'مكتمل بنجاح';
        } else if (item.status === 'confirmed') {
            badgeStyle = 'background: rgba(16, 185, 129, 0.12); color: #059669;';
            statusLabel = 'موعد مؤكد';
        } else if (item.status === 'cancelled') {
            badgeStyle = 'background: rgba(239, 68, 68, 0.12); color: #dc2626;';
            statusLabel = 'ملغى';
        }

        return `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:4px;">
                    <div>
                        <strong style="color:var(--text-primary); font-size:1rem;">${icon} ${item.title}</strong>
                        <span style="margin-right:8px; color:#0284c7; font-size:0.85rem; font-weight:700;">مع د. ${escapeHtml(item.doctorName)}</span>
                    </div>
                    <span style="padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; ${badgeStyle}">
                        ${statusLabel}
                    </span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:6px;">🕒 ${dateStr}</div>
                <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.6;">${escapeHtml(item.details)}</p>
            </div>
        `;
    }).join('');
}

function renderPrescriptions(notes, consultations, specsMap) {
    const container = document.getElementById('prescriptions-container');
    if (!container) return;

    const list = [];

    // From Case Notes
    notes.forEach(n => {
        if (n.note_type === 'prescription' || n.note_type === 'treatment_plan') {
            list.push({
                id: n.id,
                doctorName: specsMap[n.specialist_id] || 'طبيب مختص',
                date: n.created_at,
                type: n.note_type === 'prescription' ? '💊 وصفة علاجية دوائية' : '📋 خطة علاجية وتأهيلية',
                diagnosis: n.diagnosis,
                medications: Array.isArray(n.medications) ? n.medications : [],
                content: n.content
            });
        }
    });

    // From Consultations
    consultations.forEach(c => {
        if (c.prescription && c.prescription.trim()) {
            list.push({
                id: c.id,
                doctorName: c.specialist_id ? specsMap[c.specialist_id] || 'طبيب استشاري' : 'طبيب استشاري',
                date: c.updated_at || c.created_at,
                type: '💊 وصفة طبية (جلسة استشارة)',
                diagnosis: null,
                medications: Array.isArray(c.structured_prescription) ? c.structured_prescription : [],
                content: c.prescription
            });
        }
    });

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">💊</div>
                <div style="font-weight: 700; margin-bottom: 4px;">لا توجد وصفات علاجية مدونة بعد</div>
                <p style="font-size: 0.85rem; margin: 0;">تظهر هنا الوصفات والخطط العلاجية الصادرة من الأطباء المعتمدين.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(item => `
        <div class="prescription-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <strong style="color:#059669; font-size:0.95rem;">${item.type}</strong>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">🕒 ${formatArabicDateTime(item.date)}</span>
                    <a href="print_document.html?type=prescription&id=${encodeURIComponent(item.id)}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; padding:4px 10px; border-radius:8px; text-decoration:none;">
                        🖨️ طباعة الوصفة (A4 / PDF)
                    </a>
                </div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-primary); font-weight:700; margin-bottom:6px;">
                الطبيب المعالج: د. ${escapeHtml(item.doctorName)}
            </div>
            ${item.diagnosis ? `
                <div style="font-size:0.85rem; color:#0284c7; font-weight:700; margin-bottom:6px;">
                    🔬 التشخيص المعتمد: <span style="color:var(--text-primary); font-weight:500;">${escapeHtml(item.diagnosis)}</span>
                </div>
            ` : ''}
            ${item.medications && item.medications.length > 0 ? `
                <div style="margin:8px 0; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:10px; padding:8px 12px; overflow-x:auto;">
                    <div style="font-weight:700; font-size:0.82rem; margin-bottom:6px; color:#059669;">الأدوية المعتمدة والجرعات:</div>
                    <table style="width:100%; font-size:0.82rem; text-align:right; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-secondary);">
                                <th style="padding:4px 6px;">اسم الدواء</th>
                                <th style="padding:4px 6px;">الجرعة</th>
                                <th style="padding:4px 6px;">التكرار</th>
                                <th style="padding:4px 6px;">المدة</th>
                                <th style="padding:4px 6px;">إرشادات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${item.medications.map(m => `
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
            <div style="background:var(--bg-secondary); padding:10px 14px; border-radius:12px; font-size:0.9rem; color:var(--text-primary); line-height:1.7; white-space:pre-wrap;">
                ${escapeHtml(item.content)}
            </div>
        </div>
    `).join('');
}

function renderReports(consultations, specsMap) {
    const container = document.getElementById('reports-container');
    if (!container) return;

    const reports = [];

    consultations.forEach(c => {
        if (c.report && c.report.trim()) {
            reports.push({
                id: c.id,
                title: `تقرير استشارة #${c.id.slice(0, 8).toUpperCase()}`,
                doctorName: c.specialist_id ? specsMap[c.specialist_id] || 'طبيب استشاري' : 'طبيب استشاري',
                date: c.updated_at || c.created_at,
                content: c.report,
                attachments: c.attachments || []
            });
        }
    });

    if (reports.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">📋</div>
                <div style="font-weight: 700; margin-bottom: 4px;">لا توجد تقارير طبية رسمية بعد</div>
                <p style="font-size: 0.85rem; margin: 0;">يتم إدراج التقارير الطبية الرسمية هنا فور اعتمادها من قبل الأطباء المشرفين.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = reports.map(r => `
        <div class="card" style="margin-bottom:1rem; border-radius:16px; border:1px solid var(--border-color); padding:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <strong style="color:var(--brand-accent); font-size:1rem;">📄 ${escapeHtml(r.title)}</strong>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">🕒 ${formatArabicDateTime(r.date)}</span>
                    <a href="print_document.html?type=report&id=${encodeURIComponent(r.id)}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; padding:4px 10px; border-radius:8px; text-decoration:none;">
                        🖨️ طباعة التقرير (A4 / PDF)
                    </a>
                </div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">
                مُعَد بواسطة: <strong>د. ${escapeHtml(r.doctorName)}</strong>
            </div>
            <div style="background:var(--bg-secondary); padding:12px; border-radius:12px; font-size:0.9rem; line-height:1.7; color:var(--text-primary); margin-bottom:8px; white-space:pre-wrap;">
                ${escapeHtml(r.content)}
            </div>
            ${r.attachments && r.attachments.length > 0 ? `
                <div style="margin-top:8px; font-size:0.85rem;">
                    <strong>المرفقات:</strong>
                    <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
                        ${r.attachments.map(att => `
                            <a href="${escapeHtml(att.url || '#')}" target="_blank" style="padding:4px 10px; border-radius:8px; background:rgba(2,132,199,0.1); color:#0284c7; font-weight:700; font-size:0.8rem; text-decoration:none;">
                                📎 ${escapeHtml(att.name || 'مستند طبي')}
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

window.openPrintSummary = function() {
    if (!currentUser || !currentUser.id) return;
    window.open(`print_document.html?type=summary&id=${encodeURIComponent(currentUser.id)}`, '_blank');
};
