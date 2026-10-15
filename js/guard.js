// guard.js - Strict Role-Based Access Control (RBAC) & Route Guard System
import { supabase } from './supabase.js';

const ALLOWED_SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist', 'admin', 'super_admin'];
const ALLOWED_ADMIN_ROLES = ['admin', 'super_admin'];

export async function enforceGuard() {
    if (!supabase) return;

    const path = window.location.pathname.toLowerCase();

    if (path.includes('login.html') || path.includes('register.html') || path.includes('unauthorized.html') || path.includes('verify.html')) {
        return; // Public auth / status pages
    }

    const isAdminRoute = path.includes('/admin/') || path.includes('/superadmin/');
    const isSpecialistRoute = path.includes('/specialist/');
    const isUserRoute = path.includes('/user/') || path.includes('dashboard.html') || (path.includes('profile.html') && !isSpecialistRoute && !isAdminRoute) || path.includes('user_live_session.html');

    if (!isAdminRoute && !isSpecialistRoute && !isUserRoute) {
        return; // Public route
    }

    const { data: { session } } = await supabase.auth.getSession();

    // 1. Unauthenticated Visitor Access Control
    if (!session) {
        console.warn("RBAC Guard: Unauthenticated access blocked on path:", path);
        const redirectPrefix = (isAdminRoute || isSpecialistRoute) ? '../' : '';
        window.location.href = `${redirectPrefix}login.html`;
        return;
    }

    // 2. Fetch User Profile & Role directly from Supabase
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    const rawRole = profile?.role || 'user';
    const role = rawRole.toLowerCase().trim().replace(/\s+/g, '_');

    if (error || !profile) {
        console.error("RBAC Guard ERROR: Could not load user profile from Supabase for ID:", session.user.id, error);
        // Fallback to login if profile cannot be fetched to prevent bypass
        const redirectPrefix = (isAdminRoute || isSpecialistRoute) ? '../' : '';
        window.location.href = `${redirectPrefix}login.html`;
        return;
    }

    // 3. Role-Based Route Enforcement
    const redirectPrefix = (isAdminRoute || isSpecialistRoute || path.includes('/user/')) ? '../' : '';
    
    // Admin trying to access unauthorized portals (Admin can access specialist, but if we want strictly separated we can enforce. Current setup allows admin to specialist).
    if (isAdminRoute && !ALLOWED_ADMIN_ROLES.includes(role)) {
        console.error("RBAC Guard: Access to Admin Portal blocked for role:", role);
        window.location.href = `${redirectPrefix}unauthorized.html`;
        return;
    }

    if (isSpecialistRoute && !ALLOWED_SPECIALIST_ROLES.includes(role)) {
        console.error("RBAC Guard: Access to Specialist Portal blocked for role:", role);
        window.location.href = `${redirectPrefix}unauthorized.html`;
        return;
    }

    // A Specialist trying to access regular user dashboard should be blocked if we enforce strict separation.
    // The instructions: "إذا حاول SPECIALIST الدخول إلى /user/ /admin/ /superadmin/ يتم منعه."
    // And "إذا حاول USER الدخول إلى /specialist/ /admin/ /superadmin/ يتم منعه."
    if (isUserRoute && ALLOWED_SPECIALIST_ROLES.includes(role) && !ALLOWED_ADMIN_ROLES.includes(role)) {
        console.error("RBAC Guard: Specialist trying to access User Portal blocked.");
        // Redirect specialist to their portal
        window.location.href = (path.includes('/user/')) ? '../specialist/index.html' : 'specialist/index.html';
        return;
    }

    console.log(`RBAC Guard: Access GRANTED for role [${role}] on path [${path}]`);
}

document.addEventListener('DOMContentLoaded', enforceGuard);
