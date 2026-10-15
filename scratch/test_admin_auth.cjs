const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://xsuednrcrzbjdyrdrgat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWVkbnJjcnpiamR5cmRyZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDMwNDYsImV4cCI6MjEwNzQxOTA0Nn0.5ltBXW_X1UI0YdShK_q4OLWmJs-0ItxSzjdv5otjgOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAdmin() {
    await supabase.auth.signInWithPassword({
        email: 'sidialiabdouu@gmail.com',
        password: 'Admin@bba2005@2026!'
    });

    try {
        const { data, error } = await supabase.auth.admin.listUsers();
        console.log("auth.admin.listUsers result:", error ? error.message : data);
    } catch (e) {
        console.log("auth.admin error:", e.message);
    }
}

testAdmin();
