const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lgedjkyafshufxhjywhk.supabase.co';
// Use the Anon key from the frontend for a simple check, or I can try to find the service key if it's in a local .env
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWRqa3lhZnNodWZ4aGp5d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTgwNTAsImV4cCI6MjA4NDAzNDA1MH0.RqL0cdmv259m_txWrpIZoFB9vJ40R_vStxxoZz3ICv0';

async function check() {
    console.log('--- Database Audit ---');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('1. Testing Connection...');
    const { data: leads, error } = await supabase.from('leads').select('*').limit(1);

    if (error) {
        console.error('Connection Failed:', error.message);
        return;
    }

    console.log('Connection Successful. Sample Lead:', JSON.stringify(leads[0], null, 2));

    console.log('\n2. Checking for Admin Users...');
    const { data: users, error: userError } = await supabase.from('users').select('id, role').eq('role', 'admin');
    if (userError) {
        console.error('User Fetch Failed:', userError.message);
    } else {
        console.log('Admins found:', users.length);
        users.forEach(u => console.log(' - ID:', u.id));
    }
}

check();
