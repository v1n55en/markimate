// Test Billing & Midtrans: Leak Guard, Admin Activation, Snap Creation & Webhook
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto, { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-billing-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_orders: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { createSnapTransaction, handleMidtransWebhook, TOPUP_PACKAGES } = await import('../lib/midtrans.js');

let baseUrl;
const TEST_ADMIN_KEY = 'test-admin-secret-billing-' + Date.now();

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

async function runBillingTests() {
  console.log('=== RUNNING TEST BILLING & MIDTRANS (Leak Guard, Admin Endpoints & Webhooks) ===');

  process.env.JWT_SECRET = 'test-secret-key-billing';
  process.env.PORT = '5016';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5016';
  delete process.env.BILLING_DUMMY;

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  // 1. Registrasi user uji & verifikasi akun
  console.log('1. Mendaftarkan user uji...');
  const testEmail = `billing-test-${Date.now()}@example.com`;
  const dummyPass = ['Test', 'Pass', '12345', '!'].join('');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: dummyPass, brandName: 'Brand Uji Leak', acceptTerms: true }
  });
  assert.strictEqual(regRes.status, 200);

  const userRow = await db.findOne('accounts', { email: testEmail });
  await req(`/api/admin/users/${userRow.id}/verify`, {
    method: 'POST',
    headers: adminHeaders
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: dummyPass }
  });
  assert.strictEqual(loginRes.status, 200);
  const token = loginRes.data.accessToken || loginRes.data.token;
  const user = loginRes.data.user;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Leak Guard: POST /api/billing/checkout ditolak 403 saat produksi (BILLING_DUMMY tidak aktif)
  console.log('2. Menguji penolakan checkout di produksi (403 BILLING_DISABLED)...');
  const leakRes = await req('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { plan: 'seo', method: 'qris' }
  });
  assert.strictEqual(leakRes.status, 403);
  assert.strictEqual(leakRes.data.code, 'BILLING_DISABLED');

  const creditCheck1 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck1.data.balance.sub, 0);
  assert.strictEqual(creditCheck1.data.balance.total, 300);

  // 3. Mode Dev Lokal: POST /api/billing/checkout berhasil saat BILLING_DUMMY=true
  console.log('3. Menguji checkout simulasi (mode dev)...');
  process.env.BILLING_DUMMY = 'true';
  const dummyRes = await req('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { plan: 'seo', method: 'qris' }
  });
  assert.strictEqual(dummyRes.status, 200);
  assert.strictEqual(dummyRes.data.user.plan, 'seo');

  const creditCheck2 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck2.data.balance.sub, 1500);
  delete process.env.BILLING_DUMMY;

  // 4. Admin Subscriptions Endpoint
  console.log('4. Menguji endpoint POST /api/admin/subscriptions...');
  const noKeySub = await req('/api/admin/subscriptions', {
    method: 'POST',
    body: { email: testEmail, plan: 'focus3', months: 1 }
  });
  assert.strictEqual(noKeySub.status, 401);

  const notFoundSub = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: { email: 'nonexistent@example.com', plan: 'focus3', months: 1 }
  });
  assert.strictEqual(notFoundSub.status, 404);

  const invalidPlanSub = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: { email: testEmail, plan: 'free', months: 1 }
  });
  assert.strictEqual(invalidPlanSub.status, 400);

  const successSub = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: { email: testEmail, plan: 'focus3', months: 1 }
  });
  assert.strictEqual(successSub.status, 200);
  assert.strictEqual(successSub.data.user.plan, 'focus3');
  assert.strictEqual(successSub.data.creditsGranted, 3200);

  // 5. Admin Credit Grant Endpoint
  console.log('5. Menguji endpoint POST /api/admin/credits/grant...');
  const noKeyGrant = await req('/api/admin/credits/grant', {
    method: 'POST',
    body: { email: testEmail, bucket: 'topup', amount: 500, days: 30 }
  });
  assert.strictEqual(noKeyGrant.status, 401);

  const grantRes = await req('/api/admin/credits/grant', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      email: testEmail,
      bucket: 'topup',
      amount: 500,
      days: 60,
      note: 'Akun Reviewer Shopee & TikTok'
    }
  });
  assert.strictEqual(grantRes.status, 200);
  assert.strictEqual(grantRes.data.granted.amount, 500);
  assert.strictEqual(grantRes.data.granted.bucket, 'topup');

  // 6. Midtrans Snap Creation & Webhook Handler
  console.log('6. Menguji createSnapTransaction & Webhook Midtrans...');
  const snapRes = await createSnapTransaction(userRow, 'growth');
  assert.ok(snapRes.orderId);
  assert.strictEqual(snapRes.package.price, 1000000);
  assert.strictEqual(snapRes.package.credits, 1050);

  // Simulasi notifikasi settlement dari Midtrans
  const mockWebhookPayload = {
    order_id: snapRes.orderId,
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: '1000000.00',
    signature_key: 'mock-sig-key',
    fraud_status: 'accept',
    payment_type: 'qris'
  };

  const webhookRes = await req('/api/webhooks/midtrans', {
    method: 'POST',
    body: mockWebhookPayload
  });
  assert.strictEqual(webhookRes.status, 200);
  assert.strictEqual(webhookRes.data.status, 'ok');
  assert.strictEqual(webhookRes.data.paid, true);

  // Idempotensi webhook: Kirim ulang settlement yang sama
  const webhookResRepeat = await req('/api/webhooks/midtrans', {
    method: 'POST',
    body: mockWebhookPayload
  });
  assert.strictEqual(webhookResRepeat.status, 200);
  assert.strictEqual(webhookResRepeat.data.alreadyPaid, true);

  console.log('✅ ALL BILLING & MIDTRANS TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runBillingTests().catch(err => {
  console.error('❌ Billing Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
