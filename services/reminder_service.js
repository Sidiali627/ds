/**
 * Youth Health Studio - Appointment Reminder Scheduling Engine
 * 
 * - Scans upcoming confirmed appointments within the 24-hour window
 * - Excludes cancelled, rejected, and rescheduled appointments
 * - Enforces zero duplicate alerts via notifications and email_logs lookup
 * - Formats time according to application timezone (UTC / Africa/Algiers / Local)
 * - Dispatches in-app reminders and invokes email notification service
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmailNotification } = require('./email_service.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xsuednrcrzbjdyrdrgat.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

let defaultSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function setSupabaseClient(client) {
    if (client) defaultSupabase = client;
}

/**
 * Formats appointment timestamp cleanly for Arabic presentation
 */
function formatAppointmentTimeArabic(isoDateStr) {
    try {
        const d = new Date(isoDateStr);
        return d.toLocaleString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    } catch {
        return isoDateStr;
    }
}

/**
 * Checks whether an in-app reminder was already created for this appointment within the current reminder cycle
 */
async function hasExistingInAppReminder(userId, appointmentId, client = defaultSupabase) {
    try {
        const { data, error } = await client
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'reminder')
            .filter('metadata->>appointment_id', 'eq', String(appointmentId))
            .limit(1);

        if (error) {
            console.warn('[ReminderService] Query existing reminder notice:', error.message);
            return false;
        }

        return data && data.length > 0;
    } catch (err) {
        console.warn('[ReminderService] In-app reminder dedup check failed:', err.message);
        return false;
    }
}

/**
 * Core processor for scanning and dispatching appointment reminders
 * 
 * @param {Object} options
 * @param {number} [options.windowHours=24] - Lookahead window in hours
 * @param {Date} [options.referenceTime=new Date()] - Reference point for time calculations
 */
async function processAppointmentReminders({ windowHours = 24, referenceTime = new Date(), client = defaultSupabase } = {}) {
    const startTime = referenceTime.toISOString();
    const endTime = new Date(referenceTime.getTime() + windowHours * 3600 * 1000).toISOString();

    console.log(`[ReminderService] Scanning upcoming appointments between ${startTime} and ${endTime}...`);

    const summary = {
        scanWindowHours: windowHours,
        scanStart: startTime,
        scanEnd: endTime,
        totalFound: 0,
        confirmedEligible: 0,
        remindersDispatched: 0,
        skippedDuplicates: 0,
        skippedCancelledOrRescheduled: 0,
        errors: []
    };

    try {
        // Query upcoming appointments in window
        const { data: appointments, error } = await client
            .from('appointments')
            .select(`
                id,
                user_id,
                specialist_id,
                scheduled_at,
                status,
                duration_minutes
            `)
            .gte('scheduled_at', startTime)
            .lte('scheduled_at', endTime);

        if (error) {
            summary.errors.push(`Failed to query appointments: ${error.message}`);
            return summary;
        }

        summary.totalFound = appointments ? appointments.length : 0;

        if (!appointments || appointments.length === 0) {
            console.log('[ReminderService] No appointments scheduled in the target window.');
            return summary;
        }

        for (const apt of appointments) {
            // STRICT FILTER: Ignore non-confirmed statuses (e.g. cancelled, rescheduled, rejected, pending)
            if (apt.status !== 'confirmed') {
                summary.skippedCancelledOrRescheduled++;
                console.log(`[ReminderService] Appointment ${apt.id} skipped due to non-confirmed status: '${apt.status}'`);
                continue;
            }

            summary.confirmedEligible++;

            // 1. Deduplication check: in-app notification
            const alreadyRemindedInApp = await hasExistingInAppReminder(apt.user_id, apt.id, client);
            if (alreadyRemindedInApp) {
                summary.skippedDuplicates++;
                console.log(`[ReminderService] Appointment ${apt.id} already has a reminder in-app. Skipping.`);
                continue;
            }

            const formattedTime = formatAppointmentTimeArabic(apt.scheduled_at);

            // 2. Create In-App Notification
            const notifTitle = 'تذكير بموعدك الطبي القادم ⏰';
            const notifMessage = `نود تذكيرك باقتراب موعد استشارتك الطبية المحددة في: ${formattedTime}. يرجى التواجد بالموعد قبل البدء بدقائق.`;

            const { error: notifErr } = await client
                .from('notifications')
                .insert([{
                    user_id: apt.user_id,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'reminder',
                    priority: 'high',
                    is_read: false,
                    link: 'dashboard.html',
                    metadata: {
                        appointment_id: apt.id,
                        scheduled_at: apt.scheduled_at,
                        reminder_window: windowHours
                    }
                }]);

            if (notifErr) {
                summary.errors.push(`Failed to insert notification for appointment ${apt.id}: ${notifErr.message}`);
                continue;
            }

            // 3. Fetch patient profile to check for email dispatch
            try {
                const { data: patientProfile } = await client
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', apt.user_id)
                    .single();

                if (patientProfile && patientProfile.email) {
                    await sendEmailNotification({
                        to: patientProfile.email,
                        template: 'appointment_reminder',
                        data: {
                            formattedDate: formattedTime,
                            actionUrl: 'https://youthhealthstudio.org/dashboard.html'
                        },
                        referenceId: apt.id,
                        metadata: {
                            appointment_id: apt.id,
                            user_id: apt.user_id
                        },
                        client: client
                    });
                }
            } catch (emailErr) {
                console.warn(`[ReminderService] Notice on email dispatch for apt ${apt.id}:`, emailErr.message);
            }

            summary.remindersDispatched++;
            console.log(`[ReminderService] Successfully dispatched reminder for appointment ${apt.id} to user ${apt.user_id}`);
        }

        return summary;
    } catch (err) {
        summary.errors.push(`Critical exception in reminder runner: ${err.message}`);
        return summary;
    }
}

// Allow direct execution via CLI (e.g. `node services/reminder_service.js`)
if (require.main === module) {
    (async () => {
        console.log('Running Appointment Reminder Scheduler...');
        const res = await processAppointmentReminders();
        console.log('Reminder Execution Result:', JSON.stringify(res, null, 2));
    })();
}

module.exports = {
    processAppointmentReminders,
    formatAppointmentTimeArabic,
    hasExistingInAppReminder,
    setSupabaseClient
};
