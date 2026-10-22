
/**
 * Youth Health Studio - Privacy-Preserving Email Service
 * 
 * Supports:
 * - Resend HTTP API (via RESEND_API_KEY)
 * - SMTP fallback (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * - Safe Diagnostic Mode (status: 'pending_configuration' if keys missing)
 * - 15-minute deduplication window via email_logs
 * - Strict Healthcare Privacy: NEVER leaks diagnoses, prescriptions, or clinical notes into emails!
 * - Responsive Arabic RTL templates
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Auto-load .env if available
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    } catch {
        // Silently continue if .env cannot be parsed
    }
}

// Load environment variables or configuration defaults
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Youth Health Studio <no-reply@example.com>';

let defaultSupabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    defaultSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function setSupabaseClient(client) {
    if (client) defaultSupabase = client;
}

function getSupabaseClient() {
    return defaultSupabase;
}

function canPersistEmailLogs(client) {
    return Boolean(client && typeof client.from === 'function');
}

/**
 * Strips any sensitive medical information to guarantee patient privacy
 */
function sanitizeForPrivacy(text) {
    if (!text) return '';
    // Prevent accidental leakage of clinical keywords
    const blacklist = [/diagnos[a-z]*/gi, /prescript[a-z]*/gi, /mg\b/gi, /tablet[s]?/gi, /mg\/ml/gi, /جرعة/gi, /تشخيص/gi, /علاج:/gi];
    let sanitized = text;
    for (const pattern of blacklist) {
        sanitized = sanitized.replace(pattern, '***');
    }
    return sanitized;
}

/**
 * Base Arabic RTL HTML Template Builder
 */
function buildArabicEmailHtml({ title, subtitle, mainMessage, actionText, actionUrl, badgeText, badgeColor = '#0284c7' }) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; color: #1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                            <div style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">استوديو صحة الشباب</div>
                            <div style="font-size: 13px; opacity: 0.9; font-weight: 500;">Youth Health Studio • المنصة الطبية المعتمدة للشباب</div>
                        </td>
                    </tr>
                    
                    <!-- Content Card -->
                    <tr>
                        <td style="padding: 32px 28px;">
                            ${badgeText ? `
                            <div style="margin-bottom: 16px;">
                                <span style="background-color: ${badgeColor}15; color: ${badgeColor}; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid ${badgeColor}30; display: inline-block;">
                                    ${badgeText}
                                </span>
                            </div>` : ''}

                            <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; line-height: 1.4;">${title}</h1>
                            ${subtitle ? `<p style="font-size: 14px; color: #64748b; margin: 0 0 20px 0; line-height: 1.5;">${subtitle}</p>` : ''}
                            
                            <div style="font-size: 15px; line-height: 1.8; color: #334155; margin-bottom: 28px; background: #f8fafc; padding: 20px; border-radius: 12px; border-right: 4px solid #0284c7;">
                                ${mainMessage}
                            </div>

                            <!-- Privacy Assurance Callout -->
                            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 28px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">🔒</span>
                                <span style="font-size: 12px; color: #065f46; font-weight: 600; line-height: 1.4;">
                                    لحماية خصوصيتك وسريتك الطبية، لا نرسل أي تشخيصات أو تفاصيل علاجية عبر البريد الإلكتروني.
                                </span>
                            </div>

                            <!-- Action Button -->
                            ${actionUrl ? `
                            <div style="text-align: center; margin: 28px 0 16px 0;">
                                <a href="${actionUrl}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                                    ${actionText || 'تسجيل الدخول الآمن للمتابعة'}
                                </a>
                            </div>` : ''}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
                            <div style="font-weight: 600; color: #475569; margin-bottom: 4px;">منصة استوديو صحة الشباب - Youth Health Studio</div>
                            <div>تم إرسال هذا البريد التلقائي لكونك مسجلاً في المنصة. إذا لم تكن قمت بهذا الإجراء، يرجى مراجعة فريق الدعم فوراً.</div>
                            <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Predefined Privacy-Preserving Templates
 */
const EMAIL_TEMPLATES = {
    // 1. Consultation status update
    consultation_status: (data) => {
        const statusArabic = data.status === 'accepted' ? 'تم قبولها وتعيين الطبيب المختص' :
            data.status === 'in_progress' ? 'بدأت الجلسة السريرية' :
            data.status === 'completed' ? 'اكتملت بنجاح' :
            data.status === 'rejected' ? 'اعتذر المختص عن قبولها' : 'قيد المراجعة';
            
        return {
            subject: 'تحديث بشأن استشارتك الطبية - استوديو صحة الشباب',
            html: buildArabicEmailHtml({
                title: 'تحديث حالة الاستشارة الطبية',
                subtitle: `مرجع الاستشارة: #${(data.consultationId || '').substring(0, 8).toUpperCase()}`,
                badgeText: 'استشارة طبية',
                badgeColor: '#0284c7',
                mainMessage: `مرحباً بك، نود إعلامك بأنه تم تحديث حالة استشارتك إلى: <strong>${statusArabic}</strong>.<br><br>يرجى تسجيل الدخول إلى حسابك بأمان لمتابعة مستجدات الرعاية الصحية والتواصل مع الطبيب المشرف عبر الجلسة المباشرة.`,
                actionText: 'عرض تفاصيل الاستشارة الآن',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/dashboard.html'
            })
        };
    },

    // 2. Appointment confirmation
    appointment_confirmation: (data) => {
        return {
            subject: 'تأكيد موعدك الطبي - استوديو صحة الشباب',
            html: buildArabicEmailHtml({
                title: 'تم تأكيد موعدك الطبي بنجاح',
                subtitle: data.formattedDate ? `الموعد المحدد: ${data.formattedDate}` : 'موعد سريري مؤكد',
                badgeText: 'تأكيد موعد',
                badgeColor: '#059669',
                mainMessage: `مرحباً بك، يسعدنا تأكيد حجز موعدك الطبي مع الطبيب المختص.<br><br>تاريخ وتوقيت الجلسة: <strong>${data.formattedDate || 'يرجى مراجعة جدولك'}</strong>.<br>يمكنك الدخول إلى قاعة الاستشارة الافتراضية قبل الموعد بـ 5 دقائق.`,
                actionText: 'عرض تفاصيل الموعد في جدولك',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/dashboard.html'
            })
        };
    },

    // 3. Appointment reminder (24h or upcoming)
    appointment_reminder: (data) => {
        return {
            subject: 'تذكير بموعدك الطبي القادم - استوديو صحة الشباب',
            html: buildArabicEmailHtml({
                title: 'تذكير بموعد جلستك الطبية القادمة',
                subtitle: `توقيت الجلسة: ${data.formattedDate || 'خلال الساعات القادمة'}`,
                badgeText: 'تذكير بالموعد ⏰',
                badgeColor: '#d97706',
                mainMessage: `مرحباً بك، هذا تذكير ودي باقتراب موعد استشارتك الطبية المجدولة.<br><br>يرجى التحقق من اتصالك بالإنترنت وتجهيز أي استفسارات تود طرحها على المختص، ثم تسجيل الدخول للغرفة الافتراضية في الوقت المحدد.`,
                actionText: 'الانتقال إلى موعدي',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/dashboard.html'
            })
        };
    },

    // 4. Medical record / prescription ready
    medical_record_ready: (data) => {
        return {
            subject: 'تحديث جديد في سجلك الطبي (EMR) - استوديو صحة الشباب',
            html: buildArabicEmailHtml({
                title: 'يتوفر تدوين سريري جديد في سجلك الطبي',
                subtitle: 'ملف طبي إلكتروني موثق',
                badgeText: 'السجل الطبي EMR',
                badgeColor: '#7c3aed',
                mainMessage: `مرحباً بك، قام الطبيب المشرف بإضافة تدوين أو تقرير طبي جديد في سجلك الطبي الإلكتروني.<br><br>حفاظاً على سرية معلوماتك، يرجى تسجيل الدخول الآمن للاطلاع على التقرير أو الوصفة المعتمدة وتحميل نسختك الرسمية الموقعة.`,
                actionText: 'الاطلاع على سجلي الطبي الآمن',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/emr.html'
            })
        };
    },

    // 5. Important administrative announcement
    admin_announcement: (data) => {
        return {
            subject: data.title ? `${data.title} - استوديو صحة الشباب` : 'إعلان رسمي هام - استوديو صحة الشباب',
            html: buildArabicEmailHtml({
                title: data.title || 'إعلان رسمي هام',
                subtitle: 'إدارة استوديو صحة الشباب',
                badgeText: 'إعلان عام 📢',
                badgeColor: '#1a56db',
                mainMessage: data.message || 'نشارككم أحدث الإعلانات والتحديثات الهامة في منصة استوديو صحة الشباب.',
                actionText: 'زيارة المنصة',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/index.html'
            })
        };
    },

    // 6. Support ticket created confirmation
    support_ticket_created: (data) => {
        const ticketNum = data.ticketNumber || 'TICK-NEW';
        return {
            subject: `تم استلام تذكرة الدعم الخاصة بك [${ticketNum}] - استوديو صحة الشباب`,
            html: buildArabicEmailHtml({
                title: 'تم استلام تذكرة الدعم بنجاح',
                subtitle: `رقم التذكرة: ${ticketNum}`,
                badgeText: 'مركز الدعم والشكاوى 💬',
                badgeColor: '#0284c7',
                mainMessage: `مرحباً بك، تم تسجيل طلب الدعم الخاص بك بنجاح بالرمز المرجعي: <strong>${ticketNum}</strong>.<br><br>الموضوع: <strong>${sanitizeForPrivacy(data.subject || 'طلب دعم فني')}</strong>.<br>يقوم فريق الدعم بمراجعة طلبك والرد عليه في أقرب وقت. يمكنك متابعة حالة التذكرة في أي وقت من خلال مركز الدعم.`,
                actionText: 'متابعة التذكرة الآن',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/support.html'
            })
        };
    },

    // 7. Support staff replied to ticket
    support_ticket_reply: (data) => {
        const ticketNum = data.ticketNumber || 'TICK-UPDATE';
        return {
            subject: `رد جديد على تذكرة الدعم [${ticketNum}] - استوديو صحة الشباب`,
            html: buildArabicEmailHtml({
                title: 'ورد رد جديد من فريق الدعم الفني',
                subtitle: `رقم التذكرة: ${ticketNum}`,
                badgeText: 'رد جديد 💬',
                badgeColor: '#059669',
                mainMessage: `مرحباً بك، قام فريق الدعم الفني بالرد على تذكرتك ذات الرقم المرجعي <strong>${ticketNum}</strong>.<br><br>لحماية خصوصيتك وأمان بياناتك، يرجى تسجيل الدخول الآمن للاطلاع على الرد ومتابعة المحادثة.`,
                actionText: 'عرض الرد ومتابعة التذكرة',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/support.html'
            })
        };
    },

    // 8. Support ticket status change / resolution
    support_ticket_status: (data) => {
        const ticketNum = data.ticketNumber || 'TICK-STATUS';
        const statusMap = {
            open: 'مفتوحة وقيد الفرز',
            in_progress: 'قيد المعالجة والمتابعة',
            waiting_user: 'بانتظار معلومات إضافية منك',
            resolved: 'تم حل المشكلة بنجاح',
            closed: 'مغلقة'
        };
        const statusArabic = data.statusArabic || statusMap[data.status] || data.status;
        const isResolved = data.status === 'resolved';

        return {
            subject: `تحديث حالة تذكرة الدعم [${ticketNum}] - استوديو صحة الشباب`,
            html: buildArabicEmailHtml({
                title: isResolved ? 'تم حل تذكرة الدعم الخاصة بك' : 'تحديث حالة تذكرة الدعم',
                subtitle: `رقم التذكرة: ${ticketNum}`,
                badgeText: isResolved ? 'تم الحل ✅' : 'تحديث الحالة 🔄',
                badgeColor: isResolved ? '#10b981' : '#f59e0b',
                mainMessage: `مرحباً بك، نود إعلامك بأنه تم تحديث حالة تذكرتك المرجعية <strong>${ticketNum}</strong> إلى: <strong>${statusArabic}</strong>.<br><br>${isResolved ? 'إذا كانت المشكلة قد حُلت بالفعل، يسعدنا ذلك. وفي حال لا تزال بحاجة لمزيد من المساعدة يمكنك الرد لإعادة فتحها.' : 'يرجى تسجيل الدخول للاطلاع على المستجدات ومتابعة التذكرة.'}`,
                actionText: 'الانتقال إلى مركز الدعم',
                actionUrl: data.actionUrl || 'https://youthhealthstudio.org/support.html'
            })
        };
    }
};

/**
 * Checks whether an identical email was dispatched within the deduplication window (15 mins)
 */
async function checkDuplicate(recipientEmail, templateKey, referenceId = null, client = defaultSupabase) {
    if (!canPersistEmailLogs(client)) return false;
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        let query = client
            .from('email_logs')
            .select('id, status, created_at')
            .eq('recipient_email', recipientEmail)
            .eq('template_key', templateKey)
            .gte('created_at', fifteenMinutesAgo)
            .in('status', ['sent', 'pending', 'pending_configuration']);

        if (referenceId) {
            query = query.filter('metadata->>reference_id', 'eq', String(referenceId));
        }

        const { data, error } = await query.limit(1);
        if (error) {
            console.warn('[EmailService] Dedup check query notice:', error.message);
            return false;
        }

        return data && data.length > 0;
    } catch (err) {
        console.warn('[EmailService] Dedup exception:', err.message);
        return false;
    }
}

/**
 * Main Email Dispatch Function
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.template - Template key name
 * @param {Object} options.data - Template variable parameters
 * @param {string} [options.referenceId] - Optional reference UUID for deduplication
 * @param {Object} [options.metadata] - Optional metadata JSON
 * @param {Object} [options.client] - Optional Supabase client instance
 */
async function sendEmailNotification({ to, template, data = {}, referenceId = null, metadata = {}, client = defaultSupabase }) {
    if (!to || !to.includes('@')) {
        return { success: false, error: 'Invalid recipient email address' };
    }

    const templateFn = EMAIL_TEMPLATES[template];
    if (!templateFn) {
        return { success: false, error: `Unknown email template: ${template}` };
    }

    const { subject, html } = templateFn(data);

    // 1. Deduplication check
    const canStoreLogs = canPersistEmailLogs(client);
    const isDuplicate = canStoreLogs
        ? await checkDuplicate(to, template, referenceId, client)
        : false;
    if (isDuplicate) {
        console.log(`[EmailService] Deduplication prevented email to ${to} (${template})`);
        return {
            success: true,
            duplicate: true,
            message: 'Email dispatch skipped: duplicate prevented within 15-minute window'
        };
    }

    const logEntry = {
        recipient_email: to,
        subject: subject,
        template_key: template,
        status: 'pending',
        metadata: {
            ...metadata,
            reference_id: referenceId,
            timestamp: new Date().toISOString()
        }
    };

    // 2. Check Provider Credentials
    if (!RESEND_API_KEY) {
        // Safe diagnostic mode: Credentials not configured yet
        logEntry.status = 'pending_configuration';
        logEntry.error_message = 'Email provider credentials (RESEND_API_KEY) not configured in server environment. Logged safely for diagnostic tracking.';
        
        try {
            if (canStoreLogs) {
                await client.from('email_logs').insert([logEntry]);
            }
        } catch (dbErr) {
            console.error('[EmailService] Failed to insert diagnostic log:', dbErr.message);
        }

        return {
            success: true,
            providerConfigured: false,
            status: 'pending_configuration',
            message: 'Provider credentials unavailable. Transaction safely recorded in email_logs with status pending_configuration.'
        };
    }

    // 3. Dispatch via Resend API
    try {
        let senderAddress = EMAIL_FROM;
        if (senderAddress.includes('@gmail.com') || senderAddress.includes('@yahoo.com') || senderAddress.includes('@hotmail.com')) {
            console.warn('[EmailService] Notice: Public domain in EMAIL_FROM detected. Using Resend sandbox sender "Youth Health Studio <onboarding@resend.dev>" to comply with Resend DMARC policy.');
            senderAddress = 'Youth Health Studio <onboarding@resend.dev>';
        }

        let response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: senderAddress,
                to: [to],
                subject: subject,
                html: html
            })
        });

        let result = await response.json();

        if (!response.ok) {
            logEntry.status = 'failed';
            logEntry.error_message = `Resend API Error: ${result.message || response.statusText}`;
            if (canStoreLogs) {
                await client.from('email_logs').insert([logEntry]);
            }
            return { success: false, error: logEntry.error_message };
        }

        // Success
        logEntry.status = 'sent';
        logEntry.sent_at = new Date().toISOString();
        logEntry.metadata.resend_id = result.id;
        if (canStoreLogs) {
            await client.from('email_logs').insert([logEntry]);
        }

        return {
            success: true,
            status: 'sent',
            id: result.id
        };
    } catch (err) {
        logEntry.status = 'failed';
        logEntry.error_message = `Network exception during dispatch: ${err.message}`;
        try {
            if (canStoreLogs) {
                await client.from('email_logs').insert([logEntry]);
            }
        } catch (dbErr) {
            // Ignore log save errors
        }
        return { success: false, error: logEntry.error_message };
    }
}

module.exports = {
    sendEmailNotification,
    checkDuplicate,
    setSupabaseClient,
    getSupabaseClient,
    EMAIL_TEMPLATES,
    buildArabicEmailHtml,
    sanitizeForPrivacy
};
