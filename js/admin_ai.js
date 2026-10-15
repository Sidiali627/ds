// admin_ai.js
import { supabase } from './supabase.js';
import { askAI } from './ai_engine.js';

let currentUser = null;
let currentConversationId = null;
let aiSettings = {};
let prompts = [];
let currentMessages = [];

async function init() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    currentUser = session.user;

    await loadSettings();
    await loadPrompts();
    await loadHistory();
    
    // Setup Markdown Options
    if (window.marked) {
        marked.setOptions({ breaks: true, gfm: true });
    }
}

async function loadSettings() {
    const { data, error } = await supabase.from('ai_settings').select('*').limit(1).single();
    if (data) {
        aiSettings = data;
        document.getElementById('set-provider').value = data.provider;
        document.getElementById('set-apikey').value = data.api_key || '';
        document.getElementById('set-model').value = data.model;
        document.getElementById('set-temp').value = data.temperature;
        document.getElementById('set-prompt-admin').value = data.system_prompt_admin;
    }
}

window.saveSettings = async () => {
    const payload = {
        provider: document.getElementById('set-provider').value,
        api_key: document.getElementById('set-apikey').value,
        model: document.getElementById('set-model').value,
        temperature: parseFloat(document.getElementById('set-temp').value),
        system_prompt_admin: document.getElementById('set-prompt-admin').value,
    };
    
    let q;
    if (aiSettings.id) {
        q = supabase.from('ai_settings').update(payload).eq('id', aiSettings.id);
    } else {
        q = supabase.from('ai_settings').insert([payload]);
    }

    const { error } = await q;
    if (error) { alert("فشل الحفظ: تأكد أنك Super Admin"); console.error(error); }
    else { alert("تم حفظ إعدادات الذكاء الاصطناعي بنجاح."); aiSettings = {...aiSettings, ...payload}; }
}

async function loadPrompts() {
    const { data, error } = await supabase.from('ai_prompts').select('*');
    if (data) {
        prompts = data;
        const grid = document.getElementById('prompts-grid');
        grid.innerHTML = prompts.map(p => `
            <div class="prompt-card" onclick="usePrompt('${p.id}')">
                <div class="prompt-title">${p.title}</div>
                <div class="prompt-desc">${p.content.substring(0,60)}...</div>
            </div>
        `).join('');
    }
}

window.usePrompt = (id) => {
    const p = prompts.find(x => x.id === id);
    if(p) {
        document.getElementById('chat-input').value = p.content;
        document.querySelector('.ai-tab[data-target="view-chat"]').click();
        document.getElementById('chat-input').focus();
    }
}

async function loadHistory() {
    const { data, error } = await supabase.from('ai_conversations').select('*').eq('user_id', currentUser.id).eq('type', 'admin').order('updated_at', { ascending: false });
    
    const list = document.getElementById('chat-history-list');
    if (error || !data || data.length === 0) {
        list.innerHTML = '<div style="color:var(--admin-text-muted); text-align:center; padding:1rem;">لا توجد محادثات سابقة.</div>';
        return;
    }

    list.innerHTML = data.map(c => `
        <div class="chat-item" id="conv-${c.id}" onclick="loadConversation('${c.id}')">
            ${c.title}
        </div>
    `).join('');
}

window.startNewChat = () => {
    currentConversationId = null;
    currentMessages = [];
    document.getElementById('messages-container').innerHTML = `
        <div style="text-align:center; margin-top:4rem; color:var(--admin-text-muted);">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2; margin-bottom:1rem;"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12"></path><path d="M12 12l8.5 4.9"></path><path d="M12 12l8.5-4.9"></path></svg>
            <h2>محادثة جديدة</h2>
            <p>أنا مستعد لمساعدتك في إدارة المنصة.</p>
        </div>
    `;
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    document.querySelector('.ai-tab[data-target="view-chat"]').click();
}

window.loadConversation = async (id) => {
    currentConversationId = id;
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`conv-${id}`).classList.add('active');
    document.querySelector('.ai-tab[data-target="view-chat"]').click();

    const container = document.getElementById('messages-container');
    container.innerHTML = '<div style="text-align:center; color:var(--admin-text-muted);">جاري التحميل...</div>';

    const { data, error } = await supabase.from('ai_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    
    if (error) { container.innerHTML = 'حدث خطأ.'; return; }
    
    currentMessages = data.map(m => ({ role: m.role, content: m.content }));
    
    container.innerHTML = '';
    currentMessages.forEach(m => appendMessageToUI(m.role, m.content));
    scrollToBottom();
}

window.handleEnter = (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;
    
    input.value = '';
    input.style.height = 'auto'; // reset resize

    const btn = document.getElementById('btn-send');
    btn.disabled = true;

    // Append User Message to UI
    appendMessageToUI('user', text);
    currentMessages.push({ role: 'user', content: text });
    
    // Clear welcome message if it's new chat
    if(!currentConversationId) document.getElementById('messages-container').innerHTML = '';
    
    // Create conversation in DB if new
    if(!currentConversationId) {
        const title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        const { data, error } = await supabase.from('ai_conversations').insert([{ user_id: currentUser.id, title, type: 'admin' }]).select();
        if(!error && data) {
            currentConversationId = data[0].id;
            loadHistory(); // refresh sidebar
        }
    }

    // Save User Msg to DB
    if(currentConversationId) {
        supabase.from('ai_messages').insert([{ conversation_id: currentConversationId, role: 'user', content: text }]).then();
    }

    // Show Loading
    const loadingId = 'loading-' + Date.now();
    appendMessageToUI('assistant', '<span class="typing">...</span>', loadingId);
    scrollToBottom();

    try {
        const settingsForEngine = { ...aiSettings, system_prompt: aiSettings.system_prompt_admin };
        const aiResponse = await askAI(currentMessages, settingsForEngine);
        
        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if(loadingEl) loadingEl.remove();

        // Append AI Response
        appendMessageToUI('assistant', aiResponse);
        currentMessages.push({ role: 'assistant', content: aiResponse });

        // Save AI Msg to DB
        if(currentConversationId) {
            supabase.from('ai_messages').insert([{ conversation_id: currentConversationId, role: 'assistant', content: aiResponse }]).then();
            supabase.from('ai_conversations').update({ updated_at: new Date() }).eq('id', currentConversationId).then();
        }
    } catch(e) {
        const loadingEl = document.getElementById(loadingId);
        if(loadingEl) loadingEl.remove();
        appendMessageToUI('assistant', `<span style="color:var(--danger-color);">حدث خطأ: ${e.message}</span>`);
    }

    btn.disabled = false;
    scrollToBottom();
}

function appendMessageToUI(role, content, forceId = null) {
    const container = document.getElementById('messages-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role === 'user' ? 'msg-user' : 'msg-ai'}`;
    if (forceId) msgDiv.id = forceId;

    let parsedContent = content;
    if (role === 'assistant' && !content.includes('<span class="typing">') && !content.includes('حدث خطأ')) {
        parsedContent = window.marked ? marked.parse(content) : content;
    }

    msgDiv.innerHTML = `
        <div class="msg-avatar">${role === 'user' ? 'U' : 'AI'}</div>
        <div class="msg-bubble">${parsedContent}</div>
    `;
    container.appendChild(msgDiv);
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// Tabs Logic
document.querySelectorAll('.ai-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ai-view').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.add('active');
    });
});

document.addEventListener('DOMContentLoaded', init);
