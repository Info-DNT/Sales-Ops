const https = require('https');

const options = {
    hostname: 'lgedjkyafshufxhjywhk.supabase.co',
    path: '/rest/v1/leads?select=*&limit=1',
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWRqa3lhZnNodWZ4aGp5d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTgwNTAsImV4cCI6MjA4NDAzNDA1MH0.RqL0cdmv259m_txWrpIZoFB9vJ40R_vStxxoZz3ICv0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWRqa3lhZnNodWZ4aGp5d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTgwNTAsImV4cCI6MjA4NDAzNDA1MH0.RqL0cdmv259m_txWrpIZoFB9vJ40R_vStxxoZz3ICv0'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', data);
    });
});

req.on('error', (e) => console.error(e));
req.end();
