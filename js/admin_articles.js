// admin_articles.js
import { supabase } from './supabase.js';

let currentUser = null;
const STATUS_LABELS = {
    draft: 'مسودة',
    pending_review: 'قيد المراجعة',
    approved: 'معتمد',
    published: 'منشور',
    rejected: 'مرفوض',
    changes_requested: 'يتطلب تعديلات',
    archived: 'مؤرشف'
};

async function checkAuth() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
    currentUser = session.user;
}

async function loadArticles() {
    if(!supabase) return;
    const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('articles-tbody');
    
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="4">خطأ في التحميل</td></tr>';
        return;
    }
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">لا يوجد مقالات</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    data.forEach(art => {
        const tr = document.createElement('tr');
        const date = new Date(art.created_at).toLocaleDateString('ar');
        const statusClass = art.status === 'published' || art.status === 'approved'
            ? 'pill success'
            : art.status === 'pending_review'
                ? 'pill warning'
                : 'pill';
        const statusText = STATUS_LABELS[art.status] || art.status || 'غير محدد';
        
        tr.innerHTML = `
            <td>${art.title}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${date}</td>
            <td>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; border: 1px solid var(--danger-color); color: var(--danger-color);" onclick="deleteArticle('${art.id}')">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteArticle = async function(id) {
    if(confirm('هل أنت متأكد من الحذف؟')) {
        await supabase.from('articles').delete().eq('id', id);
        loadArticles();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadArticles();
    
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
    
    // Modal logic
    const modal = document.getElementById('article-modal');
    document.getElementById('btn-new-article')?.addEventListener('click', () => { if (modal) modal.style.display = 'flex'; });
    document.getElementById('btn-close-modal')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    
    document.getElementById('article-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('art-title').value;
        const content = document.getElementById('art-content').value;
        const image_url = document.getElementById('art-image').value;
        const status = document.getElementById('art-status').value;

        if (!title.trim() || !content.trim()) {
            alert('يرجى إدخال العنوان والمحتوى.');
            return;
        }
        
        const { error } = await supabase.from('articles').insert({
            title: title.trim(),
            content: content.trim(),
            image_url: image_url.trim() || null,
            status,
            author_id: currentUser.id
        });
        
        if(!error) {
            modal.style.display = 'none';
            document.getElementById('article-form').reset();
            loadArticles();
        } else {
            alert('حدث خطأ أثناء النشر: ' + error.message);
        }
    });
});
