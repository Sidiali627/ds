// auth.js - التعامل مع تسجيل الدخول والخروج مع التوجيه الدقيق لجميع أدوار المختصين
import { supabase } from './supabase.js';
import { isAdminRole, isSpecialistRole, normalizeRole } from './roles.js';

export async function signUp(email, password, fullName) {
    if(!supabase) return { error: { message: "Supabase غير متصل" } };
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        if (error && error.message === "Failed to fetch") {
            return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
        }
        return { data, error };
    } catch (err) {
        if (err.message && err.message.includes("Failed to fetch")) {
            return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
        }
        return { error: { message: "حدث خطأ غير متوقع أثناء إنشاء الحساب." } };
    }
}

export async function signIn(email, password) {
    if(!supabase) return { error: { message: "Supabase غير متصل" } };
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            if (error.message === "Failed to fetch") {
                return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
            }
            // Translate common auth errors
            if (error.message === "Invalid login credentials") {
                return { error: { message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." } };
            }
            return { data, error };
        }
        
        if (data && data.session) {
            const userId = data.session.user.id;
            const userEmail = data.session.user.email;

            const { data: userProfile, error: profError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            const role = normalizeRole(userProfile?.role || 'user');

            console.log("=== Auth SignIn Details ===");
            console.log("Current User ID:", userId);
            console.log("Email:", userEmail);
            console.log("Profile Loaded:", userProfile);
            console.log("Profile Fetch Error:", profError);
            console.log("Current Role:", role);

            let redirectUrl = 'dashboard.html';
            if (isAdminRole(role)) {
                redirectUrl = 'admin/index.html';
            } else if (isSpecialistRole(role)) {
                redirectUrl = 'specialist/index.html';
            }
            
            return { data, error: null, redirectUrl };
        }
        return { data, error };
    } catch (err) {
        if (err.message && err.message.includes("Failed to fetch")) {
            return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
        }
        return { error: { message: "حدث خطأ غير متوقع أثناء تسجيل الدخول." } };
    }
}

export async function resetPassword(email) {
    if(!supabase) return { error: { message: "Supabase غير متصل" } };
    try {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html'
        });
        if (error) {
            if (error.message === "Failed to fetch") {
                return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
            }
            return { data, error };
        }
        return { data, error: null };
    } catch (err) {
        if (err.message && err.message.includes("Failed to fetch")) {
            return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
        }
        return { error: { message: "حدث خطأ أثناء طلب استعادة كلمة المرور." } };
    }
}

export async function updatePassword(newPassword) {
    if(!supabase) return { error: { message: "Supabase غير متصل" } };
    try {
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            if (error.message === "Failed to fetch") {
                return { error: { message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً." } };
            }
            return { data, error };
        }
        return { data, error: null };
    } catch (err) {
        return { error: { message: "حدث خطأ أثناء تحديث كلمة المرور." } };
    }
}

export async function getUserRole(userId) {
    if(!supabase || !userId) return 'user';
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        if (error || !data) return 'user';
        return normalizeRole(data.role || 'user');
    } catch {
        return 'user';
    }
}

export function redirectUserByRole(role) {
    const normalized = normalizeRole(role || 'user');
    if (isAdminRole(normalized)) {
        return 'admin/index.html';
    } else if (isSpecialistRole(normalized)) {
        return 'specialist/index.html';
    }
    return 'dashboard.html';
}


export async function signOut() {
    if(!supabase) return;
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

export async function checkSession() {
    if(!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function requireAuth() {
    const session = await checkSession();
    if (!session) {
        window.location.href = 'login.html';
    }
    return session;
}
