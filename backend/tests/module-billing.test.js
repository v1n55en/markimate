// Test PRD F15 Langkah 3: Fulfillment Module + Entitlement Lifetime + Idempotensi granted_at + Bundle Pricing
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-mod-billing-${randomUUID()}.json`);
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
const { fulfillPayment, handleNotification } = await import('../lib/payments/service.js');
const { MODULES, BUNDLES } = await import('../lib/catalog.js');

let baseUrl;
const TEST_CLIENT_ID = 'CLIENT-module-test-12345';
const TEST_SECRET_KEY = 'SK-module-secret-key-67890';

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

async function runModuleBillingTests() {
  console.log('=== RUNNING TEST MODULE BILLING & LIFETIME ENTITLEMENTS (PRD F15 Langkah 3) ===');

  process.env.JWT_SECRET = 'test-secret-key-mod-min-32chars-ok!';
  process.env.PORT = '5020';
  process.env.CREDITS_ENABLED = 'true';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5020';
  process.env.PAYMENT_PROVIDER = 'doku';
  process.env.DOKU_CLIENT_ID = TEST_CLIENT_ID;
  process.env.DOKU_SECRET_KEY = TEST_SECRET_KEY;

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  // 1. Registrasi user & ambil auth token
  console.log('1. Mendaftarkan user uji...');
  const TEST_ADMIN_KEY = 'test-admin-secret-mod-long-key-32chars!';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  const userEmail = `modowner.${Date.now()}@testmarkimate.id`;
  const dummyPass = 'Password123!';
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Lifetime Module Tester',
      email: userEmail,
      password: dummyPass,
      brandName: 'Test Brand Module',
      websiteUrl: 'https://testbrandmod.com',
      acceptTerms: true
    }
  });
  assert.strictEqual(regRes.status, 200, 'Registrasi harus berhasil');

  const user = await db.findOne('accounts', { email: userEmail });
  await req(`/api/admin/users/${user.id}/verify`, {
    method: 'POST',
    headers: adminHeaders
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: userEmail, password: dummyPass }
  });
  assert.strictEqual(loginRes.status, 200, 'Login harus berhasil');
  const token = loginRes.data.accessToken || loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const meRes = await req('/api/me', { headers: authHeaders });
  const workspaceId = meRes.data.activeWorkspaceId || meRes.data.activeWorkspace?.id;
  assert.ok(workspaceId, 'Workspace ID harus ada');

  // 2. Mock DOKU checkout adapter
  const fakeDoku = new DokuPaymentProvider({
    clientId: TEST_CLIENT_ID,
    secretKey: TEST_SECRET_KEY,
    env: 'sandbox'
  });
  fakeDoku.createCheckout = async ({ invoiceNumber, amount }) => ({
    checkoutUrl: `https://checkout.sandbox.doku.com/${invoiceNumber}`,
    providerRef: `TOK-${randomUUID().slice(0, 8)}`,
    expiresAt: new Date(Date.now() + 3600e3).toISOString()
  });
  setProvider(fakeDoku);

  // 3. Menguji POST /api/billing/modules - Pembelian modul SEO ditolak 410 (PRD F16 §3.7 & §7)
  console.log('2. Menguji POST /api/billing/modules (410 MODULE_PURCHASE_DISCONTINUED)...');
  const modRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { module: 'seo' }
  });
  assert.strictEqual(modRes.status, 410, 'Checkout modul SEO harus 410 Gone (PRD F16 §3.7)');
  assert.strictEqual(modRes.data.code, 'MODULE_PURCHASE_DISCONTINUED');

  // 4. Simulasi Pembayaran Modul Lama yang Sudah Pending (Backward Compatibility)
  console.log('3. Menguji Webhook DOKU SUCCESS & Fulfillment Modul SEO Data Lama...');
  const oldInvoiceNumber = 'MKM-M-261020-OLDSEO';
  const paymentSeo = await db.insert('payments', {
    workspace_id: workspaceId,
    user_id: user.id,
    kind: 'module',
    item_id: 'seo',
    item_name: 'SEO Specialist',
    amount: 1990000,
    currency: 'IDR',
    credits: 100,
    period_days: null,
    provider: 'doku',
    invoice_number: oldInvoiceNumber,
    status: 'pending',
    fulfilled_at: null,
    granted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const webhookPayloadSeo = {
    order: {
      invoice_number: oldInvoiceNumber,
      amount: 1990000
    },
    transaction: {
      status: 'SUCCESS',
      date: new Date().toISOString()
    },
    payment: {
      payment_method_type: 'VIRTUAL_ACCOUNT_BCA'
    }
  };

  const hookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhookPayloadSeo),
    body: webhookPayloadSeo
  });
  assert.strictEqual(hookRes.status, 200, 'Webhook harus diterima 200 OK');
  assert.strictEqual(hookRes.data.status, 'ok');

  // Verifikasi DB setelah fulfillment SEO:
  const updatedPaymentSeo = await db.findOne('payments', { id: paymentSeo.id });
  assert.strictEqual(updatedPaymentSeo.status, 'paid');
  assert.ok(updatedPaymentSeo.fulfilled_at, 'fulfilled_at harus terisi');
  assert.ok(updatedPaymentSeo.granted_at, 'granted_at harus terisi sesuai PRD F15/F16');

  const entSeo = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: 'seo' });
  assert.ok(entSeo, 'module_entitlements untuk SEO harus ada');
  assert.strictEqual(entSeo.active, true);
  assert.strictEqual(entSeo.source, 'lifetime');
  assert.strictEqual(entSeo.ends_at, null, 'Modul lifetime ends_at harus null');
  assert.strictEqual(entSeo.payment_id, paymentSeo.id);

  // PRD F16 §3.5: Verifikasi wallet tidak mendapat kuota bulanan karena grant bulanan telah dihapus
  const walletAfterSeo = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(walletAfterSeo?.balance_sub || 0, 0, 'Wallet tidak mendapat kredit bulanan karena kuota bulanan dihapus (PRD F16)');

  // 5. Menguji Idempotensi Fulfillment & Webhook Duplikat Modul Lama
  console.log('4. Menguji Idempotensi Webhook duplikat (pencegahan double grant)...');
  const hookDupRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhookPayloadSeo),
    body: webhookPayloadSeo
  });
  assert.strictEqual(hookDupRes.status, 200);
  assert.strictEqual(hookDupRes.data.status, 'already_processed', 'Webhook event duplikat harus dideteksi');

  // Direct re-fulfillment test
  const reFulfill = await fulfillPayment(updatedPaymentSeo);
  assert.strictEqual(reFulfill.fulfilled, false, 'Re-fulfillment harus ditolak secara idempoten');

  const walletAfterDup = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(walletAfterDup?.balance_sub || 0, 0, 'Saldo wallet sub tetap 0 saat webhook/fulfillment diulang');
  // 10. Menguji reconcile memulihkan baris paid + fulfilled_at terisi + granted_at null (tanpa re-claim)
  console.log('10. Menguji reconcile memulihkan baris paid + fulfilled_at terisi + granted_at null...');
  const wsReconcileId = randomUUID();
  await db.insert('workspaces', {
    id: wsReconcileId,
    owner_user_id: user.id,
    name: 'Workspace Reconcile Recovery'
  });
  await db.insert('workspace_members', {
    workspace_id: wsReconcileId,
    user_id: user.id,
    role: 'admin',
    joined_at: new Date().toISOString()
  });

  const stuckPaymentId = randomUUID();
  const invoiceStuck = 'MKM-M-TEST-RECON-001';
  await db.insert('payments', {
    id: stuckPaymentId,
    workspace_id: wsReconcileId,
    user_id: user.id,
    kind: 'module',
    item_id: 'ads_spy',
    item_name: 'Ads Spy',
    amount: 1490000,
    invoice_number: invoiceStuck,
    provider: 'doku',
    status: 'paid',
    fulfilled_at: new Date().toISOString(),
    granted_at: null,
    created_at: new Date().toISOString()
  });

  // Sebelum reconcile, belum ada entitlement ads_spy
  const entBefore = await db.findOne('module_entitlements', { workspace_id: wsReconcileId, module: 'ads_spy' });
  assert.strictEqual(entBefore, null, 'Sebelum reconcile, entitlement belum ada');

  // Jalankan reconcile
  const { reconcile } = await import('../lib/payments/service.js');
  const recResult = await reconcile();
  assert(recResult.fulfilled >= 1, 'Reconcile harus memulihkan setidaknya 1 payment');

  // Setelah reconcile: modul ads_spy aktif lifetime dan granted_at terisi
  const entAfter = await db.findOne('module_entitlements', { workspace_id: wsReconcileId, module: 'ads_spy' });
  assert.ok(entAfter, 'Entitlement ads_spy harus aktif setelah reconcile');
  assert.strictEqual(entAfter.active, true);
  assert.strictEqual(entAfter.source, 'lifetime');
  assert.strictEqual(entAfter.ends_at, null);

  const paymentAfterRec = await db.findOne('payments', { id: stuckPaymentId });
  assert.ok(paymentAfterRec.granted_at, 'granted_at harus terisi setelah reconcile');

  // Reconcile kedua kali -> idempoten, modul tetap aktif 1x dan tidak error
  await reconcile();
  const entAfter2 = await db.findOne('module_entitlements', { workspace_id: wsReconcileId, module: 'ads_spy' });
  assert.strictEqual(entAfter2.source, 'lifetime');

  console.log('✅ ALL MODULE BILLING & LIFETIME ENTITLEMENTS TESTS PASSED!');
}

runModuleBillingTests()
  .then(() => {
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ MODULE BILLING TEST FAILED:', err);
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(1);
  });
