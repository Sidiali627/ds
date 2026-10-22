const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function probe() {
    console.log("=== PHASE 10: PROBING USER & ROLE MANAGEMENT ===");

    // 1. Check anonymous access to profiles
    const { data: anonProfiles, error: anonErr } = await supabase.from('profiles').select('*').limit(3);
    console.log("Anon profiles access:", anonErr ? `Error: ${anonErr.message}` : `Success (${anonProfiles.length} rows)`);

    // 2. Sign in as Super Admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.org',
        password: 'CHANGE_ME_SECURE_PASSWORD'
    });

    if (authError) {
        console.error("Super Admin login error:", authError);
        return;
    }
    console.log("Super Admin logged in. UID:", authData.user.id);

    // 3. Inspect profiles columns and rows
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
    if (profErr) {
        console.error("Profiles fetch error:", profErr);
    } else {
        console.log(`Total profiles found: ${profiles.length}`);
        if (profiles.length > 0) {
            console.log("Sample profile columns:", Object.keys(profiles[0]));
            console.log("Profiles summary:");
            profiles.forEach(p => {
                console.log(`- ID: ${p.id.slice(0, 8)}... | Name: ${p.full_name} | Role: ${p.role} | Status: ${p.account_status} | Email in profile?: ${p.email !== undefined ? p.email : 'NO EMAIL COLUMN'}`);
            });
        }
    }

    // 4. Check roles table
    const { data: roles, error: rolesErr } = await supabase.from('roles').select('*');
    if (rolesErr) {
        console.log("Roles table error:", rolesErr.message);
    } else {
        console.log("Roles table entries:", roles);
    }

    // 5. Check if specialist_profiles exist
    const { data: specialists, error: specErr } = await supabase.from('specialist_profiles').select('*');
    if (specErr) {
        console.log("Specialist profiles error:", specErr.message);
    } else {
        console.log(`Specialist profiles: ${specialists.length} rows`);
        specialists.forEach(s => console.log(`- Specialist UID: ${s.id} | Specialty: ${s.specialty}`));
    }
}

probe();
