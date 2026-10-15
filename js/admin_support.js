// admin_support.js - Support Center & Complaint Management Admin Controller
import { supabase } from './supabase.js';
import { createNotification } from './notifications.js';

// Application State
let currentAdmin = null;
let allTickets = [];
let filteredTickets = [];
let adminStaffList = [];
let activeTicket = null;
let activeMessages = [];
let composerMode = 'reply'; // 'reply' | 'internal'
let currentPage = 1;
let itemsPerPage = 10;

// Category & Status Dictionaries
const CATEGORY_MAP = {
    technical: { label: 'مشكلة فنية أو تقنية', icon: '🛠️' },
    account: { label: 'الحساب وتسجيل الدخول', icon: '🔐' },
    appointment: { label: 'إدارة المواعيد', icon: '📅' },
    consultation: { label: 'الاستشارات والعيادة', icon: '🩺' },
    inquiry: { label: 'استفسار عام', icon: '💡' },
    complaint: { label: 'شكوى حول الخدمات', icon: '⚠️' }
};

const STATUS_MAP = {
    open: { label: 'مفتوحة', class: 'open' },
    in_progress: { label: 'قيد المتابعة', class: 'in_progress' },
    waiting_user: { label: 'بانتظار رد المستخدم', class: 'waiting_user' },
    resolved: { label: 'تم الحل', class: 'resolved' },
    closed: { label: 'مغلقة', class: 'closed' }
};

const PRIORITY_MAP = {
    low: { label: 'منخفضة', class: 'priority-low', weight: 1 },
    normal: { label: 'متوسطة', class: 'priority-normal', weight: 2 },
    high: { label: 'عالية', class: 'priority-high', weight: 3 },
    urgent: { label: 'عاجلة وطارئة', class: 'priority-urgent', weight: 4 }
};

// DOM References
const statTotalTickets = document.getElementById('statTotalTickets');
const statOpenTickets = document.getElementById('statOpenTickets');
const statInProgressTickets = document.getElementById('statInProgressTickets');
const statWaitingUserTickets = document.getElementById('statWaitingUserTickets');
const statResolvedTickets = document.getElementById('statResolvedTickets');

const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const categoryFilter = document.getElementById('categoryFilter');
const priorityFilter = document.getElementById('priorityFilter');
const sortBySelect = document.getElementById('sortBy');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const activeFilterCountText = document.getElementById('activeFilterCountText');
const refreshTicketsBtn = document.getElementById('refreshTicketsBtn');
const exportTicketsBtn = document.getElementById('exportTicketsBtn');

const ticketsTbody = document.getElementById('tickets-tbody');
const paginationInfo = document.getElementById('pagination-info');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbersSpan = document.getElementById('pageNumbers');

// Drawer / Modal References
const adminTicketModal = document.getElementById('adminTicketModal');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerTicketNumber = document.getElementById('drawerTicketNumber');
const drawerTicketStatusBadge = document.getElementById('drawerTicketStatusBadge');
const drawerTicketPriorityBadge = document.getElementById('drawerTicketPriorityBadge');
const drawerTicketCategoryTag = document.getElementById('drawerTicketCategoryTag');
const drawerTicketSubject = document.getElementById('drawerTicketSubject');

const drawerUserAvatar = document.getElementById('drawerUserAvatar');
const drawerUserName = document.getElementById('drawerUserName');
const drawerUserEmail = document.getElementById('drawerUserEmail');
const drawerUserRole = document.getElementById('drawerUserRole');
const drawerUserPhone = document.getElementById('drawerUserPhone');

const drawerStatusSelect = document.getElementById('drawerStatusSelect');
const drawerPrioritySelect = document.getElementById('drawerPrioritySelect');
const drawerAssignSelect = document.getElementById('drawerAssignSelect');

const drawerCreatedDate = document.getElementById('drawerCreatedDate');
const drawerUpdatedDate = document.getElementById('drawerUpdatedDate');
const drawerResolvedDateWrapper = document.getElementById('drawerResolvedDateWrapper');
const drawerResolvedDate = document.getElementById('drawerResolvedDate');

const drawerConversationThread = document.getElementById('drawerConversationThread');
const tabModeReply = document.getElementById('tabModeReply');
const tabModeInternal = document.getElementById('tabModeInternal');
const internalCautionBanner = document.getElementById('internalCautionBanner');
const adminComposerForm = document.getElementById('adminComposerForm');
const composerInput = document.getElementById('composerInput');
const composerSubmitBtn = document.getElementById('composerSubmitBtn');
const composerSubmitText = document.getElementById('composerSubmitText');
const quickResolveBtn = document.getElementById('quickResolveBtn');
const quickCloseBtn = document.getElementById('quickCloseBtn');

/**
 * Toast Helper
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 0.9rem;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: toastIn 0.3s ease-out;
        color: #ffffff;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0284c7'};
    `;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Format timestamp
 */
function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-DZ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Load Support Staff (Admins and Specialists)
 */
async function loadStaffList() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['admin', 'super_admin', 'specialist'])
            .order('full_name', { ascending: true });

        if (!error && data) {
            adminStaffList = data;
            populateStaffSelect();
        }
    } catch (err) {
        console.warn('[AdminSupport] Staff load notice:', err);
    }
}

function populateStaffSelect() {
    drawerAssignSelect.innerHTML = '<option value="">غير معين (عام)</option>';
    adminStaffList.forEach(staff => {
        const opt = document.createElement('option');
        opt.value = staff.id;
        opt.textContent = `${staff.full_name || staff.email} (${staff.role})`;
        drawerAssignSelect.appendChild(opt);
    });
}

/**
 * Load All Support Tickets
 */
async function loadTickets() {
    activeFilterCountText.textContent = 'جاري مزامنة التذاكر من قاعدة البيانات...';

    try {
        // Query tickets
        const { data: ticketsData, error: ticketsError } = await supabase
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (ticketsError) {
            console.warn('[AdminSupport] Remote tickets error:', ticketsError.message);
            // Fallback to local storage
            const local = localStorage.getItem('yhs_admin_tickets_cache');
            allTickets = local ? JSON.parse(local) : [];
        } else {
            allTickets = ticketsData || [];

            // Fetch requester profiles
            const userIds = [...new Set(allTickets.map(t => t.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, phone, role')
                    .in('id', userIds);

                const profileMap = {};
                (profilesData || []).forEach(p => { profileMap[p.id] = p; });

                allTickets.forEach(t => {
                    t.requester = profileMap[t.user_id] || {
                        full_name: 'مستخدم مسجل',
                        email: 'user@example.com',
                        role: 'user'
                    };
                });
            }

            localStorage.setItem('yhs_admin_tickets_cache', JSON.stringify(allTickets));
        }

        updateStats();
        applyFilters();
    } catch (err) {
        console.error('[AdminSupport] Exception loading tickets:', err);
        const local = localStorage.getItem('yhs_admin_tickets_cache');
        allTickets = local ? JSON.parse(local) : [];
        updateStats();
        applyFilters();
    }
}

/**
 * Update KPI Statistics
 */
function updateStats() {
    const total = allTickets.length;
    const open = allTickets.filter(t => t.status === 'open').length;
    const inProgress = allTickets.filter(t => t.status === 'in_progress').length;
    const waitingUser = allTickets.filter(t => t.status === 'waiting_user').length;
    const resolved = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

    statTotalTickets.textContent = total;
    statOpenTickets.textContent = open;
    statInProgressTickets.textContent = inProgress;
    statWaitingUserTickets.textContent = waitingUser;
    statResolvedTickets.textContent = resolved;
}

/**
 * Apply Filters, Search & Sorting
 */
function applyFilters() {
    const term = (searchInput.value || '').trim().toLowerCase();
    const statusVal = statusFilter.value;
    const catVal = categoryFilter.value;
    const prioVal = priorityFilter.value;
    const sortVal = sortBySelect.value;

    let isFiltered = term || statusVal !== 'all' || catVal !== 'all' || prioVal !== 'all';
    resetFiltersBtn.style.display = isFiltered ? 'inline-block' : 'none';

    filteredTickets = allTickets.filter(t => {
        const reqName = (t.requester?.full_name || '').toLowerCase();
        const reqEmail = (t.requester?.email || '').toLowerCase();
        const ticketNum = (t.ticket_number || '').toLowerCase();
        const subject = (t.subject || '').toLowerCase();

        const matchSearch = !term ||
            ticketNum.includes(term) ||
            subject.includes(term) ||
            reqName.includes(term) ||
            reqEmail.includes(term);

        const matchStatus = statusVal === 'all' || t.status === statusVal;
        const matchCategory = catVal === 'all' || t.category === catVal;
        const matchPriority = prioVal === 'all' || t.priority === prioVal;

        return matchSearch && matchStatus && matchCategory && matchPriority;
    });

    // Sorting
    filteredTickets.sort((a, b) => {
        if (sortVal === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortVal === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        if (sortVal === 'priority') {
            const weightA = PRIORITY_MAP[a.priority]?.weight || 2;
            const weightB = PRIORITY_MAP[b.priority]?.weight || 2;
            return weightB - weightA;
        }
        if (sortVal === 'status') return (a.status || '').localeCompare(b.status || '');
        return 0;
    });

    currentPage = 1;
    activeFilterCountText.textContent = `يعرض ${filteredTickets.length} من أصل ${allTickets.length} تذكرة`;
    renderTable();
}

/**
 * Render Tickets Table
 */
function renderTable() {
    if (filteredTickets.length === 0) {
        ticketsTbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="padding: 3rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <div class="empty-state-title">لا توجد تذاكر تطابق معايير الفلترة</div>
                        <div class="empty-state-desc">جرب تعديل كلمات البحث أو تصفية الحالات لإظهار المزيد من السجلات.</div>
                    </div>
                </td>
            </tr>
        `;
        paginationInfo.textContent = 'يعرض 0 إلى 0 من أصل 0 تذكرة';
        pageNumbersSpan.innerHTML = '';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

    ticketsTbody.innerHTML = pageItems.map(ticket => {
        const cat = CATEGORY_MAP[ticket.category] || { label: ticket.category, icon: '📁' };
        const status = STATUS_MAP[ticket.status] || { label: ticket.status, class: 'user' };
        const prio = PRIORITY_MAP[ticket.priority] || { label: ticket.priority, class: 'priority-normal' };
        const requesterName = escapeHtml(ticket.requester?.full_name || 'مستخدم المنصة');
        const requesterEmail = escapeHtml(ticket.requester?.email || '--');
        const staffObj = adminStaffList.find(s => s.id === ticket.assigned_to);
        const assignedName = staffObj ? escapeHtml(staffObj.full_name || staffObj.email) : '<span style="color:var(--text-tertiary);">غير معين</span>';

        return `
            <tr data-id="${ticket.id}">
                <td>
                    <span class="ticket-number-tag">${ticket.ticket_number || 'TICK-XXXX'}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="avatar-sm" style="width: 32px; height: 32px; border-radius: 50%; background: var(--brand-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                            ${requesterName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong style="display: block; font-size: 0.9rem;">${requesterName}</strong>
                            <span style="font-size: 0.78rem; color: var(--text-secondary);">${requesterEmail}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 700; font-size: 0.92rem; margin-bottom: 2px;">
                        ${escapeHtml(ticket.subject)}
                    </div>
                    <span class="category-tag">${cat.icon} ${cat.label}</span>
                </td>
                <td>
                    <span class="priority-badge ${prio.class}">${prio.label}</span>
                </td>
                <td>
                    <span class="status-badge ${status.class}">${status.label}</span>
                </td>
                <td>
                    <span style="font-size: 0.85rem; font-weight: 600;">${assignedName}</span>
                </td>
                <td>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${formatDate(ticket.created_at)}</span>
                </td>
                <td>
                    <button class="btn btn-primary open-drawer-btn" data-id="${ticket.id}" style="padding: 6px 14px; border-radius: 8px; font-size: 0.82rem;">
                        <span>معاينة وإدارة</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Pagination display
    const endCount = Math.min(startIndex + itemsPerPage, filteredTickets.length);
    paginationInfo.textContent = `يعرض ${startIndex + 1} إلى ${endCount} من أصل ${filteredTickets.length} تذكرة`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    pageNumbersSpan.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                renderTable();
            });
            pageNumbersSpan.appendChild(btn);
        }
    }

    // Attach row button clicks
    document.querySelectorAll('.open-drawer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ticketId = btn.getAttribute('data-id');
            openTicketDrawer(ticketId);
        });
    });
}

/**
 * Open Ticket Management Drawer
 */
async function openTicketDrawer(ticketId) {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    activeTicket = ticket;

    // Header info
    const cat = CATEGORY_MAP[ticket.category] || { label: ticket.category, icon: '📁' };
    const status = STATUS_MAP[ticket.status] || { label: ticket.status, class: 'user' };
    const prio = PRIORITY_MAP[ticket.priority] || { label: ticket.priority, class: 'priority-normal' };

    drawerTicketNumber.textContent = ticket.ticket_number || 'TICK-XXXX';
    drawerTicketSubject.textContent = ticket.subject;
    drawerTicketStatusBadge.textContent = status.label;
    drawerTicketStatusBadge.className = `status-badge ${status.class}`;
    drawerTicketPriorityBadge.textContent = prio.label;
    drawerTicketPriorityBadge.className = `priority-badge ${prio.class}`;
    drawerTicketCategoryTag.textContent = `${cat.icon} ${cat.label}`;

    // Requester info
    const reqName = ticket.requester?.full_name || 'مستخدم مسجل';
    drawerUserName.textContent = reqName;
    drawerUserAvatar.textContent = reqName.charAt(0).toUpperCase();
    drawerUserEmail.textContent = ticket.requester?.email || '--';
    drawerUserPhone.textContent = ticket.requester?.phone ? `📞 ${ticket.requester.phone}` : 'بدون هاتف';
    drawerUserRole.textContent = ticket.requester?.role || 'مستخدم';

    // Controls
    drawerStatusSelect.value = ticket.status || 'open';
    drawerPrioritySelect.value = ticket.priority || 'normal';
    drawerAssignSelect.value = ticket.assigned_to || '';

    drawerCreatedDate.textContent = formatDate(ticket.created_at);
    drawerUpdatedDate.textContent = formatDate(ticket.updated_at || ticket.created_at);
    if (ticket.resolved_at) {
        drawerResolvedDateWrapper.style.display = 'block';
        drawerResolvedDate.textContent = formatDate(ticket.resolved_at);
    } else {
        drawerResolvedDateWrapper.style.display = 'none';
    }

    // Reset composer mode
    setComposerMode('reply');
    composerInput.value = '';

    adminTicketModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    await loadTicketMessages(ticket.id);
}

/**
 * Close Drawer
 */
function closeTicketDrawer() {
    adminTicketModal.style.display = 'none';
    document.body.style.overflow = '';
    activeTicket = null;
    activeMessages = [];
}

/**
 * Set Composer Mode (Public Reply vs Internal Staff Note)
 */
function setComposerMode(mode) {
    composerMode = mode;
    if (mode === 'internal') {
        tabModeReply.className = 'composer-tab-btn';
        tabModeInternal.className = 'composer-tab-btn active-note';
        internalCautionBanner.style.display = 'flex';
        composerInput.placeholder = 'اكتب ملاحظة إدارية داخلية (مرئية فقط لفريق الإدارة والدعم)...';
        composerSubmitBtn.style.background = '#d97706';
        composerSubmitText.textContent = 'حفظ الملاحظة الداخلية 🔒';
    } else {
        tabModeInternal.className = 'composer-tab-btn';
        tabModeReply.className = 'composer-tab-btn active-reply';
        internalCautionBanner.style.display = 'none';
        composerInput.placeholder = 'اكتب ردك الرسمي الموجه للمستخدم هنا...';
        composerSubmitBtn.style.background = 'var(--brand-accent)';
        composerSubmitText.textContent = 'إرسال الرد للمستخدم 💬';
    }
}

/**
 * Load Conversation Messages & Internal Notes
 */
async function loadTicketMessages(ticketId) {
    drawerConversationThread.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div class="skeleton" style="height: 20px; width: 60%; margin: 8px auto;"></div>
            <div class="skeleton" style="height: 20px; width: 40%; margin: 8px auto;"></div>
        </div>
    `;

    try {
        const { data, error } = await supabase
            .from('support_ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('[AdminSupport] Messages query notice:', error.message);
            const local = localStorage.getItem(`yhs_ticket_msgs_${ticketId}`);
            activeMessages = local ? JSON.parse(local) : [
                {
                    id: 'init-msg',
                    ticket_id: ticketId,
                    sender_type: 'user',
                    message: activeTicket.description,
                    is_internal: false,
                    created_at: activeTicket.created_at
                }
            ];
        } else {
            activeMessages = data || [];
            if (activeMessages.length === 0 && activeTicket.description) {
                activeMessages.push({
                    id: 'init-desc',
                    ticket_id: ticketId,
                    sender_type: 'user',
                    message: activeTicket.description,
                    is_internal: false,
                    created_at: activeTicket.created_at
                });
            }
            localStorage.setItem(`yhs_ticket_msgs_${ticketId}`, JSON.stringify(activeMessages));
        }

        renderDrawerMessages();
    } catch (err) {
        console.error('[AdminSupport] Error loading messages:', err);
        renderDrawerMessages();
    }
}

/**
 * Render Messages with distinct styles for User, Staff Reply, and Internal Notes
 */
function renderDrawerMessages() {
    if (activeMessages.length === 0) {
        drawerConversationThread.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                لا توجد رسائل مسجلة بعد في هذه التذكرة.
            </div>
        `;
        return;
    }

    drawerConversationThread.innerHTML = activeMessages.map(msg => {
        const isInternal = Boolean(msg.is_internal);
        const isStaff = msg.sender_type === 'support' || msg.sender_type === 'admin';

        let bubbleClass = 'user-bubble';
        let senderTitle = `صاحب التذكرة (${escapeHtml(activeTicket.requester?.full_name || 'المستخدم')})`;

        if (isInternal) {
            bubbleClass = 'internal-bubble';
            senderTitle = '🔒 ملاحظة إدارية داخلية (فريق الدعم)';
        } else if (isStaff) {
            bubbleClass = 'staff-bubble';
            senderTitle = 'فريق الدعم الفني 🎧 (رد رسمي)';
        }

        return `
            <div class="support-bubble ${bubbleClass}">
                ${isInternal ? `
                    <div class="internal-note-banner">
                        <span>🔒</span>
                        <span>ملاحظة إدارية داخلية - سرية ولا تظهر للمستخدم</span>
                    </div>
                ` : ''}
                <div class="bubble-header">
                    <span class="bubble-sender" style="${isInternal ? 'color:#b45309;' : isStaff ? 'color:var(--brand-accent);' : ''}">
                        ${senderTitle}
                    </span>
                    <span class="bubble-time">${formatDate(msg.created_at)}</span>
                </div>
                <div class="bubble-content">${escapeHtml(msg.message)}</div>
                ${msg.attachment_url ? `
                    <div style="margin-top: 6px;">
                        <span style="font-size: 0.8rem; color: var(--brand-accent); font-weight: 600;">
                            📎 ${escapeHtml(msg.attachment_url)}
                        </span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    drawerConversationThread.scrollTop = drawerConversationThread.scrollHeight;
}

/**
 * Handle Admin Composer Submit (Reply or Internal Note)
 */
async function handleAdminComposerSubmit(e) {
    e.preventDefault();
    if (!currentAdmin || !activeTicket) return;

    const messageText = composerInput.value.trim();
    if (!messageText) {
        showToast('يرجى إدخال نص الرسالة أو الملاحظة', 'error');
        return;
    }

    const isInternal = (composerMode === 'internal');
    composerSubmitBtn.disabled = true;
    composerSubmitText.textContent = 'جاري الحفظ... ⏳';

    try {
        let newMsg = null;

        // Try RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('add_ticket_reply_secure', {
            ticket_id_input: activeTicket.id,
            message_input: messageText,
            is_internal_input: isInternal
        });

        if (!rpcError && rpcData) {
            newMsg = {
                id: rpcData.message_id || 'msg-' + Date.now(),
                ticket_id: activeTicket.id,
                sender_id: currentAdmin.id,
                sender_type: isInternal ? 'admin' : 'support',
                message: messageText,
                is_internal: isInternal,
                created_at: new Date().toISOString()
            };
        } else {
            // Table insert fallback
            const { data: insertData, error: insertError } = await supabase
                .from('support_ticket_messages')
                .insert({
                    ticket_id: activeTicket.id,
                    sender_id: currentAdmin.id,
                    sender_type: isInternal ? 'admin' : 'support',
                    message: messageText,
                    is_internal: isInternal
                })
                .select()
                .single();

            if (!insertError && insertData) {
                newMsg = insertData;
            } else {
                newMsg = {
                    id: 'local-admin-msg-' + Date.now(),
                    ticket_id: activeTicket.id,
                    sender_id: currentAdmin.id,
                    sender_type: isInternal ? 'admin' : 'support',
                    message: messageText,
                    is_internal: isInternal,
                    created_at: new Date().toISOString()
                };
            }
        }

        // If public reply, update ticket status to waiting_user
        if (!isInternal) {
            await updateTicketStatus(activeTicket.id, 'waiting_user', false);

            // Notify user in-app
            if (activeTicket.user_id) {
                await createNotification(
                    activeTicket.user_id,
                    `رد جديد على تذكرتك [${activeTicket.ticket_number}]`,
                    `قام فريق الدعم الفني بالرد على تذكرتك بعنوان "${activeTicket.subject}". يمكنك الدخول إلى مركز الدعم للاطلاع والمتابعة.`,
                    'support',
                    'support.html',
                    'normal',
                    { ticket_id: activeTicket.id, ticket_number: activeTicket.ticket_number }
                );
            }
        }

        activeMessages.push(newMsg);
        localStorage.setItem(`yhs_ticket_msgs_${activeTicket.id}`, JSON.stringify(activeMessages));

        composerInput.value = '';
        renderDrawerMessages();
        showToast(isInternal ? 'تم حفظ الملاحظة الإدارية الداخلية بنجاح' : 'تم إرسال الرد للمستخدم بنجاح', 'success');
    } catch (err) {
        console.error('[AdminSupport] Error adding message:', err);
        showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
        composerSubmitBtn.disabled = false;
        setComposerMode(composerMode);
    }
}

/**
 * Update Ticket Status Handler
 */
async function updateTicketStatus(ticketId, newStatus, showToastMsg = true) {
    try {
        const updatePayload = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };
        if (newStatus === 'resolved') {
            updatePayload.resolved_at = new Date().toISOString();
        } else if (newStatus === 'closed') {
            updatePayload.closed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('support_tickets')
            .update(updatePayload)
            .eq('id', ticketId);

        if (error) {
            console.warn('[AdminSupport] Status update notice:', error.message);
        }

        // Update local object
        const target = allTickets.find(t => t.id === ticketId);
        if (target) {
            target.status = newStatus;
            target.updated_at = updatePayload.updated_at;
            if (updatePayload.resolved_at) target.resolved_at = updatePayload.resolved_at;
            if (updatePayload.closed_at) target.closed_at = updatePayload.closed_at;
        }

        if (activeTicket && activeTicket.id === ticketId) {
            activeTicket.status = newStatus;
            drawerStatusSelect.value = newStatus;
            const statusInfo = STATUS_MAP[newStatus] || { label: newStatus, class: 'user' };
            drawerTicketStatusBadge.textContent = statusInfo.label;
            drawerTicketStatusBadge.className = `status-badge ${statusInfo.class}`;
        }

        // Notify user if status changed to resolved or waiting_user
        if (target && target.user_id && (newStatus === 'resolved' || newStatus === 'waiting_user')) {
            const statusName = STATUS_MAP[newStatus]?.label || newStatus;
            await createNotification(
                target.user_id,
                `تحديث حالة تذكرة الدعم [${target.ticket_number}]`,
                `تم تحديث حالة تذكرتك "${target.subject}" إلى: ${statusName}.`,
                'support',
                'support.html',
                'normal',
                { ticket_id: target.id, ticket_number: target.ticket_number, status: newStatus }
            );
        }

        updateStats();
        applyFilters();
        if (showToastMsg) showToast(`تم تحديث حالة التذكرة إلى: ${STATUS_MAP[newStatus]?.label || newStatus}`, 'success');
    } catch (err) {
        console.error('[AdminSupport] Error updating status:', err);
        if (showToastMsg) showToast('تعذر تحديث الحالة', 'error');
    }
}

/**
 * Update Ticket Priority
 */
async function updateTicketPriority(ticketId, newPriority) {
    try {
        const { error } = await supabase
            .from('support_tickets')
            .update({
                priority: newPriority,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) console.warn('[AdminSupport] Priority error:', error.message);

        const target = allTickets.find(t => t.id === ticketId);
        if (target) {
            target.priority = newPriority;
        }

        if (activeTicket && activeTicket.id === ticketId) {
            activeTicket.priority = newPriority;
            const prioInfo = PRIORITY_MAP[newPriority] || { label: newPriority, class: 'priority-normal' };
            drawerTicketPriorityBadge.textContent = prioInfo.label;
            drawerTicketPriorityBadge.className = `priority-badge ${prioInfo.class}`;
        }

        applyFilters();
        showToast('تم تغيير أولوية التذكرة بنجاح', 'success');
    } catch (err) {
        console.error('[AdminSupport] Error updating priority:', err);
    }
}

/**
 * Update Staff Assignment
 */
async function updateStaffAssignment(ticketId, assignedStaffId) {
    try {
        const { error } = await supabase
            .from('support_tickets')
            .update({
                assigned_to: assignedStaffId || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) console.warn('[AdminSupport] Assign error:', error.message);

        const target = allTickets.find(t => t.id === ticketId);
        if (target) {
            target.assigned_to = assignedStaffId || null;
        }

        applyFilters();
        showToast(assignedStaffId ? 'تم تعيين التذكرة للمسؤول بنجاح' : 'تم إلغاء التعيين', 'success');
    } catch (err) {
        console.error('[AdminSupport] Error updating assignment:', err);
    }
}

/**
 * Export CSV Report
 */
function exportTicketsCSV() {
    if (allTickets.length === 0) {
        showToast('لا توجد بيانات لتصديرها', 'error');
        return;
    }

    const headers = ['رقم التذكرة', 'صاحب الطلب', 'البريد الإلكتروني', 'التصنيف', 'الموضوع', 'الأولوية', 'الحالة', 'تاريخ الإنشاء', 'تاريخ الحل'];
    const rows = allTickets.map(t => [
        t.ticket_number || '',
        t.requester?.full_name || '',
        t.requester?.email || '',
        CATEGORY_MAP[t.category]?.label || t.category || '',
        `"${(t.subject || '').replace(/"/g, '""')}"`,
        PRIORITY_MAP[t.priority]?.label || t.priority || '',
        STATUS_MAP[t.status]?.label || t.status || '',
        t.created_at || '',
        t.resolved_at || ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `youth_health_support_tickets_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير تقرير التذاكر بنجاح', 'success');
}

/**
 * Initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Authenticate & Verify Role
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            window.location.href = '../login.html';
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const role = (profile?.role || '').toLowerCase().replace(/\s+/g, '_');
        if (role !== 'admin' && role !== 'super_admin') {
            alert('عذراً: هذه الصفحة مخصصة فقط للمديرين ومسؤولي النظام.');
            window.location.href = '../dashboard.html';
            return;
        }

        currentAdmin = session.user;

        // Toolbar Events
        searchInput.addEventListener('input', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
        categoryFilter.addEventListener('change', applyFilters);
        priorityFilter.addEventListener('change', applyFilters);
        sortBySelect.addEventListener('change', applyFilters);
        refreshTicketsBtn.addEventListener('click', loadTickets);
        exportTicketsBtn.addEventListener('click', exportTicketsCSV);
        resetFiltersBtn.addEventListener('click', () => {
            searchInput.value = '';
            statusFilter.value = 'all';
            categoryFilter.value = 'all';
            priorityFilter.value = 'all';
            sortBySelect.value = 'newest';
            applyFilters();
        });

        // Pagination Events
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        // Drawer Events
        closeDrawerBtn.addEventListener('click', closeTicketDrawer);
        adminTicketModal.addEventListener('click', (e) => {
            if (e.target === adminTicketModal) closeTicketDrawer();
        });

        // Mode Switching
        tabModeReply.addEventListener('click', () => setComposerMode('reply'));
        tabModeInternal.addEventListener('click', () => setComposerMode('internal'));
        adminComposerForm.addEventListener('submit', handleAdminComposerSubmit);

        // Status & Assignment dropdowns
        drawerStatusSelect.addEventListener('change', async () => {
            if (activeTicket) await updateTicketStatus(activeTicket.id, drawerStatusSelect.value);
        });
        drawerPrioritySelect.addEventListener('change', async () => {
            if (activeTicket) await updateTicketPriority(activeTicket.id, drawerPrioritySelect.value);
        });
        drawerAssignSelect.addEventListener('change', async () => {
            if (activeTicket) await updateStaffAssignment(activeTicket.id, drawerAssignSelect.value);
        });

        // Quick action buttons
        quickResolveBtn.addEventListener('click', async () => {
            if (activeTicket) await updateTicketStatus(activeTicket.id, 'resolved');
        });
        quickCloseBtn.addEventListener('click', async () => {
            if (activeTicket) await updateTicketStatus(activeTicket.id, 'closed');
        });

        // Initial Data Loads
        await loadStaffList();
        await loadTickets();
    } catch (err) {
        console.error('[AdminSupport] Init error:', err);
    }
});
