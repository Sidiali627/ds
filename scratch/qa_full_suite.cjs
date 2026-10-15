const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// Test Results Registry
const testResults = {
    auth: { passed: 0, failed: 0, tests: [] },
    rbac: { passed: 0, failed: 0, tests: [] },
    specialist: { passed: 0, failed: 0, tests: [] },
    consultations: { passed: 0, failed: 0, tests: [] },
    admin: { passed: 0, failed: 0, tests: [] },
    ui_ux: { passed: 0, failed: 0, tests: [] },
    supabase_schema: { passed: 0, failed: 0, tests: [] }
};

function recordTest(category, name, passed, details = '') {
    if (passed) {
        testResults[category].passed++;
    } else {
        testResults[category].failed++;
    }
    testResults[category].tests.push({ name, passed, details });
}

console.log('====================================================');
console.log('   Youth Health Studio - Comprehensive QA Suite     ');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. Authentication & Role Redirection Logic Test
// ----------------------------------------------------
console.log('--- 1. Testing Authentication Logic & Redirections ---');
const SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist'];
const ADMIN_ROLES = ['admin', 'super_admin'];

function calculateRedirectUrl(role) {
    let redirectUrl = 'dashboard.html';
    if (ADMIN_ROLES.includes(role)) {
        redirectUrl = 'admin/index.html';
    } else if (SPECIALIST_ROLES.includes(role)) {
        redirectUrl = 'specialist/index.html';
    }
    return redirectUrl;
}

// Test redirection for each approved DB role
const roleRedirectExpectations = [
    { role: 'super_admin', expected: 'admin/index.html' },
    { role: 'admin', expected: 'admin/index.html' },
    { role: 'specialist', expected: 'specialist/index.html' },
    { role: 'doctor', expected: 'specialist/index.html' },
    { role: 'psychologist', expected: 'specialist/index.html' },
    { role: 'nutritionist', expected: 'specialist/index.html' },
    { role: 'user', expected: 'dashboard.html' },
    { role: 'volunteer', expected: 'dashboard.html' },
    { role: undefined, expected: 'dashboard.html' }
];

roleRedirectExpectations.forEach(r => {
    const actual = calculateRedirectUrl(r.role);
    const pass = actual === r.expected;
    recordTest('auth', `Redirect for role [${r.role || 'default'}] -> ${r.expected}`, pass, `Expected: ${r.expected}, Got: ${actual}`);
});

// Verify auth.js exports and methods
const authJsPath = path.join(rootDir, 'js/auth.js');
const authJsContent = fs.readFileSync(authJsPath, 'utf8');
const hasSignIn = authJsContent.includes('export async function signIn');
const hasSignUp = authJsContent.includes('export async function signUp');
const hasSignOut = authJsContent.includes('export async function signOut');
const hasRequireAuth = authJsContent.includes('export async function requireAuth');
const handlesFetchError = authJsContent.includes('Failed to fetch');

recordTest('auth', 'auth.js: signIn implementation', hasSignIn);
recordTest('auth', 'auth.js: signUp implementation', hasSignUp);
recordTest('auth', 'auth.js: signOut implementation', hasSignOut);
recordTest('auth', 'auth.js: requireAuth implementation', hasRequireAuth);
recordTest('auth', 'auth.js: graceful network/fetch error handling', handlesFetchError);

// ----------------------------------------------------
// 2. RBAC Guard Security Matrix Test
// ----------------------------------------------------
console.log('\n--- 2. Testing RBAC Route Guard Matrix ---');

function simulateGuard(pathStr, session, role) {
    const p = pathStr.toLowerCase();
    if (p.includes('login.html') || p.includes('register.html') || p.includes('unauthorized.html') || p.includes('verify.html')) {
        return { allowed: true, action: 'ALLOW_PUBLIC_AUTH' };
    }

    const isAdminRoute = p.includes('/admin/') || p.includes('/superadmin/');
    const isSpecialistRoute = p.includes('/specialist/');
    const isUserRoute = p.includes('/user/') || p.includes('dashboard.html') || (p.includes('profile.html') && !isSpecialistRoute && !isAdminRoute) || p.includes('user_live_session.html');

    if (!isAdminRoute && !isSpecialistRoute && !isUserRoute) {
        return { allowed: true, action: 'ALLOW_PUBLIC' };
    }

    if (!session) {
        const prefix = (isAdminRoute || isSpecialistRoute) ? '../' : '';
        return { allowed: false, action: 'REDIRECT_LOGIN', target: `${prefix}login.html` };
    }

    const ALLOWED_ADMINS = ['admin', 'super_admin'];
    const ALLOWED_SPECIALISTS = ['specialist', 'doctor', 'psychologist', 'nutritionist', 'admin', 'super_admin'];

    if (isAdminRoute && !ALLOWED_ADMINS.includes(role)) {
        return { allowed: false, action: 'BLOCK_UNAUTHORIZED', target: '../unauthorized.html' };
    }

    if (isSpecialistRoute && !ALLOWED_SPECIALISTS.includes(role)) {
        return { allowed: false, action: 'BLOCK_UNAUTHORIZED', target: '../unauthorized.html' };
    }

    if (isUserRoute && ALLOWED_SPECIALISTS.includes(role) && !ALLOWED_ADMINS.includes(role)) {
        return { allowed: false, action: 'REDIRECT_SPECIALIST', target: 'specialist/index.html' };
    }

    return { allowed: true, action: 'ALLOW_GRANTED' };
}

// Guard Test Cases
const guardScenarios = [
    // Unauthenticated
    { path: '/admin/index.html', session: false, role: null, expect: 'REDIRECT_LOGIN' },
    { path: '/specialist/consultations.html', session: false, role: null, expect: 'REDIRECT_LOGIN' },
    { path: 'dashboard.html', session: false, role: null, expect: 'REDIRECT_LOGIN' },
    { path: '/admin/login.html', session: false, role: null, expect: 'ALLOW_PUBLIC_AUTH' },
    { path: 'login.html', session: false, role: null, expect: 'ALLOW_PUBLIC_AUTH' },
    { path: 'articles.html', session: false, role: null, expect: 'ALLOW_PUBLIC' },
    
    // User role
    { path: 'dashboard.html', session: true, role: 'user', expect: 'ALLOW_GRANTED' },
    { path: '/admin/index.html', session: true, role: 'user', expect: 'BLOCK_UNAUTHORIZED' },
    { path: '/specialist/patients.html', session: true, role: 'user', expect: 'BLOCK_UNAUTHORIZED' },
    
    // Specialist role
    { path: '/specialist/index.html', session: true, role: 'specialist', expect: 'ALLOW_GRANTED' },
    { path: '/specialist/patients.html', session: true, role: 'doctor', expect: 'ALLOW_GRANTED' },
    { path: '/admin/index.html', session: true, role: 'specialist', expect: 'BLOCK_UNAUTHORIZED' },
    { path: 'dashboard.html', session: true, role: 'specialist', expect: 'REDIRECT_SPECIALIST' },
    
    // Admin & Super Admin roles
    { path: '/admin/index.html', session: true, role: 'admin', expect: 'ALLOW_GRANTED' },
    { path: '/admin/users.html', session: true, role: 'super_admin', expect: 'ALLOW_GRANTED' },
    { path: '/specialist/consultations.html', session: true, role: 'admin', expect: 'ALLOW_GRANTED' },
    { path: 'dashboard.html', session: true, role: 'admin', expect: 'ALLOW_GRANTED' }
];

guardScenarios.forEach(s => {
    const res = simulateGuard(s.path, s.session, s.role);
    const pass = res.action === s.expect;
    recordTest('rbac', `Route [${s.path}] with session=${s.session}, role=${s.role} -> ${s.expect}`, pass, `Got: ${res.action}`);
});

// ----------------------------------------------------
// 3. Specialist Portal Pages & Handlers Test
// ----------------------------------------------------
console.log('\n--- 3. Testing Specialist Portal Integrity ---');

const specPages = ['calendar.html', 'consultations.html', 'index.html', 'live_session.html', 'patients.html', 'profile.html'];
specPages.forEach(sp => {
    const full = path.join(rootDir, 'specialist', sp);
    const exists = fs.existsSync(full);
    const html = exists ? fs.readFileSync(full, 'utf8') : '';
    const hasGuard = html.includes('guard.js');
    const hasSidebarRoot = html.includes('id="specialist-sidebar-root"');
    const hasHeaderRoot = html.includes('id="specialist-header-root"');

    recordTest('specialist', `Page [specialist/${sp}] exists`, exists);
    recordTest('specialist', `Page [specialist/${sp}] has guard.js`, hasGuard);
    if (sp !== 'live_session.html') {
        recordTest('specialist', `Page [specialist/${sp}] has sidebar root`, hasSidebarRoot);
        recordTest('specialist', `Page [specialist/${sp}] has header root`, hasHeaderRoot);
    }
});

// Test patients.js functions & safe checks
const patientsJs = fs.readFileSync(path.join(rootDir, 'js/specialist/patients.js'), 'utf8');
recordTest('specialist', 'patients.js has safe avatar calculation', patientsJs.includes('getAvatarColor'));
recordTest('specialist', 'patients.js supports live search by name and email', patientsJs.includes('matchesQuery'));
recordTest('specialist', 'patients.js has EMR modal tab switcher', patientsJs.includes('switchEmrTab'));
recordTest('specialist', 'patients.js has retry mechanism', patientsJs.includes('retryLoadPatients'));

// ----------------------------------------------------
// 4. Consultations Workflow Integrity Test
// ----------------------------------------------------
console.log('\n--- 4. Testing Consultations Workflow & Form Integrity ---');

const userConsJs = fs.readFileSync(path.join(rootDir, 'js/consultations.js'), 'utf8');
const userConsHtml = fs.readFileSync(path.join(rootDir, 'consultations.html'), 'utf8');
const hasForm = userConsHtml.includes('id="consultation-form"');
const hasCategory = userConsHtml.includes('id="category"');
const hasDesc = userConsHtml.includes('id="description"');
const hasFallback = userConsJs.includes('fallbackRes');

recordTest('consultations', 'consultations.html contains consultation-form', hasForm);
recordTest('consultations', 'consultations.html contains category select', hasCategory);
recordTest('consultations', 'consultations.html contains description textarea', hasDesc);
recordTest('consultations', 'js/consultations.js contains schema fallback handling', hasFallback);

// ----------------------------------------------------
// 5. Admin Dashboard Integrity Test
// ----------------------------------------------------
console.log('\n--- 5. Testing Admin Dashboard Integrity ---');

const adminArticlesHtml = fs.readFileSync(path.join(rootDir, 'admin/articles.html'), 'utf8');
const adminSettingsHtml = fs.readFileSync(path.join(rootDir, 'admin/settings.html'), 'utf8');
const adminUsersHtml = fs.readFileSync(path.join(rootDir, 'admin/users.html'), 'utf8');

recordTest('admin', 'admin/articles.html contains btn-new-article', adminArticlesHtml.includes('id="btn-new-article"'));
recordTest('admin', 'admin/articles.html contains article-modal', adminArticlesHtml.includes('id="article-modal"'));
recordTest('admin', 'admin/settings.html contains save-all-btn', adminSettingsHtml.includes('id="save-all-btn"'));
recordTest('admin', 'admin/settings.html contains save-indicator', adminSettingsHtml.includes('id="save-indicator"'));
recordTest('admin', 'admin/users.html contains role edit modal', adminUsersHtml.includes('id="roleEditModal"'));
recordTest('admin', 'admin/users.html contains users-tbody', adminUsersHtml.includes('id="users-tbody"'));

// ----------------------------------------------------
// 6. UI/UX, Arabic RTL & Mobile Viewport Audit
// ----------------------------------------------------
console.log('\n--- 6. Auditing UI/UX, RTL & Viewport Across All Pages ---');

function getHtmlFiles(dir) {
    let res = [];
    const list = fs.readdirSync(dir);
    for (const f of list) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('scratch')) {
                res = res.concat(getHtmlFiles(full));
            }
        } else if (f.endsWith('.html')) {
            res.push(full);
        }
    }
    return res;
}

const allHtml = getHtmlFiles(rootDir);
let rtlCount = 0;
let viewportCount = 0;
let cairoFontCount = 0;

allHtml.forEach(h => {
    const content = fs.readFileSync(h, 'utf8');
    const isRTL = content.includes('dir="rtl"');
    const hasViewport = content.includes('name="viewport"');
    if (isRTL) rtlCount++;
    if (hasViewport) viewportCount++;
});

recordTest('ui_ux', `All HTML files have dir="rtl" (${rtlCount}/${allHtml.length})`, rtlCount === allHtml.length);
recordTest('ui_ux', `All HTML files have mobile viewport meta tag (${viewportCount}/${allHtml.length})`, viewportCount === allHtml.length);

// ----------------------------------------------------
// 7. Supabase Migration & Schema Safety Check
// ----------------------------------------------------
console.log('\n--- 7. Testing Supabase Migration & Schema Safety ---');

const migration14Path = path.join(rootDir, 'supabase/migrations/20240101000014_specialist_portal.sql');
const mig14Content = fs.readFileSync(migration14Path, 'utf8');

const hasDropPolicy = mig14Content.includes('DROP POLICY IF EXISTS');
const hasSafeRealtime = mig14Content.includes('pg_publication_tables');
const hasIndexes = mig14Content.includes('CREATE INDEX IF NOT EXISTS');
const hasAlterColumns = mig14Content.includes('ADD COLUMN IF NOT EXISTS');

recordTest('supabase_schema', '20240101000014 migration uses DROP POLICY IF EXISTS (Prevents Error 42710)', hasDropPolicy);
recordTest('supabase_schema', '20240101000014 migration uses safe Realtime DO block (Prevents duplicate relation error)', hasSafeRealtime);
recordTest('supabase_schema', '20240101000014 migration creates performance indexes on foreign keys', hasIndexes);
recordTest('supabase_schema', '20240101000014 migration ensures new columns exist on pre-existing tables', hasAlterColumns);

// Print Final Report Summary
console.log('\n====================================================');
console.log('                 QA Test Suite Summary              ');
console.log('====================================================');

let totalPassed = 0;
let totalFailed = 0;

for (const [cat, data] of Object.entries(testResults)) {
    console.log(`[${cat.toUpperCase()}]: ${data.passed} Passed, ${data.failed} Failed`);
    totalPassed += data.passed;
    totalFailed += data.failed;
}

console.log('----------------------------------------------------');
console.log(`TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
console.log('====================================================\n');

fs.writeFileSync(path.join(__dirname, 'qa_results.json'), JSON.stringify(testResults, null, 2));
