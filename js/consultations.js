// consultations.js - Dual Schema Compatible Consultation Submission
import { requireAuth } from './auth.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('consultation-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const msgEl = document.getElementById('cons-msg-box') || document.getElementById('cons-msg');
        const submitBtn = document.getElementById('btn-submit-consultation') || form.querySelector('button[type="submit"]');
        
        if (msgEl) {
            msgEl.style.display = 'none';
        }
        
        // Ensure user is logged in
        const session = await requireAuth();
        if(!session) return;
        
        const category = document.getElementById('category').value;
        const priority = document.getElementById('priority')?.value || 'normal';
        const description = document.getElementById('description').value.trim();

        if (!description) {
            if (msgEl) {
                msgEl.innerText = 'يرجى كتابة شرح كافٍ لحالتك الصحية.';
                msgEl.style.background = 'rgba(239, 68, 68, 0.1)';
                msgEl.style.color = 'var(--danger-color)';
                msgEl.style.display = 'block';
            }
            return;
        }

        // Set Loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>جاري إرسال طلب الاستشارة... ⏳</span>';
        }
        
        const specDisplay = category === 'psychology' ? 'صحة نفسية' : (category === 'nutrition' ? 'تغذية' : 'طب عام');
        const priorityDisplay = priority === 'urgent' ? 'عاجل' : 'عادي';
        const reportText = `التخصص: ${specDisplay}\nالأولوية: ${priorityDisplay}\nالوصف: ${description}`;

        // Attempt primary insert (New schema)
        let { error } = await supabase.from('consultations').insert({
            user_id: session.user.id,
            specialty: category,
            priority: priority,
            description: description,
            report: reportText,
            status: 'pending'
        });
        
        // Fallback for older database schema without 'description', 'priority', or 'specialty' columns
        if (error && (error.message.includes("description") || error.message.includes("specialty") || error.message.includes("priority") || error.message.includes("schema cache"))) {
            console.warn("Retrying with fallback schema payload (report column)...");
            const fallbackRes = await supabase.from('consultations').insert({
                user_id: session.user.id,
                report: reportText,
                status: 'pending'
            });
            error = fallbackRes.error;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>إرسال طلب الاستشارة الآن</span>';
        }

        if (error) {
            if (msgEl) {
                if (error.message.includes('row-level security') || error.message.includes('RLS')) {
                    msgEl.innerText = 'تنبيه: جدول الاستشارات بحاجة لتفعيل سياسة السماح بالإدخال (RLS Policy).';
                } else if (error.message.includes('Failed to fetch')) {
                    msgEl.innerText = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.';
                } else {
                    msgEl.innerText = 'حدث خطأ أثناء تقديم الطلب: ' + error.message;
                }
                msgEl.style.background = 'rgba(239, 68, 68, 0.1)';
                msgEl.style.color = 'var(--danger-color)';
                msgEl.style.display = 'block';
            }
        } else {
            // Trigger in-app notification for patient
            try {
                const { createNotification } = await import('./notifications.js');
                await createNotification(
                    session.user.id,
                    'تم تسجيل طلب استشارتك بنجاح 🩺',
                    `تم استلام طلب استشارتك في تخصص (${specDisplay}). سيقوم الفريق الطبي بتعيين مختص ومتابعة حالتك قريباً.`,
                    'consultation',
                    'dashboard.html'
                );
            } catch (notifErr) {
                console.warn('Notice: In-app notification creation skipped:', notifErr);
            }

            if (msgEl) {
                msgEl.innerText = '✅ تم تسجيل طلب استشارتك بنجاح! سيتم توجيهك الآن إلى لوحة التحكم لمتابعة حالتها.';
                msgEl.style.background = 'rgba(16, 185, 129, 0.12)';
                msgEl.style.color = 'var(--success-color)';
                msgEl.style.display = 'block';
            }
            form.reset();
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1400);
        }
    });
});
