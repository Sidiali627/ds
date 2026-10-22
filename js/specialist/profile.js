import { supabase } from '../supabase.js';
import { showToast } from '../toast.js';
import { canAccessSpecialistPortal, normalizeRole } from '../roles.js';

let currentUser = null;

async function init() {
    if (!supabase) { window.location.href = '../login.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return; }

    // Step 1: Fetch Profile safely
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !profile || !canAccessSpecialistPortal(normalizeRole(profile.role))) {
        showToast("هذه الصفحة مخصصة للمختصين فقط.", 'error');
        setTimeout(() => window.location.href = '../index.html', 1500);
        return;
    }

    // Step 2: Fetch Specialist Extra Profile safely
    const { data: spData } = await supabase.from('specialist_profiles').select('*').eq('id', session.user.id).maybeSingle();
    profile.specialist_profiles = spData;

    currentUser = profile;

    const spNameEl = document.getElementById('sp-name');
    if (spNameEl) spNameEl.innerText = profile.full_name || 'طبيب استشاري';
    const profTitleEl = document.getElementById('prof-title-display');
    if (profTitleEl) profTitleEl.innerText = `د. ${profile.full_name || ''}`;
    const profNameEl = document.getElementById('prof-name');
    if (profNameEl) profNameEl.value = profile.full_name || '';
    
    if (profile.avatar_url) {
        const spAvatarEl = document.getElementById('sp-avatar');
        if (spAvatarEl) spAvatarEl.src = profile.avatar_url;
        const profImgEl = document.getElementById('prof-img');
        if (profImgEl) profImgEl.src = profile.avatar_url;
    }

    if (profile.specialist_profiles) {
        const sp = profile.specialist_profiles;
        const spSpecEl = document.getElementById('sp-specialty');
        if (spSpecEl) spSpecEl.innerText = sp.specialty || 'أخصائي معتمد';
        const profSpecDisplay = document.getElementById('prof-specialty-display');
        if (profSpecDisplay) profSpecDisplay.innerText = sp.specialty || 'طبيب استشاري';
        const profSpecInput = document.getElementById('prof-spec');
        if (profSpecInput) profSpecInput.value = sp.specialty || '';
        const profBioInput = document.getElementById('prof-bio');
        if (profBioInput) profBioInput.value = sp.bio || '';
    }
}

window.updateProfile = async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof-name').value.trim();
    const spec = document.getElementById('prof-spec').value.trim();
    const bio = document.getElementById('prof-bio').value.trim();

    if (!name || !spec) return;

    showToast('جاري تحديث البيانات...', 'info', 1000);
    // 1. Update Profiles table
    await supabase.from('profiles').update({ full_name: name }).eq('id', currentUser.id);

    // 2. Update Specialist Profiles table
    const { error } = await supabase.from('specialist_profiles')
        .upsert([{ id: currentUser.id, specialty: spec, bio: bio }]);

    if (error) {
        showToast("حدث خطأ أثناء التحديث: " + error.message, 'error');
    } else {
        showToast("تم تحديث الملف المهني بنجاح! ✅", 'success');
        await init();
    }
};

document.addEventListener('DOMContentLoaded', init);
