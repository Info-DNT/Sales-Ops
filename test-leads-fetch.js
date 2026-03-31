require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  console.log('Testing getLeads query...');
  
  // Try the query that's failing in the browser
  const { data, error } = await supabase
    .from('leads')
    .select('*, users!user_id(name, email)')
    .or('is_converted.eq.false,is_converted.is.null')
    .limit(5);

  if (error) {
    console.error('FETCH ERROR:', error);
  } else {
    console.log('FETCH SUCCESS:', data.length, 'leads found');
    console.log('First lead:', JSON.stringify(data[0], null, 2));
  }
}

testFetch();
