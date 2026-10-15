import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createDoctor() {
    console.log("1. Signing up user sidou05a@gmail.com...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'sidou05a@gmail.com',
        password: 'Abdou@#$2026',
        options: {
            data: {
                full_name: 'Dr. Sidou'
            }
        }
    });

    if (authError) {
        console.error("Auth Error:", authError);
        // If user already exists, let's try to sign in
        if (authError.message.includes("already registered")) {
            console.log("User already exists. Signing in...");
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: 'sidou05a@gmail.com',
                password: 'Abdou@#$2026'
            });
            if (signInError) {
                console.error("Sign in failed:", signInError);
                return;
            }
            authData.user = signInData.user;
        } else {
            return;
        }
    }

    const userId = authData.user.id;
    console.log("User ID:", userId);

    console.log("2. Updating profile role to 'specialist'...");
    // Update profile
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'specialist' })
        .eq('id', userId);

    if (profileError) {
        console.error("Error updating profile role:", profileError);
        return;
    }
    console.log("Profile updated successfully.");

    console.log("3. Inserting/Updating specialist_profiles...");
    const { error: specError } = await supabase
        .from('specialist_profiles')
        .upsert({
            id: userId,
            specialty: 'طبيب استشاري',
            bio: 'طبيب مختص في تقديم الاستشارات الطبية للشباب.',
            availability_status: 'online',
            rating: 5.0
        });

    if (specError) {
        console.error("Error inserting specialist_profile:", specError);
        // RLS might be blocking this. If so, we'll see the error.
        return;
    }
    console.log("Specialist profile created successfully.");

    // Fetch final profile to verify
    const { data: verifyData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    console.log("Final Profile Data:", verifyData);

    const { data: verifySpec } = await supabase.from('specialist_profiles').select('*').eq('id', userId).single();
    console.log("Final Specialist Profile:", verifySpec);
}

createDoctor();
