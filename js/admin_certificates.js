// admin_certificates.js
import { supabase } from './supabase.js';

let certificates = [];
let templates = [];

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; }
    return session.user;
}

async function loadData() {
    try {
        // Load Templates
        const { data: tData, error: tErr } = await supabase.from('certificate_templates').select('*');
        if (!tErr) templates = tData || [];
        
        // Load Certificates
        const { data: cData, error: cErr } = await supabase.from('certificates').select('*, certificate_templates(name)').order('created_at', { ascending: false });
        if (!cErr) certificates = cData || [];

        renderTemplates();
        renderCertificates();
    } catch (e) {
        console.error(e);
    }
}

function renderTemplates() {
    const list = document.getElementById('templates-list');
    const select = document.getElementById('c_template');
    
    if (templates.length === 0) {
        list.innerHTML = '<div style="color:var(--admin-text-muted);">لا توجد قوالب. يرجى إنشاء قالب.</div>';
        select.innerHTML = '<option value="">لا توجد قوالب</option>';
        return;
    }

    list.innerHTML = templates.map(t => `
        <div style="border:1px solid var(--admin-border); padding:1rem; border-radius:8px;">
            <h4>${t.name}</h4>
            <div style="height:100px; background:url(${t.background_url}) center/cover; margin-top:8px; border-radius:4px;"></div>
        </div>
    `).join('');

    select.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

function renderCertificates() {
    const tbody = document.getElementById('cert-tbody');
    if (certificates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد شهادات مصدرة بعد.</td></tr>';
        return;
    }

    tbody.innerHTML = certificates.map(c => {
        const badge = c.status === 'valid' ? 'badge-valid' : 'badge-cancelled';
        const statusText = c.status === 'valid' ? 'صالحة' : 'ملغاة';
        
        return `
            <tr>
                <td style="font-family:monospace; font-size:0.8rem; color:var(--admin-text-muted);">${c.id.split('-')[0]}...</td>
                <td><strong>${c.recipient_name}</strong></td>
                <td>${c.activity_name}</td>
                <td>${c.issue_date}</td>
                <td><span class="badge ${badge}">${statusText}</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="downloadPDF('${c.id}')">PDF</button>
                    ${c.status === 'valid' ? `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; color:var(--danger-color); border-color:var(--danger-color);" onclick="cancelCert('${c.id}')">إلغاء</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

window.openIssueModal = () => {
    if(templates.length === 0) return alert("يرجى إنشاء قالب أولاً.");
    document.getElementById('issue-modal').style.display = 'flex';
    document.getElementById('c_date').valueAsDate = new Date();
}

window.submitCertificate = async () => {
    const user = await checkAuth();
    const name = document.getElementById('c_name').value.trim();
    const activity = document.getElementById('c_activity').value.trim();
    const date = document.getElementById('c_date').value;
    const templateId = document.getElementById('c_template').value;

    if(!name || !activity || !templateId) return alert("يرجى تعبئة جميع الحقول.");

    const { data, error } = await supabase.from('certificates').insert([{
        recipient_name: name,
        activity_name: activity,
        issue_date: date,
        template_id: templateId,
        created_by: user.id
    }]).select('*, certificate_templates(name)');

    if(error) {
        alert("حدث خطأ أثناء الإصدار.");
        console.error(error);
    } else {
        certificates.unshift(data[0]);
        document.getElementById('issue-modal').style.display = 'none';
        renderCertificates();
    }
}

window.cancelCert = async (id) => {
    if(confirm('هل أنت متأكد من إلغاء هذه الشهادة؟ (ستظهر كملغاة عند التحقق)')) {
        const { error } = await supabase.from('certificates').update({ status: 'cancelled' }).eq('id', id);
        if(!error) {
            const c = certificates.find(x => x.id === id);
            if(c) c.status = 'cancelled';
            renderCertificates();
        }
    }
}

window.createDefaultTemplate = async () => {
    const { data, error } = await supabase.from('certificate_templates').insert([{
        name: 'قالب الشكر والتقدير الأساسي',
        background_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=842&h=595' // Professional gradient background as default
    }]).select();
    
    if(!error) {
        templates.push(data[0]);
        renderTemplates();
    }
}

window.downloadPDF = (id) => {
    const cert = certificates.find(x => x.id === id);
    const template = templates.find(x => x.id === cert.template_id);
    if(!cert || !template) return alert("البيانات غير مكتملة.");

    const container = document.getElementById('pdf-container');
    
    // Setup the DOM elements
    container.style.backgroundImage = `url(${template.background_url})`;
    document.getElementById('pdf-name').innerText = cert.recipient_name;
    document.getElementById('pdf-activity').innerText = `لاجتيازه بنجاح: ${cert.activity_name}`;
    document.getElementById('pdf-date').innerText = `التاريخ: ${cert.issue_date}`;
    
    // Generate QR Code containing the verification URL
    const verifyUrl = `${window.location.origin}/verify.html?id=${cert.id}`;
    const qrContainer = document.getElementById('pdf-qr');
    qrContainer.innerHTML = ''; // clear previous
    new QRCode(qrContainer, {
        text: verifyUrl,
        width: 100,
        height: 100,
        colorDark: "#000000",
        colorLight: "#ffffff",
    });

    // Make it briefly visible (off-screen) so html2pdf can capture it properly
    container.parentElement.style.display = 'block';

    const opt = {
        margin:       0,
        filename:     `Certificate_${cert.recipient_name}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'px', format: [842, 595], orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        container.parentElement.style.display = 'none'; // hide it again
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadData();
});
