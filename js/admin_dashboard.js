// admin_dashboard.js - Phase 9: Analytics, Statistics & Administrative Reports
import './guard.js';
import { supabase } from './supabase.js';

// Global state
let currentPeriod = 'all';
let customRange = { from: null, to: null };
let currentReportType = 'consultations';
let reportPage = 1;
const reportPageSize = 10;
let reportTotalCount = 0;
let reportSearchTerm = '';
let reportStatusFilter = 'all';
let reportDateFrom = '';
let reportDateTo = '';

// Chart instances tracker for clean destruction
const chartInstances = {
    volume: null,
    status: null,
    users: null,
    activity: null
};

// ---------------------- 1. Authentication & RBAC Guard ---------------------- //

async function checkAdminAuth() {
    if (!supabase) {
        console.warn("Supabase client is not initialized.");
        return false;
    }
    try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session) {
            window.location.href = '../login.html';
            return false;
        }

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', session.user.id)
            .single();

        if (profErr || !profile) {
            console.error("Could not fetch admin profile:", profErr);
            window.location.href = '../login.html';
            return false;
        }

        const normalizedRole = (profile.role || '').toLowerCase().replace(/\s+/g, '_');
        if (normalizedRole !== 'admin' && normalizedRole !== 'super_admin') {
            console.error("Access denied: User does not hold administrative role:", profile.role);
            window.location.href = '../unauthorized.html';
            return false;
        }

        return true;
    } catch (err) {
        console.error("checkAdminAuth exception:", err);
        return false;
    }
}

// ---------------------- 2. Date Filtering Utilities ---------------------- //

function getDateRange(period, custom = { from: null, to: null }) {
    const now = new Date();
    if (period === '7d') {
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { from: from.toISOString(), to: now.toISOString(), label: 'آخر 7 أيام' };
    }
    if (period === '30d') {
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { from: from.toISOString(), to: now.toISOString(), label: 'آخر 30 يوماً' };
    }
    if (period === 'month') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: from.toISOString(), to: now.toISOString(), label: 'هذا الشهر' };
    }
    if (period === 'custom' && custom.from) {
        const from = new Date(custom.from);
        const to = custom.to ? new Date(custom.to + 'T23:59:59.999Z') : now;
        return { from: from.toISOString(), to: to.toISOString(), label: 'فترة مخصصة' };
    }
    return { from: null, to: null, label: 'كافة الفترات' };
}

// ---------------------- 3. System Connectivity Ribbon ---------------------- //

async function updateSystemMonitor() {
    const setStatus = (id, isOk, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = text || (isOk ? 'متصل 🟢' : 'غير متصل 🔴');
        el.style.color = isOk ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)';
    };

    try {
        const { error: dbErr } = await supabase.from('profiles').select('id').limit(1);
        setStatus('sys-db', !dbErr, !dbErr ? 'متصل 🟢' : 'خطأ اتصال');
        setStatus('sys-api', !dbErr, !dbErr ? 'جاهز ⚡' : 'معطل');
    } catch {
        setStatus('sys-db', false);
        setStatus('sys-api', false);
    }

    try {
        const { data } = await supabase.auth.getSession();
        setStatus('sys-auth', !!data?.session, !!data?.session ? 'مفعل 🔒' : 'غير مسجل');
    } catch {
        setStatus('sys-auth', false);
    }
}

// ---------------------- 4. Real Database KPIs Calculation ---------------------- //

async function getFilteredCount(table, options = {}) {
    try {
        let query = supabase.from(table).select('*', { count: 'exact', head: true });

        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.role) {
            if (Array.isArray(options.role)) {
                query = query.in('role', options.role);
            } else {
                query = query.eq('role', options.role);
            }
        }
        if (options.from) {
            const dateCol = options.dateColumn || 'created_at';
            query = query.gte(dateCol, options.from);
        }
        if (options.to) {
            const dateCol = options.dateColumn || 'created_at';
            query = query.lte(dateCol, options.to);
        }

        const { count, error } = await query;
        if (error) {
            console.warn(`Query count warning for ${table}:`, error.message);
            return 0;
        }
        return count || 0;
    } catch (err) {
        console.error(`Error counting ${table}:`, err);
        return 0;
    }
}

async function loadKpis() {
    const { from, to, label } = getDateRange(currentPeriod, customRange);
    
    // Run parallel count requests for optimal performance
    const [
        totalUsers,
        specialists,
        totalConsultations,
        pendingConsultations,
        completedConsultations,
        totalAppointments,
        volunteers,
        emrNotes,
        events,
        articles
    ] = await Promise.all([
        getFilteredCount('profiles', { from, to }),
        getFilteredCount('profiles', { role: ['specialist', 'doctor', 'psychologist', 'nutritionist'] }),
        getFilteredCount('consultations', { from, to }),
        getFilteredCount('consultations', { status: 'pending', from, to }),
        getFilteredCount('consultations', { status: 'completed', from, to }),
        getFilteredCount('appointments', { from, to, dateColumn: 'scheduled_at' }),
        getFilteredCount('volunteers', { from, to }),
        getFilteredCount('case_notes', { from, to }),
        getFilteredCount('events', { from, to }),
        getFilteredCount('articles', { from, to })
    ]);

    const renderVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = Number(val).toLocaleString('ar-EG');
    };

    renderVal('metric-total-users', totalUsers);
    renderVal('metric-specialists', specialists);
    renderVal('metric-total-consultations', totalConsultations);
    renderVal('metric-pending-consultations', pendingConsultations);
    renderVal('metric-completed-consultations', completedConsultations);
    renderVal('metric-appointments', totalAppointments);
    renderVal('metric-volunteers', volunteers);
    renderVal('metric-emr-notes', emrNotes);
    renderVal('metric-events', events);
    renderVal('metric-articles', articles);

    // Update subtitles to show active period scope
    const subUsers = document.getElementById('metric-sub-users');
    if (subUsers) subUsers.innerText = `مسجلون (${label})`;

    const subAppts = document.getElementById('metric-sub-appointments');
    if (subAppts) subAppts.innerText = `مواعيد (${label})`;

    const updateLabel = document.getElementById('last-updated-text');
    if (updateLabel) {
        updateLabel.innerText = `آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}`;
    }

    return {
        totalUsers, specialists, totalConsultations, pendingConsultations,
        completedConsultations, totalAppointments, volunteers, emrNotes, events, articles
    };
}

// ---------------------- 5. Charts & Trends (Chart.js) ---------------------- //

function ensureChartJsReady() {
    return new Promise((resolve) => {
        if (window.Chart) return resolve(window.Chart);
        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            if (window.Chart || retries > 30) {
                clearInterval(interval);
                resolve(window.Chart || null);
            }
        }, 100);
    });
}

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
    }
}

async function renderCharts(kpiData) {
    const ChartClass = await ensureChartJsReady();
    if (!ChartClass) {
        console.warn("Chart.js library is not loaded. Skipping chart rendering.");
        return;
    }

    const { from, to } = getDateRange(currentPeriod, customRange);

    // 1. Chart: Volume Over Time (Consultations & Appointments)
    await renderVolumeTrendChart(ChartClass, from, to);

    // 2. Chart: Consultation Status Distribution
    await renderStatusDistributionChart(ChartClass, from, to);

    // 3. Chart: User Registration Growth
    await renderUserGrowthChart(ChartClass, from, to);

    // 4. Chart: Activity & Clinical Breakdown
    renderActivityBreakdownChart(ChartClass, kpiData);
}

// Helper: Generate daily date labels for the past 7 days (or period)
function generateDateBuckets(days = 7) {
    const buckets = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isoDate = d.toISOString().split('T')[0];
        const displayLabel = d.toLocaleDateString('ar-EG', { weekday: 'short', month: 'numeric', day: 'numeric' });
        buckets.push({ key: isoDate, label: displayLabel, countConsults: 0, countAppts: 0, countUsers: 0 });
    }
    return buckets;
}

async function renderVolumeTrendChart(ChartClass, from, to) {
    const ctx = document.getElementById('chart-volume-trend')?.getContext('2d');
    if (!ctx) return;
    destroyChart('volume');

    const buckets = generateDateBuckets(7);
    const bucketMap = {};
    buckets.forEach(b => { bucketMap[b.key] = b; });

    try {
        // Query recent consultations
        const { data: consults } = await supabase
            .from('consultations')
            .select('created_at')
            .gte('created_at', buckets[0].key + 'T00:00:00.000Z');

        (consults || []).forEach(c => {
            const day = (c.created_at || '').split('T')[0];
            if (bucketMap[day]) bucketMap[day].countConsults++;
        });

        // Query recent appointments
        const { data: appts } = await supabase
            .from('appointments')
            .select('scheduled_at, created_at')
            .gte('created_at', buckets[0].key + 'T00:00:00.000Z');

        (appts || []).forEach(a => {
            const day = (a.created_at || a.scheduled_at || '').split('T')[0];
            if (bucketMap[day]) bucketMap[day].countAppts++;
        });
    } catch (e) {
        console.warn("Error querying data for volume trend chart:", e);
    }

    chartInstances.volume = new ChartClass(ctx, {
        type: 'line',
        data: {
            labels: buckets.map(b => b.label),
            datasets: [
                {
                    label: 'الاستشارات الطبية',
                    data: buckets.map(b => b.countConsults),
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#0284c7'
                },
                {
                    label: 'المواعيد السريرية',
                    data: buckets.map(b => b.countAppts),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#7c3aed'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', rtl: true, labels: { font: { family: 'Cairo' } } },
                tooltip: { rtl: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, font: { family: 'Cairo' } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                x: {
                    ticks: { font: { family: 'Cairo' } },
                    grid: { display: false }
                }
            }
        }
    });
}

async function renderStatusDistributionChart(ChartClass, from, to) {
    const ctx = document.getElementById('chart-status-distribution')?.getContext('2d');
    if (!ctx) return;
    destroyChart('status');

    let statusCounts = { pending: 0, accepted: 0, in_progress: 0, completed: 0, cancelled: 0 };

    try {
        let query = supabase.from('consultations').select('status');
        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);
        const { data } = await query;

        (data || []).forEach(row => {
            const st = row.status || 'pending';
            if (statusCounts[st] !== undefined) statusCounts[st]++;
            else statusCounts.pending++;
        });
    } catch (e) {
        console.warn("Status distribution error:", e);
    }

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const labels = ['قيد الانتظار', 'مقبولة', 'جلسة جارية', 'مكتملة', 'ملغاة'];
    const colors = ['#d97706', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];
    const dataVals = [
        statusCounts.pending,
        statusCounts.accepted,
        statusCounts.in_progress,
        statusCounts.completed,
        statusCounts.cancelled
    ];

    // If completely empty, show an empty state placeholder donut
    const finalData = total === 0 ? [1] : dataVals;
    const finalColors = total === 0 ? ['#e2e8f0'] : colors;
    const finalLabels = total === 0 ? ['لا توجد استشارات مسجلة'] : labels;

    chartInstances.status = new ChartClass(ctx, {
        type: 'doughnut',
        data: {
            labels: finalLabels,
            datasets: [{
                data: finalData,
                backgroundColor: finalColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Cairo' } } },
                tooltip: {
                    enabled: total > 0,
                    rtl: true
                }
            }
        }
    });
}

async function renderUserGrowthChart(ChartClass, from, to) {
    const ctx = document.getElementById('chart-users-growth')?.getContext('2d');
    if (!ctx) return;
    destroyChart('users');

    const buckets = generateDateBuckets(7);
    const bucketMap = {};
    buckets.forEach(b => { bucketMap[b.key] = b; });

    try {
        const { data: users } = await supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', buckets[0].key + 'T00:00:00.000Z');

        (users || []).forEach(u => {
            const day = (u.created_at || '').split('T')[0];
            if (bucketMap[day]) bucketMap[day].countUsers++;
        });
    } catch (e) {
        console.warn("User growth query error:", e);
    }

    chartInstances.users = new ChartClass(ctx, {
        type: 'bar',
        data: {
            labels: buckets.map(b => b.label),
            datasets: [{
                label: 'تسجيلات المستخدمين الجدد',
                data: buckets.map(b => b.countUsers),
                backgroundColor: 'rgba(5, 150, 105, 0.75)',
                borderColor: '#059669',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', rtl: true, labels: { font: { family: 'Cairo' } } },
                tooltip: { rtl: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, font: { family: 'Cairo' } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                x: {
                    ticks: { font: { family: 'Cairo' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderActivityBreakdownChart(ChartClass, kpiData) {
    const ctx = document.getElementById('chart-activity-breakdown')?.getContext('2d');
    if (!ctx) return;
    destroyChart('activity');

    const labels = ['المواعيد', 'الوصفات وEMR', 'الفعاليات', 'المقالات', 'المتطوعون'];
    const dataVals = [
        kpiData?.totalAppointments || 0,
        kpiData?.emrNotes || 0,
        kpiData?.events || 0,
        kpiData?.articles || 0,
        kpiData?.volunteers || 0
    ];

    chartInstances.activity = new ChartClass(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'الحجم الفعلي المسجل',
                data: dataVals,
                backgroundColor: [
                    'rgba(124, 58, 237, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(20, 184, 166, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars for clear readability
            plugins: {
                legend: { display: false },
                tooltip: { rtl: true }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { precision: 0, font: { family: 'Cairo' } },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                y: {
                    ticks: { font: { family: 'Cairo' } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ---------------------- 6. Operational Reports Hub & Pagination ---------------------- //

const REPORT_COLUMNS = {
    consultations: [
        { label: 'رقم المرجع (ID)', field: 'id' },
        { label: 'التخصص', field: 'specialty' },
        { label: 'الحالة', field: 'status' },
        { label: 'تاريخ الإنشاء', field: 'created_at' },
        { label: 'آخر تحديث', field: 'updated_at' }
    ],
    appointments: [
        { label: 'معرف الموعد', field: 'id' },
        { label: 'الموعد المحدد', field: 'scheduled_at' },
        { label: 'المدة (دقيقة)', field: 'duration_minutes' },
        { label: 'الحالة', field: 'status' },
        { label: 'تاريخ الإنشاء', field: 'created_at' }
    ],
    users: [
        { label: 'معرف المستخدم', field: 'id' },
        { label: 'الاسم الكامل', field: 'full_name' },
        { label: 'الدور', field: 'role' },
        { label: 'حالة الحساب', field: 'account_status' },
        { label: 'تاريخ الانضمام', field: 'created_at' }
    ],
    emr: [
        { label: 'معرف التدوين', field: 'id' },
        { label: 'نوع الملاحظة', field: 'note_type' },
        { label: 'تاريخ التسجيل', field: 'created_at' },
        { label: 'معرف الاستشارة', field: 'consultation_id' }
    ]
};

function formatStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'confirmed' || s === 'completed' || s === 'active' || s === 'published') {
        return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${translateStatus(s)}</span>`;
    }
    if (s === 'pending' || s === 'scheduled') {
        return `<span class="badge" style="background: rgba(217, 119, 6, 0.15); color: #d97706; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${translateStatus(s)}</span>`;
    }
    if (s === 'cancelled' || s === 'blocked') {
        return `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${translateStatus(s)}</span>`;
    }
    return `<span class="badge" style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${translateStatus(s)}</span>`;
}

function translateStatus(s) {
    const map = {
        pending: 'قيد الانتظار',
        accepted: 'مقبولة',
        in_progress: 'جلسة جارية',
        completed: 'مكتملة',
        cancelled: 'ملغاة',
        confirmed: 'مؤكد',
        scheduled: 'مجدول',
        active: 'نشط',
        user: 'مستفيد',
        specialist: 'طبيب / مختص',
        admin: 'مسؤول',
        super_admin: 'مدير عام',
        clinical: 'سريرية',
        general: 'عامة',
        prescription: 'وصفة علاجية'
    };
    return map[s] || s;
}

function renderTableHeader() {
    const thead = document.getElementById('report-table-head');
    if (!thead) return;
    const cols = REPORT_COLUMNS[currentReportType] || [];
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr>`;
}

async function loadReportsTable() {
    renderTableHeader();
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--admin-text-muted);">
                <div style="font-size: 1.5rem; margin-bottom: 6px;">⏳</div>
                <div>جاري جلب بيانات التقرير...</div>
            </td>
        </tr>
    `;

    const tableMap = {
        consultations: 'consultations',
        appointments: 'appointments',
        users: 'profiles',
        emr: 'case_notes'
    };
    const targetTable = tableMap[currentReportType] || 'consultations';

    try {
        let query = supabase.from(targetTable).select('*', { count: 'exact' });

        // Status / Role filter
        if (reportStatusFilter !== 'all') {
            if (targetTable === 'profiles') {
                query = query.eq('role', reportStatusFilter);
            } else {
                query = query.eq('status', reportStatusFilter);
            }
        }

        // Date range
        if (reportDateFrom) {
            const dateCol = (targetTable === 'appointments') ? 'scheduled_at' : 'created_at';
            query = query.gte(dateCol, new Date(reportDateFrom).toISOString());
        }
        if (reportDateTo) {
            const dateCol = (targetTable === 'appointments') ? 'scheduled_at' : 'created_at';
            query = query.lte(dateCol, new Date(reportDateTo + 'T23:59:59.999Z').toISOString());
        }

        // Search filter
        if (reportSearchTerm.trim()) {
            const term = reportSearchTerm.trim();
            if (targetTable === 'consultations') {
                query = query.or(`specialty.ilike.%${term}%,status.ilike.%${term}%`);
            } else if (targetTable === 'profiles') {
                query = query.or(`full_name.ilike.%${term}%,role.ilike.%${term}%`);
            } else if (targetTable === 'appointments') {
                query = query.or(`status.ilike.%${term}%,notes.ilike.%${term}%`);
            }
        }

        // Sorting & Pagination
        const dateSortCol = (targetTable === 'appointments') ? 'scheduled_at' : 'created_at';
        query = query.order(dateSortCol, { ascending: false });

        const fromOffset = (reportPage - 1) * reportPageSize;
        const toOffset = fromOffset + reportPageSize - 1;
        query = query.range(fromOffset, toOffset);

        const { data, count, error } = await query;

        if (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                        <div>⚠️ حدث خطأ أثناء تحميل التقرير: ${error.message}</div>
                    </td>
                </tr>
            `;
            return;
        }

        reportTotalCount = count || 0;
        updatePaginationControls();

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--admin-text-muted);">
                        <div style="font-size: 1.5rem; margin-bottom: 6px;">📂</div>
                        <div>لا توجد سجلات مطابقة لمعايير البحث والتصفية.</div>
                    </td>
                </tr>
            `;
            return;
        }

        // Render Rows with Privacy Sanitization
        const cols = REPORT_COLUMNS[currentReportType] || [];
        tbody.innerHTML = data.map(row => {
            const cells = cols.map(c => {
                const rawVal = row[c.field];
                if (c.field === 'id') {
                    return `<td><code style="font-size: 0.75rem; background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px;">#${String(rawVal || '').substring(0, 8)}</code></td>`;
                }
                if (c.field === 'status' || c.field === 'role' || c.field === 'account_status') {
                    return `<td>${formatStatusBadge(rawVal)}</td>`;
                }
                if (c.field.includes('date') || c.field.includes('_at')) {
                    const d = rawVal ? new Date(rawVal).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                    return `<td style="font-size: 0.82rem; color: var(--admin-text-muted);">${d}</td>`;
                }
                return `<td>${rawVal || '—'}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

    } catch (err) {
        console.error("loadReportsTable exception:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <div>⚠️ تعذر استرجاع بيانات التقرير حالياً.</div>
                </td>
            </tr>
        `;
    }
}

function updatePaginationControls() {
    const info = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const pageLabel = document.getElementById('current-page-label');

    const start = reportTotalCount === 0 ? 0 : (reportPage - 1) * reportPageSize + 1;
    const end = Math.min(reportPage * reportPageSize, reportTotalCount);

    if (info) {
        info.innerText = `عرض ${start} - ${end} من إجمالي ${reportTotalCount} سجل`;
    }
    if (pageLabel) {
        pageLabel.innerText = reportPage;
    }
    if (prevBtn) {
        prevBtn.disabled = reportPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = end >= reportTotalCount;
    }
}

// ---------------------- 7. CSV Export (Privacy Compliant, UTF-8 BOM) ---------------------- //

async function exportReportCsv() {
    const tableMap = {
        consultations: 'consultations',
        appointments: 'appointments',
        users: 'profiles',
        emr: 'case_notes'
    };
    const targetTable = tableMap[currentReportType] || 'consultations';
    const cols = REPORT_COLUMNS[currentReportType] || [];

    try {
        let query = supabase.from(targetTable).select('*').limit(1000);

        if (reportStatusFilter !== 'all') {
            if (targetTable === 'profiles') query = query.eq('role', reportStatusFilter);
            else query = query.eq('status', reportStatusFilter);
        }
        if (reportDateFrom) {
            const dateCol = (targetTable === 'appointments') ? 'scheduled_at' : 'created_at';
            query = query.gte(dateCol, new Date(reportDateFrom).toISOString());
        }
        if (reportDateTo) {
            const dateCol = (targetTable === 'appointments') ? 'scheduled_at' : 'created_at';
            query = query.lte(dateCol, new Date(reportDateTo + 'T23:59:59.999Z').toISOString());
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            alert('لا توجد بيانات مطابقة لتصديرها.');
            return;
        }

        // Build CSV Content with UTF-8 BOM for Arabic compatibility in Excel
        const BOM = '\uFEFF';
        const headers = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
        
        const rows = data.map(row => {
            return cols.map(c => {
                let val = row[c.field];
                // Sanitize sensitive info: passwords, tokens, full diagnoses
                if (c.field === 'id') val = `#${String(val || '').substring(0, 8)}`;
                if (c.field === 'status' || c.field === 'role') val = translateStatus(val);
                if (c.field.includes('_at') && val) val = new Date(val).toLocaleString('ar-EG');
                val = val ? String(val).replace(/"/g, '""') : '';
                return `"${val}"`;
            }).join(',');
        });

        const csvContent = BOM + headers + '\r\n' + rows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `report_${currentReportType}_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("CSV Export error:", err);
        alert('تعذر تصدير ملف CSV.');
    }
}

// ---------------------- 8. Print Layout Trigger ---------------------- //

function printReport() {
    const printTime = document.getElementById('print-timestamp');
    if (printTime) {
        printTime.innerText = `تاريخ إنشاء التقرير: ${new Date().toLocaleString('ar-EG')}`;
    }
    window.print();
}

// ---------------------- 9. Task Center & Activity Timeline ---------------------- //

async function loadTaskCenter() {
    const container = document.getElementById('task-center');
    if (!container) return;

    try {
        const tasks = [];
        // Pending consultations count
        const { count: pendingConsults } = await supabase
            .from('consultations')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (pendingConsults > 0) {
            tasks.push({
                title: `استشارات بانتظار المراجعة والتعيين (${pendingConsults})`,
                color: 'var(--danger-color, #ef4444)'
            });
        }

        // Upcoming appointments in next 24 hours
        const nowIso = new Date().toISOString();
        const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { count: upcomingAppts } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .gte('scheduled_at', nowIso)
            .lte('scheduled_at', tomorrowIso);

        if (upcomingAppts > 0) {
            tasks.push({
                title: `مواعيد سريرية مجدولة خلال 24 ساعة (${upcomingAppts})`,
                color: 'var(--info-color, #0284c7)'
            });
        }

        if (tasks.length === 0) {
            container.innerHTML = `<div class="cc-empty">لا توجد مهام تشغيلية عاجلة، المنصة تعمل بسلاسة.</div>`;
            return;
        }

        container.innerHTML = tasks.map(t => `
            <div class="cc-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color, #e2e8f0);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${t.color}"></div>
                    <div class="cc-list-item-title" style="font-weight: 700; font-size: 0.88rem;">${t.title}</div>
                </div>
                <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.78rem;">متابعة</button>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="cc-empty">تعذر جلب المهام التشغيلية.</div>`;
    }
}

async function loadActivityTimeline() {
    const container = document.getElementById('activity-timeline');
    if (!container) return;

    try {
        // Fetch latest users and appointments as dynamic timeline
        const [{ data: users }, { data: appts }] = await Promise.all([
            supabase.from('profiles').select('full_name, role, created_at').order('created_at', { ascending: false }).limit(4),
            supabase.from('appointments').select('scheduled_at, status, created_at').order('created_at', { ascending: false }).limit(4)
        ]);

        const events = [];
        (users || []).forEach(u => {
            events.push({
                title: `حساب جديد: ${u.full_name || 'مستخدم مسجل'} (${translateStatus(u.role)})`,
                date: new Date(u.created_at)
            });
        });
        (appts || []).forEach(a => {
            events.push({
                title: `طلب موعد سريري جديد (الحالة: ${translateStatus(a.status)})`,
                date: new Date(a.created_at || a.scheduled_at)
            });
        });

        events.sort((a, b) => b.date - a.date);

        if (events.length === 0) {
            container.innerHTML = `<div class="cc-empty">لا يوجد نشاط مسجل حديثاً.</div>`;
            return;
        }

        container.innerHTML = events.slice(0, 6).map(e => `
            <div class="timeline-item" style="padding: 8px 0; border-bottom: 1px dashed var(--border-color, #e2e8f0);">
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${e.title}</div>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${e.date.toLocaleString('ar-EG', { hour12: true })}</div>
            </div>
        `).join('');
    } catch {
        container.innerHTML = `<div class="cc-empty">تعذر تحميل سجل النشاط.</div>`;
    }
}

// ---------------------- 10. Dashboard Initialization & Event Listeners ---------------------- //

async function refreshFullDashboard() {
    const kpis = await loadKpis();
    await renderCharts(kpis);
    await loadReportsTable();
    loadTaskCenter();
    loadActivityTimeline();
}

function setupEventListeners() {
    // 1. Period filter buttons
    const periodButtons = document.querySelectorAll('.period-btn');
    const customContainer = document.getElementById('custom-date-container');

    periodButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.getAttribute('data-period');
            currentPeriod = period;

            if (period === 'custom') {
                if (customContainer) customContainer.style.display = 'flex';
            } else {
                if (customContainer) customContainer.style.display = 'none';
                customRange = { from: null, to: null };
                const kpis = await loadKpis();
                await renderCharts(kpis);
            }
        });
    });

    // Custom date apply button
    document.getElementById('btn-apply-custom-date')?.addEventListener('click', async () => {
        const fromVal = document.getElementById('filter-date-from')?.value;
        const toVal = document.getElementById('filter-date-to')?.value;
        if (!fromVal) {
            alert('يرجى تحديد تاريخ البداية.');
            return;
        }
        customRange = { from: fromVal, to: toVal };
        const kpis = await loadKpis();
        await renderCharts(kpis);
    });

    // Manual refresh button
    document.getElementById('btn-refresh-dashboard')?.addEventListener('click', async () => {
        await refreshFullDashboard();
    });

    // 2. Report Hub Tabs
    const reportTabs = document.querySelectorAll('.report-tab-btn');
    reportTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            reportTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentReportType = tab.getAttribute('data-report-type');
            reportPage = 1;
            await loadReportsTable();
        });
    });

    // Report Hub Search & Filters
    document.getElementById('btn-filter-reports')?.addEventListener('click', async () => {
        reportSearchTerm = document.getElementById('report-search-input')?.value || '';
        reportStatusFilter = document.getElementById('report-status-filter')?.value || 'all';
        reportDateFrom = document.getElementById('report-date-from')?.value || '';
        reportDateTo = document.getElementById('report-date-to')?.value || '';
        reportPage = 1;
        await loadReportsTable();
    });

    // Search input on Enter
    document.getElementById('report-search-input')?.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-filter-reports')?.click();
        }
    });

    // Pagination buttons
    document.getElementById('btn-prev-page')?.addEventListener('click', async () => {
        if (reportPage > 1) {
            reportPage--;
            await loadReportsTable();
        }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', async () => {
        if (reportPage * reportPageSize < reportTotalCount) {
            reportPage++;
            await loadReportsTable();
        }
    });

    // Export & Print buttons
    document.getElementById('btn-export-csv')?.addEventListener('click', exportReportCsv);
    document.getElementById('btn-print-report')?.addEventListener('click', printReport);
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthed = await checkAdminAuth();
    if (!isAuthed) return;

    updateSystemMonitor();
    setupEventListeners();
    await refreshFullDashboard();
});

export {
    checkAdminAuth,
    getDateRange,
    getFilteredCount,
    loadKpis,
    renderCharts,
    loadReportsTable,
    exportReportCsv,
    translateStatus,
    REPORT_COLUMNS
};
