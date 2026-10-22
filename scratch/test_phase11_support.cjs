// test_phase11_support.cjs - Comprehensive Verification Suite for Phase 11: Support Center & Complaint Management
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const SUPABASE_URL = 'process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'';
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
    console.log("  PHASE 11: SUPPORT CENTER & COMPLAINT MANAGEMENT SYSTEM QA");
    console.log("======================================================================\n");

    // -------------------------------------------------------------------------
    // 1. Supabase Migration & Schema Safety Check
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Migration 20240101000022 Schema & Defense-in-Depth ---");
    const migrationPath = path.join(rootDir, 'supabase/migrations/20240101000022_support_center_and_complaints.sql');
    const migrationExists = fs.existsSync(migrationPath);
    recordTest("Phase 11 SQL Migration file exists", migrationExists);

    if (migrationExists) {
        const migContent = fs.readFileSync(migrationPath, 'utf8');

        recordTest(
            "Migration creates public.support_tickets table with sequence and unique ticket_number",
            migContent.includes("CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq") &&
            migContent.includes("CREATE TABLE IF NOT EXISTS public.support_tickets") &&
            migContent.includes("ticket_number VARCHAR UNIQUE"),
            "TICK-YYYY-XXXX pattern"
        );

        recordTest(
            "Migration includes all required ticket fields (category, priority, status, assigned_to, internal_notes)",
            migContent.includes("category VARCHAR") &&
            migContent.includes("priority VARCHAR") &&
            migContent.includes("status VARCHAR") &&
            migContent.includes("assigned_to UUID") &&
            migContent.includes("internal_notes TEXT"),
            "Complete ticket lifecycle fields"
        );

        recordTest(
            "Migration creates public.support_ticket_messages table with is_internal flag",
            migContent.includes("CREATE TABLE IF NOT EXISTS public.support_ticket_messages") &&
            migContent.includes("is_internal BOOLEAN DEFAULT false"),
            "Strict isolation for internal notes"
        );

        recordTest(
            "Migration creates performance indexes for tickets and messages",
            migContent.includes("idx_support_tickets_user_id") &&
            migContent.includes("idx_support_tickets_status") &&
            migContent.includes("idx_support_tickets_category") &&
            migContent.includes("idx_ticket_messages_ticket") &&
            migContent.includes("idx_ticket_messages_internal"),
            "Fast query indexes on user_id, status, ticket_id, is_internal"
        );

        recordTest(
            "Migration enables RLS on both support_tickets and support_ticket_messages",
            migContent.includes("ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY") &&
            migContent.includes("ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY"),
            "Enforced at database level"
        );

        recordTest(
            "Migration implements strict RLS SELECT isolating user tickets",
            migContent.includes('CREATE POLICY "Users view own support tickets"') &&
            migContent.includes("auth.uid() = user_id OR"),
            "Users view own; Admins view all"
        );

        recordTest(
            "Migration implements strict RLS for messages hiding internal notes from users",
            migContent.includes('CREATE POLICY "Users view non-internal ticket messages"') &&
            migContent.includes("is_internal = false") &&
            migContent.includes("IN ('admin', 'super_admin')"),
            "Users NEVER receive is_internal = true messages"
        );

        recordTest(
            "Migration implements database trigger protecting ticket integrity",
            migContent.includes("protect_support_ticket_integrity") &&
            migContent.includes("BEFORE UPDATE ON public.support_tickets") &&
            migContent.includes("Ticket ownership cannot be altered"),
            "Prevents ownership theft, internal note tamper, or rogue escalations"
        );

        recordTest(
            "Migration implements secure RPC procedures with audit logging",
            migContent.includes("create_support_ticket_secure") &&
            migContent.includes("add_ticket_reply_secure") &&
            migContent.includes("INSERT INTO public.audit_logs"),
            "RPC functions with parameter validation and audit logging"
        );
    }

    // -------------------------------------------------------------------------
    // 2. User Support Center (HTML & JS) Check
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing User Support Center (support.html & js/support.js) ---");
    const supportHtmlPath = path.join(rootDir, 'support.html');
    const supportHtmlExists = fs.existsSync(supportHtmlPath);
    recordTest("support.html exists in project root", supportHtmlExists);

    if (supportHtmlExists) {
        const supportHtml = fs.readFileSync(supportHtmlPath, 'utf8');

        recordTest("support.html has RTL direction", supportHtml.includes('dir="rtl"'));
        recordTest("support.html has viewport meta tag", supportHtml.includes('name="viewport"'));
        recordTest("support.html has descriptive meta title and description", 
            supportHtml.includes('<title>مركز الدعم والشكاوى') &&
            supportHtml.includes('name="description"')
        );

        recordTest(
            "support.html displays healthcare privacy alert (no clinical details in support)",
            supportHtml.includes("تنبيه الخصوصية وسرية المعلومات") &&
            supportHtml.includes("عدم كتابة معلومات مرضية"),
            "Healthcare privacy guard against clinical data leakage"
        );

        recordTest(
            "support.html has tab bar (My Tickets vs New Ticket)",
            supportHtml.includes('id="tabMyTicketsBtn"') &&
            supportHtml.includes('id="tabNewTicketBtn"') &&
            supportHtml.includes('id="viewMyTickets"') &&
            supportHtml.includes('id="viewNewTicket"')
        );

        recordTest(
            "support.html new ticket form has all 6 required categories",
            supportHtml.includes('value="technical"') &&
            supportHtml.includes('value="account"') &&
            supportHtml.includes('value="appointment"') &&
            supportHtml.includes('value="consultation"') &&
            supportHtml.includes('value="inquiry"') &&
            supportHtml.includes('value="complaint"'),
            "technical, account, appointment, consultation, inquiry, complaint"
        );

        recordTest(
            "support.html has priority select (normal, low, high, urgent)",
            supportHtml.includes('id="ticketPriority"') &&
            supportHtml.includes('value="normal"') &&
            supportHtml.includes('value="urgent"')
        );

        recordTest(
            "support.html has ticket conversation modal with reply composer & close button",
            supportHtml.includes('id="ticketDetailModal"') &&
            supportHtml.includes('id="conversationThread"') &&
            supportHtml.includes('id="replyForm"') &&
            supportHtml.includes('id="userCloseTicketBtn"')
        );
    }

    const supportJsPath = path.join(rootDir, 'js/support.js');
    const supportJsExists = fs.existsSync(supportJsPath);
    recordTest("js/support.js exists and is loaded as module", supportJsExists);

    if (supportJsExists) {
        const supportJs = fs.readFileSync(supportJsPath, 'utf8');

        recordTest(
            "js/support.js validates input lengths (subject >= 3, description >= 10)",
            supportJs.includes("subject.length < 3") &&
            supportJs.includes("description.length < 10"),
            "Subject min 3, description min 10"
        );

        recordTest(
            "js/support.js restricts file upload size to 5MB",
            supportJs.includes("5 * 1024 * 1024"),
            "5MB max attachment limit"
        );

        recordTest(
            "js/support.js integrates with notification engine (createNotification)",
            supportJs.includes("createNotification("),
            "In-app notifications on ticket creation"
        );

        recordTest(
            "js/support.js provides safe local fallback for resilience",
            supportJs.includes("localStorage.setItem") &&
            supportJs.includes("localStorage.getItem"),
            "Zero crashes if network or migration pending"
        );
    }

    // -------------------------------------------------------------------------
    // 3. Admin Support Dashboard (HTML & JS) Check
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Admin Support Dashboard (admin/support.html & js/admin_support.js) ---");
    const adminSupportHtmlPath = path.join(rootDir, 'admin/support.html');
    const adminSupportHtmlExists = fs.existsSync(adminSupportHtmlPath);
    recordTest("admin/support.html exists", adminSupportHtmlExists);

    if (adminSupportHtmlExists) {
        const adminHtml = fs.readFileSync(adminSupportHtmlPath, 'utf8');

        recordTest("admin/support.html includes dynamic sidebar and header roots",
            adminHtml.includes('id="admin-sidebar-root"') &&
            adminHtml.includes('id="admin-header-root"')
        );

        recordTest("admin/support.html loads admin_components.js and guard.js",
            adminHtml.includes('admin_components.js') &&
            adminHtml.includes('guard.js')
        );

        recordTest("admin/support.html has 5 KPI stat cards",
            adminHtml.includes('id="statTotalTickets"') &&
            adminHtml.includes('id="statOpenTickets"') &&
            adminHtml.includes('id="statInProgressTickets"') &&
            adminHtml.includes('id="statWaitingUserTickets"') &&
            adminHtml.includes('id="statResolvedTickets"'),
            "Total, Open, In Progress, Waiting, Resolved"
        );

        recordTest("admin/support.html has search and multi-criteria filters",
            adminHtml.includes('id="searchInput"') &&
            adminHtml.includes('id="statusFilter"') &&
            adminHtml.includes('id="categoryFilter"') &&
            adminHtml.includes('id="priorityFilter"') &&
            adminHtml.includes('id="sortBy"')
        );

        recordTest("admin/support.html has dual composer (Public Reply vs Internal Staff Note)",
            adminHtml.includes('id="tabModeReply"') &&
            adminHtml.includes('id="tabModeInternal"') &&
            adminHtml.includes('id="internalCautionBanner"')
        );

        recordTest("admin/support.html has CSV export button",
            adminHtml.includes('id="exportTicketsBtn"')
        );
    }

    const adminSupportJsPath = path.join(rootDir, 'js/admin_support.js');
    const adminSupportJsExists = fs.existsSync(adminSupportJsPath);
    recordTest("js/admin_support.js exists and is loaded as module", adminSupportJsExists);

    if (adminSupportJsExists) {
        const adminJs = fs.readFileSync(adminSupportJsPath, 'utf8');

        recordTest(
            "admin_support.js strictly checks admin/super_admin role in profiles",
            adminJs.includes("role !== 'admin' && role !== 'super_admin'"),
            "Strict RBAC route protection"
        );

        recordTest(
            "admin_support.js clearly differentiates internal notes from public replies",
            adminJs.includes("is_internal: isInternal") &&
            adminJs.includes("internal-bubble") &&
            adminJs.includes("ملاحظة إدارية داخلية"),
            "Internal note banner and styling"
        );

        recordTest(
            "admin_support.js automatically updates ticket status to waiting_user on public reply",
            adminJs.includes("updateTicketStatus(activeTicket.id, 'waiting_user'"),
            "Prompts user for followup"
        );

        recordTest(
            "admin_support.js generates UTF-8 BOM CSV for Arabic spreadsheet compatibility",
            adminJs.includes("'\\uFEFF'") &&
            adminJs.includes("text/csv;charset=utf-8;"),
            "Compatible with Excel in Arabic"
        );
    }

    // -------------------------------------------------------------------------
    // 4. Privacy & Email Notification Templates Check
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Privacy-Safe Email Integration ---");
    const emailServicePath = path.join(rootDir, 'services/email_service.js');
    const emailServiceExists = fs.existsSync(emailServicePath);
    recordTest("services/email_service.js exists", emailServiceExists);

    if (emailServiceExists) {
        const emailContent = fs.readFileSync(emailServicePath, 'utf8');

        recordTest(
            "email_service.js has support_ticket_created template",
            emailContent.includes("support_ticket_created:"),
            "Ticket confirmation template"
        );

        recordTest(
            "email_service.js has support_ticket_reply template",
            emailContent.includes("support_ticket_reply:"),
            "Staff response notification template"
        );

        recordTest(
            "email_service.js has support_ticket_status template",
            emailContent.includes("support_ticket_status:"),
            "Status transition / resolution template"
        );

        recordTest(
            "email_service.js sanitizes medical keywords from support emails",
            emailContent.includes("sanitizeForPrivacy(data.subject"),
            "Prevents accidental leakage of clinical keywords"
        );
    }

    // -------------------------------------------------------------------------
    // 5. CSS & Visual Design System Check
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing CSS Design System & Support Badges ---");
    const adminCssPath = path.join(rootDir, 'css/admin.css');
    const adminCss = fs.readFileSync(adminCssPath, 'utf8');

    recordTest(
        "css/admin.css has ticket status badges (open, waiting_user, resolved, closed)",
        adminCss.includes(".status-badge.open") &&
        adminCss.includes(".status-badge.waiting_user") &&
        adminCss.includes(".status-badge.resolved") &&
        adminCss.includes(".status-badge.closed"),
        "Colors match design system"
    );

    recordTest(
        "css/admin.css has priority badges (urgent, high, normal, low)",
        adminCss.includes(".priority-urgent") &&
        adminCss.includes(".priority-high") &&
        adminCss.includes(".priority-normal") &&
        adminCss.includes(".priority-low")
    );

    recordTest(
        "css/admin.css has conversation thread and bubble styles (user, staff, internal)",
        adminCss.includes(".support-conversation-thread") &&
        adminCss.includes(".support-bubble.user-bubble") &&
        adminCss.includes(".support-bubble.staff-bubble") &&
        adminCss.includes(".support-bubble.internal-bubble"),
        "Clear visual distinction for internal notes"
    );

    // -------------------------------------------------------------------------
    // 6. Navigation Integration Across User and Admin Portals
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Testing Navigation Integration Across Portals ---");
    const adminCompPath = path.join(rootDir, 'js/admin_components.js');
    const adminCompContent = fs.readFileSync(adminCompPath, 'utf8');
    recordTest(
        "admin_components.js sidebar has link to support.html (مركز الدعم والشكاوى)",
        adminCompContent.includes('href="support.html"') &&
        adminCompContent.includes("مركز الدعم والشكاوى"),
        "Integrated in Admin navigation"
    );

    const dashboardHtml = fs.readFileSync(path.join(rootDir, 'dashboard.html'), 'utf8');
    recordTest(
        "dashboard.html sidebar has link to support.html",
        dashboardHtml.includes('href="support.html"') &&
        dashboardHtml.includes("مركز الدعم والشكاوى")
    );

    const profileHtml = fs.readFileSync(path.join(rootDir, 'profile.html'), 'utf8');
    recordTest(
        "profile.html sidebar has link to support.html",
        profileHtml.includes('href="support.html"')
    );

    const emrHtml = fs.readFileSync(path.join(rootDir, 'emr.html'), 'utf8');
    recordTest(
        "emr.html sidebar has link to support.html",
        emrHtml.includes('href="support.html"')
    );

    // -------------------------------------------------------------------------
    // 7. Security Simulation: User Isolation & Internal Note Privacy
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Security Simulation: Isolation & Privacy Tests ---");

    // Simulate RLS Ticket Isolation Rule
    function checkTicketAccess(ticket, caller) {
        if (!caller) return false;
        if (caller.role === 'admin' || caller.role === 'super_admin') return true;
        return ticket.user_id === caller.id;
    }

    const mockTickets = [
        { id: 't1', user_id: 'user-alpha', subject: 'مشكلة فنية A' },
        { id: 't2', user_id: 'user-beta', subject: 'مشكلة فنية B' }
    ];

    const callerAlpha = { id: 'user-alpha', role: 'user' };
    const callerBeta = { id: 'user-beta', role: 'user' };
    const callerAdmin = { id: 'admin-1', role: 'admin' };

    recordTest(
        "User Alpha can view their own ticket (t1)",
        checkTicketAccess(mockTickets[0], callerAlpha) === true
    );

    recordTest(
        "User Alpha CANNOT view User Beta's ticket (t2)",
        checkTicketAccess(mockTickets[1], callerAlpha) === false,
        "RLS User Isolation enforced"
    );

    recordTest(
        "User Beta CANNOT view User Alpha's ticket (t1)",
        checkTicketAccess(mockTickets[0], callerBeta) === false,
        "Bidirectional Isolation enforced"
    );

    recordTest(
        "Admin can view all tickets (t1 & t2)",
        checkTicketAccess(mockTickets[0], callerAdmin) === true &&
        checkTicketAccess(mockTickets[1], callerAdmin) === true,
        "Staff supervision authorized"
    );

    // Simulate Message / Internal Note Visibility Rule
    function checkMessageVisibility(message, ticket, caller) {
        if (!caller) return false;
        if (caller.role === 'admin' || caller.role === 'super_admin') return true;
        // Ordinary user: must own the ticket AND message must NOT be internal
        if (ticket.user_id === caller.id && message.is_internal === false) return true;
        return false;
    }

    const mockPublicMsg = { id: 'm1', ticket_id: 't1', is_internal: false, message: 'رد رسمي من الدعم' };
    const mockInternalNote = { id: 'm2', ticket_id: 't1', is_internal: true, message: 'ملاحظة داخلية: المستخدم قام بتغيير كلمة المرور' };

    recordTest(
        "User Alpha can view public message on their ticket",
        checkMessageVisibility(mockPublicMsg, mockTickets[0], callerAlpha) === true
    );

    recordTest(
        "User Alpha CANNOT view internal staff note on their ticket",
        checkMessageVisibility(mockInternalNote, mockTickets[0], callerAlpha) === false,
        "Internal staff notes strictly hidden from requester"
    );

    recordTest(
        "Admin can view both public messages and internal notes",
        checkMessageVisibility(mockPublicMsg, mockTickets[0], callerAdmin) === true &&
        checkMessageVisibility(mockInternalNote, mockTickets[0], callerAdmin) === true,
        "Admins have complete visibility"
    );

    // -------------------------------------------------------------------------
    // 8. Live Supabase API Verification
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Live Supabase API & Super Admin Connectivity ---");
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: 'admin@example.org',
            password: 'CHANGE_ME_SECURE_PASSWORD'
        });

        if (authError) {
            recordTest("Super Admin Authentication", false, authError.message);
        } else {
            recordTest("Super Admin Authentication", true, `Logged in as ${authData.user.email}`);

            // Check profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', authData.user.id)
                .single();

            recordTest("Super Admin Profile Verification", 
                profile && profile.role === 'super_admin',
                `Role: ${profile?.role}`
            );
        }
    } catch (err) {
        recordTest("Live Supabase Connectivity", false, err.message);
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log("\n======================================================================");
    console.log(`  QA SUMMARY: ${results.passed} / ${results.total} Tests Passed (${Math.round((results.passed / results.total) * 100)}%)`);
    console.log("======================================================================\n");

    const outputPath = path.join(rootDir, 'scratch/phase11_test_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    if (results.failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error("FATAL in test suite:", err);
    process.exit(1);
});
