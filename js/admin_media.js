// admin_media.js
import { supabase, SUPABASE_URL } from './supabase.js';

let allMedia = [];
let currentFilter = 'all';
let currentSelection = null;

async function checkAuth() {
    if (!supabase) { window.location.href = 'login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; }
    return session.user;
}

async function loadMedia() {
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '<div class="empty-state">جاري التحميل...</div>';
    
    try {
        const { data, error } = await supabase.from('media_library')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        allMedia = data || [];
        renderMedia();
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div class="empty-state" style="color:var(--danger-color);">حدث خطأ أثناء تحميل الوسائط. تأكد من تشغيل ملف الهجرة.</div>';
    }
}

function renderMedia() {
    const grid = document.getElementById('media-grid');
    const q = document.getElementById('media-search').value.toLowerCase();
    
    const filtered = allMedia.filter(m => {
        // Search
        const matchQ = m.file_name.toLowerCase().includes(q) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q)));
        
        // Folder Filter
        let matchF = false;
        if (currentFilter === 'deleted') {
            matchF = m.is_deleted === true;
        } else {
            if (m.is_deleted) return false; // Hide deleted files from normal views
            if (currentFilter === 'all') matchF = true;
            else if (currentFilter === 'image') matchF = m.mime_type.startsWith('image/');
            else if (currentFilter === 'video') matchF = m.mime_type.startsWith('video/');
            else if (currentFilter === 'document') matchF = m.mime_type.includes('pdf') || m.mime_type.includes('document');
        }
        return matchQ && matchF;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <div>لا توجد ملفات هنا. اسحب وأفلت الملفات لرفعها.</div>
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(m => {
        const isImage = m.mime_type.startsWith('image/');
        const url = `${SUPABASE_URL}/storage/v1/object/public/${m.bucket_id}/${m.file_path}`;
        
        let visual = isImage ? `<img src="${url}" class="media-thumb" loading="lazy">` : 
                     `<div class="media-icon-fallback">${m.mime_type.split('/')[1].toUpperCase()}</div>`;
                     
        return `
            <div class="media-card" id="card-${m.id}" onclick="selectMedia('${m.id}')">
                ${visual}
                <div class="media-name-overlay">${m.file_name}</div>
            </div>
        `;
    }).join('');
}

window.filterMedia = (type) => {
    currentFilter = type;
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderMedia();
    document.getElementById('details-panel').style.display = 'none';
}

window.searchMedia = () => renderMedia();

window.selectMedia = (id) => {
    document.querySelectorAll('.media-card').forEach(el => el.classList.remove('selected'));
    document.getElementById(`card-${id}`).classList.add('selected');
    
    const m = allMedia.find(x => x.id === id);
    currentSelection = m;
    
    const panel = document.getElementById('details-panel');
    panel.style.display = 'flex';
    
    const url = `${SUPABASE_URL}/storage/v1/object/public/${m.bucket_id}/${m.file_path}`;
    
    if (m.mime_type.startsWith('image/')) {
        document.getElementById('d-thumb').style.display = 'block';
        document.getElementById('d-thumb').src = url;
    } else {
        document.getElementById('d-thumb').style.display = 'none';
    }
    
    document.getElementById('d-name').innerText = m.file_name;
    document.getElementById('d-url').value = url;
    document.getElementById('d-type').innerText = m.mime_type;
    document.getElementById('d-size').innerText = (m.size_bytes / 1024).toFixed(2) + ' KB';
    document.getElementById('d-date').innerText = new Date(m.created_at).toLocaleString('ar-EG');
    document.getElementById('d-usage').innerText = m.usage_location || 'غير مستخدم';

    // Buttons logic
    if (m.is_deleted) {
        document.getElementById('btn-restore').style.display = 'block';
        document.getElementById('btn-delete').style.display = 'none';
        document.getElementById('btn-hard-delete').style.display = 'block';
    } else {
        document.getElementById('btn-restore').style.display = 'none';
        document.getElementById('btn-delete').style.display = 'block';
        document.getElementById('btn-hard-delete').style.display = 'none';
    }
}

window.copyUrl = () => {
    const copyText = document.getElementById('d-url');
    copyText.select();
    document.execCommand('copy');
    alert("تم النسخ!");
}

window.deleteFile = async () => {
    if(!currentSelection) return;
    if(confirm('هل أنت متأكد من نقل الملف إلى سلة المحذوفات؟')) {
        const { error } = await supabase.from('media_library').update({ is_deleted: true, deleted_at: new Date() }).eq('id', currentSelection.id);
        if(!error) {
            currentSelection.is_deleted = true;
            document.getElementById('details-panel').style.display = 'none';
            renderMedia();
        }
    }
}

window.restoreFile = async () => {
    if(!currentSelection) return;
    const { error } = await supabase.from('media_library').update({ is_deleted: false, deleted_at: null }).eq('id', currentSelection.id);
    if(!error) {
        currentSelection.is_deleted = false;
        document.getElementById('details-panel').style.display = 'none';
        renderMedia();
    }
}

window.hardDeleteFile = async () => {
    if(!currentSelection) return;
    if(confirm('سيتم حذف الملف نهائياً من التخزين السحابي وقاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه!')) {
        // 1. Delete from Storage
        await supabase.storage.from('media').remove([currentSelection.file_path]);
        // 2. Delete from DB
        await supabase.from('media_library').delete().eq('id', currentSelection.id);
        
        allMedia = allMedia.filter(m => m.id !== currentSelection.id);
        document.getElementById('details-panel').style.display = 'none';
        renderMedia();
    }
}

// Upload Logic
window.handleFilesUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const user = await checkAuth();
    
    for (let file of files) {
        // Simulating upload progress
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `uploads/${new Date().getFullYear()}/${fileName}`;
        
        try {
            // Upload to Supabase Storage
            const { data: storageData, error: storageError } = await supabase.storage.from('media').upload(filePath, file);
            
            if (storageError) {
                console.error("Upload error (You might need to create 'media' bucket in Supabase UI):", storageError);
                alert(`فشل رفع ${file.name}. هل تأكدت من إنشاء دلو (Bucket) باسم 'media' وجعله Public؟`);
                continue;
            }
            
            // Insert into media_library DB
            const { data: dbData, error: dbError } = await supabase.from('media_library').insert([{
                file_name: file.name,
                bucket_id: 'media',
                file_path: filePath,
                mime_type: file.type,
                size_bytes: file.size,
                uploaded_by: user?.id
            }]).select();
            
            if (!dbError && dbData) {
                allMedia.unshift(dbData[0]);
            }
            
        } catch (e) {
            console.error(e);
        }
    }
    
    renderMedia();
}

// Drag & Drop Handling
const dropZone = document.querySelector('.admin-content');
const dropOverlay = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.style.display = 'block';
    dropOverlay.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('dragover');
    if (e.relatedTarget === null || e.relatedTarget === dropZone) {
       dropOverlay.style.display = 'none';
    }
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.style.display = 'none';
    dropOverlay.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    handleFilesUpload(files);
});

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadMedia();
});
