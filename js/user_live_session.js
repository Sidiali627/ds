import { supabase } from './supabase.js';
import { WebRTCManager } from './webrtc.js';
import { showToast } from './toast.js';

let currentUser = null;
let currentConsultation = null;
let broadcastChannel = null;
let typingTimeout = null;
let rtcManager = null;
const loadedMessageIds = new Set();

async function init() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    currentUser = session.user;

    const urlParams = new URLSearchParams(window.location.search);
    const cId = urlParams.get('id');
    if (!cId) { showToast('رقم الجلسة مفقود', 'error'); setTimeout(() => window.location.href = 'dashboard.html', 1500); return; }

    await loadConsultation(cId);
    setupRealtime();
    
    const input = document.getElementById('chat-input');
    input?.addEventListener('input', handleTyping);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.sendMessage();
        }
    });
}

async function loadConsultation(id) {
    const { data: consultation, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !consultation) {
        console.error("Error loading consultation:", error);
        showToast("تعذر تحميل بيانات الجلسة: " + (error?.message || "غير موجودة"), "error");
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }
    currentConsultation = consultation;

    if (consultation.specialist_id) {
        const { data: spProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', consultation.specialist_id)
            .single();

        if (spProfile) {
            const spNameEl = document.getElementById('sp-name');
            if (spNameEl) spNameEl.innerText = spProfile.full_name || 'طبيب الاستشارة';
            const spAvatarEl = document.getElementById('sp-avatar');
            if (spAvatarEl && spProfile.avatar_url) spAvatarEl.src = spProfile.avatar_url;
            const specDisplay = consultation.specialty === 'psychology' ? 'صحة نفسية' : (consultation.specialty === 'nutrition' ? 'تغذية' : (consultation.specialty || 'استشارة عامة'));
            const spStatusEl = document.getElementById('sp-status');
            if (spStatusEl) spStatusEl.innerText = `${specDisplay} - جلسة أونلاين 🟢`;
            const sessInfoEl = document.getElementById('session-info');
            if (sessInfoEl) sessInfoEl.innerText = `مع د. ${spProfile.full_name || 'المختص'} (${specDisplay}) 🟢`;
        }
    } else {
        const spNameEl = document.getElementById('sp-name');
        if (spNameEl) spNameEl.innerText = 'في انتظار انضمام المختص...';
        const spStatusEl = document.getElementById('sp-status');
        if (spStatusEl) spStatusEl.innerText = 'تم تقديم الطلب بنجاح';
        const sessInfoEl = document.getElementById('session-info');
        if (sessInfoEl) sessInfoEl.innerText = 'في انتظار انضمام الطبيب للجلسة... ⏳';
    }

    await loadMessages();
}

async function loadMessages() {
    const { data, error } = await supabase.from('chat_messages')
        .select('*')
        .eq('consultation_id', currentConsultation.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error);
        return;
    }

    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    loadedMessageIds.clear();

    if (data && data.length > 0) {
        data.forEach(msg => appendMessage(msg));
        scrollToBottom();
        markMessagesAsRead();
    } else {
        box.innerHTML = '<div style="text-align:center; color: var(--text-secondary); font-size:0.9rem; margin-top:2rem;">بدأت الجلسة. لا توجد رسائل سابقة.</div>';
    }
}

async function markMessagesAsRead() {
    const now = new Date().toISOString();
    await supabase.from('chat_messages')
        .update({ status: 'read', read_at: now, delivered_at: now })
        .eq('consultation_id', currentConsultation.id)
        .neq('sender_id', currentUser.id)
        .neq('status', 'read');
}

function appendMessage(msg) {
    if (!msg || !msg.id) return;
    
    // Deduplicate
    if (loadedMessageIds.has(msg.id)) {
        // Update existing message ticks if status updated
        const existingEl = document.getElementById(`msg-${msg.id}`);
        if (existingEl && msg.sender_id === currentUser.id) {
            const ticksEl = existingEl.querySelector('.msg-status-ticks');
            if (ticksEl) {
                if (msg.status === 'read') {
                    ticksEl.className = 'msg-status-ticks msg-status-read';
                    ticksEl.innerText = '✓✓';
                } else if (msg.status === 'delivered') {
                    ticksEl.className = 'msg-status-ticks';
                    ticksEl.innerText = '✓✓';
                } else {
                    ticksEl.className = 'msg-status-ticks';
                    ticksEl.innerText = '✓';
                }
            }
        }
        return;
    }

    loadedMessageIds.add(msg.id);

    const box = document.getElementById('chat-box');
    const isMe = msg.sender_id === currentUser.id;
    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `msg ${isMe ? 'msg-me' : 'msg-other'}`;

    let statusTicks = '';
    if (isMe) {
        if (msg.status === 'read') statusTicks = '<span class="msg-status-ticks msg-status-read">✓✓</span>';
        else if (msg.status === 'delivered') statusTicks = '<span class="msg-status-ticks">✓✓</span>';
        else statusTicks = '<span class="msg-status-ticks">✓</span>';
    }

    div.innerHTML = `
        <div>${msg.content ? msg.content.replace(/\n/g, '<br>') : ''}</div>
        ${msg.file_url ? `<div style="margin-top:6px;"><a href="${msg.file_url}" target="_blank" style="color:inherit; text-decoration:underline;">📎 عرض المرفق</a></div>` : ''}
        <div class="msg-meta">
            <span>${new Date(msg.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            ${statusTicks}
        </div>
    `;
    box.appendChild(div);
}

function scrollToBottom() {
    const box = document.getElementById('chat-box');
    if (box) box.scrollTop = box.scrollHeight;
}

window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = '';

    // Insert directly into Supabase DB first to guarantee persistence
    const payload = {
        consultation_id: currentConsultation.id,
        sender_id: currentUser.id,
        sender_role: 'user',
        content: text,
        status: 'sent',
        message_type: 'text'
    };

    const { data, error } = await supabase.from('chat_messages').insert([payload]).select().single();

    if (error) {
        console.error("Error inserting message to DB:", error);
        showToast("فشل إرسال الرسالة إلى قاعدة البيانات: " + error.message, 'error');
    } else if (data) {
        appendMessage(data);
        scrollToBottom();
    }
}

function handleTyping() {
    if (!broadcastChannel) return;
    broadcastChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id, isTyping: true }
    });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        broadcastChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: currentUser.id, isTyping: false }
        });
    }, 2000);
}

function setupRealtime() {
    // 1. Postgres changes for new messages & status updates
    supabase.channel(`chat_channel_${currentConsultation.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages', 
            filter: `consultation_id=eq.${currentConsultation.id}` 
        }, payload => {
            if (payload.new.sender_id !== currentUser.id) {
                appendMessage(payload.new);
                scrollToBottom();
                markMessagesAsRead();
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages',
            filter: `consultation_id=eq.${currentConsultation.id}`
        }, payload => {
            if (payload.new.id) {
                const existingEl = document.getElementById(`msg-${payload.new.id}`);
                if (existingEl && payload.new.sender_id === currentUser.id) {
                    const ticksEl = existingEl.querySelector('.msg-status-ticks');
                    if (ticksEl) {
                        if (payload.new.status === 'read') {
                            ticksEl.className = 'msg-status-ticks msg-status-read';
                            ticksEl.innerText = '✓✓';
                        } else if (payload.new.status === 'delivered') {
                            ticksEl.className = 'msg-status-ticks';
                            ticksEl.innerText = '✓✓';
                        }
                    }
                }
            }
        })
        .subscribe();

    // 2. Broadcast for presence & typing
    broadcastChannel = supabase.channel(`presence_${currentConsultation.id}`);
    
    broadcastChannel
        .on('broadcast', { event: 'typing' }, payload => {
            const typingInd = document.getElementById('typing-ind');
            if (payload.payload.userId !== currentUser.id && payload.payload.isTyping) {
                if (typingInd) typingInd.style.display = 'block';
            } else {
                if (typingInd) typingInd.style.display = 'none';
            }
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', init);

let selectedRating = 5;

window.setRating = (num) => {
    selectedRating = num;
};

window.submitPatientRating = async () => {
    const comment = document.getElementById('rating-comment').value.trim();
    if (!currentConsultation || !currentConsultation.specialist_id) return;

    await supabase.from('reviews').insert([{
        consultation_id: currentConsultation.id,
        specialist_id: currentConsultation.specialist_id,
        user_id: currentUser.id,
        rating: selectedRating,
        comment: comment
    }]);

    document.getElementById('rating-modal').style.display = 'none';
    window.location.href = 'dashboard.html';
};


// WebRTC Global Video Call Handlers
window.startVideoCall = async () => {
    document.getElementById('video-container').style.display = 'block';
    if (!rtcManager) {
        rtcManager = new WebRTCManager(supabase, currentConsultation.id, currentUser.id, {
            onRemoteStream: (stream) => {
                document.getElementById('remote-video').srcObject = stream;
            },
            onStatusChange: (msg) => {
                const el = document.getElementById('v-status');
                if (el) el.innerText = msg;
                showToast(msg, 'info', 2000);
            },
            onError: (err) => {
                showToast("تعذر الوصول للكاميرا/الميكروفون", 'error');
            }
        });
        await rtcManager.init(document.getElementById('local-video'));
    }
    await rtcManager.createCall();
};

window.toggleAudio = window.toggleMic = () => {
    if (rtcManager) {
        const active = rtcManager.toggleMic();
        const btn = document.getElementById('btn-audio') || document.getElementById('btn-toggle-mic');
        if (btn) btn.innerText = active ? '🎙️' : '🔇';
    }
};

window.toggleVideo = window.toggleCam = () => {
    if (rtcManager) {
        const active = rtcManager.toggleCamera();
        const btn = document.getElementById('btn-video') || document.getElementById('btn-toggle-cam');
        if (btn) btn.innerText = active ? '📷' : '🚫';
    }
};

window.shareScreen = window.toggleScreen = async () => {
    if (rtcManager) {
        const active = await rtcManager.toggleScreenShare(document.getElementById('remote-video'));
        const btn = document.getElementById('btn-screen') || document.getElementById('btn-screen-share');
        if (btn) btn.style.background = active ? 'var(--brand-accent)' : '#334155';
    }
};

window.endVideoCall = () => {
    if (rtcManager) {
        rtcManager.endCall();
        rtcManager = null;
    }
    document.getElementById('video-container').style.display = 'none';
};

