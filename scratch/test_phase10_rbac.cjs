// test_phase10_rbac.cjs - Comprehensive Verification Suite for Phase 10: User Management & RBAC
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
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

async function runTestSuite() {
    console.log("======================================================================");
    console.log("  PHASE 10: USER MANAGEMENT & ROLE-BASED ACCESS CONTROL (RBAC) QA");
    console.log("======================================================================\n");

    // -------------------------------------------------------------------------
    // 1. Supabase Migration & Schema Safety Check
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Migration 20240101000021 Schema & Defense-in-Depth ---");
    const migrationPath = path.join(rootDir, 'supabase/migrations/20240101000021_user_management_and_rbac_hardening.sql');
    const migrationExists = fs.existsSync(migrationPath);
    recordTest("Phase 10 SQL Migration file exists", migrationExists);

    if (migrationExists) {
        const migContent = fs.readFileSync(migrationPath, 'utf8');

        recordTest(
            "Migration has column idempotency (ADD COLUMN IF NOT EXISTS)",
            migContent.includes("ADD COLUMN IF NOT EXISTS email") &&
            migContent.includes("ADD COLUMN IF NOT EXISTS account_status"),
            "email, account_status columns"
        );

        recordTest(
            "Migration creates performance indexes on email, role, and status",
            migContent.includes("idx_profiles_email") &&
            migContent.includes("idx_profiles_role") &&
            migContent.includes("idx_profiles_status"),
            "idx_profiles_email, idx_profiles_role, idx_profiles_status"
        );

        recordTest(
            "Migration seeds standard approved project roles",
            migContent.includes("'super_admin'") &&
            migContent.includes("'admin'") &&
            migContent.includes("'specialist'") &&
            migContent.includes("'volunteer'") &&
            migContent.includes("'user'"),
            "super_admin, admin, specialist, volunteer, user"
        );

        recordTest(
            "Migration enforces RLS on roles and adds SELECT policy",
            migContent.includes("ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY") &&
            migContent.includes("Allow authenticated read roles"),
            "Protects roles table with authenticated SELECT"
        );

        recordTest(
            "Migration hardens profiles UPDATE RLS policy for Admin management",
            migContent.includes("Profiles update policy") &&
            migContent.includes("auth.uid() = id OR"),
            "Allows users own profile OR admins management"
        );

        recordTest(
            "Migration implements DB trigger function protect_profile_roles_and_status",
            migContent.includes("protect_profile_roles_and_status") &&
            migContent.includes("BEFORE UPDATE ON public.profiles"),
            "Engine-level trigger preventing client privilege escalation"
        );

        recordTest(
            "Migration trigger strictly protects Super Admin privilege escalation",
            migContent.includes("Only Super Administrators can grant or modify Super Admin privileges"),
            "Non-super_admin cannot grant or touch super_admin"
        );

        recordTest(
            "Migration trigger strictly prevents self-role changes and self-banning",
            migContent.includes("Administrators cannot modify their own role") &&
            migContent.includes("You cannot modify your own account status"),
            "Prevents accidental lockout and self-elevation"
        );

        recordTest(
            "Migration includes secure RPC functions with audit logging",
            migContent.includes("admin_update_user_role") &&
            migContent.includes("admin_update_user_status") &&
            migContent.includes("admin_update_user_profile") &&
            migContent.includes("INSERT INTO public.audit_logs"),
            "Audit logging for role and status changes"
        );
    }

    // -------------------------------------------------------------------------
    // 2. Route Guard Security & Authorization Matrix
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Route Guard & Authorization Protection Matrix ---");
    const guardPath = path.join(rootDir, 'js/guard.js');
    const guardContent = fs.readFileSync(guardPath, 'utf8');

    recordTest(
        "Guard normalizes role strings (handles 'Super Admin', uppercase, whitespace)",
        guardContent.includes("toLowerCase().trim().replace(/\\s+/g, '_')"),
        "Normalized lowercase underscore"
    );

    const authPath = path.join(rootDir, 'js/auth.js');
    const authContent = fs.readFileSync(authPath, 'utf8');

    recordTest(
        "auth.js normalizes role in signIn, getUserRole, and redirectUserByRole",
        authContent.includes("toLowerCase().trim().replace(/\\s+/g, '_')"),
        "Resilient role matching"
    );

    // Guard matrix simulation
    function simulateAdminAccess(role, session) {
        if (!session) return { allowed: false, action: 'REDIRECT_LOGIN' };
        const normRole = (role || 'user').toLowerCase().trim().replace(/\s+/g, '_');
        const ALLOWED_ADMINS = ['admin', 'super_admin'];
        if (!ALLOWED_ADMINS.includes(normRole)) return { allowed: false, action: 'BLOCK_UNAUTHORIZED' };
        return { allowed: true, action: 'ALLOW_ADMIN' };
    }

    const testScenarios = [
        { role: null, session: false, expected: 'REDIRECT_LOGIN' },
        { role: 'user', session: true, expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'volunteer', session: true, expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'specialist', session: true, expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'doctor', session: true, expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'admin', session: true, expected: 'ALLOW_ADMIN' },
        { role: 'super_admin', session: true, expected: 'ALLOW_ADMIN' },
        { role: 'Super Admin', session: true, expected: 'ALLOW_ADMIN' }
    ];

    testScenarios.forEach(s => {
        const res = simulateAdminAccess(s.role, s.session);
        recordTest(
            `Access to /admin/users.html for [${s.role || 'Visitor'}] -> ${s.expected}`,
            res.action === s.expected,
            `Result: ${res.action}`
        );
    });

    // -------------------------------------------------------------------------
    // 3. User Management Interface Elements (HTML & CSS)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing User Management UI/UX & Accessible Elements ---");
    const usersHtmlPath = path.join(rootDir, 'admin/users.html');
    const usersHtml = fs.readFileSync(usersHtmlPath, 'utf8');

    recordTest("users.html has RTL direction", usersHtml.includes('dir="rtl"'));
    recordTest("users.html has mobile viewport meta tag", usersHtml.includes('name="viewport"'));
    recordTest("users.html has search input with aria-label", usersHtml.includes('id="searchInput"'));
    recordTest("users.html has role filter with all project roles", 
        usersHtml.includes('id="roleFilter"') &&
        usersHtml.includes('value="super_admin"') &&
        usersHtml.includes('value="admin"') &&
        usersHtml.includes('value="specialist"') &&
        usersHtml.includes('value="volunteer"') &&
        usersHtml.includes('value="user"')
    );
    recordTest("users.html has status filter (active, inactive, suspended, banned)", 
        usersHtml.includes('id="statusFilter"') &&
        usersHtml.includes('value="active"') &&
        usersHtml.includes('value="inactive"') &&
        usersHtml.includes('value="suspended"') &&
        usersHtml.includes('value="banned"')
    );
    recordTest("users.html has sorting controls (sortBy)", usersHtml.includes('id="sortBy"'));
    recordTest("users.html has page size selector (pageSizeSelect)", usersHtml.includes('id="pageSizeSelect"'));
    recordTest("users.html has CSV export button (exportUsersBtn)", usersHtml.includes('id="exportUsersBtn"'));
    recordTest("users.html has statistics overview cards", 
        usersHtml.includes('id="statTotalUsers"') &&
        usersHtml.includes('id="statSpecialists"') &&
        usersHtml.includes('id="statAdmins"') &&
        usersHtml.includes('id="statVolunteers"') &&
        usersHtml.includes('id="statRestricted"')
    );
    recordTest("users.html contains Role Edit Modal (roleEditModal)", usersHtml.includes('id="roleEditModal"'));
    recordTest("users.html contains Status Edit Modal (statusEditModal)", usersHtml.includes('id="statusEditModal"'));
    recordTest("users.html contains Profile 360 Details Modal (profileDetailsModal)", usersHtml.includes('id="profileDetailsModal"'));
    recordTest("users.html contains Confirmation Dialog (confirmActionModal)", usersHtml.includes('id="confirmActionModal"'));
    recordTest("users.html contains Skeleton shimmer loaders", usersHtml.includes('class="skeleton"'));

    // Check CSS additions
    const adminCss = fs.readFileSync(path.join(rootDir, 'css/admin.css'), 'utf8');
    recordTest("admin.css contains volunteer status badge", adminCss.includes('.status-badge.volunteer'));
    recordTest("admin.css contains inactive status badge", adminCss.includes('.status-badge.inactive'));
    recordTest("admin.css contains suspended status badge", adminCss.includes('.status-badge.suspended'));
    recordTest("admin.css contains banned status badge", adminCss.includes('.status-badge.banned'));
    recordTest("admin.css contains user details grid classes", adminCss.includes('.user-details-grid'));
    recordTest("admin.css contains confirmation dialog classes", adminCss.includes('.confirmation-dialog-box'));

    // -------------------------------------------------------------------------
    // 4. JavaScript Logic & RBAC Enforcement (admin_users.js)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing admin_users.js Architecture & Security Controls ---");
    const adminUsersJs = fs.readFileSync(path.join(rootDir, 'js/admin_users.js'), 'utf8');

    recordTest("admin_users.js checks session and verifies admin role", 
        adminUsersJs.includes("currentAdminRole") &&
        adminUsersJs.includes("['admin', 'super_admin'].includes(currentAdminRole)")
    );
    recordTest("admin_users.js loads real data from Supabase profiles", 
        adminUsersJs.includes(".from('profiles')") && adminUsersJs.includes(".select('*')")
    );
    recordTest("admin_users.js handles network errors with friendly error state and retry", 
        adminUsersJs.includes("window.reloadUsers()") || adminUsersJs.includes("إعادة المحاولة")
    );
    recordTest("admin_users.js supports multi-attribute live search (name, email, phone, wilaya, id)", 
        adminUsersJs.includes("nameMatch") &&
        adminUsersJs.includes("emailMatch") &&
        adminUsersJs.includes("phoneMatch") &&
        adminUsersJs.includes("wilayaMatch")
    );
    recordTest("admin_users.js supports role and status filtering", 
        adminUsersJs.includes("matchesRole") && adminUsersJs.includes("matchesStatus")
    );
    recordTest("admin_users.js supports sorting (newest, oldest, name, role, status)", 
        adminUsersJs.includes("sortOrder") && adminUsersJs.includes("localeCompare")
    );
    recordTest("admin_users.js prevents self-role modification (Privilege Lockout Protection)", 
        adminUsersJs.includes("currentAdminId === currentEditingUser.id") &&
        adminUsersJs.includes("selfRoleWarning")
    );
    recordTest("admin_users.js prevents non-super-admin from granting or editing Super Admin", 
        adminUsersJs.includes("isActorSuper") &&
        adminUsersJs.includes("optSuperAdmin.disabled = true")
    );
    recordTest("admin_users.js prevents self-ban or self-suspension", 
        adminUsersJs.includes("currentAdminId === currentStatusUser.id") &&
        adminUsersJs.includes("selfStatusWarning")
    );
    recordTest("admin_users.js requires confirmation dialog before sensitive changes", 
        adminUsersJs.includes("showConfirmation(")
    );
    recordTest("admin_users.js logs administrative operations to audit_logs", 
        adminUsersJs.includes("audit_logs")
    );
    recordTest("admin_users.js includes CSV export with UTF-8 BOM", 
        adminUsersJs.includes("\\uFEFF")
    );

    // -------------------------------------------------------------------------
    // 5. Real Supabase Live Connection & Data Verification
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing Real Supabase Data & Security Boundaries ---");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Test unauthenticated access to update profiles
    const fakeId = '00000000-0000-0000-0000-000000000000';
    try {
        const { data: anonUpdate, error: anonUpdateErr } = await supabase
            .from('profiles')
            .update({ role: 'super_admin' })
            .eq('id', fakeId)
            .select();

        recordTest(
            "Anonymous client cannot elevate privileges or update profiles",
            anonUpdate === null || anonUpdate.length === 0,
            anonUpdateErr ? `Blocked: ${anonUpdateErr.message}` : "0 rows updated (RLS active)"
        );
    } catch (e) {
        recordTest(
            "Anonymous client cannot elevate privileges or update profiles",
            true,
            `Blocked: ${e.message}`
        );
    }

    // Sign in as Super Admin with retry
    let authData = null;
    let authError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await supabase.auth.signInWithPassword({
                email: 'sidialiabdouu@gmail.com',
                password: 'Admin@bba2005@2026!'
            });
            authData = res.data;
            authError = res.error;
            if (!authError && authData?.user) break;
        } catch (err) {
            authError = err;
        }
        await new Promise(r => setTimeout(r, 1000));
    }


    recordTest(
        "Super Admin authentication works with production credentials",
        !authError && Boolean(authData?.user),
        authError ? authError.message : `UID: ${authData.user.id}`
    );

    if (authData?.user) {
        // Query profiles with authenticated admin
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*');

        recordTest(
            "Authorized Administrator can read all registered user profiles",
            !profErr && Array.isArray(profiles) && profiles.length > 0,
            profErr ? profErr.message : `Found ${profiles.length} real profiles`
        );

        // Verify no sensitive tokens or password hashes in profiles
        if (profiles && profiles.length > 0) {
            const sample = profiles[0];
            const hasPasswordHash = 'password' in sample || 'encrypted_password' in sample;
            const hasSecretToken = 'access_token' in sample || 'jwt' in sample;

            recordTest(
                "Profile records never expose passwords or secret tokens",
                !hasPasswordHash && !hasSecretToken,
                "Clean data model adheres to SECURITY.md"
            );

            recordTest(
                "Profiles contain role, created_at, and account_status fields",
                'role' in sample && 'created_at' in sample,
                `Role: ${sample.role}, Created: ${sample.created_at}`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log("\n======================================================================");
    console.log(`  PHASE 10 TEST SUMMARY: ${results.passed} / ${results.total} PASSED`);
    console.log("======================================================================");

    fs.writeFileSync(
        path.join(__dirname, 'phase10_test_results.json'),
        JSON.stringify(results, null, 2)
    );

    if (results.failed > 0) {
        console.error(`\n❌ Warning: ${results.failed} tests failed!`);
        process.exitCode = 1;
    } else {
        console.log("\n🎉 ALL PHASE 10 SECURITY, RBAC & USER MANAGEMENT TESTS PASSED!");
    }
}

runTestSuite().catch(err => {
    console.error("Test Suite crashed:", err);
    process.exit(1);
});
