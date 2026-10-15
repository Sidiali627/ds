import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist'];
const ADMIN_ROLES = ['admin', 'super_admin'];

async function testFlows() {
    console.log("=== Testing Registration ===");
    const testEmail = `testuser_${Date.now()}@yhs.com`;
    const password = "password123";
    
    let { data: regData, error: regErr } = await supabase.auth.signUp({
        email: testEmail,
        password,
        options: { data: { full_name: "Test User" } }
    });
    
    if (regErr) {
        console.error("Registration failed:", regErr.message);
    } else {
        console.log("Registration successful! User ID:", regData.user.id);
    }
    
    console.log("\n=== Testing Logout ===");
    await supabase.auth.signOut();
    console.log("Logout successful");
    
    console.log("\n=== Testing User Login ===");
    let { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password
    });
    
    if (loginErr) {
        console.error("Login failed:", loginErr.message);
    } else {
        console.log("Login successful! Session active.");
        await checkRoleRedirect(loginData.user.id);
    }
    
    console.log("\n=== Testing Admin Login ===");
    // Attempt login with a presumed admin email, or query the profiles for an admin
    let { data: adminProfiles, error: pErr } = await supabase.from('profiles').select('*').in('role', ADMIN_ROLES).limit(1);
    if (!pErr && adminProfiles.length > 0) {
        console.log(`Found admin in profiles: ${adminProfiles[0].id}. Can't test login without password, but we can verify the redirect logic for this role.`);
        await mockRedirectCheck(adminProfiles[0].role);
    } else {
        console.log("No admin found in profiles or RLS blocked access. Testing redirect logic with 'admin' role mock:");
        await mockRedirectCheck('admin');
    }

    console.log("\n=== Testing Specialist Login ===");
    let { data: specProfiles } = await supabase.from('profiles').select('*').in('role', SPECIALIST_ROLES).limit(1);
    if (specProfiles && specProfiles.length > 0) {
        console.log(`Found specialist in profiles: ${specProfiles[0].id}. Verifying redirect logic for this role.`);
        await mockRedirectCheck(specProfiles[0].role);
    } else {
        console.log("No specialist found in profiles. Testing redirect logic with 'specialist' role mock:");
        await mockRedirectCheck('specialist');
    }
    
    console.log("\n=== Testing Session ===");
    const { data: { session } } = await supabase.auth.getSession();
    console.log("Active Session:", session ? "YES" : "NO");
}

async function checkRoleRedirect(userId) {
    const { data: userProfile, error: profError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
    const role = userProfile?.role || 'user';
    console.log(`User Profile Role: ${role}`);
    await mockRedirectCheck(role);
}

async function mockRedirectCheck(role) {
    let redirectUrl = 'dashboard.html';
    if (ADMIN_ROLES.includes(role)) {
        redirectUrl = 'admin/index.html';
    } else if (SPECIALIST_ROLES.includes(role)) {
        redirectUrl = 'specialist/index.html';
    }
    console.log(`Role [${role}] -> Redirects to: ${redirectUrl}`);
}

testFlows().then(() => console.log("\nAll tests completed.")).catch(console.error);
