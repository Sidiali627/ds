// support.js - User Support Center & Complaint Management Module
import { supabase } from './supabase.js';
import { createNotification } from './notifications.js';

// Application State
let currentUser = null;
let userTickets = [];
let activeTicket = null;
let activeTicketMessages = [];

// Category Labels and Icons Dictionary
export const CATEGORY_MAP = {
    technical: { label: 'مشكلة فنية أو تقنية', icon: '🛠️' },
    account: { label: 'الحساب وتسجيل الدخول', icon: '🔐' },
    appointment: { label: 'إدارة المواعيد', icon: '📅' },
    consultation: { label: 'الاستشارات والعيادة', icon: '🩺' },
    inquiry: { label: 'استفسار عام', icon: '💡' },
    complaint: { label: 'شكوى حول الخدمات', icon: '⚠️' }
};

// Status Labels and Badges
export const STATUS_MAP = {
    open: { label: 'مفتوحة', class: 'open' },
    in_progress: { label: 'قيد المتابعة', class: 'in_progress' },
    waiting_user: { label: 'بانتظار ردك', class: 'waiting_user' },
    resolved: { label: 'تم الحل', class: 'resolved' },
    closed: { label: 'مغلقة', class: 'closed' }
};

// Priority Labels
export const PRIORITY_MAP = {
    low: { label: 'منخفضة', class: 'priority-low' },
    normal: { label: 'متوسطة', class: 'priority-normal' },
    high: { label: 'عالية', class: 'priority-high' },
    urgent: { label: 'عاجلة وطارئة', class: 'priority-urgent' }
};

// DOM References
const tabMyTicketsBtn = document.getElementById('tabMyTicketsBtn');
const tabNewTicketBtn = document.getElementById('tabNewTicketBtn');
const heroNewTicketBtn = document.getElementById('heroNewTicketBtn');
const heroMyTicketsBtn = document.getElementById('heroMyTicketsBtn');
const viewMyTickets = document.getElementById('viewMyTickets');
const viewNewTicket = document.getElementById('viewNewTicket');
const ticketsListContainer = document.getElementById('ticketsListContainer');
const myTicketsCountBadge = document.getElementById('myTicketsCountBadge');

const ticketSearchInput = document.getElementById('ticketSearchInput');
const ticketStatusFilter = document.getElementById('ticketStatusFilter');
const ticketCategoryFilter = document.getElementById('ticketCategoryFilter');
const refreshTicketsBtn = document.getElementById('refreshTicketsBtn');

const newTicketForm = document.getElementById('newTicketForm');
const cancelNewTicketBtn = document.getElementById('cancelNewTicketBtn');
const submitTicketBtn = document.getElementById('submitTicketBtn');
const submitTicketText = document.getElementById('submitTicketText');

// Modal Elements
const ticketDetailModal = document.getElementById('ticketDetailModal');
const closeTicketModalBtn = document.getElementById('closeTicketModalBtn');
const modalTicketNumber = document.getElementById('modalTicketNumber');
const modalTicketSubject = document.getElementById('modalTicketSubject');
const modalTicketStatus = document.getElementById('modalTicketStatus');
const modalTicketPriority = document.getElementById('modalTicketPriority');
const modalTicketCategory = document.getElementById('modalTicketCategory');
const modalTicketCreated = document.getElementById('modalTicketCreated');
const modalTicketUpdated = document.getElementById('modalTicketUpdated');
const conversationThread = document.getElementById('conversationThread');
const modalReplySection = document.getElementById('modalReplySection');
const closedTicketNotice = document.getElementById('closedTicketNotice');
const replyForm = document.getElementById('replyForm');
const replyMessageInput = document.getElementById('replyMessageInput');
const userCloseTicketBtn = document.getElementById('userCloseTicketBtn');

/**
 * Toast Notification Helper
 */
export function showToast(message, type = 'info') {
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
 * Tab Switching Handler
 */
function switchTab(target) {
    if (target === 'new') {
        tabMyTicketsBtn.classList.remove('active');
        tabNewTicketBtn.classList.add('active');
        viewMyTickets.style.display = 'none';
        viewNewTicket.style.display = 'block';
    } else {
        tabNewTicketBtn.classList.remove('active');
        tabMyTicketsBtn.classList.add('active');
        viewNewTicket.style.display = 'none';
        viewMyTickets.style.display = 'block';
    }
}

/**
 * Format timestamp nicely
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
 * Load User's Tickets
 */
async function loadUserTickets() {
    if (!currentUser) return;

    ticketsListContainer.innerHTML = `
        <div class="card" style="padding: 2rem; border-radius: 16px; margin-bottom: 1rem;">
            <div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 8px;"></div>
            <div class="skeleton" style="height: 16px; width: 25%;"></div>
        </div>
    `;

    try {
        // 1. Query remote Supabase
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[SupportCenter] Remote query notice:', error.message);
            // Fallback to local storage if remote table is not yet migrated
            const local = localStorage.getItem(`yhs_tickets_${currentUser.id}`);
            userTickets = local ? JSON.parse(local) : [];
        } else {
            userTickets = data || [];
            // Cache locally
            localStorage.setItem(`yhs_tickets_${currentUser.id}`, JSON.stringify(userTickets));
        }

        renderTicketsList();
    } catch (err) {
        console.error('[SupportCenter] Exception loading tickets:', err);
        const local = localStorage.getItem(`yhs_tickets_${currentUser.id}`);
        userTickets = local ? JSON.parse(local) : [];
        renderTicketsList();
    }
}

/**
 * Render filtered tickets
 */
function renderTicketsList() {
    const searchTerm = (ticketSearchInput.value || '').trim().toLowerCase();
    const statusVal = ticketStatusFilter.value;
    const categoryVal = ticketCategoryFilter.value;

    const filtered = userTickets.filter(t => {
        const matchSearch = !searchTerm ||
            (t.ticket_number && t.ticket_number.toLowerCase().includes(searchTerm)) ||
            (t.subject && t.subject.toLowerCase().includes(searchTerm)) ||
            (t.description && t.description.toLowerCase().includes(searchTerm));

        const matchStatus = statusVal === 'all' || t.status === statusVal;
        const matchCategory = categoryVal === 'all' || t.category === categoryVal;

        return matchSearch && matchStatus && matchCategory;
    });

    myTicketsCountBadge.textContent = userTickets.length;

    if (filtered.length === 0) {
        ticketsListContainer.innerHTML = `
            <div class="empty-state" style="background: var(--surface-color); border-radius: 16px; border: 1px solid var(--border-color); padding: 3rem 1.5rem;">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">لا توجد تذاكر دعم مطابقة</div>
                <div class="empty-state-desc">
                    ${userTickets.length === 0 ? 'لم تقم بفتح أي تذكرة دعم أو شكوى حتى الآن. إذا واجهتك أي مشكلة يسعدنا مساعدتك في أي وقت.' : 'لا توجد نتائج تطابق خيارات البحث والفلترة المحددة.'}
                </div>
                ${userTickets.length === 0 ? '<button class="btn btn-primary" id="emptyCreateBtn" style="border-radius:12px;">➕ فتح تذكرة دعم جديدة</button>' : ''}
            </div>
        `;
        const emptyBtn = document.getElementById('emptyCreateBtn');
        if (emptyBtn) emptyBtn.addEventListener('click', () => switchTab('new'));
        return;
    }

    ticketsListContainer.innerHTML = filtered.map(ticket => {
        const catInfo = CATEGORY_MAP[ticket.category] || { label: ticket.category, icon: '📁' };
        const statusInfo = STATUS_MAP[ticket.status] || { label: ticket.status, class: 'user' };
        const priorityInfo = PRIORITY_MAP[ticket.priority] || { label: ticket.priority, class: 'priority-normal' };

        return `
            <div class="ticket-list-item" data-id="${ticket.id}">
                <div class="ticket-main-info">
                    <div class="ticket-meta-badges">
                        <span class="ticket-number-tag">${ticket.ticket_number || 'TICK-NEW'}</span>
                        <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
                        <span class="priority-badge ${priorityInfo.class}">${priorityInfo.label}</span>
                        <span class="category-tag">${catInfo.icon} ${catInfo.label}</span>
                    </div>
                    <a href="javascript:void(0)" class="ticket-title-link view-ticket-btn" data-id="${ticket.id}">
                        ${escapeHtml(ticket.subject)}
                    </a>
                    <div class="ticket-date-text">
                        تاريخ الإنشاء: ${formatDate(ticket.created_at)} • آخر تحديث: ${formatDate(ticket.updated_at || ticket.created_at)}
                    </div>
                </div>

                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn btn-primary view-ticket-btn" data-id="${ticket.id}" style="padding: 7px 16px; border-radius: 10px; font-size: 0.88rem;">
                        <span>💬</span>
                        <span>عرض المحادثة</span>
                    </button>
                    ${ticket.status === 'resolved' ? `
                        <button class="btn btn-outline close-quick-btn" data-id="${ticket.id}" style="padding: 7px 14px; border-radius: 10px; font-size: 0.85rem; border-color: var(--success-color); color: var(--success-color);">
                            ✅ إغلاق
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers
    document.querySelectorAll('.view-ticket-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ticketId = btn.getAttribute('data-id');
            openTicketModal(ticketId);
        });
    });

    document.querySelectorAll('.close-quick-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const ticketId = btn.getAttribute('data-id');
            await closeTicket(ticketId);
        });
    });
}

/**
 * Open Conversation Modal
 */
async function openTicketModal(ticketId) {
    const ticket = userTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    activeTicket = ticket;

    // Populate modal headers
    const catInfo = CATEGORY_MAP[ticket.category] || { label: ticket.category, icon: '📁' };
    const statusInfo = STATUS_MAP[ticket.status] || { label: ticket.status, class: 'user' };
    const priorityInfo = PRIORITY_MAP[ticket.priority] || { label: ticket.priority, class: 'priority-normal' };

    modalTicketNumber.textContent = ticket.ticket_number || 'TICK-XXXX';
    modalTicketSubject.textContent = ticket.subject;
    modalTicketStatus.textContent = statusInfo.label;
    modalTicketStatus.className = `status-badge ${statusInfo.class}`;
    modalTicketPriority.textContent = priorityInfo.label;
    modalTicketPriority.className = `priority-badge ${priorityInfo.class}`;
    modalTicketCategory.textContent = `${catInfo.icon} ${catInfo.label}`;
    modalTicketCreated.textContent = formatDate(ticket.created_at);
    modalTicketUpdated.textContent = formatDate(ticket.updated_at || ticket.created_at);

    // If ticket is closed, hide reply form
    if (ticket.status === 'closed') {
        replyForm.style.display = 'none';
        closedTicketNotice.style.display = 'block';
    } else {
        replyForm.style.display = 'flex';
        closedTicketNotice.style.display = 'none';
        userCloseTicketBtn.style.display = (ticket.status === 'resolved' || ticket.status === 'waiting_user') ? 'inline-flex' : 'none';
    }

    ticketDetailModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    await loadConversationMessages(ticket.id);
}

/**
 * Close Conversation Modal
 */
function closeTicketModal() {
    ticketDetailModal.style.display = 'none';
    document.body.style.overflow = '';
    activeTicket = null;
    activeTicketMessages = [];
}

/**
 * Load Conversation Messages for active ticket
 */
async function loadConversationMessages(ticketId) {
    conversationThread.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div class="skeleton" style="height: 20px; width: 60%; margin: 8px auto;"></div>
            <div class="skeleton" style="height: 20px; width: 40%; margin: 8px auto;"></div>
        </div>
    `;

    try {
        // Query messages (RLS ensures user only gets is_internal = false)
        const { data, error } = await supabase
            .from('support_ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('[SupportCenter] Remote messages query error:', error.message);
            const local = localStorage.getItem(`yhs_ticket_msgs_${ticketId}`);
            activeTicketMessages = local ? JSON.parse(local) : [
                {
                    id: 'init-msg',
                    ticket_id: ticketId,
                    sender_type: 'user',
                    message: activeTicket.description,
                    created_at: activeTicket.created_at
                }
            ];
        } else {
            activeTicketMessages = data || [];
            if (activeTicketMessages.length === 0 && activeTicket.description) {
                // If initial description isn't in messages table, show it as first message
                activeTicketMessages.push({
                    id: 'init-desc',
                    ticket_id: ticketId,
                    sender_type: 'user',
                    message: activeTicket.description,
                    created_at: activeTicket.created_at
                });
            }
            localStorage.setItem(`yhs_ticket_msgs_${ticketId}`, JSON.stringify(activeTicketMessages));
        }

        renderConversationThread();
    } catch (err) {
        console.error('[SupportCenter] Error loading messages:', err);
        renderConversationThread();
    }
}

/**
 * Render conversation thread
 */
function renderConversationThread() {
    if (activeTicketMessages.length === 0) {
        conversationThread.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                لا توجد رسائل سابقة في هذه التذكرة.
            </div>
        `;
        return;
    }

    conversationThread.innerHTML = activeTicketMessages.map(msg => {
        const isStaff = msg.sender_type === 'support' || msg.sender_type === 'admin';
        const bubbleClass = isStaff ? 'staff-bubble' : 'user-bubble';
        const senderTitle = isStaff ? 'فريق الدعم الفني 🎧' : 'أنت (صاحب التذكرة)';

        return `
            <div class="support-bubble ${bubbleClass}">
                <div class="bubble-header">
                    <span class="bubble-sender" style="${isStaff ? 'color: var(--brand-accent);' : ''}">
                        ${senderTitle}
                    </span>
                    <span class="bubble-time">${formatDate(msg.created_at)}</span>
                </div>
                <div class="bubble-content">${escapeHtml(msg.message)}</div>
                ${msg.attachment_url ? `
                    <a href="${escapeHtml(msg.attachment_url)}" target="_blank" rel="noopener noreferrer" class="bubble-attachment">
                        📎 فتح المرفق
                    </a>
                ` : ''}
            </div>
        `;
    }).join('');

    // Scroll to bottom of conversation
    conversationThread.scrollTop = conversationThread.scrollHeight;
}

/**
 * Submit New Support Ticket
 */
async function handleNewTicketSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        showToast('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }

    const category = document.getElementById('ticketCategory').value;
    const priority = document.getElementById('ticketPriority').value || 'normal';
    const subject = document.getElementById('ticketSubject').value.trim();
    const description = document.getElementById('ticketDescription').value.trim();
    const fileInput = document.getElementById('ticketAttachment');

    // Validation
    if (!category || !CATEGORY_MAP[category]) {
        showToast('يرجى اختيار تصنيف صالح للتذكرة', 'error');
        return;
    }
    if (subject.length < 3) {
        showToast('عنوان التذكرة يجب أن يكون 3 أحرف على الأقل', 'error');
        return;
    }
    if (description.length < 10) {
        showToast('تفاصيل المشكلة يجب أن تكون 10 أحرف على الأقل', 'error');
        return;
    }

    // Attachment check
    let attachmentUrl = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
            showToast('حجم الملف المرفق يجب ألا يتجاوز 5 ميغابايت', 'error');
            return;
        }
        attachmentUrl = `[مرفق: ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)]`;
    }

    submitTicketBtn.disabled = true;
    submitTicketText.textContent = 'جاري الإرسال... ⏳';

    try {
        let createdTicket = null;

        // 1. Try RPC 'create_support_ticket_secure'
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_support_ticket_secure', {
            category_input: category,
            subject_input: subject,
            description_input: description,
            priority_input: priority,
            attachment_url_input: attachmentUrl
        });

        if (!rpcError && rpcData && rpcData.ticket_id) {
            createdTicket = {
                id: rpcData.ticket_id,
                ticket_number: rpcData.ticket_number,
                user_id: currentUser.id,
                category,
                subject,
                description,
                priority,
                status: 'open',
                attachment_url: attachmentUrl,
                created_at: new Date().toISOString()
            };
        } else {
            console.warn('[SupportCenter] RPC fallback, attempting direct table insert:', rpcError?.message);

            // 2. Direct table insert fallback
            const genTicketNum = `TICK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const { data: directData, error: directError } = await supabase
                .from('support_tickets')
                .insert({
                    ticket_number: genTicketNum,
                    user_id: currentUser.id,
                    category,
                    subject,
                    description,
                    priority,
                    status: 'open',
                    attachment_url: attachmentUrl
                })
                .select()
                .single();

            if (!directError && directData) {
                createdTicket = directData;
                // Insert initial message
                await supabase.from('support_ticket_messages').insert({
                    ticket_id: directData.id,
                    sender_id: currentUser.id,
                    sender_type: 'user',
                    message: description,
                    is_internal: false,
                    attachment_url: attachmentUrl
                });
            } else {
                console.warn('[SupportCenter] Table insert error, using local storage fallback:', directError?.message);
                createdTicket = {
                    id: 'local-' + Date.now(),
                    ticket_number: genTicketNum,
                    user_id: currentUser.id,
                    category,
                    subject,
                    description,
                    priority,
                    status: 'open',
                    attachment_url: attachmentUrl,
                    created_at: new Date().toISOString()
                };
            }
        }

        // Update local state and storage
        userTickets.unshift(createdTicket);
        localStorage.setItem(`yhs_tickets_${currentUser.id}`, JSON.stringify(userTickets));

        // Create in-app notification
        await createNotification(
            currentUser.id,
            `تم فتح تذكرة الدعم [${createdTicket.ticket_number}]`,
            `تم تسجيل طلبك بعنوان "${subject}". يعمل فريق الدعم على مراجعته وسنوافيك بالرد قريباً.`,
            'system',
            'support.html',
            'normal',
            { ticket_id: createdTicket.id, ticket_number: createdTicket.ticket_number }
        );

        showToast(`تم إرسال تذكرة الدعم بنجاح بالرمز: ${createdTicket.ticket_number}`, 'success');

        // Reset form & switch tab
        newTicketForm.reset();
        switchTab('my');
        renderTicketsList();
    } catch (err) {
        console.error('[SupportCenter] Error submitting ticket:', err);
        showToast('حدث خطأ أثناء إرسال التذكرة. يرجى المحاولة لاحقاً.', 'error');
    } finally {
        submitTicketBtn.disabled = false;
        submitTicketText.textContent = 'إرسال التذكرة الآن 🚀';
    }
}

/**
 * Send Reply in Conversation
 */
async function handleReplySubmit(e) {
    e.preventDefault();
    if (!currentUser || !activeTicket) return;

    const messageText = replyMessageInput.value.trim();
    if (!messageText) {
        showToast('يرجى كتابة نص الرد', 'error');
        return;
    }

    const sendBtn = document.getElementById('sendReplyBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'جاري الإرسال...';

    try {
        let newMsg = null;

        // 1. Try RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('add_ticket_reply_secure', {
            ticket_id_input: activeTicket.id,
            message_input: messageText,
            is_internal_input: false
        });

        if (!rpcError && rpcData) {
            newMsg = {
                id: rpcData.message_id || 'msg-' + Date.now(),
                ticket_id: activeTicket.id,
                sender_id: currentUser.id,
                sender_type: 'user',
                message: messageText,
                created_at: new Date().toISOString()
            };
        } else {
            // Direct insert fallback
            const { data: insertData, error: insertError } = await supabase
                .from('support_ticket_messages')
                .insert({
                    ticket_id: activeTicket.id,
                    sender_id: currentUser.id,
                    sender_type: 'user',
                    message: messageText,
                    is_internal: false
                })
                .select()
                .single();

            if (!insertError && insertData) {
                newMsg = insertData;
                // Transition ticket status to in_progress
                await supabase.from('support_tickets').update({
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                }).eq('id', activeTicket.id);
            } else {
                newMsg = {
                    id: 'local-msg-' + Date.now(),
                    ticket_id: activeTicket.id,
                    sender_id: currentUser.id,
                    sender_type: 'user',
                    message: messageText,
                    created_at: new Date().toISOString()
                };
            }
        }

        // Update local conversation
        activeTicketMessages.push(newMsg);
        localStorage.setItem(`yhs_ticket_msgs_${activeTicket.id}`, JSON.stringify(activeTicketMessages));

        // Update ticket in local list
        activeTicket.status = 'in_progress';
        activeTicket.updated_at = new Date().toISOString();
        localStorage.setItem(`yhs_tickets_${currentUser.id}`, JSON.stringify(userTickets));

        replyMessageInput.value = '';
        renderConversationThread();
        renderTicketsList();
        showToast('تم إرسال ردك بنجاح', 'success');
    } catch (err) {
        console.error('[SupportCenter] Error sending reply:', err);
        showToast('تعذر إرسال الرد، يرجى المحاولة لاحقاً', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'إرسال الرد 💬';
    }
}

/**
 * Close Ticket Handler
 */
async function closeTicket(ticketId) {
    if (!confirm('هل أنت متأكد من تأكيد حل المشكلة وإغلاق هذه التذكرة؟')) return;

    try {
        const { error } = await supabase
            .from('support_tickets')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId)
            .eq('user_id', currentUser.id);

        if (error) {
            console.warn('[SupportCenter] Error updating ticket status:', error.message);
        }

        // Update local state
        const target = userTickets.find(t => t.id === ticketId);
        if (target) {
            target.status = 'closed';
            target.closed_at = new Date().toISOString();
            localStorage.setItem(`yhs_tickets_${currentUser.id}`, JSON.stringify(userTickets));
        }

        if (activeTicket && activeTicket.id === ticketId) {
            activeTicket.status = 'closed';
            modalTicketStatus.textContent = 'مغلقة';
            modalTicketStatus.className = 'status-badge closed';
            replyForm.style.display = 'none';
            closedTicketNotice.style.display = 'block';
        }

        showToast('تم إغلاق التذكرة بنجاح. شكراً لتعاونك!', 'success');
        renderTicketsList();
    } catch (err) {
        console.error('[SupportCenter] Error closing ticket:', err);
        showToast('تعذر إغلاق التذكرة', 'error');
    }
}

/**
 * Safe HTML Escaping
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
 * Initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Authenticate User
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;

        // Event Listeners for Tabs & Hero Buttons
        tabMyTicketsBtn.addEventListener('click', () => switchTab('my'));
        tabNewTicketBtn.addEventListener('click', () => switchTab('new'));
        heroNewTicketBtn.addEventListener('click', () => switchTab('new'));
        heroMyTicketsBtn.addEventListener('click', () => switchTab('my'));

        // Filters and Search
        ticketSearchInput.addEventListener('input', renderTicketsList);
        ticketStatusFilter.addEventListener('change', renderTicketsList);
        ticketCategoryFilter.addEventListener('change', renderTicketsList);
        refreshTicketsBtn.addEventListener('click', loadUserTickets);

        // Forms
        newTicketForm.addEventListener('submit', handleNewTicketSubmit);
        cancelNewTicketBtn.addEventListener('click', () => switchTab('my'));
        replyForm.addEventListener('submit', handleReplySubmit);

        // Modals
        closeTicketModalBtn.addEventListener('click', closeTicketModal);
        ticketDetailModal.addEventListener('click', (e) => {
            if (e.target === ticketDetailModal) closeTicketModal();
        });
        userCloseTicketBtn.addEventListener('click', () => {
            if (activeTicket) closeTicket(activeTicket.id);
        });

        // Load initial tickets
        await loadUserTickets();
    } catch (err) {
        console.error('[SupportCenter] Init failed:', err);
    }
});
