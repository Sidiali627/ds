// event_details.js - Event Details, Registration & Dynamic QR Code Ticket Engine
import { supabase } from './supabase.js';

let currentEvent = null;
let currentUser = null;

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) { alert('رقم الفعالية غير متاح'); window.location.href = 'events.html'; return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;

    await loadEvent(eventId);
}

async function loadEvent(id) {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        alert("تعذر تحميل الفعالية المطلوبة.");
        window.location.href = 'events.html';
        return;
    }

    currentEvent = data;

    document.getElementById('ev-title').innerText = data.title;
    document.getElementById('ev-desc').innerText = data.description || 'لا يوجد وصف متاح للفعالية.';
    document.getElementById('ev-cat').innerText = data.category === 'psychology' ? 'صحة نفسية' : (data.category === 'nutrition' ? 'تغذية ولياقة' : (data.category === 'youth' ? 'فعاليات الشباب' : 'طب وقائي'));
    document.getElementById('ev-date').innerText = new Date(data.event_date).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });
    document.getElementById('ev-loc').innerText = data.location || 'المملكة العربية السعودية';
    document.getElementById('ev-seats').innerText = `${data.remaining_seats !== undefined ? data.remaining_seats : data.total_seats} مقعد متبقي`;
    
    if (data.image_url) document.getElementById('ev-img').src = data.image_url;

    // Auto-fill registration modal if logged in
    if (currentUser) {
        const { data: prof } = await supabase.from('profiles').select('full_name, email').eq('id', currentUser.id).single();
        if (prof) {
            document.getElementById('reg-name').value = prof.full_name || '';
            document.getElementById('reg-email').value = prof.email || '';
        }
    }
}

window.openRegModal = () => {
    if (currentEvent.remaining_seats <= 0) {
        alert("عذراً، اكتملت جميع المقاعد المتاحة لهذه الفعالية.");
        return;
    }
    document.getElementById('reg-modal').style.display = 'flex';
};

window.closeRegModal = () => {
    document.getElementById('reg-modal').style.display = 'none';
};

window.closeQrModal = () => {
    document.getElementById('qr-modal').style.display = 'none';
    window.location.href = 'events.html';
};

window.submitRegistration = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();

    if (!name || !email || !phone) return;

    const ticketCode = `TICKET-${Math.floor(100000 + Math.random() * 900000)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketCode + '|' + name + '|' + currentEvent.id)}`;

    // Save registration to Supabase
    const { error } = await supabase.from('event_registrations').insert([{
        event_id: currentEvent.id,
        user_id: currentUser ? currentUser.id : null,
        full_name: name,
        email: email,
        phone: phone,
        ticket_qr: ticketCode,
        status: 'confirmed'
    }]);

    if (error) {
        alert("حدث خطأ أثناء التسجيل: " + error.message);
        return;
    }

    // Decrement remaining seats in DB
    const newSeats = Math.max(0, currentEvent.remaining_seats - 1);
    await supabase.from('events').update({ remaining_seats: newSeats }).eq('id', currentEvent.id);

    closeRegModal();

    // Show Ticket QR Modal
    document.getElementById('ticket-qr').src = qrUrl;
    document.getElementById('ticket-code').innerText = `#${ticketCode}`;
    document.getElementById('qr-modal').style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', init);
