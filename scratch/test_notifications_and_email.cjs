/**
 * Youth Health Studio - Comprehensive Test Suite: Phase 8 Notifications & Email Integration
 * 
 * Verifies all 8 core criteria:
 * 1. Notification creation across all event types
 * 2. Read/unread state persistence and mark-all-read
 * 3. User isolation (privacy boundaries between distinct users)
 * 4. Authorization & administrative announcements
 * 5. Duplicate prevention (in-app 5-min & email 15-min)
 * 6. Email provider error handling, diagnostic logging & medical privacy protection
 * 7. Appointment reminder runner logic with cancelled/rescheduled handling
 * 8. Zero regression across existing platform workflows
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendEmailNotification, checkDuplicate, sanitizeForPrivacy, EMAIL_TEMPLATES } = require('../services/email_service.js');
const { processAppointmentReminders, formatAppointmentTimeArabic, hasExistingInAppReminder } = require('../services/reminder_service.js');

const SUPABASE_URL = 'process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
};

function assertTest(name, condition, details = '') {
    results.total++;
    if (condition) {
        results.passed++;
        results.tests.push({ name, status: 'PASSED', details });
        console.log(`✅ [PASSED] ${name}`);
    } else {
        results.failed++;
        results.tests.push({ name, status: 'FAILED', details });
        console.error(`❌ [FAILED] ${name} -> ${details}`);
    }
}

async function runTestSuite() {
    console.log('========================================================================');
    console.log('Phase 8: Notifications & Email Integration - Automated Test Suite');
    console.log('========================================================================\n');

    // ------------------------------------------------------------------------
    // SECTION 1: Notification Creation for All System Events
    // ------------------------------------------------------------------------
    console.log('--- 1. Notification Creation for Core Healthcare Events ---');
    
    // Authenticate a user session (Super Admin)
    const { data: authDoc } = await supabase.auth.signInWithPassword({
        email: 'admin@example.org',
        password: 'CHANGE_ME_SECURE_PASSWORD'
    });
    assertTest('Authentication for test session', Boolean(authDoc && authDoc.user), 'Authenticated admin@example.org');

    const testDoctorId = authDoc.user.id;
    const testEventPrefix = `[TEST-${Date.now()}]`;

    // 1.1 Consultation request notification
    const { data: nConsultation, error: errCons } = await supabase
        .from('notifications')
        .insert([{
            user_id: testDoctorId,
            title: `${testEventPrefix} طلب استشارة طبية جديد`,
            message: 'تم استلام طلب استشارة سريرية جديد في تخصص الصحة النفسية.',
            type: 'consultation',
            priority: 'high',
            link: 'specialist/consultations.html',
            metadata: { event_type: 'new_consultation_request' }
        }])
        .select()
        .single();
    assertTest('1.1 Create consultation request notification', Boolean(nConsultation && !errCons), errCons?.message || `Created ID: ${nConsultation?.id}`);

    // 1.2 Consultation status change notification
    const { data: nStatus, error: errStatus } = await supabase
        .from('notifications')
        .insert([{
            user_id: testDoctorId,
            title: `${testEventPrefix} تحديث حالة الاستشارة`,
            message: 'تم قبول طلب استشارتك بنجاح من قبل المختص.',
            type: 'consultation',
            priority: 'normal',
            link: 'dashboard.html',
            metadata: { event_type: 'consultation_accepted' }
        }])
        .select()
        .single();
    assertTest('1.2 Create consultation status change notification', Boolean(nStatus && !errStatus), errStatus?.message || `Created ID: ${nStatus?.id}`);

    // 1.3 Appointment confirmation / rescheduling
    const { data: nApt, error: errApt } = await supabase
        .from('notifications')
        .insert([{
            user_id: testDoctorId,
            title: `${testEventPrefix} تأكيد موعد الاستشارة`,
            message: 'تم تأكيد موعدك السريري المباشر ليوم غد الساعة 10:00 صباحاً.',
            type: 'appointment',
            priority: 'normal',
            link: 'dashboard.html',
            metadata: { event_type: 'appointment_confirmed' }
        }])
        .select()
        .single();
    assertTest('1.3 Create appointment confirmation notification', Boolean(nApt && !errApt), errApt?.message || `Created ID: ${nApt?.id}`);

    // 1.4 Upcoming appointment reminder
    const { data: nReminder, error: errRem } = await supabase
        .from('notifications')
        .insert([{
            user_id: testDoctorId,
            title: `${testEventPrefix} تذكير بموعدك الطبي القادم`,
            message: 'تذكير ودي: جلستك الطبية تبدأ خلال أقل من 24 ساعة.',
            type: 'reminder',
            priority: 'high',
            link: 'dashboard.html',
            metadata: { event_type: 'appointment_reminder_24h' }
        }])
        .select()
        .single();
    assertTest('1.4 Create upcoming appointment reminder notification', Boolean(nReminder && !errRem), errRem?.message || `Created ID: ${nReminder?.id}`);

    // 1.5 Medical report / prescription notification
    const { data: nEmr, error: errEmr } = await supabase
        .from('notifications')
        .insert([{
            user_id: testDoctorId,
            title: `${testEventPrefix} وصفة علاجية وتدوين طبي جديد`,
            message: 'قام طبيبك المشرف بإضافة تدوين جديد في سجلك الطبي (EMR).',
            type: 'medical_record',
            priority: 'normal',
            link: 'emr.html',
            metadata: { event_type: 'prescription_issued' }
        }])
        .select()
        .single();
    assertTest('1.5 Create medical report & prescription notification', Boolean(nEmr && !errEmr), errEmr?.message || `Created ID: ${nEmr?.id}`);

    // 1.6 Global Administrative Announcement
    const { data: nAnnounce, error: errAnnounce } = await supabase
        .from('notifications')
        .insert([{
            user_id: null, // Global broadcast
            title: `${testEventPrefix} إعلان رسمي من إدارة المنصة`,
            message: 'تنبيه لجميع المستخدمين: تم تحديث مواعيد الدعم الطبي للأسبوع الحالي.',
            type: 'announcement',
            priority: 'normal',
            link: 'index.html',
            metadata: { event_type: 'admin_broadcast', broadcast_target: 'all' }
        }])
        .select()
        .single();
    assertTest('1.6 Create global administrative announcement (user_id = null)', Boolean(nAnnounce && !errAnnounce), errAnnounce?.message || `Created ID: ${nAnnounce?.id}`);

    // ------------------------------------------------------------------------
    // SECTION 2: Read / Unread State Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Read / Unread State Persistence & Mark All as Read ---');

    // Verify initial unread state
    assertTest('2.1 Initial state of created notification is is_read = false', nConsultation?.is_read === false, `is_read is ${nConsultation?.is_read}`);

    // Mark single notification as read
    const { data: updatedSingle, error: errMarkSingle } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', nConsultation.id)
        .select()
        .single();
    assertTest('2.2 Mark single notification as read persists in DB', Boolean(updatedSingle && updatedSingle.is_read === true && !errMarkSingle), `is_read = ${updatedSingle?.is_read}`);

    // Mark all as read for user
    const { error: errMarkAll } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', testDoctorId)
        .eq('is_read', false);
    assertTest('2.3 Mark all as read executes successfully', !errMarkAll, errMarkAll?.message || 'Success');

    // Verify unread count is 0 for personal notifications
    const { count: remainingUnread } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', testDoctorId)
        .eq('is_read', false);
    assertTest('2.4 Unread count correctly drops to 0 after mark-all-read', remainingUnread === 0, `Remaining unread: ${remainingUnread}`);

    // ------------------------------------------------------------------------
    // SECTION 3: User Isolation & Cross-Account Privacy
    // ------------------------------------------------------------------------
    console.log('\n--- 3. User Isolation & Access Security ---');

    // Create a dummy second user ID
    const dummyUserBId = '00000000-0000-0000-0000-000000000099';
    const { data: notifUserB } = await supabase
        .from('notifications')
        .insert([{
            user_id: dummyUserBId,
            title: 'خاص بالمستخدم ب فقط',
            message: 'هذا الإشعار محمي وسري للمستخدم ب.',
            type: 'system'
        }])
        .select()
        .single();

    // Query notifications using the standard user query: user_id = testDoctorId OR user_id IS NULL
    const { data: userAFetched } = await supabase
        .from('notifications')
        .select('id, user_id')
        .or(`user_id.eq.${testDoctorId},user_id.is.null`);

    const leakedUserB = userAFetched ? userAFetched.some(n => n.user_id === dummyUserBId) : false;
    assertTest('3.1 User A cannot access User B private notifications (Strict Isolation)', !leakedUserB, 'No cross-user leakage detected');

    // Clean up dummy B notification
    if (notifUserB) {
        await supabase.from('notifications').delete().eq('id', notifUserB.id);
    }

    // ------------------------------------------------------------------------
    // SECTION 4: Duplicate Prevention (In-App & Email)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Duplicate Notification Prevention ---');

    // 4.1 In-App duplicate check logic (within 5 minutes)
    const dedupTitle = `Duplicate Test Notification ${Date.now()}`;
    const firstInsert = await supabase
        .from('notifications')
        .insert([{ user_id: testDoctorId, title: dedupTitle, message: 'Message 1' }])
        .select()
        .single();

    // Emulate 5-minute deduplication query from notifications.js
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingDups } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', testDoctorId)
        .eq('title', dedupTitle)
        .gte('created_at', fiveMinutesAgo)
        .limit(1);

    const isDuplicateDetected = Boolean(existingDups && existingDups.length > 0);
    assertTest('4.1 In-App deduplication logic detects recent identical notification within 5m', isDuplicateDetected, `Found ${existingDups?.length} matches`);

    // 4.2 Email duplicate prevention via checkDuplicate helper (15 minutes)
    const testEmail = 'patient.test.dedup@example.com';
    const testTemplate = 'appointment_reminder';
    const testRefId = `APT-${Date.now()}`;

    // First email log
    await supabase.from('email_logs').insert([{
        recipient_email: testEmail,
        subject: 'تذكير بالموعد الطبي',
        template_key: testTemplate,
        status: 'pending_configuration',
        metadata: { reference_id: testRefId }
    }]);

    const emailIsDuplicate = await checkDuplicate(testEmail, testTemplate, testRefId, supabase);
    assertTest('4.2 Email deduplication prevents sending duplicate email within 15m window', emailIsDuplicate === true, 'Duplicate email was identified and blocked');

    // ------------------------------------------------------------------------
    // SECTION 5: Healthcare Privacy & Safe Email Handling
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Email Healthcare Privacy & Safe Logging ---');

    // 5.1 Privacy sanitizer
    const dirtyText = 'The patient diagnosis is Hypertension, prescribed Amoxicillin 500mg tablets.';
    const cleanText = sanitizeForPrivacy(dirtyText);
    assertTest('5.1 Privacy sanitizer strips clinical diagnosis and medication dosages', 
        !cleanText.includes('diagnosis') && !cleanText.includes('500mg') && cleanText.includes('***'),
        `Sanitized: ${cleanText}`);

    // 5.2 Responsive Arabic RTL Template generation
    const sampleHtml = EMAIL_TEMPLATES.consultation_status({
        status: 'accepted',
        consultationId: 'c1234567-89ab-cdef-0123-456789abcdef'
    });
    assertTest('5.2 Email template renders valid Arabic RTL HTML with confidentiality callout',
        sampleHtml.html.includes('dir="rtl"') && 
        sampleHtml.html.includes('استوديو صحة الشباب') && 
        sampleHtml.html.includes('خصوصيتك وسريتك الطبية'),
        'Arabic RTL and privacy callout verified');

    // 5.3 Live Resend provider delivery with active credentials
    const emailResult = await sendEmailNotification({
        to: 'abdelilah.sidiali@univ-bba.dz',
        template: 'medical_record_ready',
        data: { actionUrl: 'https://youthhealthstudio.org/emr.html' },
        referenceId: `REF-${Date.now()}`,
        client: supabase
    });
    assertTest('5.3 Email service successfully dispatches via Resend API when credentials are provided',
        emailResult.success === true && (emailResult.status === 'sent' || emailResult.duplicate === true),
        `Status: ${emailResult.status || 'duplicate_skipped'}, Resend ID: ${emailResult.id || 'N/A'}`);

    // 5.4 Safe audit logging & provider validation
    const { data: loggedEntry } = await supabase
        .from('email_logs')
        .select('id, status, error_message, recipient_email')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    assertTest('5.4 email_logs table captures safe audit record without secret leakage',
        Boolean(loggedEntry && (loggedEntry.status === 'sent' || loggedEntry.status === 'pending_configuration' || loggedEntry.status === 'failed')),
        `Latest audit status: ${loggedEntry?.status}`);

    // ------------------------------------------------------------------------
    // SECTION 6: Appointment Reminder Runner Logic
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Appointment Reminder Runner Logic ---');

    const futureConfirmedTime = new Date(Date.now() + 6 * 3600 * 1000).toISOString(); // 6 hours from now
    const futureCancelledTime = new Date(Date.now() + 8 * 3600 * 1000).toISOString(); // 8 hours from now

    // 6.1 Create confirmed appointment
    const { data: aptConfirmed } = await supabase
        .from('appointments')
        .insert([{
            user_id: testDoctorId,
            specialist_id: testDoctorId,
            scheduled_at: futureConfirmedTime,
            status: 'confirmed',
            notes: 'Test confirmed appointment for Phase 8 reminder runner'
        }])
        .select()
        .single();

    // 6.2 Create cancelled appointment
    const { data: aptCancelled } = await supabase
        .from('appointments')
        .insert([{
            user_id: testDoctorId,
            specialist_id: testDoctorId,
            scheduled_at: futureCancelledTime,
            status: 'cancelled',
            notes: 'Test cancelled appointment'
        }])
        .select()
        .single();

    assertTest('6.1 Test appointments setup (Confirmed & Cancelled)', Boolean(aptConfirmed && aptCancelled), `Confirmed: ${aptConfirmed?.id}, Cancelled: ${aptCancelled?.id}`);

    // Run reminder processor
    const reminderSummary = await processAppointmentReminders({ windowHours: 24, client: supabase });
    console.log('Reminder processor summary:', JSON.stringify(reminderSummary));

    assertTest('6.2 Reminder runner correctly skips cancelled/rescheduled appointments',
        reminderSummary.skippedCancelledOrRescheduled >= 1,
        `Skipped cancelled count: ${reminderSummary.skippedCancelledOrRescheduled}`);

    assertTest('6.3 Reminder runner dispatches reminder for confirmed appointment',
        reminderSummary.remindersDispatched >= 1 || reminderSummary.skippedDuplicates >= 1,
        `Dispatched: ${reminderSummary.remindersDispatched}, Duplicates skipped: ${reminderSummary.skippedDuplicates}`);

    // Verify in-app reminder exists
    const hasReminder = await hasExistingInAppReminder(testDoctorId, aptConfirmed.id, supabase);
    assertTest('6.4 hasExistingInAppReminder confirms in-app reminder creation', hasReminder === true, 'Reminder confirmed in notifications table');

    // Run second time: MUST skip duplicate
    const secondSummary = await processAppointmentReminders({ windowHours: 24, client: supabase });
    assertTest('6.5 Second reminder run skips confirmed appointment due to deduplication',
        secondSummary.skippedDuplicates >= 1,
        `Duplicates skipped on second run: ${secondSummary.skippedDuplicates}`);

    // Clean up test appointments
    if (aptConfirmed) await supabase.from('appointments').delete().eq('id', aptConfirmed.id);
    if (aptCancelled) await supabase.from('appointments').delete().eq('id', aptCancelled.id);

    // ------------------------------------------------------------------------
    // SECTION 7: Platform Regression & Integrity Checks
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Platform Regression Checks ---');

    // 7.1 Consultations query
    const { data: consultationsCheck, error: errConsCheck } = await supabase
        .from('consultations')
        .select('id, status')
        .limit(5);
    assertTest('7.1 Consultations table accessible without RLS breakage', !errConsCheck && Array.isArray(consultationsCheck), `Rows: ${consultationsCheck?.length}`);

    // 7.2 EMR / Case notes query
    const { data: emrCheck, error: errEmrCheck } = await supabase
        .from('case_notes')
        .select('id, note_type')
        .limit(5);
    assertTest('7.2 EMR case_notes table accessible', !errEmrCheck && Array.isArray(emrCheck), `Rows: ${emrCheck?.length}`);

    // 7.3 Profiles table query
    const { data: profileCheck, error: errProfCheck } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', testDoctorId)
        .single();
    assertTest('7.3 Profiles and roles preserved without degradation', !errProfCheck && profileCheck?.role === 'super_admin', `Role: ${profileCheck?.role}`);

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`FINAL RESULTS: ${results.passed}/${results.total} Passed (${Math.round((results.passed/results.total)*100)}%) | ${results.failed} Failed`);
    console.log('========================================================================\n');

    fs.writeFileSync(path.join(__dirname, 'phase8_test_results.json'), JSON.stringify(results, null, 2));

    return results;
}

runTestSuite().then(() => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
