// Test PRD F15 Langkah 5: Top-up Custom Credits, Validasi Min/Max, Diskon Otomatis & Amount Manipulation Resistance
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-topup-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_orders: [],
    payments: [], subscriptions: [], webhook_events: [], monthly_grants: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { DokuPaymentProvider } = await import('../lib/payments/doku.js');
const { setProvider } = await import('../lib/payments/index.js');
const { TOPUP, quoteTopup } = await import('../lib/catalog.js');

let baseUrl;
const TEST_CLIENT_ID = 'CLIENT-topup-test-123';
const TEST_SECRET_KEY = 'SK-topup-test-456';

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

function makeDokuWebhookHeaders(bodyObj, options = {}) {
  const reqId = options.requestId || randomUUID();
  const ts = options.timestamp || new Date().toISOString().slice(0, 19) + 'Z';
  const rawBody = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const dokuHelper = new DokuPaymentProvider({
    clientId: TEST_CLIENT_ID,
    secretKey: TEST_SECRET_KEY,
    env: 'sandbox'
  });
  const digest = dokuHelper.calculateDigest(rawBody);
  const signature = dokuHelper.generateSignature({
    clientId: TEST_CLIENT_ID,
    requestId: reqId,
    timestamp: ts,
    requestTarget: '/api/webhooks/doku',
    digest,
    secretKey: TEST_SECRET_KEY
  });

  return {
    'Client-Id': TEST_CLIENT_ID,
    'Request-Id': reqId,
    'Request-Timestamp': ts,
    'Signature': signature,
    'Content-Type': 'application/json'
  };
}

async function runCustomTopupTests() {
  console.log('=== RUNNING TEST CUSTOM TOP-UP & VALIDATION (PRD F15 Langkah 5) ===');

  process.env.JWT_SECRET = 'test-secret-key-topup-min-32chars!';
  process.env.PORT = '5021';
  process.env.CREDITS_ENABLED = 'true';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5021';
  process.env.PAYMENT_PROVIDER = 'doku';
  process.env.DOKU_CLIENT_ID = TEST_CLIENT_ID;
  process.env.DOKU_SECRET_KEY = TEST_SECRET_KEY;

  const TEST_ADMIN_KEY = 'admin-secret-topup-test-32chars!';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  // 1. Registrasi user & autentikasi
  console.log('1. Mendaftarkan user uji...');
  const userEmail = `topupowner.${Date.now()}@testmarkimate.id`;
  const dummyPass = 'TopupPass123!';
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Custom Topup Tester',
      email: userEmail,
      password: dummyPass,
      brandName: 'Topup Brand Test',
      websiteUrl: 'https://topuptest.com',
      acceptTerms: true
    }
  });
  assert.strictEqual(regRes.status, 200);

  const user = await db.findOne('accounts', { email: userEmail });
  await req(`/api/admin/users/${user.id}/verify`, { method: 'POST', headers: adminHeaders });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: dummyPass }
  });
  assert.strictEqual(loginRes.status, 200);
  const authHeaders = { Authorization: `Bearer ${loginRes.data.accessToken || loginRes.data.token}` };

  const meRes = await req('/api/me', { headers: authHeaders });
  const workspaceId = meRes.data.activeWorkspaceId || meRes.data.activeWorkspace?.id;
  assert.ok(workspaceId);

  // Mock DOKU checkout adapter
  const fakeDoku = new DokuPaymentProvider({
    clientId: TEST_CLIENT_ID,
    secretKey: TEST_SECRET_KEY,
    env: 'sandbox'
  });
  fakeDoku.createCheckout = async ({ invoiceNumber }) => ({
    checkoutUrl: `https://checkout.sandbox.doku.com/${invoiceNumber}`,
    providerRef: `TOK-${randomUUID().slice(0, 8)}`,
    expiresAt: new Date(Date.now() + 3600e3).toISOString()
  });
  setProvider(fakeDoku);

  // 2. Validasi Batas Minimum (< 50 credit)
  console.log('2. Menguji validasi batas minimum top-up (credits < 50 ditolak)...');
  const min49Res = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: 49 }
  });
  assert.strictEqual(min49Res.status, 400, 'Top-up 49 credit harus ditolak 400');
  assert.strictEqual(min49Res.data.code, 'INVALID_TOPUP_AMOUNT');

  const minZeroRes = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: 0 }
  });
  assert.strictEqual(minZeroRes.status, 400);
  assert.strictEqual(minZeroRes.data.code, 'INVALID_TOPUP_AMOUNT');

  const minNegativeRes = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: -100 }
  });
  assert.strictEqual(minNegativeRes.status, 400);
  assert.strictEqual(minNegativeRes.data.code, 'INVALID_TOPUP_AMOUNT');

  // 3. Validasi Batas Maksimum (> 50.000 credit)
  console.log('3. Menguji validasi batas maksimum top-up (credits > 50.000 ditolak)...');
  const maxRes = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: 50001 }
  });
  assert.strictEqual(maxRes.status, 400, 'Top-up 50.001 credit harus ditolak 400');
  assert.strictEqual(maxRes.data.code, 'INVALID_TOPUP_AMOUNT');

  // 4. Pengujian Top-Up Normal & Kriteria PRD F15: 75 credit -> Rp75.000
  console.log('4. Menguji top-up 75 credit (Rp75.000) dan manipulasi amount client diabaikan...');
  const res75 = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    // Client iseng mencoba mengirim amount yang lebih kecil (Rp1.000)
    body: { credits: 75, amount: 1000 }
  });
  assert.strictEqual(res75.status, 200, 'Top-up 75 credit harus berhasil 200 OK');
  assert.strictEqual(res75.data.amount, 75000, 'Server wajib mengabaikan amount client & menagih Rp75.000');
  assert.ok(res75.data.invoiceNumber.startsWith('MKM-T-'));

  const payment75 = await db.findOne('payments', { invoice_number: res75.data.invoiceNumber });
  assert.strictEqual(payment75.amount, 75000);
  assert.strictEqual(payment75.credits, 75);
  assert.strictEqual(payment75.kind, 'topup');

  // 5. Pengujian Diskon Otomatis Tier 1: 1.000 credit -> Diskon 5% -> Rp950.000
  console.log('5. Menguji diskon otomatis tier 1: 1.000 credit -> diskon 5% -> Rp950.000...');
  const res1000 = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: 1000 }
  });
  assert.strictEqual(res1000.status, 200);
  assert.strictEqual(res1000.data.amount, 950000, 'Top-up 1.000 credit harus mendapat diskon 5% (Rp950.000)');

  // 6. Pengujian Diskon Otomatis Tier 2: 2.500 credit -> Diskon 10% -> Rp2.250.000
  console.log('6. Menguji diskon otomatis tier 2: 2.500 credit -> diskon 10% -> Rp2.250.000...');
  const res2500 = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { credits: 2500 }
  });
  assert.strictEqual(res2500.status, 200);
  assert.strictEqual(res2500.data.amount, 2250000, 'Top-up 2.500 credit harus mendapat diskon 10% (Rp2.250.000)');

  // 7. Pengujian Fulfillment Webhook DOKU untuk Custom Top-up
  console.log('7. Menguji fulfillment custom top-up 75 credit via webhook...');
  const webhook75 = {
    order: {
      invoice_number: res75.data.invoiceNumber,
      amount: 75000
    },
    transaction: {
      status: 'SUCCESS',
      date: new Date().toISOString()
    },
    payment: {
      payment_method_type: 'QRIS'
    }
  };

  const hookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhook75),
    body: webhook75
  });
  assert.strictEqual(hookRes.status, 200);
  assert.strictEqual(hookRes.data.status, 'ok');

  const wallet = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(wallet.balance_topup, 75, 'Saldo topup harus bertambah 75 credit');

  // 8. Backward Compatibility: Dukungan paket lama { packageId: 'starter' }
  console.log('8. Menguji backward compatibility { packageId: "starter" }...');
  const resStarter = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { packageId: 'starter' }
  });
  assert.strictEqual(resStarter.status, 200);
  assert.strictEqual(resStarter.data.amount, 500000);

  console.log('✅ ALL CUSTOM TOP-UP & VALIDATION TESTS PASSED!');
}

runCustomTopupTests()
  .then(() => {
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ CUSTOM TOP-UP TEST FAILED:', err);
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(1);
  });
