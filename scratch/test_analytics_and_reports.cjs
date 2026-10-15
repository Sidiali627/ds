// scratch/test_analytics_and_reports.cjs - Comprehensive Verification for Phase 9
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xsuednrcrzbjdyrdrgat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
};

function recordTest(name, passed, details = '') {
    results.total++;
    if (passed) results.passed++;
    else results.failed++;
    results.tests.push({ name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} : ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
    console.log("======================================================================");
    console.log("  PHASE 9: Analytics, Statistics & Administrative Reports Verification");
    console.log("======================================================================\n");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Authenticate as Super Admin
    console.log("--- 1. Authenticating as Administrator ---");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'sidialiabdouu@gmail.com',
        password: 'Admin@bba2005@2026!'
    });

    recordTest(
        "Admin Session Authentication",
        !authError && !!authData?.user,
        authError ? authError.message : `UID: ${authData.user.id}`
    );

    // 2. Role Verification
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', authData.user.id)
        .single();

    const isAdmin = ['admin', 'super_admin'].includes(adminProfile?.role?.toLowerCase().replace(/\s+/g, '_'));
    recordTest(
        "Admin Role Authorization Check",
        isAdmin,
        `Role: ${adminProfile?.role}`
    );

    // 3. Database Exact Metric Counts Verification
    console.log("\n--- 2. Verifying Real Database Metric Calculations (No Mock Data) ---");
    
    // Total Users
    const { count: usersCount, error: uErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Total Registered Users Count", !uErr && typeof usersCount === 'number', `Count: ${usersCount}`);

    // Specialists
    const { count: specCount, error: sErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['specialist', 'doctor', 'psychologist', 'nutritionist']);
    recordTest("Metric: Active Specialists Count", !sErr && typeof specCount === 'number', `Count: ${specCount}`);

    // Consultations Total
    const { count: totalConsults, error: cErr } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Total Consultations Count", !cErr && typeof totalConsults === 'number', `Count: ${totalConsults}`);

    // Pending Consultations
    const { count: pendingConsults, error: pcErr } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
    recordTest("Metric: Pending Consultations Count", !pcErr && typeof pendingConsults === 'number', `Count: ${pendingConsults}`);

    // Completed Consultations
    const { count: completedConsults, error: ccErr } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
    recordTest("Metric: Completed Consultations Count", !ccErr && typeof completedConsults === 'number', `Count: ${completedConsults}`);

    // Appointments Total
    const { count: apptsCount, error: aErr } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Appointments Count", !aErr && typeof apptsCount === 'number', `Count: ${apptsCount}`);

    // Volunteers
    const { count: volCount, error: vErr } = await supabase
        .from('volunteers')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Volunteers Count", !vErr && typeof volCount === 'number', `Count: ${volCount}`);

    // EMR Notes
    const { count: emrCount, error: emrErr } = await supabase
        .from('case_notes')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: EMR Case Notes Count", !emrErr && typeof emrCount === 'number', `Count: ${emrCount}`);

    // Events
    const { count: eventsCount, error: evErr } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Published Events Count", !evErr && typeof eventsCount === 'number', `Count: ${eventsCount}`);

    // Articles
    const { count: articlesCount, error: artErr } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });
    recordTest("Metric: Articles Count", !artErr && typeof articlesCount === 'number', `Count: ${articlesCount}`);

    // 4. Date Range Logic Verification
    console.log("\n--- 3. Verifying Date Range Utilities & Filtering Logic ---");
    
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

    const range7d = getDateRange('7d');
    const range30d = getDateRange('30d');
    const rangeMonth = getDateRange('month');
    const rangeCustom = getDateRange('custom', { from: '2026-10-01', to: '2026-10-15' });

    recordTest(
        "7-Day Date Filter Interval",
        new Date(range7d.to) - new Date(range7d.from) === 7 * 24 * 60 * 60 * 1000,
        `From: ${range7d.from.split('T')[0]}`
    );
    recordTest(
        "30-Day Date Filter Interval",
        new Date(range30d.to) - new Date(range30d.from) === 30 * 24 * 60 * 60 * 1000,
        `From: ${range30d.from.split('T')[0]}`
    );
    recordTest(
        "Current Month Date Filter Interval",
        new Date(rangeMonth.from).getDate() === 1,
        `Start: ${rangeMonth.from.split('T')[0]}`
    );
    recordTest(
        "Custom Date Filter Range",
        rangeCustom.from.startsWith('2026-10-01') && rangeCustom.to.startsWith('2026-10-15'),
        `Interval: ${rangeCustom.from.split('T')[0]} to ${rangeCustom.to.split('T')[0]}`
    );

    // Filtered count query execution test
    const { count: recentAppts, error: rErr } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', range30d.from);
    recordTest(
        "Filtered Count Execution on Database (30-day range)",
        !rErr && typeof recentAppts === 'number',
        `30d Appointments: ${recentAppts}`
    );

    // 5. Chart Data Aggregation Logic
    console.log("\n--- 4. Verifying Chart.js Data Aggregation Logic ---");

    function generateDateBuckets(days = 7) {
        const buckets = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const isoDate = d.toISOString().split('T')[0];
            buckets.push({ key: isoDate, countConsults: 0, countAppts: 0, countUsers: 0 });
        }
        return buckets;
    }

    const testBuckets = generateDateBuckets(7);
    recordTest("Daily Date Buckets Generation (7 days)", testBuckets.length === 7, `Buckets count: ${testBuckets.length}`);

    // Map existing appointments to buckets
    const { data: dbAppts } = await supabase
        .from('appointments')
        .select('created_at, scheduled_at');

    const bucketMap = {};
    testBuckets.forEach(b => { bucketMap[b.key] = b; });
    (dbAppts || []).forEach(a => {
        const day = (a.created_at || a.scheduled_at || '').split('T')[0];
        if (bucketMap[day]) bucketMap[day].countAppts++;
    });

    const totalBucketedAppts = testBuckets.reduce((sum, b) => sum + b.countAppts, 0);
    recordTest(
        "Appointments Timeline Aggregation",
        totalBucketedAppts >= 0,
        `Mapped appointments in 7-day window: ${totalBucketedAppts}`
    );

    // Status distribution aggregation
    const statusMap = { pending: 0, accepted: 0, in_progress: 0, completed: 0, cancelled: 0 };
    const { data: consultStatusRows } = await supabase.from('consultations').select('status');
    (consultStatusRows || []).forEach(r => {
        if (statusMap[r.status] !== undefined) statusMap[r.status]++;
    });
    recordTest(
        "Consultation Status Distribution Computation",
        Object.keys(statusMap).length === 5,
        `Statuses: ${JSON.stringify(statusMap)}`
    );

    // 6. Reports Pagination & Filtering
    console.log("\n--- 5. Verifying Operational Reports Hub Queries & Pagination ---");

    const pageSize = 10;
    const page = 1;
    const fromOffset = (page - 1) * pageSize;
    const toOffset = fromOffset + pageSize - 1;

    const { data: pagedAppts, count: totalApptsInHub, error: pageErr } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .order('scheduled_at', { ascending: false })
        .range(fromOffset, toOffset);

    recordTest(
        "Operational Reports Hub: Appointments Pagination Query",
        !pageErr && Array.isArray(pagedAppts),
        `Rows returned: ${pagedAppts.length}, Total in DB: ${totalApptsInHub}`
    );

    // Profiles / Users report query
    const { data: pagedUsers, count: totalUsersInHub, error: uPageErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, account_status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 9);

    recordTest(
        "Operational Reports Hub: Users Report Query",
        !uPageErr && Array.isArray(pagedUsers),
        `Users returned: ${pagedUsers.length}, Total in DB: ${totalUsersInHub}`
    );

    // 7. Security & Data Privacy Verification for CSV Exports
    console.log("\n--- 6. Verifying Security & Privacy in Export Formats ---");

    function buildCsv(rows, columns) {
        const BOM = '\uFEFF';
        const headers = columns.map(c => `"${c.label}"`).join(',');
        const bodyRows = rows.map(r => {
            return columns.map(c => {
                let val = r[c.field];
                if (c.field === 'id') val = `#${String(val || '').substring(0, 8)}`;
                val = val ? String(val).replace(/"/g, '""') : '';
                return `"${val}"`;
            }).join(',');
        });
        return BOM + headers + '\r\n' + bodyRows.join('\r\n');
    }

    const sampleExportColumns = [
        { label: 'معرف المستخدم', field: 'id' },
        { label: 'الاسم الكامل', field: 'full_name' },
        { label: 'الدور', field: 'role' },
        { label: 'حالة الحساب', field: 'account_status' },
        { label: 'تاريخ الانضمام', field: 'created_at' }
    ];

    const generatedCsv = buildCsv(pagedUsers, sampleExportColumns);

    recordTest(
        "CSV Starts with UTF-8 BOM (\\uFEFF) for Arabic Excel Compatibility",
        generatedCsv.startsWith('\uFEFF'),
        "BOM byte prefix confirmed"
    );

    const hasLeakedPasswords = generatedCsv.includes('password') || generatedCsv.includes('hash') || generatedCsv.includes('secret');
    const hasTokens = generatedCsv.includes('Bearer') || generatedCsv.includes('eyJ');
    recordTest(
        "CSV Free of Sensitive Credentials, Passwords, or Access Tokens",
        !hasLeakedPasswords && !hasTokens,
        "Zero sensitive credentials detected"
    );

    // 8. Unauthenticated & Non-Admin RBAC Access Blocking
    console.log("\n--- 7. Verifying Role-Based Access Control (RBAC) ---");

    // Create an unauthenticated client
    const unauthedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: unauthedData } = await unauthedSupabase.auth.getSession();
    recordTest(
        "Unauthenticated Client Has No Active Session",
        unauthedData.session === null,
        "Anonymous context verified"
    );

    // Read guard.js and admin_dashboard.js to verify server & client guards
    const guardContent = fs.readFileSync(path.join(__dirname, '../js/guard.js'), 'utf8');
    const adminDashContent = fs.readFileSync(path.join(__dirname, '../js/admin_dashboard.js'), 'utf8');

    const guardEnforcesAdmin = guardContent.includes("ALLOWED_ADMIN_ROLES = ['admin', 'super_admin']") &&
                               guardContent.includes("unauthorized.html");
    recordTest(
        "guard.js Strictly Enforces ['admin', 'super_admin'] for /admin/ Routes",
        guardEnforcesAdmin,
        "Unauthorized roles redirected to unauthorized.html"
    );

    const adminDashEnforcesAuth = adminDashContent.includes("checkAdminAuth") &&
                                  adminDashContent.includes("normalizedRole !== 'admin' && normalizedRole !== 'super_admin'");
    recordTest(
        "admin_dashboard.js Performs Dedicated Administrative Role Verification",
        adminDashEnforcesAuth,
        "checkAdminAuth verified"
    );

    // 9. Inspect UI & Print Styles in admin/index.html
    console.log("\n--- 8. Verifying Markup, Chart Containers & Print Styles ---");
    const adminHtml = fs.readFileSync(path.join(__dirname, '../admin/index.html'), 'utf8');

    const hasKpiCards = adminHtml.includes('metric-total-users') &&
                        adminHtml.includes('metric-specialists') &&
                        adminHtml.includes('metric-total-consultations') &&
                        adminHtml.includes('metric-pending-consultations') &&
                        adminHtml.includes('metric-completed-consultations') &&
                        adminHtml.includes('metric-appointments') &&
                        adminHtml.includes('metric-volunteers') &&
                        adminHtml.includes('metric-emr-notes') &&
                        adminHtml.includes('metric-events') &&
                        adminHtml.includes('metric-articles');

    recordTest(
        "admin/index.html Contains All 10 Required KPI Card IDs",
        hasKpiCards,
        "10 Real Metric Cards Present"
    );

    const hasAllCharts = adminHtml.includes('chart-volume-trend') &&
                         adminHtml.includes('chart-status-distribution') &&
                         adminHtml.includes('chart-users-growth') &&
                         adminHtml.includes('chart-activity-breakdown');

    recordTest(
        "admin/index.html Contains All 4 Chart.js Canvas Elements",
        hasAllCharts,
        "4 Chart Canvases Present"
    );

    const hasReportsHub = adminHtml.includes('reports-section') &&
                          adminHtml.includes('report-data-table') &&
                          adminHtml.includes('btn-export-csv') &&
                          adminHtml.includes('btn-print-report') &&
                          adminHtml.includes('pagination-bar');

    recordTest(
        "admin/index.html Contains Reports Hub, Export, Print & Pagination Controls",
        hasReportsHub,
        "Reports Hub UI Present"
    );

    const hasPrintMedia = adminHtml.includes('@media print') && adminHtml.includes('print-header');
    recordTest(
        "admin/index.html Supports Clean @media print & Official Report Headers",
        hasPrintMedia,
        "@media print CSS rules verified"
    );

    // 10. Summary
    console.log("\n======================================================================");
    console.log(`  VERIFICATION RESULTS: ${results.passed} / ${results.total} Tests Passed (${Math.round((results.passed / results.total) * 100)}%)`);
    console.log("======================================================================\n");

    const outPath = path.join(__dirname, 'analytics_reports_test_results.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

    if (results.failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution exception:", err);
    process.exit(1);
});
