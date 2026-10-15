// scratch/test_admin_ui_unification.cjs - Automated Verification for Admin UI/UX Unification
const fs = require('fs');
const path = require('path');

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

const ADMIN_PAGES = [
    'index.html',
    'users.html',
    'consultations.html',
    'appointments.html',
    'events.html',
    'articles.html',
    'cms.html',
    'crm.html',
    'crm_profile.html',
    'media.html',
    'notifications.html',
    'security.html',
    'settings.html',
    'seo.html',
    'ai_center.html',
    'certificates.html'
];

function runVerification() {
    console.log("======================================================================");
    console.log("   ADMIN DASHBOARD UI/UX UNIFICATION - COMPREHENSIVE VERIFICATION");
    console.log("======================================================================\n");

    const adminDir = path.join(__dirname, '../admin');
    const cssPath = path.join(__dirname, '../css/admin.css');
    const adminCompPath = path.join(__dirname, '../js/admin_components.js');

    // 1. Verify All Admin Pages Have Sidebar & Header Roots
    console.log("--- 1. Verifying Structural Consistency Across All Admin Pages ---");
    ADMIN_PAGES.forEach(page => {
        const filePath = path.join(adminDir, page);
        const exists = fs.existsSync(filePath);
        if (!exists) {
            recordTest(`Page exists: ${page}`, false, "File missing");
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const hasSidebarRoot = content.includes('id="admin-sidebar-root"');
        const hasHeaderRoot = content.includes('id="admin-header-root"');
        const loadsAdminComp = content.includes('admin_components.js');
        const loadsGuard = content.includes('guard.js');

        recordTest(`[${page}] Contains Sidebar Root`, hasSidebarRoot, '#admin-sidebar-root');
        recordTest(`[${page}] Contains Header Root`, hasHeaderRoot, '#admin-header-root');
        recordTest(`[${page}] Injects admin_components.js`, loadsAdminComp, 'admin_components.js');
        recordTest(`[${page}] Protected by guard.js`, loadsGuard, 'guard.js');
    });

    // 2. Verify Unified Design Tokens & Styles in css/admin.css
    console.log("\n--- 2. Auditing Unified CSS Architecture (css/admin.css) ---");
    const adminCss = fs.readFileSync(cssPath, 'utf8');

    recordTest(
        "admin.css Contains Card Shadow Tokens",
        adminCss.includes('--card-shadow:') && adminCss.includes('--card-shadow-hover:'),
        "--card-shadow tokens verified"
    );

    recordTest(
        "admin.css Standardizes 20px Border Radius on Advanced Panels & Cards",
        adminCss.includes('border-radius: 20px;') && adminCss.includes('.advanced-table-wrapper'),
        "20px radius tokens verified"
    );

    recordTest(
        "admin.css Contains Hero Card System (Doctor & Admin)",
        adminCss.includes('.hero-doctor-card') && adminCss.includes('.hero-admin-card'),
        "Hero cards verified"
    );

    recordTest(
        "admin.css Contains RTL Nav Item Highlight",
        adminCss.includes('border-right: 3px solid') || adminCss.includes('border-right-color:'),
        "RTL active border highlight verified"
    );

    recordTest(
        "admin.css Contains Mobile Drawer & Overlay Animation Rules",
        adminCss.includes('.admin-sidebar.mobile-open') && adminCss.includes('.sidebar-overlay'),
        "Mobile drawer responsive rules verified"
    );

    recordTest(
        "admin.css Contains Complete Status Badges System",
        adminCss.includes('.status-badge.admin') &&
        adminCss.includes('.status-badge.super_admin') &&
        adminCss.includes('.status-badge.specialist') &&
        adminCss.includes('.status-badge.confirmed') &&
        adminCss.includes('.status-badge.pending'),
        "Status badges verified"
    );

    // 3. Verify admin_components.js Visual Language & Features
    console.log("\n--- 3. Auditing Unified Component Logic (js/admin_components.js) ---");
    const compJs = fs.readFileSync(adminCompPath, 'utf8');

    recordTest(
        "admin_components.js Contains Administrator Profile Card (Avatar, Role, Status Dot)",
        compJs.includes('admin-user-profile') &&
        compJs.includes('admin-user-avatar') &&
        compJs.includes('admin-user-display-name') &&
        compJs.includes('admin-user-role-badge'),
        "Profile header card verified"
    );

    recordTest(
        "admin_components.js Contains Dynamic Profile Hydration via Supabase",
        compJs.includes('hydrateAdminProfile') && compJs.includes('supabase.auth.getSession'),
        "Profile hydration verified"
    );

    recordTest(
        "admin_components.js Contains 4 Clean Navigation Sections",
        compJs.includes('مركز القيادة (Control Center)') &&
        compJs.includes('العمليات والخدمات السريرية') &&
        compJs.includes('المحتوى والفعاليات') &&
        compJs.includes('الأدوات والأنظمة الذكية'),
        "4 clean navigation groupings verified"
    );

    recordTest(
        "admin_components.js Header Includes Live Sync, Notification Bell, Theme Toggle & Public Link",
        compJs.includes('Live Sync') &&
        compJs.includes('admin-notifications-bell-container') &&
        compJs.includes('admin-theme-toggle') &&
        compJs.includes('المنصة الرئيسية'),
        "Unified header controls verified"
    );

    recordTest(
        "admin_components.js Handles Mobile Sidebar Open & Close",
        compJs.includes('open-sidebar-btn') &&
        compJs.includes('close-sidebar-btn') &&
        compJs.includes('mobile-open'),
        "Mobile sidebar toggle handler verified"
    );

    // 4. Summary
    console.log("\n======================================================================");
    console.log(`  VERIFICATION RESULTS: ${results.passed} / ${results.total} Tests Passed (${Math.round((results.passed / results.total) * 100)}%)`);
    console.log("======================================================================\n");

    const outPath = path.join(__dirname, 'admin_ui_unification_test_results.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

    if (results.failed > 0) {
        process.exit(1);
    }
}

runVerification();
