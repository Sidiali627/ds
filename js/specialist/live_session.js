import { supabase } from '../supabase.js';
import { WebRTCManager } from '../webrtc.js';
import { showToast } from '../toast.js';
import { createNotification } from '../notifications.js';

let currentUser = null;
let currentConsultation = null;
let broadcastChannel = null;
let typingTimeout = null;
let rtcManager = null;
const loadedMessageIds = new Set();

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }
    currentUser = session.user;

    const urlParams = new URLSearchParams(window.location.search);
    const cId = urlParams.get('id');
    if (!cId) { showToast('رقم الجلسة مفقود', 'error'); setTimeout(() => window.location.href = 'consultations.html', 1500); return; }

    await loadSession(cId);
    setupRealtime();
    startTimer();
    
    const input = document.getElementById('chat-input');
    input?.addEventListener('input', handleTyping);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.sendMessage();
        }
    });
}

async function loadSession(id) {
    const { data: consultation, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !consultation) { 
        console.error("Error loading session:", error);
        showToast("حدث خطأ أو الجلسة غير موجودة", "error"); 
        setTimeout(() => window.location.href = 'consultations.html', 1500); 
        return; 
    }
    
    // Auto-set started_at if not set
    if (!consultation.started_at) {
        const now = new Date().toISOString();
        await supabase.from('consultations').update({ started_at: now }).eq('id', id);
        consultation.started_at = now;
    }
    
    currentConsultation = consultation;

    if (consultation.user_id) {
        const { data: patientProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', consultation.user_id)
            .single();

        if (patientProfile) {
            document.getElementById('pat-name').innerText = patientProfile.full_name || 'مريض جديد';
        }
    }
    document.getElementById('sess-id').innerText = consultation.id.substring(0,8).toUpperCase();

    // Check Case File exists
    const { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', consultation.user_id).single();
    if(!caseFile) {
        await supabase.from('case_files').insert([{ user_id: consultation.user_id }]);
    }
    
    await loadMessages();
    loadNotes();
    loadSessionDocs();
}

async function loadMessages() {
    const { data, error } = await supabase.from('chat_messages')
        .select('*')
        .eq('consultation_id', currentConsultation.id)
        .order('created_at', { ascending: true });
        
    if (error) {
        console.error("Error loading messages:", error);
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
    if(!text) return;

    input.value = '';
    input.style.height = '';

    const payload = {
        consultation_id: currentConsultation.id,
        sender_id: currentUser.id,
        sender_role: 'specialist',
        content: text,
        status: 'sent',
        message_type: 'text'
    };

    const { data, error } = await supabase.from('chat_messages').insert([payload]).select().single();

    if(error) {
        console.error("Error inserting specialist message:", error);
        showToast("فشل إرسال رسالة المختص: " + error.message, 'error');
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

// Timer Logic
let sessionTime = 0;
function startTimer() {
    const timerEl = document.getElementById('timer');
    setInterval(() => {
        sessionTime++;
        const m = String(Math.floor(sessionTime / 60)).padStart(2, '0');
        const s = String(sessionTime % 60).padStart(2, '0');
        if(timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);
}

window.endSession = async () => {
    if(!confirm("هل أنت متأكد من إنهاء هذه الجلسة وإغلاق الملف السريري؟")) return;
    
    const now = new Date().toISOString();
    let duration = 0;
    if (currentConsultation.started_at) {
        duration = Math.floor((new Date(now) - new Date(currentConsultation.started_at)) / 1000 / 60); // in minutes
    }
    
    await supabase.from('consultations').update({ 
        status: 'completed', 
        ended_at: now,
        duration: duration
    }).eq('id', currentConsultation.id);
    
    showToast("تم إنهاء الجلسة وإغلاق الملف بنجاح.", 'success');
    setTimeout(() => window.location.href = 'consultations.html', 1500);
}

// Clinical Notes Logic
async function loadNotes() {
    const { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', currentConsultation.user_id).single();
    if(!caseFile) return;

    const { data, error } = await supabase.from('case_notes')
        .select('*')
        .eq('case_id', caseFile.id)
        .eq('specialist_id', currentUser.id)
        .order('created_at', { ascending: false });

    if(!error && data) {
        const list = document.getElementById('notes-list');
        if(list) {
            list.innerHTML = data.map(n => `
                <div style="background:var(--bg-secondary); padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">${new Date(n.created_at).toLocaleString('ar-EG')}</div>
                    <div style="color:var(--text-primary); font-size:0.9rem;">${n.content}</div>
                </div>
            `).join('');
        }
    }
}

window.saveNote = async () => {
    const content = document.getElementById('private-note').value.trim();
    if(!content) return;

    const { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', currentConsultation.user_id).single();
    if(!caseFile) return;

    const { error } = await supabase.from('case_notes').insert([{
        case_id: caseFile.id,
        specialist_id: currentUser.id,
        consultation_id: currentConsultation.id,
        content: content,
        is_private: true
    }]);

    if(!error) {
        document.getElementById('private-note').value = '';
        loadNotes();
    }
}

// -------------------------------------------------------------
// Live Session Prescriptions & Reports Logic
// -------------------------------------------------------------
window.openPrescriptionModal = () => {
    const modal = document.getElementById('modal-live-prescription');
    if (modal) {
        modal.style.display = 'flex';
        const container = document.getElementById('live-rx-meds-container');
        if (container && container.children.length === 0) {
            window.addLiveMedRow();
        }
    }
};

window.closePrescriptionModal = () => {
    const modal = document.getElementById('modal-live-prescription');
    if (modal) modal.style.display = 'none';
};

window.addLiveMedRow = () => {
    const container = document.getElementById('live-rx-meds-container');
    if (!container) return;
    const rowId = 'live-med-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'live-med-row';
    row.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr auto; gap:6px; align-items:center; background:var(--bg-secondary); padding:8px; border-radius:8px; border:1px solid var(--border-color);';
    row.innerHTML = `
        <input type="text" class="live-med-name" placeholder="اسم الدواء (مثل: Amoxicillin)" required style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="live-med-dosage" placeholder="الجرعة (500mg)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="live-med-freq" placeholder="التكرار (كل 8 ساعات)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="live-med-dur" placeholder="المدة (7 أيام)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <input type="text" class="live-med-inst" placeholder="إرشادات (بعد الأكل)" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.82rem; background:var(--surface-color); color:var(--text-primary); font-family:inherit;">
        <button type="button" onclick="window.removeLiveMedRow('${rowId}')" title="حذف" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:0.85rem;">🗑️</button>
    `;
    container.appendChild(row);
};

window.removeLiveMedRow = (rowId) => {
    const el = document.getElementById(rowId);
    if (el) el.remove();
};

window.handleLivePrescriptionSubmit = async (e) => {
    e.preventDefault();
    if (!currentConsultation || !currentUser) return;

    const diagnosis = document.getElementById('live-rx-diagnosis')?.value.trim() || null;
    const instructions = document.getElementById('live-rx-instructions')?.value.trim();
    if (!instructions) {
        showToast('يرجى كتابة تعليمات الوصفة الطبية.', 'error');
        return;
    }

    const rows = document.querySelectorAll('#live-rx-meds-container .live-med-row');
    const medications = [];
    rows.forEach(r => {
        const name = r.querySelector('.live-med-name')?.value.trim();
        const dosage = r.querySelector('.live-med-dosage')?.value.trim();
        const frequency = r.querySelector('.live-med-freq')?.value.trim();
        const duration = r.querySelector('.live-med-dur')?.value.trim();
        const inst = r.querySelector('.live-med-inst')?.value.trim();
        if (name) {
            medications.push({ name, dosage, frequency, duration, instructions: inst });
        }
    });

    const submitBtn = document.getElementById('btn-submit-live-rx');
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري الاعتماد... ⏳';

    try {
        let { data: caseFile } = await supabase.from('case_files').select('id').eq('user_id', currentConsultation.user_id).maybeSingle();
        if (!caseFile) {
            const { data: newCase } = await supabase.from('case_files').insert({ user_id: currentConsultation.user_id }).select().maybeSingle();
            caseFile = newCase;
        }

        const { data: note, error: noteErr } = await supabase.from('case_notes').insert({
            case_id: caseFile.id,
            specialist_id: currentUser.id,
            consultation_id: currentConsultation.id,
            note_type: 'prescription',
            content: instructions,
            diagnosis: diagnosis,
            medications: medications,
            status: 'active',
            instructions: instructions,
            is_private: false
        }).select().single();

        if (noteErr) throw noteErr;

        // Also update consultation structured prescription and text
        await supabase.from('consultations').update({
            prescription: instructions,
            structured_prescription: medications,
            updated_at: new Date().toISOString()
        }).eq('id', currentConsultation.id);

        currentConsultation.prescription = instructions;
        currentConsultation.structured_prescription = medications;

        // Send patient notification
        const docName = currentUser.user_metadata?.full_name || 'الطبيب المعالج';
        await createNotification(
            currentConsultation.user_id,
            'وصفة طبية علاجية جديدة 💊',
            `أصدر د. ${docName} وصفة علاجية جديدة لجلسة الاستشارة الحالية. يمكنك مراجعتها وطباعتها الآن في سجلك الطبي.`,
            'medical_record',
            'emr.html'
        );

        showToast('تم اعتماد وإصدار الوصفة الطبية بنجاح! ✅', 'success');
        window.closePrescriptionModal();
        await loadSessionDocs();

        // Offer to print immediately
        if (note?.id) {
            window.openPrintDocument('prescription', note.id);
        }
    } catch (err) {
        console.error("Error creating prescription:", err);
        showToast('تعذر إصدار الوصفة: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'حفظ واعتماد الوصفة 💾';
    }
};

window.openReportModal = () => {
    const modal = document.getElementById('modal-live-report');
    if (modal) {
        if (currentConsultation.report) {
            const txt = document.getElementById('live-report-text');
            if (txt) txt.value = currentConsultation.report;
        }
        modal.style.display = 'flex';
    }
};

window.closeReportModal = () => {
    const modal = document.getElementById('modal-live-report');
    if (modal) modal.style.display = 'none';
};

window.handleLiveReportSubmit = async (e) => {
    e.preventDefault();
    if (!currentConsultation || !currentUser) return;

    const reportText = document.getElementById('live-report-text')?.value.trim();
    if (!reportText) {
        showToast('يرجى كتابة التقرير الطبي.', 'error');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-live-report');
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري الاعتماد... ⏳';

    try {
        const { error } = await supabase.from('consultations').update({
            report: reportText,
            updated_at: new Date().toISOString()
        }).eq('id', currentConsultation.id);

        if (error) throw error;

        currentConsultation.report = reportText;

        const docName = currentUser.user_metadata?.full_name || 'الطبيب المعالج';
        await createNotification(
            currentConsultation.user_id,
            'تقرير استشارة طبية رسمي 📄',
            `اعتمد د. ${docName} التقرير الطبي الرسمي الخاص بجلستكم. يمكنك الاطلاع عليه وطباعته في سجلك الطبي.`,
            'medical_record',
            'emr.html'
        );

        showToast('تم اعتماد التقرير الطبي بنجاح! ✅', 'success');
        window.closeReportModal();
        await loadSessionDocs();

        // Offer print
        window.openPrintDocument('report', currentConsultation.id);
    } catch (err) {
        console.error("Error creating report:", err);
        showToast('تعذر حفظ التقرير: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'اعتماد وحفظ التقرير 💾';
    }
};

async function loadSessionDocs() {
    const container = document.getElementById('live-session-docs-list');
    if (!container || !currentConsultation) return;

    try {
        // Fetch prescriptions from case_notes for this consultation
        const { data: notes } = await supabase.from('case_notes')
            .select('*')
            .eq('consultation_id', currentConsultation.id)
            .eq('note_type', 'prescription')
            .order('created_at', { ascending: false });

        let html = '';

        if (notes && notes.length > 0) {
            html += notes.map(n => `
                <div style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:10px; padding:10px; font-size:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:#059669;">💊 وصفة طبية صادرة</strong>
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.openPrintDocument('prescription', '${n.id}')" style="padding:2px 8px; font-size:0.75rem; border-radius:6px;">
                            🖨️ طباعة الوصفة
                        </button>
                    </div>
                    <div style="color:var(--text-secondary); font-size:0.8rem; margin-bottom:4px;">🕒 ${new Date(n.created_at).toLocaleDateString('ar-EG')}</div>
                    ${n.diagnosis ? `<div style="color:#0284c7; font-size:0.8rem; margin-bottom:2px;">🔬 التشخيص: ${n.diagnosis}</div>` : ''}
                    <div style="color:var(--text-primary); font-size:0.85rem; white-space:pre-wrap;">${n.content}</div>
                </div>
            `).join('');
        }

        if (currentConsultation.report && currentConsultation.report.trim()) {
            html += `
                <div style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:10px; padding:10px; font-size:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:var(--specialist-primary);">📄 تقرير الاستشارة المعتمد</strong>
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.openPrintDocument('report', '${currentConsultation.id}')" style="padding:2px 8px; font-size:0.75rem; border-radius:6px;">
                            🖨️ طباعة التقرير
                        </button>
                    </div>
                    <div style="color:var(--text-primary); font-size:0.85rem; white-space:pre-wrap; margin-top:4px;">${currentConsultation.report}</div>
                </div>
            `;
        }

        container.innerHTML = html || `
            <div style="text-align:center; padding:1rem; color:var(--text-secondary); font-size:0.85rem;">
                لم يتم إصدار وصفات أو تقارير لهذه الجلسة بعد.
            </div>
        `;
    } catch (e) {
        console.error("Error loading session docs:", e);
    }
}

window.openPrintDocument = (type, id) => {
    if (!id) return;
    window.open(`../print_document.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, '_blank');
};

document.addEventListener('DOMContentLoaded', init);

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

window.toggleMic = () => {
    if (rtcManager) {
        const active = rtcManager.toggleMic();
        document.getElementById('btn-toggle-mic').innerText = active ? '🎙️' : '🔇';
    }
};

window.toggleCam = () => {
    if (rtcManager) {
        const active = rtcManager.toggleCamera();
        document.getElementById('btn-toggle-cam').innerText = active ? '📷' : '🚫';
    }
};

window.toggleScreen = async () => {
    if (rtcManager) {
        const active = await rtcManager.toggleScreenShare(document.getElementById('remote-video'));
        document.getElementById('btn-screen-share').style.background = active ? 'var(--brand-accent)' : '#334155';
    }
};

window.endVideoCall = () => {
    if (rtcManager) {
        rtcManager.endCall();
        rtcManager = null;
    }
    document.getElementById('video-container').style.display = 'none';
};

