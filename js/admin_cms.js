// admin_cms.js
import { supabase } from './supabase.js';

async function checkAuth() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadHeroSettings() {
    const { data } = await supabase.from('site_settings').select('*');
    if (data) {
        const getVal = (key) => { const obj = data.find(s => s.key === key); return obj ? obj.value.replace(/"/g, '') : ''; };
        document.getElementById('hero-title').value = getVal('hero_title');
        document.getElementById('hero-desc').value = getVal('hero_desc');
    }
}

async function loadCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('campaigns-tbody');
    tbody.innerHTML = '';
    if (data) {
        data.forEach(camp => {
            tbody.innerHTML += `<tr>
                <td>${camp.title}</td>
                <td>${camp.progress}%</td>
                <td><button onclick="delCamp('${camp.id}')" style="color:red; background:none; border:none; cursor:pointer;">حذف</button></td>
            </tr>`;
        });
    }
}

async function loadPartners() {
    const { data } = await supabase.from('partners').select('*').order('sort_order');
    const tbody = document.getElementById('partners-tbody');
    tbody.innerHTML = '';
    if (data) {
        data.forEach(part => {
            tbody.innerHTML += `<tr>
                <td>${part.name}</td>
                <td><img src="${part.logo_url}" height="30"></td>
                <td><button onclick="delPart('${part.id}')" style="color:red; background:none; border:none; cursor:pointer;">حذف</button></td>
            </tr>`;
        });
    }
}

window.delCamp = async (id) => {
    if(confirm('متأكد؟')) { await supabase.from('campaigns').delete().eq('id', id); loadCampaigns(); }
}

window.delPart = async (id) => {
    if(confirm('متأكد؟')) { await supabase.from('partners').delete().eq('id', id); loadPartners(); }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadHeroSettings();
    
    // We will attempt to load tables, if they fail (migration not run), we swallow error.
    try { await loadCampaigns(); } catch(e){}
    try { await loadPartners(); } catch(e){}
    
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    // Save Hero
    document.getElementById('hero-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('hero-title')?.value;
        const desc = document.getElementById('hero-desc')?.value;
        await supabase.from('site_settings').upsert({ key: 'hero_title', value: JSON.stringify(title) });
        await supabase.from('site_settings').upsert({ key: 'hero_desc', value: JSON.stringify(desc) });
        const msg = document.getElementById('hero-msg');
        if (msg) {
            msg.style.display = 'inline';
            setTimeout(() => msg.style.display = 'none', 3000);
        }
    });

    // Add Campaign
    document.getElementById('campaign-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('camp-title')?.value;
        const prog = document.getElementById('camp-prog')?.value;
        if (!title) return;
        await supabase.from('campaigns').insert({ title, progress: parseInt(prog) });
        document.getElementById('campaign-form')?.reset();
        loadCampaigns();
    });

    // Add Partner
    document.getElementById('partner-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('part-name')?.value;
        const logo = document.getElementById('part-logo')?.value;
        if (!name) return;
        await supabase.from('partners').insert({ name, logo_url: logo });
        document.getElementById('partner-form')?.reset();
        loadPartners();
    });
});
