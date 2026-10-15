// admin_seo.js
import { supabase } from './supabase.js';

let seoPages = [];

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
}

async function loadPages() {
    const { data, error } = await supabase.from('seo_pages').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('pages-tbody');
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد صفحات مهيأة. أضف صفحة جديدة.</td></tr>';
        return;
    }

    seoPages = data;
    tbody.innerHTML = data.map(p => `
        <tr>
            <td dir="ltr" style="text-align:right;">${p.path}</td>
            <td><strong>${p.title || 'بدون عنوان'}</strong></td>
            <td>${(p.keywords || '').split(',').slice(0,3).join('، ')}...</td>
            <td>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="openEditModal('${p.id}')">تعديل SEO</button>
            </td>
        </tr>
    `).join('');
}

window.openEditModal = (id) => {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'flex';
    
    if (id) {
        document.getElementById('modal-title').innerText = 'تعديل الـ SEO';
        const p = seoPages.find(x => x.id === id);
        document.getElementById('seo_id').value = p.id;
        document.getElementById('seo_path').value = p.path;
        document.getElementById('seo_title').value = p.title || '';
        document.getElementById('seo_desc').value = p.description || '';
        document.getElementById('seo_keywords').value = p.keywords || '';
        document.getElementById('seo_og').value = p.og_image || '';
        document.getElementById('seo_canonical').value = p.canonical_url || '';
    } else {
        document.getElementById('modal-title').innerText = 'تهيئة صفحة جديدة';
        document.getElementById('seo_id').value = '';
        document.getElementById('seo_path').value = '/';
        document.getElementById('seo_title').value = '';
        document.getElementById('seo_desc').value = '';
        document.getElementById('seo_keywords').value = '';
        document.getElementById('seo_og').value = '';
        document.getElementById('seo_canonical').value = '';
    }
    window.updatePreview();
}

window.updatePreview = () => {
    const title = document.getElementById('seo_title').value;
    const desc = document.getElementById('seo_desc').value;
    const path = document.getElementById('seo_path').value;
    
    // Update Google Preview
    document.getElementById('pv-url').innerHTML = `https://yhs.com${path} <span>›</span> ...`;
    document.getElementById('pv-title').innerText = title || 'عنوان الصفحة سيظهر هنا';
    document.getElementById('pv-desc').innerText = desc || 'وصف الصفحة سيظهر هنا في محركات البحث. تأكد من أنه جذاب ويشجع على النقر.';

    // Update Counters
    const tCount = document.getElementById('title-count');
    const dCount = document.getElementById('desc-count');
    
    tCount.innerText = `${title.length}/60`;
    if(title.length > 0 && title.length <= 60) tCount.className = 'char-count good';
    else if (title.length > 60) tCount.className = 'char-count danger';
    else tCount.className = 'char-count warning';

    dCount.innerText = `${desc.length}/160`;
    if(desc.length > 50 && desc.length <= 160) dCount.className = 'char-count good';
    else if (desc.length > 160) dCount.className = 'char-count danger';
    else dCount.className = 'char-count warning';

    analyzeSEO(title, desc);
}

function analyzeSEO(title, desc) {
    let score = 100;
    let issues = [];

    if(!title) { score -= 30; issues.push("العنوان مفقود."); }
    else if(title.length < 30) { score -= 10; issues.push("العنوان قصير جداً."); }
    else if(title.length > 60) { score -= 15; issues.push("العنوان طويل (سيُقص في جوجل)."); }

    if(!desc) { score -= 30; issues.push("الوصف مفقود."); }
    else if(desc.length < 50) { score -= 10; issues.push("الوصف قصير جداً."); }
    else if(desc.length > 160) { score -= 15; issues.push("الوصف طويل (سيُقص في جوجل)."); }

    const circle = document.getElementById('seo-score-num');
    const details = document.getElementById('seo-score-details');

    circle.innerText = score;
    if(score >= 80) { circle.className = 'score-circle score-good'; }
    else if(score >= 50) { circle.className = 'score-circle score-warning'; }
    else { circle.className = 'score-circle score-danger'; }

    if(issues.length === 0) {
        details.innerHTML = '<ul style="color:var(--success-color);"><li>ممتاز! البيانات مطابقة للمعايير.</li></ul>';
    } else {
        details.innerHTML = `<ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>`;
    }
}

window.saveSEO = async () => {
    const id = document.getElementById('seo_id').value;
    const payload = {
        path: document.getElementById('seo_path').value.trim(),
        title: document.getElementById('seo_title').value.trim(),
        description: document.getElementById('seo_desc').value.trim(),
        keywords: document.getElementById('seo_keywords').value.trim(),
        og_image: document.getElementById('seo_og').value.trim(),
        canonical_url: document.getElementById('seo_canonical').value.trim()
    };

    if(!payload.path) return alert("المسار مطلوب!");

    let res;
    if (id) {
        res = await supabase.from('seo_pages').update(payload).eq('id', id);
    } else {
        res = await supabase.from('seo_pages').insert([payload]);
    }

    if(res.error) {
        alert("حدث خطأ أثناء الحفظ: " + res.error.message);
    } else {
        document.getElementById('edit-modal').style.display = 'none';
        loadPages();
    }
}

// Sitemap Generator
window.generateSitemap = () => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    seoPages.forEach(p => {
        let loc = p.canonical_url || `https://yhs.com${p.path}`;
        xml += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p.path === '/index.html' || p.path === '/' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;
    document.getElementById('sitemap-output').value = xml;
}

window.generateRobots = () => {
    let txt = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /css/\nDisallow: /js/\n\nSitemap: https://yhs.com/sitemap.xml`;
    document.getElementById('robots-output').value = txt;
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadPages();
});
