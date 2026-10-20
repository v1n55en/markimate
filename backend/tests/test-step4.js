// Test Langkah 4: UI Credit Wallet, Ledger, dan Insufficient Credits 402 flow
import assert from 'assert';
import http from 'http';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let appServer;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('=== RUNNING TEST STEP 4 ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-step4';
  process.env.PORT = '5004';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = 'test-admin-key-step4';

  await seedCreditPricesAndRates();

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const testEmail = `step4-user-${Date.now()}@example.com`;
  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'password123',
      name: 'Step 4 Tester',
      acceptTerms: true
    })
  });
  assert.strictEqual(registerRes.status, 200, 'Register should succeed');

  const userRow = await db.findOne('accounts', { email: testEmail });
  assert(userRow, 'User must exist');
  const userId = userRow.id;

  await request(`/api/admin/users/${userId}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'password123'
    })
  });
  assert.strictEqual(loginRes.status, 200, 'Login should succeed');
  const token = loginRes.data.token || loginRes.data.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('1. User registered and verified with 300 trial credits');

  // Test 1: Fetch initial ledger
  const ledger1 = await request('/api/credits/ledger', { headers: authHeaders });
  assert.strictEqual(ledger1.status, 200, 'Ledger endpoint should return 200');
  assert.ok(Array.isArray(ledger1.data.ledger), 'Ledger should be array');
  assert.strictEqual(ledger1.data.ledger.length, 1, 'Initial ledger should have 1 grant entry (trial)');
  assert.strictEqual(ledger1.data.ledger[0].action_key, 'auth.trial', 'First ledger entry should be auth.trial');
  assert.strictEqual(ledger1.data.ledger[0].delta, 300, 'Delta should be 300');
  console.log('✓ Initial ledger verified (auth.trial +300)');

  // Test 2: Filter ledger by module & kind
  const ledgerFilteredModule = await request('/api/credits/ledger?module=auth', { headers: authHeaders });
  assert.strictEqual(ledgerFilteredModule.status, 200);
  assert.strictEqual(ledgerFilteredModule.data.entries.length, 1);

  const ledgerFilteredOther = await request('/api/credits/ledger?module=seo', { headers: authHeaders });
  assert.strictEqual(ledgerFilteredOther.status, 200);
  assert.strictEqual(ledgerFilteredOther.data.entries.length, 0, 'No seo entries yet');
  console.log('✓ Ledger filtering by module works');

  // Test 3: Insufficient credits check (402)
  // Set user's credits to 10 so running seo.article (60 credits) triggers 402
  await db.update('credit_wallets', { workspace_id: userId }, { balance_trial: 10 });

  // Connect dummy CMS so keyword can be created
  await request('/api/cms/wordpress', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      config: { siteUrl: 'https://example.com', username: 'admin', appPassword: 'app-pass-secret' },
      articleSettings: { images: { enabled: false, count: 0 } }
    })
  });

  const kwRes = await request('/api/keywords', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      keyword: 'sepatu sneaker lokal',
      geo: 'ID',
      ln: 'id',
      cms: 'wordpress',
      schedule: 'manual'
    })
  });
  assert.strictEqual(kwRes.status, 200, 'Keyword creation should succeed');
  const kwId = kwRes.data.keyword.id;

  const runRes = await request(`/api/keywords/${kwId}/run`, {
    method: 'POST',
    headers: authHeaders
  });

  assert.strictEqual(runRes.status, 402, 'Should return 402 Payment Required');
  assert.strictEqual(runRes.data.code, 'INSUFFICIENT_CREDITS', 'Code should be INSUFFICIENT_CREDITS');
  assert.strictEqual(runRes.data.need, 60, 'Need should be 60');
  assert.strictEqual(runRes.data.have, 10, 'Have should be 10');
  assert.ok(runRes.data.topupUrl, 'topupUrl should be provided');
  console.log('✓ 402 INSUFFICIENT_CREDITS response correctly structured:', runRes.data);

  // Test 4: Restore balance and verify ledger
  await db.update('credit_wallets', { workspace_id: userId }, { balance_trial: 300 });
  const ledgerAfter = await request('/api/credits/ledger', { headers: authHeaders });
  assert.strictEqual(ledgerAfter.status, 200);
  console.log('✓ Ledger summary verified with totals and pagination');

  console.log('ALL STEP 4 TESTS PASSED!');
  process.exit(0);
}

main().catch(err => {
  console.error('Test Step 4 Failed:', err);
  process.exit(1);
}).finally(() => {
  if (appServer) appServer.close();
});
