// admin_notifications.js - Enhanced Admin Notification & Email Control Center
import { supabase } from './supabase.js';

let allTemplates = [];

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        alert('هذه الصفحة مخصصة للمدراء فقط.');
        window.location.href = '../index.html';
    }
}

const emptyRow = (msg, cols) => `<tr><td colspan="${cols}"><div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
    <div>${msg}</div>
</div></td></tr>`;

async function loadOverview() {
    try {
        const { count: cEmails } = await supabase.from('email_logs').select('*', { count: 'exact', head: true });
        const { count: cSubs } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
        const { count: cNotifs } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
        const { count: cFailed } = await supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed');

        document.getElementById('st-total-emails').innerText = cEmails || '0';
        document.getElementById('st-subs').innerText = cSubs || '0';
        document.getElementById('st-notifs').innerText = cNotifs || '0';
        document.getElementById('st-failed').innerText = cFailed || '0';

        renderCharts();
    } catch (e) {
        console.error("Overview stats error:", e);
    }
}

function renderCharts() {
    const ctxEmailEl = document.getElementById('emailChart');
    if (ctxEmailEl && !ctxEmailEl.chartInstance) {
        const ctxEmail = ctxEmailEl.getContext('2d');
        ctxEmailEl.chartInstance = new Chart(ctxEmail, {
            type: 'line',
            data: { labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'], datasets: [{ label: 'الرسائل المرسلة', data: [12, 19, 8, 15, 22, 18, 25], borderColor: '#0284c7', tension: 0.4, fill: false }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxCampEl = document.getElementById('campaignChart');
    if (ctxCampEl && !ctxCampEl.chartInstance) {
        const ctxCamp = ctxCampEl.getContext('2d');
        ctxCampEl.chartInstance = new Chart(ctxCamp, {
            type: 'doughnut',
            data: { labels: ['مرسلة بنجاح', 'فاشلة', 'قيد الانتظار/التهيئة'], datasets: [{ data: [18, 1, 4], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'] }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    }
}

async function loadNotifications() {
    const tbody = document.getElementById('notif-tbody');
    if (!tbody) return;

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = emptyRow('لا توجد إشعارات سابقة.', 4);
        return;
    }
    
    tbody.innerHTML = data.map(n => {
        const audienceLabel = !n.user_id ? '🌐 الجميع (Global)' : '👤 مستخدم محدد';
        const typeBadge = n.type === 'consultation' ? '<span class="badge" style="background:#e0f2fe; color:#0284c7;">استشارة</span>' :
            n.type === 'appointment' ? '<span class="badge" style="background:#dcfce7; color:#16a34a;">موعد</span>' :
            n.type === 'reminder' ? '<span class="badge" style="background:#fef3c7; color:#d97706;">تذكير</span>' :
            n.type === 'medical_record' ? '<span class="badge" style="background:#f3e8ff; color:#9333ea;">سجل طبي</span>' :
            n.type === 'announcement' ? '<span class="badge" style="background:#dbeafe; color:#1d4ed8;">إعلان عام</span>' :
            '<span class="badge badge-neutral">نظام</span>';

        return `
            <tr>
                <td style="font-weight:700;">
                    <div>${n.title}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:normal; margin-top:2px;">${n.message}</div>
                </td>
                <td>${typeBadge}</td>
                <td><span style="font-size:0.85rem; font-weight:600;">${audienceLabel}</span></td>
                <td style="color:var(--admin-text-muted); font-size:0.85rem;">${new Date(n.created_at).toLocaleString('ar-EG')}</td>
            </tr>
        `;
    }).join('');
}

window.sendNotification = async () => {
    const title = document.getElementById('n_title')?.value.trim();
    const msg = document.getElementById('n_msg')?.value.trim();
    const target = document.getElementById('n_target')?.value || 'all';
    const type = document.getElementById('n_type')?.value || 'announcement';
    const priority = document.getElementById('n_priority')?.value || 'normal';
    const link = document.getElementById('n_link')?.value.trim() || null;

    if (!title || !msg) {
        alert('الرجاء تعبئة العنوان والرسالة أولاً.');
        return;
    }

    const btn = document.getElementById('btn-send-notif');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'جاري الإرسال... ⏳';
    }

    try {
        if (target === 'all') {
            // Global announcement
            const { error } = await supabase.from('notifications').insert([{
                title,
                message: msg,
                type,
                priority,
                link,
                user_id: null,
                metadata: { broadcast_target: 'all' }
            }]);

            if (error) throw error;
        } else {
            // Role targeted
            let roleFilter = [];
            if (target === 'patients') roleFilter = ['user'];
            else if (target === 'specialists') roleFilter = ['specialist', 'doctor', 'psychologist', 'nutritionist'];
            else if (target === 'admins') roleFilter = ['admin', 'super_admin'];

            const { data: targetUsers, error: usersErr } = await supabase
                .from('profiles')
                .select('id')
                .in('role', roleFilter);

            if (usersErr) throw usersErr;

            if (!targetUsers || targetUsers.length === 0) {
                alert('لم يتم العثور على أي مستخدمين ضمن هذه الفئة المستهدفة.');
                if (btn) { btn.disabled = false; btn.innerText = 'إرسال الإشعار الآن 🚀'; }
                return;
            }

            const notifRows = targetUsers.map(u => ({
                user_id: u.id,
                title,
                message: msg,
                type,
                priority,
                link,
                metadata: { broadcast_target: target }
            }));

            const { error: insertErr } = await supabase.from('notifications').insert(notifRows);
            if (insertErr) throw insertErr;
        }

        alert('✅ تم إرسال الإشعار بنجاح إلى الفئة المحددة!');
        document.getElementById('n_title').value = '';
        document.getElementById('n_msg').value = '';
        if (document.getElementById('n_link')) document.getElementById('n_link').value = '';
        loadNotifications();
        loadOverview();
    } catch (err) {
        console.error("Error sending notification:", err);
        alert('خطأ في الإرسال: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'إرسال الإشعار الآن 🚀';
        }
    }
};

async function loadCampaigns() {
    const tbody = document.getElementById('camp-tbody');
    if (!tbody) return;

    const { data, error } = await supabase
        .from('email_campaigns')
        .select('*, email_templates(name)')
        .order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = emptyRow('لا توجد حملات بريدية. يمكنك إنشاء حملة جديدة.', 5);
        return;
    }
    
    tbody.innerHTML = data.map(c => `
        <tr>
            <td style="font-weight:600;">${c.name}</td>
            <td>${c.email_templates?.name || 'افتراضي'}</td>
            <td>${c.target_audience}</td>
            <td>${c.sent_count}</td>
            <td><span class="badge badge-success">${c.status}</span></td>
        </tr>
    `).join('');
}

async function loadTemplates() {
    const grid = document.getElementById('templates-grid');
    if (!grid) return;

    const { data, error } = await supabase.from('email_templates').select('*').order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2.5rem; color:var(--admin-text-muted);">
            <div style="font-size: 2rem; margin-bottom: 6px;">📧</div>
            <div style="font-weight:700;">لا توجد قوالب حتى الآن</div>
            <p style="font-size:0.85rem; margin-top:4px;">انقر على زر "إنشاء القوالب الافتراضية" لتوليد قوالب النظام العربية المعتمدة.</p>
        </div>`;
        return;
    }
    
    allTemplates = data;

    grid.innerHTML = data.map(t => {
        const category = t.style_config?.category || 'general';
        return `
            <div class="stat-card" style="text-align:right; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="badge badge-neutral" style="font-size:0.7rem;">${category}</span>
                        <span style="font-size:0.75rem; color:var(--admin-text-muted);">${t.name}</span>
                    </div>
                    <div style="font-weight:700; font-size:1.05rem; margin-bottom:6px; color:var(--text-primary);">${t.subject}</div>
                    <div style="font-size:0.82rem; color:var(--admin-text-muted); line-height:1.45; margin-bottom:1rem;">
                        ${(t.body_content || '').substring(0, 90)}...
                    </div>
                </div>
                <button class="btn btn-outline" onclick="previewTemplate('${t.id}')" style="width:100%; font-size:0.84rem; padding:8px;">
                    👁️ معاينة تصميم القالب
                </button>
            </div>
        `;
    }).join('');
}

window.previewTemplate = (templateId) => {
    const t = allTemplates.find(x => x.id === templateId);
    if (!t) return;

    const modal = document.getElementById('template-preview-modal');
    const titleEl = document.getElementById('preview-modal-title');
    const bodyEl = document.getElementById('preview-modal-body');

    if (modal && titleEl && bodyEl) {
        titleEl.innerText = `معاينة: ${t.name} (${t.subject})`;
        
        // Render rich preview card
        bodyEl.innerHTML = `
            <div style="max-width:520px; margin: 0 auto; background:white; border-radius:14px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.06); font-family:sans-serif; direction:rtl;">
                <div style="background:linear-gradient(135deg, #0284c7, #0369a1); padding:20px; text-align:center; color:white;">
                    <div style="font-size:20px; font-weight:800;">استوديو صحة الشباب</div>
                    <div style="font-size:11px; opacity:0.9;">Youth Health Studio • المنصة الطبية المعتمدة للشباب</div>
                </div>
                <div style="padding:24px;">
                    <h2 style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 12px 0;">${t.subject}</h2>
                    <div style="font-size:14px; line-height:1.7; color:#334155; margin-bottom:20px; background:#f8fafc; padding:16px; border-radius:10px; border-right:4px solid #0284c7;">
                        ${t.body_content}
                    </div>
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:10px 14px; margin-bottom:20px; font-size:12px; color:#065f46; font-weight:600;">
                        🔒 تنبيه الخصوصية: لا نقوم بإرسال تفاصيل التشخيص أو الوصفات الطبية عبر البريد الإلكتروني.
                    </div>
                    <div style="text-align:center;">
                        <a href="#" style="background:#0284c7; color:white; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">تسجيل الدخول الآمن للمتابعة</a>
                    </div>
                </div>
                <div style="background:#f1f5f9; padding:14px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">
                    جميع الحقوق محفوظة © استوديو صحة الشباب
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }
};

window.closeTemplatePreview = () => {
    const modal = document.getElementById('template-preview-modal');
    if (modal) modal.style.display = 'none';
};

window.createDefaultTemplates = async () => {
    const templates = [
        {
            name: 'consultation_status',
            subject: 'تحديث بشأن استشارتك الطبية - استوديو صحة الشباب',
            body_content: 'مرحباً بك، نود إعلامك بأنه تم تحديث حالة استشارتك الطبية في منصة استوديو صحة الشباب. للمحافظة على خصوصية بياناتك الصحية، يرجى تسجيل الدخول إلى حسابك بأمان لمراجعة المستجدات والتواصل مع فريق الرعاية الصحية.',
            style_config: { category: 'consultation', primary_color: '#0284c7' }
        },
        {
            name: 'appointment_confirmation',
            subject: 'تأكيد موعدك الطبي - استوديو صحة الشباب',
            body_content: 'مرحباً بك، يسعدنا إبلاغك بأنه قد تم تأكيد موعدك الطبي بنجاح. يمكنك الاطلاع على توقيت الجلسة ورابط الاستشارة المباشرة عبر تسجيل الدخول إلى منصة استوديو صحة الشباب.',
            style_config: { category: 'appointment', primary_color: '#059669' }
        },
        {
            name: 'appointment_reminder',
            subject: 'تذكير بموعدك الطبي القادم - استوديو صحة الشباب',
            body_content: 'مرحباً بك، هذا تذكير ودي باقتراب موعد جلستك الطبية القادمة خلال 24 ساعة. يرجى التأكد من جاهزية اتصالك بالإنترنت وتسجيل الدخول إلى حسابك قبل الموعد ببضع دقائق.',
            style_config: { category: 'reminder', primary_color: '#d97706' }
        },
        {
            name: 'medical_record_ready',
            subject: 'تحديث جديد في سجلك الطبي (EMR) - استوديو صحة الشباب',
            body_content: 'مرحباً بك، قام طبيبك المشرف بإضافة تدوين أو تقرير طبي جديد في سجلك الطبي الإلكتروني. لأسباب تتعلق بالسرية الطبية، لا نقوم بإرسال تفاصيل التقرير عبر البريد. يرجى تسجيل الدخول الآمن للاطلاع عليه.',
            style_config: { category: 'medical_record', primary_color: '#7c3aed' }
        },
        {
            name: 'admin_announcement',
            subject: 'إعلان رسمي هام - استوديو صحة الشباب',
            body_content: 'إعلان هام لجميع مستخدمي منصة استوديو صحة الشباب. نود إحاطتكم علماً بالمستجدات والتحديثات الإدارية الموضحة داخل المنصة.',
            style_config: { category: 'announcement', primary_color: '#1a56db' }
        }
    ];

    for (const t of templates) {
        await supabase.from('email_templates').upsert(t, { onConflict: 'name' });
    }

    alert('✅ تم إنشاء وتحديث قوالب البريد الافتراضية بنجاح!');
    loadTemplates();
};

async function loadSubscribers() {
    const tbody = document.getElementById('subs-tbody');
    if (!tbody) return;

    const { data, error } = await supabase.from('subscribers').select('*').order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = emptyRow('لا يوجد مشتركون في القائمة البريدية.', 4);
        return;
    }
    
    tbody.innerHTML = data.map(s => `
        <tr>
            <td style="font-weight:600;">${s.email}</td>
            <td>${s.name || '--'}</td>
            <td style="color:var(--admin-text-muted); font-size:0.85rem;">${new Date(s.created_at).toLocaleString('ar-EG')}</td>
            <td><span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">${s.status}</span></td>
        </tr>
    `).join('');
}

async function loadLogs() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;

    const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(35);
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = emptyRow('سجل الإرسال فارغ. لم يتم تسجيل أي عمليات إرسال بعد.', 5);
        return;
    }
    
    tbody.innerHTML = data.map(l => {
        let badgeClass = 'badge-neutral';
        let statusText = l.status;

        if (l.status === 'sent') {
            badgeClass = 'badge-success';
            statusText = 'مرسل بنجاح ✅';
        } else if (l.status === 'pending_configuration') {
            badgeClass = 'badge-warning';
            statusText = 'بانتظار تهيئة API ⚙️';
        } else if (l.status === 'failed') {
            badgeClass = 'badge-danger';
            statusText = 'فشل الإرسال ❌';
        }

        const templateBadge = l.template_key ? `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.72rem; margin-right:4px;">${l.template_key}</span>` : '';
        const diagTooltip = l.error_message ? `title="${l.error_message.replace(/"/g, '&quot;')}" style="cursor:help;"` : '';

        return `
            <tr>
                <td style="font-weight:600;">${l.recipient_email}</td>
                <td>
                    <div>${l.subject}</div>
                    <div style="font-size:0.75rem; color:var(--admin-text-muted); margin-top:2px;">${templateBadge}</div>
                </td>
                <td>${l.template_key || 'نظام'}</td>
                <td>
                    <span class="badge ${badgeClass}" ${diagTooltip}>${statusText}</span>
                    ${l.status === 'pending_configuration' ? '<div style="font-size:0.7rem; color:var(--admin-text-muted); margin-top:2px;">تم الحفظ التشخيصي بأمان</div>' : ''}
                </td>
                <td style="color:var(--admin-text-muted); font-size:0.85rem;">${new Date(l.created_at).toLocaleString('ar-EG')}</td>
            </tr>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadOverview();
    loadNotifications();
    loadCampaigns();
    loadTemplates();
    loadSubscribers();
    loadLogs();
});
