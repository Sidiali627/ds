const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function probe() {
    console.log("=== PROBING DATABASE TABLES FOR PHASE 9 ===");
    
    // Login as Admin to inspect with authenticated admin role
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.org',
        password: 'CHANGE_ME_SECURE_PASSWORD'
    });
    
    if (authError) {
        console.error("Auth error:", authError);
    } else {
        console.log("Admin logged in successfully:", authData.user.id);
    }

    const tables = [
        'profiles',
        'specialist_profiles',
        'consultations',
        'appointments',
        'case_notes',
        'events',
        'articles',
        'volunteers',
        'notifications',
        'email_logs'
    ];

    for (const t of tables) {
        try {
            const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`Table ${t}: Error -> ${error.message} (${error.code})`);
            } else {
                console.log(`Table ${t}: ${count} rows`);
            }
        } catch (e) {
            console.log(`Table ${t}: Exception -> ${e.message}`);
        }
    }

    // Inspect sample columns from key tables
    const sampleConsult = await supabase.from('consultations').select('*').limit(1);
    console.log("Sample Consultation:", sampleConsult.data);

    const sampleAppt = await supabase.from('appointments').select('*').limit(1);
    console.log("Sample Appointment:", sampleAppt.data);

    const sampleCaseNotes = await supabase.from('case_notes').select('*').limit(1);
    console.log("Sample Case Note:", sampleCaseNotes.data);
}

probe();
