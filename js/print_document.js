// js/print_document.js - Secure Printable Medical Documents Engine
import { requireAuth } from './auth.js';
import { supabase } from './supabase.js';

let currentUser = null;

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
            month: 'long',
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

function showDocError(title, msg) {
    document.getElementById('doc-loading-state').style.display = 'none';
    document.getElementById('doc-error-state').style.display = 'block';
    if (title) document.getElementById('doc-error-title').innerText = title;
    if (msg) document.getElementById('doc-error-msg').innerText = msg;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    currentUser = session.user;

    const urlParams = new URLSearchParams(window.location.search);
    const docType = urlParams.get('type') || 'prescription';
    const docId = urlParams.get('id');

    if (!docId) {
        showDocError('رقم المستند غير محدد', 'يرجى تزويد معرف المستند المطلوب للاطلاع على البيانات.');
        return;
    }

    try {
        if (docType === 'prescription') {
            await renderPrescriptionDoc(docId);
        } else if (docType === 'report') {
            await renderReportDoc(docId);
        } else if (docType === 'summary') {
            await renderSummaryDoc(docId);
        } else {
            showDocError('نوع المستند غير معروف', 'النوع المطلوب غير مدعوم في النظام.');
        }
    } catch (err) {
        console.error("Error loading printable document:", err);
        showDocError('خطأ أثناء معالجة المستند', 'تعذر استرجاع بيانات المستند المطلوب.');
    }
});

/**
 * 1. Render Official Prescription Document
 */
async function renderPrescriptionDoc(noteId) {
    // Fetch case note
    const { data: note, error: noteErr } = await supabase
        .from('case_notes')
        .select(`
            *,
            case_files!inner(id, user_id)
        `)
        .eq('id', noteId)
        .single();

    if (noteErr || !note) {
        showDocError('الوصفة الطبية غير موجودة', 'تعذر العثور على الوصفة الطبية المطلوبة أو تم حذفها.');
        return;
    }

    const patientId = note.case_files?.user_id;

    // Authorization check: User is patient OR user is author doctor OR admin
    const isPatient = patientId === currentUser.id;
    const isDoctor = note.specialist_id === currentUser.id;

    // Check if user is admin
    let isAdmin = false;
    const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    if (myProfile && (myProfile.role === 'admin' || myProfile.role === 'super_admin')) {
        isAdmin = true;
    }

    if (!isPatient && !isDoctor && !isAdmin) {
        // Check if doctor has active encounter with this patient
        const { data: treatsPatient } = await supabase.from('consultations')
            .select('id')
            .eq('user_id', patientId)
            .eq('specialist_id', currentUser.id)
            .limit(1);

        if (!treatsPatient || treatsPatient.length === 0) {
            showDocError('غير مصرح بالوصول', 'لا تملك الصلاحية السريرية للاطلاع على هذه الوصفة الطبية.');
            return;
        }
    }

    // Fetch Doctor and Patient Profiles
    const [{ data: doctorProf }, { data: patientProf }, { data: patientHealth }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', note.specialist_id).single(),
        supabase.from('profiles').select('*').eq('id', patientId).single(),
        supabase.from('health_profiles').select('*').eq('user_id', patientId).maybeSingle()
    ]);

    // Fetch Doctor specialty if available
    const { data: specData } = await supabase.from('specialist_profiles').select('specialty').eq('id', note.specialist_id).maybeSingle();

    // Setup Header & Parties Info
    const docName = doctorProf?.full_name || 'طبيب استشاري معتمد';
    const patientName = patientProf?.full_name || 'مريض';
    const specialty = specData?.specialty || 'استشاري عام';
    const rxCode = `#RX-${note.id.substring(0, 8).toUpperCase()}`;

    document.getElementById('top-doc-title').innerText = `الوصفة الطبية الرسمية (${rxCode})`;
    document.getElementById('doc-badge-code').innerText = rxCode;
    document.getElementById('doc-badge-date').innerText = `تاريخ الإصدار: ${formatArabicDate(note.created_at)}`;
    
    const statusText = note.status === 'completed' ? 'منتهية' : (note.status === 'cancelled' ? 'ملغاة' : 'سارية ومفعلة');
    const statusColor = note.status === 'cancelled' ? '#dc2626' : '#059669';
    document.getElementById('doc-badge-status').innerHTML = `<span style="color:${statusColor}; font-weight:800; font-size:0.8rem;">الحالة: ${statusText}</span>`;

    document.getElementById('doc-doctor-name').innerText = `د. ${docName}`;
    document.getElementById('doc-doctor-spec').innerText = specialty;
    document.getElementById('doc-signature-name').innerText = `د. ${docName}`;

    document.getElementById('doc-patient-name').innerText = patientName;
    document.getElementById('doc-patient-blood').innerText = patientHealth?.blood_type || 'غير مسجل';
    document.getElementById('doc-patient-emr-code').innerText = `#EMR-${note.case_id.substring(0, 8).toUpperCase()}`;
    document.getElementById('doc-timestamp-now').innerText = formatArabicDateTime(new Date().toISOString());

    // Build Clinical Content: Structured Medications
    const container = document.getElementById('dynamic-clinical-container');
    let medsHtml = '';

    const medsList = Array.isArray(note.medications) ? note.medications : [];

    if (medsList.length > 0) {
        medsHtml = `
            <table class="doc-table">
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th>اسم الدواء العلمي / التجاري</th>
                        <th>الجرعة (Dosage)</th>
                        <th>التكرار (Frequency)</th>
                        <th>المدة (Duration)</th>
                        <th>إرشادات الاستخدام</th>
                    </tr>
                </thead>
                <tbody>
                    ${medsList.map((m, idx) => `
                        <tr>
                            <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                            <td style="font-weight:700; color:#0f172a;">${escapeHtml(m.name || 'دواء')}</td>
                            <td>${escapeHtml(m.dosage || '-')}</td>
                            <td>${escapeHtml(m.frequency || '-')}</td>
                            <td>${escapeHtml(m.duration || '-')}</td>
                            <td style="font-size:0.85rem;">${escapeHtml(m.instructions || 'وفق إرشادات الطبيب')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin:0; font-size:1.35rem; color:#0284c7; font-weight:800;">💊 وصفة طبية علاجية معتمدة</h3>
            <p style="margin:4px 0 0; color:#64748b; font-size:0.85rem;">Clinical Prescription Dossier</p>
        </div>

        ${note.diagnosis ? `
            <div class="clinical-section-box">
                <h4 class="clinical-section-title">🔬 التشخيص السريري المعتمد:</h4>
                <p class="clinical-section-body">${escapeHtml(note.diagnosis)}</p>
            </div>
        ` : ''}

        <div style="margin-bottom:1.5rem;">
            <h4 style="margin:0 0 8px; font-size:1rem; font-weight:800; color:#0f172a;">الأدوية الموصوفة والجرعات العلاجية:</h4>
            ${medsHtml}
        </div>

        ${note.content && note.content.trim() ? `
            <div class="clinical-section-box">
                <h4 class="clinical-section-title">📝 تعليمات وإرشادات الطبيب المشرف:</h4>
                <p class="clinical-section-body">${escapeHtml(note.content)}</p>
            </div>
        ` : ''}

        ${patientHealth?.allergies ? `
            <div style="background:rgba(239, 68, 68, 0.06); border:1px solid rgba(239, 68, 68, 0.2); border-radius:8px; padding:10px 14px; margin-top:1rem; font-size:0.85rem; color:#dc2626;">
                ⚠️ <strong>تنبيه الحساسية المسجلة للمريض:</strong> ${escapeHtml(patientHealth.allergies)}
            </div>
        ` : ''}
    `;

    document.getElementById('doc-loading-state').style.display = 'none';
    document.getElementById('doc-content-body').style.display = 'block';
}

/**
 * 2. Render Official Consultation Report Document
 */
async function renderReportDoc(consultationId) {
    const { data: c, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', consultationId)
        .single();

    if (error || !c) {
        showDocError('التقرير الطبي غير متوفر', 'تعذر العثور على تقرير الاستشارة الطبية المطلوبة.');
        return;
    }

    // Authorization Check
    const isPatient = c.user_id === currentUser.id;
    const isDoctor = c.specialist_id === currentUser.id;

    let isAdmin = false;
    const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    if (myProfile && (myProfile.role === 'admin' || myProfile.role === 'super_admin')) {
        isAdmin = true;
    }

    if (!isPatient && !isDoctor && !isAdmin) {
        showDocError('غير مصرح بالوصول', 'لا تملك الصلاحية السريرية للاطلاع على هذا التقرير الطبي.');
        return;
    }

    // Fetch Doctor and Patient details
    const [{ data: docProf }, { data: patientProf }, { data: patientHealth }] = await Promise.all([
        c.specialist_id ? supabase.from('profiles').select('*').eq('id', c.specialist_id).single() : Promise.resolve({ data: null }),
        supabase.from('profiles').select('*').eq('id', c.user_id).single(),
        supabase.from('health_profiles').select('*').eq('user_id', c.user_id).maybeSingle()
    ]);

    const docName = docProf?.full_name || 'طبيب استشاري معتمد';
    const patientName = patientProf?.full_name || 'مريض';
    const repCode = `#REP-${c.id.substring(0, 8).toUpperCase()}`;

    document.getElementById('top-doc-title').innerText = `تقرير استشارة طبية (${repCode})`;
    document.getElementById('doc-badge-code').innerText = repCode;
    document.getElementById('doc-badge-date').innerText = `تاريخ التقرير: ${formatArabicDate(c.updated_at || c.created_at)}`;
    document.getElementById('doc-badge-status').innerHTML = `<span style="color:#0284c7; font-weight:800; font-size:0.8rem;">الحالة: ${c.status === 'completed' ? 'معتمد ومغلق ✅' : 'قيد المعالجة'}</span>`;

    document.getElementById('doc-doctor-name').innerText = `د. ${docName}`;
    document.getElementById('doc-doctor-spec').innerText = c.specialty === 'psychology' ? 'صحة نفسية' : (c.specialty === 'nutrition' ? 'تغذية علاجية' : 'استشارات عامة');
    document.getElementById('doc-signature-name').innerText = `د. ${docName}`;

    document.getElementById('doc-patient-name').innerText = patientName;
    document.getElementById('doc-patient-blood').innerText = patientHealth?.blood_type || 'غير مسجل';
    document.getElementById('doc-patient-emr-code').innerText = `#EMR-${c.user_id.substring(0, 8).toUpperCase()}`;
    document.getElementById('doc-timestamp-now').innerText = formatArabicDateTime(new Date().toISOString());

    const container = document.getElementById('dynamic-clinical-container');
    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin:0; font-size:1.35rem; color:#0284c7; font-weight:800;">📋 تقرير استشارة طبية سريرية</h3>
            <p style="margin:4px 0 0; color:#64748b; font-size:0.85rem;">Consultation Medical Report</p>
        </div>

        <div class="clinical-section-box">
            <h4 class="clinical-section-title">🩺 شكوى المريض والأعراض المقدمة:</h4>
            <p class="clinical-section-body">${escapeHtml(c.description || 'لم يتم تدوين وصف إضافي.')}</p>
        </div>

        <div class="clinical-section-box">
            <h4 class="clinical-section-title">🔬 التقرير الطبي السريري المعتمد:</h4>
            <p class="clinical-section-body" style="font-weight:600;">${escapeHtml(c.report || 'التقرير الطبي قيد الاعتماد من قبل الطبيب المشرف.')}</p>
        </div>

        ${c.prescription ? `
            <div class="clinical-section-box" style="border-right: 4px solid #10b981;">
                <h4 class="clinical-section-title">💊 الخطة العلاجية والتوصيات الصادرة:</h4>
                <p class="clinical-section-body">${escapeHtml(c.prescription)}</p>
            </div>
        ` : ''}

        ${c.attachments && c.attachments.length > 0 ? `
            <div style="margin-top:1rem; font-size:0.85rem;">
                <strong>المرفقات والمستندات السريرية المرفقة بالتقرير:</strong>
                <ul style="margin:6px 1.5rem 0 0; color:#64748b;">
                    ${c.attachments.map(att => `<li>${escapeHtml(att.name || 'مستند')}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;

    document.getElementById('doc-loading-state').style.display = 'none';
    document.getElementById('doc-content-body').style.display = 'block';
}

/**
 * 3. Render Patient Medical Dossier Summary
 */
async function renderSummaryDoc(patientId) {
    // Authorization Check: user must be the patient OR a doctor treating the patient OR admin
    const isPatient = patientId === currentUser.id;
    let isAdmin = false;
    const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    if (myProfile && (myProfile.role === 'admin' || myProfile.role === 'super_admin')) {
        isAdmin = true;
    }

    if (!isPatient && !isAdmin) {
        const { data: treatsPatient } = await supabase.from('consultations')
            .select('id')
            .eq('user_id', patientId)
            .eq('specialist_id', currentUser.id)
            .limit(1);

        if (!treatsPatient || treatsPatient.length === 0) {
            showDocError('غير مصرح بالوصول', 'لا تملك الصلاحية السريرية للاطلاع على هذا الملخص الطبي.');
            return;
        }
    }

    const [{ data: patientProf }, { data: patientHealth }, { data: consults }, { data: appts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', patientId).single(),
        supabase.from('health_profiles').select('*').eq('user_id', patientId).maybeSingle(),
        supabase.from('consultations').select('*').eq('user_id', patientId).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').eq('user_id', patientId).order('scheduled_at', { ascending: false })
    ]);

    const patientName = patientProf?.full_name || 'مريض';
    const sumCode = `#SUM-${patientId.substring(0, 8).toUpperCase()}`;

    document.getElementById('top-doc-title').innerText = `الملخص السريري الشامل (${sumCode})`;
    document.getElementById('doc-badge-code').innerText = sumCode;
    document.getElementById('doc-badge-date').innerText = `تاريخ الاستخراج: ${formatArabicDate(new Date().toISOString())}`;
    document.getElementById('doc-badge-status').innerHTML = `<span style="color:#10b981; font-weight:800; font-size:0.8rem;">ملف موثق EMR</span>`;

    document.getElementById('doc-doctor-name').innerText = 'استوديو صحة الشباب';
    document.getElementById('doc-doctor-spec').innerText = 'قسم السجلات الطبية الرقمية';
    document.getElementById('doc-signature-name').innerText = 'إدارة السجلات الطبية';

    document.getElementById('doc-patient-name').innerText = patientName;
    document.getElementById('doc-patient-blood').innerText = patientHealth?.blood_type || 'غير مسجل';
    document.getElementById('doc-patient-emr-code').innerText = sumCode;
    document.getElementById('doc-timestamp-now').innerText = formatArabicDateTime(new Date().toISOString());

    const container = document.getElementById('dynamic-clinical-container');
    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin:0; font-size:1.35rem; color:#0284c7; font-weight:800;">📄 الملخص الطبي السريري الشامل للمريض</h3>
            <p style="margin:4px 0 0; color:#64748b; font-size:0.85rem;">Patient Health Dossier Summary</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:1.5rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:0.8rem; color:#64748b;">الطول</div>
                <strong style="font-size:1.1rem; color:#0f172a;">${patientHealth?.height || '--'} سم</strong>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:0.8rem; color:#64748b;">الوزن</div>
                <strong style="font-size:1.1rem; color:#0f172a;">${patientHealth?.weight || '--'} كغ</strong>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:0.8rem; color:#64748b;">فصيلة الدم</div>
                <strong style="font-size:1.1rem; color:#dc2626;">${patientHealth?.blood_type || 'غير محدد'}</strong>
            </div>
        </div>

        ${patientHealth?.allergies ? `
            <div class="clinical-section-box" style="background:#fef2f2; border-color:#fecaca;">
                <h4 class="clinical-section-title" style="color:#dc2626;">⚠️ الحساسية السريرية المسجلة:</h4>
                <p class="clinical-section-body" style="font-weight:700; color:#991b1b;">${escapeHtml(patientHealth.allergies)}</p>
            </div>
        ` : ''}

        <div class="clinical-section-box">
            <h4 class="clinical-section-title">💊 الأدوية الحالية والتاريخ الصحي:</h4>
            <p class="clinical-section-body">${escapeHtml(patientHealth?.medications || 'لا توجد أدوية منتظمة مسجلة.')}</p>
            ${patientHealth?.chronic_diseases ? `<p class="clinical-section-body" style="margin-top:8px;"><strong>الأمراض المزمنة:</strong> ${escapeHtml(patientHealth.chronic_diseases)}</p>` : ''}
        </div>

        <div style="margin-top:1.5rem;">
            <h4 style="margin:0 0 8px; font-size:1rem; font-weight:800; color:#0f172a;">سجل الزيارات والاستشارات الطبية السابقة:</h4>
            <table class="doc-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>الحالة</th>
                        <th>التفاصيل السريرية</th>
                    </tr>
                </thead>
                <tbody>
                    ${(consults || []).slice(0, 5).map(c => `
                        <tr>
                            <td>${formatArabicDate(c.created_at)}</td>
                            <td>استشارة (${escapeHtml(c.specialty)})</td>
                            <td>${c.status === 'completed' ? 'مكتملة' : 'جارية'}</td>
                            <td>${escapeHtml(c.description || '-')}</td>
                        </tr>
                    `).join('')}
                    ${(appts || []).slice(0, 5).map(a => `
                        <tr>
                            <td>${formatArabicDate(a.scheduled_at)}</td>
                            <td>موعد كشف عيادي</td>
                            <td>${a.status === 'confirmed' ? 'مؤكد' : a.status}</td>
                            <td>${escapeHtml(a.notes || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('doc-loading-state').style.display = 'none';
    document.getElementById('doc-content-body').style.display = 'block';
}
