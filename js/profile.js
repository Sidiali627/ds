// profile.js
import { requireAuth, signOut } from './auth.js';
import { supabase } from './supabase.js';

let currentUser = null;

function showMsg(text, isError = false) {
    const el = document.getElementById('status-msg');
    el.innerText = text;
    el.style.display = 'block';
    el.style.backgroundColor = isError ? '#fee2e2' : '#d1fae5';
    el.style.color = isError ? '#991b1b' : '#065f46';
    setTimeout(() => el.style.display = 'none', 3000);
}

async function loadProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if(data) {
        document.getElementById('full_name').value = data.full_name || '';
        document.getElementById('phone').value = data.phone || '';
    }
}

async function loadHealth() {
    const { data, error } = await supabase.from('health_profiles').select('*').eq('user_id', currentUser.id).single();
    if(data) {
        document.getElementById('height').value = data.height || '';
        document.getElementById('weight').value = data.weight || '';
        document.getElementById('blood_type').value = data.blood_type || '';
        document.getElementById('allergies').value = data.allergies || '';
        document.getElementById('chronic_diseases').value = data.chronic_diseases || '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;
    currentUser = session.user;
    
    document.getElementById('logout-btn')?.addEventListener('click', signOut);
    
    await loadProfile();
    await loadHealth();
    
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const full_name = document.getElementById('full_name').value;
        const phone = document.getElementById('phone').value;
        const { error } = await supabase.from('profiles').update({ full_name, phone }).eq('id', currentUser.id);
        if(error) showMsg(error.message, true); else showMsg('تم الحفظ بنجاح');
    });

    document.getElementById('health-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            user_id: currentUser.id,
            height: document.getElementById('height').value || null,
            weight: document.getElementById('weight').value || null,
            blood_type: document.getElementById('blood_type').value,
            allergies: document.getElementById('allergies').value,
            chronic_diseases: document.getElementById('chronic_diseases').value
        };
        const { error } = await supabase.from('health_profiles').upsert(payload, { onConflict: 'user_id' });
        if(error) showMsg(error.message, true); else showMsg('تم حفظ الملف الصحي');
    });
});
