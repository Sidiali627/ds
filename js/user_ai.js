// user_ai.js
import { supabase } from './supabase.js';
import { askAI } from './ai_engine.js';

let currentUser = null;
let currentConversationId = null;
let aiSettings = {};
let currentMessages = [];

async function init() {
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) currentUser = session.user;
    }

    await loadSettings();
    
    if (window.marked) {
        marked.setOptions({ breaks: true, gfm: true });
    }
}

async function loadSettings() {
    const { data, error } = await supabase.from('ai_settings').select('*').limit(1).single();
    if (data) {
        aiSettings = data;
    }
}

window.sendChip = (text) => {
    document.getElementById('chat-input').value = text;
    sendMessage();
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

    const btn = document.getElementById('btn-send');
    btn.disabled = true;

    // Hide welcome
    document.getElementById('welcome-msg').style.display = 'none';
    document.getElementById('welcome-chips').style.display = 'none';

    // Append User Message to UI
    appendMessageToUI('user', text);
    currentMessages.push({ role: 'user', content: text });
    
    // Create conversation in DB if new AND user is logged in
    if(!currentConversationId && currentUser) {
        const title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        const { data, error } = await supabase.from('ai_conversations').insert([{ user_id: currentUser.id, title, type: 'user' }]).select();
        if(!error && data) {
            currentConversationId = data[0].id;
        }
    }

    // Save User Msg to DB
    if(currentConversationId && currentUser) {
        supabase.from('ai_messages').insert([{ conversation_id: currentConversationId, role: 'user', content: text }]).then();
    }

    // Show Loading
    const loadingId = 'loading-' + Date.now();
    appendMessageToUI('assistant', 'جاري التفكير...', loadingId);
    scrollToBottom();

    try {
        const settingsForEngine = { ...aiSettings, system_prompt: aiSettings.system_prompt_user };
        const aiResponse = await askAI(currentMessages, settingsForEngine);
        
        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if(loadingEl) loadingEl.remove();

        // Append AI Response
        appendMessageToUI('assistant', aiResponse);
        currentMessages.push({ role: 'assistant', content: aiResponse });

        // Save AI Msg to DB
        if(currentConversationId && currentUser) {
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
    msgDiv.className = `msg ${role === 'user' ? 'msg-user' : 'msg-ai'}`;
    if (forceId) msgDiv.id = forceId;

    let parsedContent = content;
    if (role === 'assistant' && content !== 'جاري التفكير...' && !content.includes('حدث خطأ')) {
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

document.addEventListener('DOMContentLoaded', init);
