// Test Langkah 5: Langganan -> balance_sub (reset), cron expire + email peringatan (PRD §4.3)
import assert from 'assert';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

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

async function runStep5Tests() {
  console.log('=== RUNNING TEST STEP 5 (Langganan & Cron Alerts) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-step5';
  process.env.PORT = '5005';
  process.env.CREDITS_ENABLED = 'true';
  process.env.BILLING_DUMMY = 'true';
  process.env.CRON_SECRET = 'cron-secret-step5';

  await seedCreditPricesAndRates();

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const testEmail = `step5-${Date.now()}@example.com`;
  const dummyPass = ['Test', 'Pass', '12345', '!'].join('');
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: dummyPass, name: 'Step 5 Tester', acceptTerms: true })
  });
  assert.strictEqual(regRes.status, 200, 'Register should succeed');

  // Verifikasi akun
  const userRow = await db.findOne('accounts', { email: testEmail });
  await db.update('accounts', { id: userRow.id }, { status: 'active', email_verified_at: new Date().toISOString() });
  const { grantTrialIfEligible } = await import('../lib/credits.js');
  await grantTrialIfEligible(userRow.id, testEmail);

  // Login untuk mendapatkan JWT
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: dummyPass })
  });
  assert.strictEqual(loginRes.status, 200);
  const token = loginRes.data.token;
  const userId = loginRes.data.user.id;
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('1. User registered with 300 trial credits');

  // Test 1: Checkout SEO Plan (1.500 credits)
  const checkoutRes = await request('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ plan: 'seo', method: 'qris' })
  });
  assert.strictEqual(checkoutRes.status, 200, 'Checkout SEO should succeed');
  assert.strictEqual(checkoutRes.data.user.plan, 'seo');

  const credits1 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(credits1.status, 200);
  assert.strictEqual(credits1.data.balance.sub, 1500, 'balance_sub should be 1500 credits');
  assert.strictEqual(credits1.data.balance.trial, 300, 'balance_trial should still be 300');
  assert.strictEqual(credits1.data.balance.total, 1800, 'total balance should be 1800 (300 trial + 1500 sub)');
  assert.ok(credits1.data.expires.sub, 'sub_expires_at should be populated');
  console.log('✓ 1. Checkout paket SEO berhasil: balance_sub = 1500, total = 1800');

  // Test 2: Renewal / Upgrade to Focus 3 (3.200 credits) -> PRD §4.3: RESET, bukan tambah!
  const upgradeRes = await request('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ plan: 'focus3', method: 'bca' })
  });
  assert.strictEqual(upgradeRes.status, 200, 'Checkout Focus 3 should succeed');

  const credits2 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(credits2.data.balance.sub, 3200, 'balance_sub should reset to 3200, NOT 1500 + 3200');
  assert.strictEqual(credits2.data.balance.total, 3500, 'total balance should be 3500 (300 trial + 3200 sub)');
  console.log('✓ 2. Upgrade/Renewal reset credit berhasil: balance_sub = 3200 (bukan akumulasi)');

  // Test 3: Cron expire trial bucket
  // Simulasikan masa trial sudah lewat waktu
  await db.update('credit_wallets', { workspace_id: userId }, {
    trial_expires_at: new Date(Date.now() - 3600e3).toISOString() // 1 jam lalu
  });

  const cronRes1 = await request('/api/cron/run-scheduled', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  assert.strictEqual(cronRes1.status, 200, 'Cron endpoint should return 200');

  const creditsAfterExpire = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditsAfterExpire.data.balance.trial, 0, 'Trial bucket should be expired to 0');
  assert.strictEqual(creditsAfterExpire.data.balance.sub, 3200, 'Subscription bucket should remain 3200');
  console.log('✓ 3. Cron expireBuckets berhasil mengosongkan trial yang kadaluarsa');

  // Test 4: Low balance <= 20% alert
  // Set balance_sub ke 400 (karena base Focus 3 = 3200, 20% = 640. 400 <= 640).
  await db.update('credit_wallets', { workspace_id: userId }, { balance_sub: 400 });

  const cronRes2 = await request('/api/cron/run-scheduled', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  assert.strictEqual(cronRes2.status, 200);

  // Check alert log in credit_alerts
  const alerts = await db.findMany('credit_alerts', { workspace_id: userId });
  assert.ok(alerts.length > 0, 'Alert should be recorded in credit_alerts');
  const lowAlert = alerts.find(a => a.alert_type === 'balance_low_20');
  assert.ok(lowAlert, 'balance_low_20 alert should be triggered');
  assert.strictEqual(lowAlert.sent_to, testEmail);
  console.log('✓ 4. Peringatan saldo <= 20% berhasil terpicu dan tercatat di database');

  // Test 5: Idempotensi notifikasi (cron dijalankan lagi tidak menduplikasi peringatan)
  const initialAlertCount = alerts.length;
  await request('/api/cron/run-scheduled', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  const alertsAfter = await db.findMany('credit_alerts', { workspace_id: userId });
  assert.strictEqual(alertsAfter.length, initialAlertCount, 'Alert should NOT be resent in same period');
  console.log('✓ 5. Idempotensi alert terverifikasi (tidak ada email spam/duplikat)');

  console.log('ALL STEP 5 TESTS PASSED!');
  process.exit(0);
}

runStep5Tests().catch(err => {
  console.error('Test Step 5 Failed:', err);
  process.exit(1);
});
