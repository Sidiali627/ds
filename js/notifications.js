// notifications.js - Centralized In-App Notification Engine with Realtime, Sound & Filtering
import { supabase } from './supabase.js';

let notificationSubscription = null;
let currentFilter = 'all';

/**
 * Synthesizes a soft, pleasant chime using the Web Audio API (no external asset needed)
 */
export function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15); // D6

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.55);
        osc2.stop(ctx.currentTime + 0.55);
    } catch {
        // Silent fallback if audio context blocked by browser autoplay policy
    }
}

/**
 * Creates an in-app notification with intelligent deduplication
 */
export async function createNotification(userId, title, message, type = 'system', link = null, priority = 'normal', metadata = {}) {
    if (!supabase) return { error: { message: "Supabase client is not initialized" } };

    try {
        // Deduplication Check: Prevent identical notification to same user within 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        let query = supabase
            .from('notifications')
            .select('id')
            .eq('title', title)
            .gte('created_at', fiveMinutesAgo)
            .limit(1);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.is('user_id', null);
        }

        const { data: existing } = await query;

        if (existing && existing.length > 0) {
            console.log("Duplicate notification prevented:", title, "for user:", userId || 'global');
            return { data: existing[0], duplicate: true };
        }

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId || null,
                title: title,
                message: message,
                type: type,
                link: link,
                priority: priority,
                metadata: metadata,
                is_read: false
            })
            .select()
            .single();

        return { data, error };
    } catch (err) {
        console.error("Error creating notification:", err);
        return { error: err };
    }
}

/**
 * Fetches notifications for the current user with optional filtering
 */
export async function getUserNotifications(userId, filter = 'all', limit = 30) {
    if (!supabase || !userId) return [];
    try {
        let query = supabase
            .from('notifications')
            .select('*')
            .or(`user_id.eq.${userId},user_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (filter === 'unread') {
            query = query.eq('is_read', false);
        } else if (filter === 'medical') {
            query = query.in('type', ['consultation', 'appointment', 'reminder', 'medical_record']);
        } else if (filter === 'announcements') {
            query = query.in('type', ['announcement', 'system']);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching notifications:", error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error("Failed to load notifications:", err);
        return [];
    }
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(userId) {
    if (!supabase || !userId) return 0;
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .or(`user_id.eq.${userId},user_id.is.null`)
            .eq('is_read', false);

        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
}

/**
 * Marks a single notification as read
 */
export async function markAsRead(notificationId) {
    if (!supabase || !notificationId) return;
    try {
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
    } catch (err) {
        console.error("Error marking notification read:", err);
    }
}

/**
 * Marks all notifications for the user as read
 */
export async function markAllAsRead(userId) {
    if (!supabase || !userId) return;
    try {
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);
    } catch (err) {
        console.error("Error marking all notifications read:", err);
    }
}

/**
 * Renders and attaches the global interactive notification dropdown widget
 */
export async function setupNotificationWidget(triggerOrContainer, userId = null) {
    if (!triggerOrContainer) return;

    let targetEl = typeof triggerOrContainer === 'string'
        ? document.getElementById(triggerOrContainer) || document.querySelector(triggerOrContainer)
        : triggerOrContainer;

    if (!targetEl) return;

    if (!userId && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) userId = session.user.id;
    }

    if (!userId) return;

    let triggerBtn = targetEl;
    if (targetEl.tagName !== 'BUTTON') {
        targetEl.innerHTML = `
            <button class="notif-bell-btn btn btn-outline" id="global-notif-bell-btn" title="الإشعارات" aria-label="مركز الإشعارات" style="position:relative; padding:7px 14px; border-radius:12px; font-size:0.92rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition: all 0.2s;">
                <span style="font-size: 1.1rem; line-height: 1;">🔔</span>
                <span class="notif-bell-label" style="font-size:0.84rem; font-weight:700;">الإشعارات</span>
            </button>
        `;
        triggerBtn = targetEl.querySelector('.notif-bell-btn');
    }

    // Remove existing dropdown if any
    const existing = document.getElementById('notif-dropdown-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.id = 'notif-dropdown-popover';
    popover.style.cssText = `
        display: none;
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        width: 370px;
        max-width: 92vw;
        background: var(--surface-color, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 16px;
        box-shadow: 0 12px 35px rgba(0,0,0,0.14);
        z-index: 10000;
        text-align: right;
        overflow: hidden;
        direction: rtl;
        font-family: inherit;
    `;

    popover.innerHTML = `
        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color, #e2e8f0); display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary, #f8fafc);">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.1rem;">🔔</span>
                <span style="font-weight:800; font-size:0.96rem; color:var(--text-primary, #0f172a);">مركز الإشعارات</span>
            </div>
            <button id="btn-mark-all-read" style="background:none; border:none; font-size:0.78rem; color:var(--brand-accent, #0284c7); cursor:pointer; font-weight:700; font-family:inherit; padding:4px 8px; border-radius:6px; transition: background 0.15s;">
                تحديد الكل كمقروء ✓
            </button>
        </div>
        
        <!-- Filter Tabs -->
        <div style="display:flex; gap:4px; padding:8px 12px; background:var(--surface-color, #ffffff); border-bottom:1px solid var(--border-color, #e2e8f0); overflow-x:auto;">
            <button class="notif-tab-btn active" data-filter="all" style="padding:4px 10px; font-size:0.76rem; border-radius:20px; border:none; background:var(--brand-accent, #0284c7); color:white; font-weight:700; cursor:pointer;">الكل</button>
            <button class="notif-tab-btn" data-filter="unread" style="padding:4px 10px; font-size:0.76rem; border-radius:20px; border:1px solid var(--border-color, #e2e8f0); background:transparent; color:var(--text-secondary, #64748b); font-weight:600; cursor:pointer;">غير مقروءة</button>
            <button class="notif-tab-btn" data-filter="medical" style="padding:4px 10px; font-size:0.76rem; border-radius:20px; border:1px solid var(--border-color, #e2e8f0); background:transparent; color:var(--text-secondary, #64748b); font-weight:600; cursor:pointer;">الخدمات الطبية</button>
            <button class="notif-tab-btn" data-filter="announcements" style="padding:4px 10px; font-size:0.76rem; border-radius:20px; border:1px solid var(--border-color, #e2e8f0); background:transparent; color:var(--text-secondary, #64748b); font-weight:600; cursor:pointer;">الإعلانات</button>
        </div>

        <div id="notif-items-list" style="max-height: 380px; overflow-y: auto; padding: 4px 0;">
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-secondary, #64748b); font-size: 0.85rem;">جاري التحميل...</div>
        </div>
    `;

    // Position container relatively if not already
    const parent = triggerBtn.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    parent.appendChild(popover);

    // Toggle popover
    triggerBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = popover.style.display === 'block';
        if (isOpen) {
            popover.style.display = 'none';
        } else {
            popover.style.display = 'block';
            await refreshDropdownContent(userId, popover, currentFilter);
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== triggerBtn) {
            popover.style.display = 'none';
        }
    });

    // Filter Tab Clicks
    popover.querySelectorAll('.notif-tab-btn').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.stopPropagation();
            popover.querySelectorAll('.notif-tab-btn').forEach(t => {
                t.style.background = 'transparent';
                t.style.color = 'var(--text-secondary, #64748b)';
                t.style.border = '1px solid var(--border-color, #e2e8f0)';
                t.classList.remove('active');
            });
            tab.style.background = 'var(--brand-accent, #0284c7)';
            tab.style.color = 'white';
            tab.style.border = 'none';
            tab.classList.add('active');

            currentFilter = tab.getAttribute('data-filter') || 'all';
            await refreshDropdownContent(userId, popover, currentFilter);
        });
    });

    // Mark all as read button
    popover.querySelector('#btn-mark-all-read')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await markAllAsRead(userId);
        await updateBadge(triggerBtn, userId);
        await refreshDropdownContent(userId, popover, currentFilter);
    });

    // Initial Badge update
    updateBadge(triggerBtn, userId);

    // Live Realtime listener
    if (supabase) {
        if (notificationSubscription) notificationSubscription.unsubscribe();
        notificationSubscription = supabase
            .channel(`notifs_live_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                // If it belongs to this user or is global announcement
                if (!payload.new.user_id || payload.new.user_id === userId) {
                    playNotificationSound();
                    updateBadge(triggerBtn, userId);
                    if (popover.style.display === 'block') {
                        refreshDropdownContent(userId, popover, currentFilter);
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications'
            }, () => {
                updateBadge(triggerBtn, userId);
                if (popover.style.display === 'block') {
                    refreshDropdownContent(userId, popover, currentFilter);
                }
            })
            .subscribe();
    }
}

async function updateBadge(triggerBtn, userId) {
    const count = await getUnreadCount(userId);
    let badge = triggerBtn.querySelector('.notif-badge-pill');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge-pill';
        badge.style.cssText = 'background:#ef4444; color:white; font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:12px; margin-right:4px; box-shadow:0 2px 6px rgba(239, 68, 68, 0.4); display:inline-block;';
        triggerBtn.appendChild(badge);
    }
    badge.innerText = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function getTypeIconAndBadge(type) {
    switch (type) {
        case 'consultation':
            return { icon: '🩺', badge: 'استشارة', color: '#0284c7' };
        case 'appointment':
            return { icon: '📅', badge: 'موعد طبي', color: '#059669' };
        case 'reminder':
            return { icon: '⏰', badge: 'تذكير', color: '#d97706' };
        case 'medical_record':
            return { icon: '📋', badge: 'سجل EMR', color: '#7c3aed' };
        case 'announcement':
            return { icon: '📢', badge: 'إعلان', color: '#1a56db' };
        default:
            return { icon: '🔔', badge: 'نظام', color: '#64748b' };
    }
}

async function refreshDropdownContent(userId, popover, filter = 'all') {
    const listEl = popover.querySelector('#notif-items-list');
    if (!listEl) return;

    const notifs = await getUserNotifications(userId, filter, 25);
    if (notifs.length === 0) {
        const emptyLabels = {
            all: 'لا توجد إشعارات حالياً',
            unread: 'رائع! لا توجد إشعارات غير مقروءة',
            medical: 'لا توجد إشعارات طبية مسجلة',
            announcements: 'لا توجد إعلانات عامة جديدة'
        };
        listEl.innerHTML = `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-secondary, #64748b);">
                <div style="font-size: 2.2rem; margin-bottom: 8px;">🔕</div>
                <div style="font-size: 0.9rem; font-weight:700; color:var(--text-primary, #0f172a);">${emptyLabels[filter] || 'لا توجد إشعارات'}</div>
                <p style="font-size: 0.78rem; margin: 4px 0 0 0; color:var(--text-secondary, #64748b);">سيتم إشعارك فور حدوث أي مستجدات سريرية أو إدارية.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = notifs.map(n => {
        const typeInfo = getTypeIconAndBadge(n.type);
        const unreadStyle = !n.is_read ? 'background: rgba(2, 132, 199, 0.05); border-right: 3px solid #0284c7;' : 'border-right: 3px solid transparent;';
        const dot = !n.is_read ? '<span style="width:7px; height:7px; border-radius:50%; background:#0284c7; display:inline-block; margin-right:4px;"></span>' : '';
        const timeAgo = formatTimeAgo(n.created_at);

        return `
            <div class="notif-item" data-id="${n.id}" data-link="${n.link || ''}" style="padding: 12px 14px; border-bottom: 1px solid var(--border-color, #e2e8f0); cursor:pointer; display:flex; gap:12px; align-items:flex-start; transition: background 0.15s; ${unreadStyle}">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${typeInfo.color}18; display:flex; align-items:center; justify-content:center; font-size: 1rem; flex-shrink:0;">
                    ${typeInfo.icon}
                </div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2px;">
                        <span style="font-size:0.7rem; font-weight:700; color:${typeInfo.color}; background:${typeInfo.color}12; padding:1px 6px; border-radius:10px;">${typeInfo.badge}</span>
                        <div style="font-size:0.68rem; color:var(--text-secondary, #94a3b8);">${dot} ${timeAgo}</div>
                    </div>
                    <div style="font-size:0.86rem; color:var(--text-primary, #0f172a); font-weight:700; margin-bottom:3px;">${n.title}</div>
                    <div style="font-size:0.78rem; color:var(--text-secondary, #475569); line-height:1.45; margin-bottom:4px;">${n.message}</div>
                    ${n.link ? `<div style="font-size:0.72rem; color:var(--brand-accent, #0284c7); font-weight:700;">انقر للمتابعة ←</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Click handler on item
    listEl.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.getAttribute('data-id');
            const link = item.getAttribute('data-link');
            await markAsRead(id);
            popover.style.display = 'none';
            if (link) {
                window.location.href = link;
            }
        });
    });
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    return `منذ ${diffDays} يوم`;
}
