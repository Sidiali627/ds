const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://xsuednrcrzbjdyrdrgat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAdminUpdate() {
    const { data: authData } = await supabase.auth.signInWithPassword({
        email: 'sidialiabdouu@gmail.com',
        password: 'Admin@bba2005@2026!'
    });
    console.log("Logged in UID:", authData.user.id);

    // Try updating the other user's wilaya or internal_notes
    const targetUserId = '59930c81-8f5c-42e8-8a5c-234e4c543195';
    const { data, error } = await supabase
        .from('profiles')
        .update({ internal_notes: 'Tested note by Super Admin' })
        .eq('id', targetUserId)
        .select();

    console.log("Update result:", error ? `Error: ${error.message}` : data);
}

testAdminUpdate();
