const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.org',
        password: 'CHANGE_ME_SECURE_PASSWORD'
    });
    console.log("Logged in:", authData?.user?.id);

    // Fetch the other profile
    const { data: profiles } = await supabase.from('profiles').select('*');
    console.log("Profiles in DB:", profiles);
}

test();
