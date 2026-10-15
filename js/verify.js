// verify.js
import { supabase } from './supabase.js';

async function verifyCertificate() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    const icon = document.getElementById('icon');
    const title = document.getElementById('title');
    const desc = document.getElementById('desc');
    const details = document.getElementById('details');

    if (!id) {
        showError("رابط غير صالح", "لم يتم تمرير رقم الشهادة في الرابط. يرجى مسح رمز الـ QR مرة أخرى.");
        return;
    }

    try {
        const { data, error } = await supabase.from('certificates').select('*').eq('id', id).single();
        
        if (error || !data) {
            showError("شهادة غير موجودة", "لم نعثر على هذه الشهادة في سجلاتنا. قد تكون مزورة أو تم مسحها.");
            return;
        }

        if (data.status === 'cancelled') {
            showError("الشهادة ملغاة", "هذه الشهادة مسجلة لدينا، ولكن تم إلغاؤها من قبل الإدارة لاحقاً، وبالتالي تعتبر غير صالحة للاستخدام.");
            document.getElementById('d-name').innerText = data.recipient_name;
            document.getElementById('d-activity').innerText = data.activity_name;
            document.getElementById('d-date').innerText = data.issue_date;
            document.getElementById('d-id').innerText = data.id;
            details.style.display = 'block';
            return;
        }

        // Valid Certificate
        icon.className = 'v-icon success';
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        title.innerText = "الشهادة موثقة وصالحة";
        title.style.color = 'var(--success-color)';
        desc.innerText = "هذه الشهادة أصلية وصادرة رسمياً من استوديو صحة الشباب ومسجلة في قاعدة بياناتنا الموثوقة.";

        document.getElementById('d-name').innerText = data.recipient_name;
        document.getElementById('d-activity').innerText = data.activity_name;
        document.getElementById('d-date').innerText = data.issue_date;
        document.getElementById('d-id').innerText = data.id;
        details.style.display = 'block';

    } catch (e) {
        console.error(e);
        showError("خطأ تقني", "تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.");
    }
}

function showError(errTitle, errDesc) {
    const icon = document.getElementById('icon');
    const title = document.getElementById('title');
    const desc = document.getElementById('desc');

    icon.className = 'v-icon error';
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    title.innerText = errTitle;
    title.style.color = 'var(--danger-color)';
    desc.innerText = errDesc;
}

document.addEventListener('DOMContentLoaded', verifyCertificate);
