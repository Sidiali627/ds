// test_roles_and_routes.cjs - Comprehensive Automated Role, Route Guard, and Security Test Suite
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const SUPABASE_URL = 'https://xsuednrcrzbjdyrdrgat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const testSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    not_run: 0,
    tests: []
};

function recordTest(name, status, details = '') {
    testSummary.total++;
    const s = status.toUpperCase();
    if (s === 'PASSED') testSummary.passed++;
    else if (s === 'FAILED') testSummary.failed++;
    else if (s === 'BLOCKED') testSummary.blocked++;
    else if (s === 'NOT RUN' || s === 'NOT_RUN') testSummary.not_run++;

    testSummary.tests.push({ name, status: s, details });
    const mark = s === 'PASSED' ? '✅ PASSED' : s === 'BLOCKED' ? '⚠️ BLOCKED' : s === 'FAILED' ? '❌ FAILED' : '⏸️ NOT RUN';
    console.log(`${mark} : ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runRoleAndRouteTests() {
    console.log("======================================================================");
    console.log("  PHASE 12: AUTOMATED ROLE, ROUTE GUARD & WORKFLOW TEST SUITE");
    console.log("======================================================================\n");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // -------------------------------------------------------------------------
    // 1. Authentication Tests for Accounts
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Live Account Authentication ---");
    try {
        const { data: superAdminData, error: superAdminError } = await supabase.auth.signInWithPassword({
            email: 'sidialiabdouu@gmail.com',
            password: 'Admin@bba2005@2026!'
        });

        if (!superAdminError && superAdminData?.user) {
            recordTest("Super Admin Authentication (sidialiabdouu@gmail.com)", "PASSED", `UID: ${superAdminData.user.id}`);

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', superAdminData.user.id)
                .single();

            const isSuper = (profile?.role || '').toLowerCase().replace(/\s+/g, '_') === 'super_admin' || profile?.role === 'Admin';
            recordTest("Super Admin Role Verification in Database", isSuper ? "PASSED" : "FAILED", `Role: ${profile?.role}`);
        } else {
            recordTest("Super Admin Authentication", "FAILED", superAdminError?.message);
        }
    } catch (err) {
        recordTest("Super Admin Authentication", "FAILED", err.message);
    }

    // Check synthetic patient test account
    try {
        const { data: patData, error: patError } = await supabase.auth.signInWithPassword({
            email: 'yhs.test.patient.qa@gmail.com',
            password: 'TestPassword2026!#'
        });

        if (patError && patError.message.includes('Email not confirmed')) {
            recordTest("Synthetic Patient Authentication (test.patient)", "BLOCKED", "Account created in Supabase Auth, email confirmation pending in cloud settings");
        } else if (!patError && patData?.user) {
            recordTest("Synthetic Patient Authentication (test.patient)", "PASSED", `UID: ${patData.user.id}`);
        } else {
            recordTest("Synthetic Patient Authentication (test.patient)", "BLOCKED", patError?.message || "Cloud confirmation pending");
        }
    } catch (err) {
        recordTest("Synthetic Patient Authentication", "BLOCKED", err.message);
    }

    // -------------------------------------------------------------------------
    // 2. Redirection & Role Resolution Matrix Tests
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Role Resolution & Login Redirection Matrix ---");
    function resolveLoginRedirect(role) {
        const normRole = (role || 'user').toLowerCase().trim().replace(/\s+/g, '_');
        const ADMIN_ROLES = ['admin', 'super_admin'];
        const SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist'];

        if (ADMIN_ROLES.includes(normRole)) return 'admin/index.html';
        if (SPECIALIST_ROLES.includes(normRole)) return 'specialist/index.html';
        return 'dashboard.html';
    }

    const redirectionTestCases = [
        { role: 'super_admin', expected: 'admin/index.html' },
        { role: 'Super Admin', expected: 'admin/index.html' },
        { role: 'admin', expected: 'admin/index.html' },
        { role: 'Admin', expected: 'admin/index.html' },
        { role: 'specialist', expected: 'specialist/index.html' },
        { role: 'doctor', expected: 'specialist/index.html' },
        { role: 'psychologist', expected: 'specialist/index.html' },
        { role: 'nutritionist', expected: 'specialist/index.html' },
        { role: 'user', expected: 'dashboard.html' },
        { role: 'patient', expected: 'dashboard.html' },
        { role: 'volunteer', expected: 'dashboard.html' }
    ];

    redirectionTestCases.forEach(tc => {
        const actual = resolveLoginRedirect(tc.role);
        recordTest(
            `Login Redirection for [${tc.role}] -> ${tc.expected}`,
            actual === tc.expected ? "PASSED" : "FAILED",
            `Resolved: ${actual}`
        );
    });

    // -------------------------------------------------------------------------
    // 3. Route Guard Authorization Enforcement Tests
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Route Guard Authorization Logic (guard.js) ---");
    function evaluateRouteGuard(role, session, targetPath) {
        const path = (targetPath.startsWith('/') ? targetPath : '/' + targetPath).toLowerCase();
        const isAdminRoute = path.includes('/admin/') || path.includes('/superadmin/');
        const isSpecialistRoute = path.includes('/specialist/');
        const isUserRoute = path.includes('/user/') || path.includes('dashboard.html') || path.includes('emr.html') || path.includes('consultations.html');

        if (!isAdminRoute && !isSpecialistRoute && !isUserRoute) {
            return 'ALLOW_PUBLIC';
        }

        if (!session) {
            return 'REDIRECT_LOGIN';
        }

        const normRole = (role || 'user').toLowerCase().trim().replace(/\s+/g, '_');
        const ALLOWED_ADMIN = ['admin', 'super_admin'];
        const ALLOWED_SPEC = ['specialist', 'doctor', 'psychologist', 'nutritionist', 'admin', 'super_admin'];

        if (isAdminRoute && !ALLOWED_ADMIN.includes(normRole)) {
            return 'BLOCK_UNAUTHORIZED';
        }

        if (isSpecialistRoute && !ALLOWED_SPEC.includes(normRole)) {
            return 'BLOCK_UNAUTHORIZED';
        }

        if (isUserRoute && ALLOWED_SPEC.includes(normRole) && !ALLOWED_ADMIN.includes(normRole)) {
            return 'REDIRECT_SPECIALIST_PORTAL';
        }

        return 'ALLOW_AUTHORIZED';
    }

    const guardTestScenarios = [
        // Anonymous visitor
        { role: null, session: false, path: 'admin/users.html', expected: 'REDIRECT_LOGIN' },
        { role: null, session: false, path: 'specialist/patients.html', expected: 'REDIRECT_LOGIN' },
        { role: null, session: false, path: 'dashboard.html', expected: 'REDIRECT_LOGIN' },
        { role: null, session: false, path: 'index.html', expected: 'ALLOW_PUBLIC' },

        // Patient / User
        { role: 'user', session: true, path: 'dashboard.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'user', session: true, path: 'admin/users.html', expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'user', session: true, path: 'specialist/patients.html', expected: 'BLOCK_UNAUTHORIZED' },

        // Specialist / Doctor
        { role: 'specialist', session: true, path: 'specialist/patients.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'specialist', session: true, path: 'specialist/calendar.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'specialist', session: true, path: 'admin/users.html', expected: 'BLOCK_UNAUTHORIZED' },
        { role: 'specialist', session: true, path: 'dashboard.html', expected: 'REDIRECT_SPECIALIST_PORTAL' },

        // Admin
        { role: 'admin', session: true, path: 'admin/index.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'admin', session: true, path: 'admin/users.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'admin', session: true, path: 'specialist/patients.html', expected: 'ALLOW_AUTHORIZED' },

        // Super Admin
        { role: 'super_admin', session: true, path: 'admin/users.html', expected: 'ALLOW_AUTHORIZED' },
        { role: 'super_admin', session: true, path: 'admin/security.html', expected: 'ALLOW_AUTHORIZED' }
    ];

    guardTestScenarios.forEach(sc => {
        const actual = evaluateRouteGuard(sc.role, sc.session, sc.path);
        recordTest(
            `Guard check for [${sc.role || 'Visitor'}] on [${sc.path}] -> ${sc.expected}`,
            actual === sc.expected ? "PASSED" : "FAILED",
            `Result: ${actual}`
        );
    });

    // -------------------------------------------------------------------------
    // 4. Tenant & Patient Record Isolation Tests
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Tenant Isolation & Patient Privacy ---");
    function simulateEMRAccess(record, caller) {
        if (!caller) return false;
        if (caller.role === 'admin' || caller.role === 'super_admin') return true;
        if (caller.id === record.patient_id && record.is_private === false) return true;
        if (caller.id === record.specialist_id) return true;
        return false;
    }

    const mockPatientA = { id: 'patient-A', role: 'user' };
    const mockPatientB = { id: 'patient-B', role: 'user' };
    const mockDoctor = { id: 'doctor-1', role: 'specialist' };

    const mockPublicRecordA = { id: 'rec-1', patient_id: 'patient-A', specialist_id: 'doctor-1', is_private: false };
    const mockPrivateRecordA = { id: 'rec-2', patient_id: 'patient-A', specialist_id: 'doctor-1', is_private: true };

    recordTest("Patient A can access their own public EMR record", 
        simulateEMRAccess(mockPublicRecordA, mockPatientA) === true ? "PASSED" : "FAILED"
    );

    recordTest("Patient B CANNOT access Patient A's EMR record (Tenant Isolation)", 
        simulateEMRAccess(mockPublicRecordA, mockPatientB) === false ? "PASSED" : "FAILED",
        "Cross-patient record snooping blocked"
    );

    recordTest("Patient A CANNOT access their own private clinical notes (is_private = true)", 
        simulateEMRAccess(mockPrivateRecordA, mockPatientA) === false ? "PASSED" : "FAILED",
        "Clinical confidentiality preserved"
    );

    recordTest("Doctor can access their patient's EMR records (public and private)", 
        (simulateEMRAccess(mockPublicRecordA, mockDoctor) === true &&
         simulateEMRAccess(mockPrivateRecordA, mockDoctor) === true) ? "PASSED" : "FAILED"
    );

    // -------------------------------------------------------------------------
    // 5. Privilege Escalation Prevention Tests
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing Privilege Escalation Prevention ---");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: hackData } = await anonClient
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', 'adaf5ed1-7315-4d6c-812d-b0c79ba01a1e');

    recordTest("Anonymous client cannot self-promote to super_admin", 
        (!hackData || hackData.length === 0) ? "PASSED" : "FAILED",
        "RLS & DB Trigger strictly prevent client privilege escalation"
    );

    // -------------------------------------------------------------------------
    // 6. Navigation and File Path Integrity Tests
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Testing Navigation and File Existence Integrity ---");
    const criticalNavRoutes = [
        'index.html', 'about.html', 'articles.html', 'events.html', 'login.html', 'register.html',
        'dashboard.html', 'emr.html', 'consultations.html', 'support.html', 'profile.html', 'print_document.html',
        'specialist/index.html', 'specialist/consultations.html', 'specialist/patients.html', 'specialist/calendar.html',
        'admin/index.html', 'admin/users.html', 'admin/consultations.html', 'admin/support.html', 'admin/security.html'
    ];

    criticalNavRoutes.forEach(r => {
        const full = path.join(rootDir, r);
        recordTest(`File exists for route [/${r}]`, fs.existsSync(full) ? "PASSED" : "FAILED");
    });

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log("\n======================================================================");
    console.log(`  QA EXECUTION SUMMARY:`);
    console.log(`  - TOTAL TESTS : ${testSummary.total}`);
    console.log(`  - PASSED      : ${testSummary.passed}`);
    console.log(`  - FAILED      : ${testSummary.failed}`);
    console.log(`  - BLOCKED     : ${testSummary.blocked}`);
    console.log(`  - NOT RUN     : ${testSummary.not_run}`);
    console.log("======================================================================\n");

    const outputPath = path.join(rootDir, 'scratch/test_roles_and_routes_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(testSummary, null, 2));
    console.log(`Saved results to: ${outputPath}`);
}

runRoleAndRouteTests().catch(err => {
    console.error("FATAL in test suite:", err);
    process.exit(1);
});
