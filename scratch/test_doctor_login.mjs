import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDoctorLogin() {
    console.log("=== Testing Doctor Login Flow ===");
    
    // 1. Test Login
    console.log("1. Attempting login for sidou05a@gmail.com...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'sidou05a@gmail.com',
        password: 'Abdou@#$2026'
    });

    if (authError) {
        console.error("❌ Login Failed:", authError.message);
        return;
    }
    console.log("✅ Login Successful! User ID:", authData.user.id);

    // 2. Test Role Detection (Equivalent to auth.js logic)
    console.log("2. Checking Role in profiles table...");
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.error("❌ Failed to fetch profile:", profileError.message);
        return;
    }

    const role = profileData.role;
    console.log(`✅ Profile loaded. Name: ${profileData.full_name}, Role: ${role}`);

    // 3. Test Specialist Redirect Logic
    const SPECIALIST_ROLES = ['specialist', 'doctor', 'psychologist', 'nutritionist'];
    if (SPECIALIST_ROLES.includes(role)) {
        console.log("✅ Routing Test: User will be correctly redirected to 'specialist/index.html'");
    } else {
        console.error("❌ Routing Test Failed: User role is not a specialist role. It is:", role);
    }

    // 4. Test Specialist Profile Data
    console.log("3. Fetching specialist_profiles data...");
    const { data: specData, error: specError } = await supabase
        .from('specialist_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (specError) {
        console.error("❌ Failed to fetch specialist_profile:", specError.message);
    } else {
        console.log("✅ Specialist Profile Data:", specData);
    }

    console.log("=== Test Completed ===");
}

testDoctorLogin();
