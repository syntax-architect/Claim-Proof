import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xwkfexydiolblhuiiuqh.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3a2ZleHlkaW9sYmxodWlpdXFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUxNjczNSwiZXhwIjoyMTA5MDkyNzM1fQ.x2onwWkX_1pZ42p0K6-d3yVbTLIV0YOhtAtVz9lRbi4';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3a2ZleHlkaW9sYmxodWlpdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTY3MzUsImV4cCI6MjEwOTA5MjczNX0.Bz6Kb_axr3usEpHQwKhrWhMd5ziuK6taG3s2w04wSW4';

console.log('Testing connection to Supabase instance:', SUPABASE_URL);

async function testConnection() {
  const results = {
    url: SUPABASE_URL,
    restHealth: false,
    authJwks: false,
    serviceRoleAuth: false,
    anonAuth: false,
    existingTables: [],
    missingTables: []
  };

  // 1. Test JWKS endpoint
  try {
    const jwksRes = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
    results.authJwks = jwksRes.ok;
    console.log(`[1] Auth JWKS Endpoint: ${jwksRes.status} ${jwksRes.statusText}`);
  } catch (err) {
    console.error(`[1] Auth JWKS Endpoint Failed:`, err.message);
  }

  // 2. Test Supabase Client with service_role key
  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const expectedTables = ['cp_devices', 'cp_licenses', 'cp_payments', 'cp_webhook_events'];
    
    for (const table of expectedTables) {
      const { data, error } = await adminClient.from(table).select('*').limit(1);
      if (error) {
        results.missingTables.push({ table, error: error.message, code: error.code });
        console.log(`[-] Table "${table}": Not found or query error (${error.message})`);
      } else {
        results.existingTables.push(table);
        console.log(`[+] Table "${table}": Responding OK (rows returned: ${data.length})`);
      }
    }
    results.serviceRoleAuth = true;
  } catch (err) {
    console.error(`[2] Service role client error:`, err.message);
  }

  // 3. Test Supabase Client with anon key
  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    // Ping public /auth/v1/health or rest
    const { error } = await anonClient.from('cp_licenses').select('*').limit(1);
    // In RLS, empty data or 0 rows without auth error means connection OK
    console.log(`[3] Anon public client check:`, error ? error.message : 'OK (RLS enforced)');
    results.anonAuth = !error || error.code === 'PGRST116' || error.message.includes('not found') || error.code === '42P01';
  } catch (err) {
    console.error(`[3] Anon client check failed:`, err.message);
  }

  console.log('\nFinal Connection Summary:');
  console.log(JSON.stringify(results, null, 2));
}

testConnection();
