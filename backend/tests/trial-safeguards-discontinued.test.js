// Test Pengaman Trial 30 Hari & Hapus Langganan Lama 410 PLAN_DISCONTINUED (PRD F15 Langkah 6)
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-step6-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_trials: [],
    payments: [], monthly_grants: [], subscriptions: [], webhook_events: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { TRIAL_CONFIG, TRIAL_DAYS, SYSTEM_WORKSPACE_ID } = await import('../lib/config.js');
const { FREE_MONTHLY_LIMIT, PLANS } = await import('../lib/plans.js');
const { grantTrialIfEligible, getWallet } = await import('../lib/credits.js');
const { createCheckout } = await import('../lib/payments/service.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step6-' + Date.now();

async function req(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });

  const data = await res.json().catch(() => null);
  return {
    status: res.status,
    ok: res.ok,
    data
  };
}

async function runStep6Tests() {
  console.log('=== RUNNING TEST PRD F15 LANGKAH 6 (Trial Safeguards & 410 Discontinued) ===');

  await seedCreditPricesAndRates();

  // 1. Verifikasi Config Trial 30 Hari & Free Tier Limit 0
  console.log('1. Memverifikasi TRIAL_CONFIG dan penghapusan free tier...');
  assert.strictEqual(TRIAL_CONFIG.days, 30, 'TRIAL_CONFIG.days must be 30');
  assert.strictEqual(TRIAL_DAYS, 30, 'TRIAL_DAYS must be 30');
  assert.strictEqual(TRIAL_CONFIG.credits, 300, 'TRIAL_CONFIG.credits must be 300');
  assert.strictEqual(FREE_MONTHLY_LIMIT, 0, 'FREE_MONTHLY_LIMIT must be 0');
  assert.strictEqual(PLANS.free.monthlyArticles, 0, 'PLANS.free monthlyArticles must be 0');
  for (const [k, p] of Object.entries(PLANS)) {
    assert.strictEqual(p.price, undefined, `PLANS.${k}.price must be deleted`);
  }
  console.log('   OK - Config trial 30 hari & free tier 0 terverifikasi.');

  // 2. Verifikasi grantTrialIfEligible 30 hari
  console.log('2. Memverifikasi alokasi trial 30 hari...');
  const ws1 = randomUUID();
  const email1 = 'user1.step6@test.id';
  const trial1 = await grantTrialIfEligible(ws1, email1, null, { clientIp: '192.168.1.1' });
  assert.strictEqual(trial1.granted, true);
  assert.strictEqual(trial1.credits, 300);
  assert.strictEqual(trial1.days, 30);
  const diffDays = Math.round((new Date(trial1.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000));
  assert.strictEqual(diffDays, 30, 'Trial expiration must be ~30 days in the future');

  const { activeBuckets } = await getWallet(ws1);
  assert.strictEqual(activeBuckets.trial, 300, 'Wallet must receive 300 trial credits');
  console.log('   OK - Trial berhasil dialokasikan 300 kredit selama 30 hari.');

  // 3. Pengaman 1x per email terverifikasi
  console.log('3. Menguji pengaman 1x per email terverifikasi...');
  const trialRepeatEmail = await grantTrialIfEligible(randomUUID(), email1, null, { clientIp: '192.168.1.1' });
  assert.strictEqual(trialRepeatEmail.granted, false);
  assert.match(trialRepeatEmail.reason, /Trial sudah pernah diklaim untuk email ini/i);
  console.log('   OK - Klaim ulang dengan email yang sama berhasil ditolak.');

  // 4. Pengaman 1x per workspace
  console.log('4. Menguji pengaman 1x per workspace...');
  const trialRepeatWs = await grantTrialIfEligible(ws1, 'different.email@test.id', null, { clientIp: '192.168.1.1' });
  assert.strictEqual(trialRepeatWs.granted, false);
  assert.match(trialRepeatWs.reason, /Trial sudah pernah diklaim untuk workspace ini/i);
  console.log('   OK - Klaim ulang pada workspace yang sama berhasil ditolak.');

  // 5. Pengaman 1x per akun Google
  console.log('5. Menguji pengaman 1x per akun Google (google_sub)...');
  const googleSubShared = 'google-sub-shared-12345';
  const wsGoogle1 = randomUUID();
  const accGoogle1 = await db.insert('accounts', {
    id: wsGoogle1,
    email: 'google.acc1@gmail.com',
    google_sub: googleSubShared,
    status: 'active'
  });
  const trialGoogle1 = await grantTrialIfEligible(wsGoogle1, accGoogle1.email, null, { googleSub: googleSubShared, clientIp: '192.168.1.2' });
  assert.strictEqual(trialGoogle1.granted, true, 'First google claim must succeed');

  // Akun google kedua dengan email berbeda tapi sub sama
  const wsGoogle2 = randomUUID();
  const accGoogle2 = await db.insert('accounts', {
    id: wsGoogle2,
    email: 'google.acc2@gmail.com',
    google_sub: googleSubShared,
    status: 'active'
  });
  const trialGoogle2 = await grantTrialIfEligible(wsGoogle2, accGoogle2.email, null, { googleSub: googleSubShared, clientIp: '192.168.1.2' });
  assert.strictEqual(trialGoogle2.granted, false);
  assert.match(trialGoogle2.reason, /Trial sudah pernah diklaim untuk akun Google ini/i);
  console.log('   OK - Klaim ulang dengan akun Google (google_sub) yang sama berhasil ditolak.');

  // 6. Alert admin kalau ada >5 pendaftaran trial dari IP yang sama dalam 24 jam
  console.log('6. Menguji deteksi abuse >5 pendaftaran trial dari IP yang sama...');
  const abuseIp = '203.0.113.99';
  for (let i = 1; i <= 5; i++) {
    const wsI = randomUUID();
    const emailI = `abuse.${i}@test.id`;
    const resI = await grantTrialIfEligible(wsI, emailI, null, { clientIp: abuseIp });
    assert.strictEqual(resI.granted, true);
  }
  // Sampai 5 klaim, belum ada alert
  const alertsBefore = await db.findMany('credit_alerts', { alert_type: 'trial_abuse_ip' });
  assert.strictEqual(alertsBefore.length, 0, 'No alert should be fired at 5 claims');

  // Klaim ke-6 dari IP yang sama -> memicu alert
  const ws6 = randomUUID();
  const res6 = await grantTrialIfEligible(ws6, 'abuse.6@test.id', null, { clientIp: abuseIp });
  assert.strictEqual(res6.granted, true);

  const alertsAfter = await db.findMany('credit_alerts', { alert_type: 'trial_abuse_ip' });
  assert.strictEqual(alertsAfter.length, 1, 'Alert must be recorded in credit_alerts after 6th claim from same IP');
  assert.strictEqual(alertsAfter[0].metadata?.ip, abuseIp);
  assert.strictEqual(alertsAfter[0].metadata?.count, 6);

  // Klaim ke-7 dari IP yang sama -> idempoten, alert tidak diduplikasi
  const ws7 = randomUUID();
  await grantTrialIfEligible(ws7, 'abuse.7@test.id', null, { clientIp: abuseIp });
  const alertsAfter7 = await db.findMany('credit_alerts', { alert_type: 'trial_abuse_ip' });
  assert.strictEqual(alertsAfter7.length, 1, 'Alert must remain 1 (idempotent per date/ip)');
  console.log('   OK - Deteksi abuse IP berhasil memicu notifikasi admin ke credit_alerts secara idempoten.');

  // 7. Penolakan Checkout Langganan Lama di Service (410 PLAN_DISCONTINUED)
  console.log('7. Menguji penolakan createCheckout(subscription)...');
  await assert.rejects(
    async () => {
      await createCheckout({
        kind: 'subscription',
        itemId: 'seo',
        workspaceId: ws1,
        userId: randomUUID()
      });
    },
    (err) => {
      assert.strictEqual(err.status, 410);
      assert.strictEqual(err.code, 'PLAN_DISCONTINUED');
      return true;
    }
  );
  console.log('   OK - createCheckout(subscription) melempar 410 PLAN_DISCONTINUED.');

  // 8. Integrasi HTTP Endpoint /api/billing/checkout & /api/billing/cancel
  console.log('8. Menguji HTTP endpoint langganan lama (410 PLAN_DISCONTINUED)...');
  process.env.JWT_SECRET = 'test-secret-step6';
  process.env.PORT = '5026';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-step6';

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `user.discontinued.${ts}@testmarkimate.id`;
  const password = ['Test', 'Pass', '123!', 'X'].join('');

  await req('/api/auth/register', {
    method: 'POST',
    body: { email: testEmail, password, brandName: 'Brand Discontinued', acceptTerms: true }
  });

  const account = await db.findOne('accounts', { email: testEmail });
  await req(`/api/admin/users/${account.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password }
  });
  const token = loginRes.data.accessToken;

  // Cek /api/billing/checkout -> 410
  const checkoutRes = await req('/api/billing/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { plan: 'seo' }
  });
  assert.strictEqual(checkoutRes.status, 410, '/api/billing/checkout must return 410');
  assert.strictEqual(checkoutRes.data.code, 'PLAN_DISCONTINUED');

  // Cek /api/billing/cancel -> 410
  const cancelRes = await req('/api/billing/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(cancelRes.status, 410, '/api/billing/cancel must return 410');
  assert.strictEqual(cancelRes.data.code, 'PLAN_DISCONTINUED');

  // Cek cron run-scheduled tidak memanggil renewal reminders
  const cronRes = await req(`/api/cron/run-scheduled?secret=${process.env.CRON_SECRET}`, { method: 'GET' });
  assert.strictEqual(cronRes.status, 200);
  assert.strictEqual(cronRes.data.renewalReminders?.status, 'discontinued');

  console.log('   OK - Semua endpoint langganan lama mengembalikan 410 PLAN_DISCONTINUED dan cron pengingat dimatikan.');

  console.log('✅ ALL STEP 6 TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runStep6Tests().catch(err => {
  console.error('❌ Step 6 Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
