// admin_events.js - Admin Events Management Logic
import { supabase } from './supabase.js';

let events = [];

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        alert("هذه الصفحة مخصصة للإدارة فقط.");
        window.location.href = '../index.html';
        return;
    }

    await loadEvents();
}

async function loadEvents() {
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    
    const tbody = document.getElementById('events-tbody');
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">لا توجد فعاليات مضافة بعد.</td></tr>';
        return;
    }

    events = data;
    tbody.innerHTML = data.map(ev => `
        <tr style="border-bottom:1px solid var(--border-color);">
            <td style="padding:12px;"><strong>${ev.title}</strong></td>
            <td style="padding:12px;">${ev.category}</td>
            <td style="padding:12px;">${new Date(ev.event_date).toLocaleDateString('ar-EG')}</td>
            <td style="padding:12px;">${ev.location}</td>
            <td style="padding:12px;">${ev.remaining_seats} / ${ev.total_seats}</td>
            <td style="padding:12px;">
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteEvent('${ev.id}')">🗑️ حذف</button>
            </td>
        </tr>
    `).join('');
}

window.openCreateModal = () => {
    document.getElementById('modal-title').innerText = 'إضافة فعالية جديدة';
    document.getElementById('ev-id').value = '';
    document.getElementById('event-form').reset();
    document.getElementById('event-modal').style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('event-modal').style.display = 'none';
};

window.saveEvent = async (e) => {
    e.preventDefault();
    const title = document.getElementById('ev-title').value.trim();
    const category = document.getElementById('ev-category').value;
    const dateVal = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-location').value.trim();
    const totalSeats = parseInt(document.getElementById('ev-total-seats').value, 10);
    const desc = document.getElementById('ev-desc').value.trim();

    if (!title || !dateVal || !location) return;

    const payload = {
        title,
        category,
        event_date: new Date(dateVal).toISOString(),
        location,
        total_seats: totalSeats,
        remaining_seats: totalSeats,
        description: desc
    };

    const { error } = await supabase.from('events').insert([payload]);
    if (error) {
        alert("حدث خطأ أثناء الحفظ: " + error.message);
    } else {
        closeModal();
        await loadEvents();
    }
};

window.deleteEvent = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفعالية؟")) return;
    await supabase.from('events').delete().eq('id', id);
    await loadEvents();
};

document.addEventListener('DOMContentLoaded', init);
