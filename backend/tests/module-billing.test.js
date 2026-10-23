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

  // 3. Menguji POST /api/billing/modules - Pembelian modul SEO
  console.log('2. Menguji POST /api/billing/modules (Pembelian single module SEO)...');
  const modRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { module: 'seo' }
  });
  assert.strictEqual(modRes.status, 200, 'Checkout modul SEO harus 200 OK');
  assert.strictEqual(modRes.data.amount, MODULES.seo?.price ?? 1990000, 'Nominal harus sesuai harga lifetime SEO');
  assert.strictEqual(modRes.data.currency, 'IDR');
  assert.ok(modRes.data.invoiceNumber.startsWith('MKM-M-'), `Invoice prefix harus MKM-M-, didapat: ${modRes.data.invoiceNumber}`);

  const paymentSeo = await db.findOne('payments', { invoice_number: modRes.data.invoiceNumber });
  assert.ok(paymentSeo, 'Payment record harus tersimpan di DB');
  assert.strictEqual(paymentSeo.kind, 'module');
  assert.strictEqual(paymentSeo.item_id, 'seo');
  assert.strictEqual(paymentSeo.status, 'pending');
  assert.strictEqual(paymentSeo.granted_at, null);

  // 4. Simulasi Webhook DOKU Payment Success untuk SEO
  console.log('3. Menguji Webhook DOKU SUCCESS & Fulfillment Modul SEO...');
  const webhookPayloadSeo = {
    order: {
      invoice_number: modRes.data.invoiceNumber,
      amount: MODULES.seo?.price ?? 1990000
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
  assert.ok(updatedPaymentSeo.granted_at, 'granted_at harus terisi sesuai PRD F15');

  const entSeo = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: 'seo' });
  assert.ok(entSeo, 'module_entitlements untuk SEO harus ada');
  assert.strictEqual(entSeo.active, true);
  assert.strictEqual(entSeo.source, 'lifetime');
  assert.strictEqual(entSeo.ends_at, null, 'Modul lifetime ends_at harus null');
  assert.strictEqual(entSeo.payment_id, paymentSeo.id);

  // Verifikasi wallet & monthly_grants
  const walletAfterSeo = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(walletAfterSeo.balance_sub, 100, 'Wallet harus mendapat 100 credit bulanan SEO');

  // 5. Menguji Idempotensi Fulfillment & Webhook Duplikat
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
  assert.strictEqual(walletAfterDup.balance_sub, 100, 'Saldo wallet tidak boleh bertambah saat webhook/fulfillment diulang');

  // 6. Menguji Pencegahan Beli Ulang Modul yang Sudah Dimiliki
  console.log('5. Menguji penolakan pembelian ulang modul yang sudah dimiliki...');
  const rebuyRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { module: 'seo' }
  });
  assert.strictEqual(rebuyRes.status, 409, 'Beli modul yang sudah dimiliki harus 409 Conflict');
  assert.strictEqual(rebuyRes.data.code, 'MODULE_ALREADY_OWNED');

  // 7. Menguji Bundle Pricing saat sebagian modul sudah dimiliki
  console.log('6. Menguji Bundle Fokus 3 saat modul SEO sudah dimiliki (diskon & floor price)...');
  // Pastikan workspace HANYA memiliki baris entitlement 'seo'
  // (Hapus baris ads_report & ads_spy dari trial awal agar fulfillment bundle BENAR-BENAR melewati jalur INSERT)
  await db.remove('module_entitlements', { workspace_id: workspaceId, module: 'ads_report' });
  await db.remove('module_entitlements', { workspace_id: workspaceId, module: 'ads_spy' });

  const onlySeoBefore = await db.findMany('module_entitlements', { workspace_id: workspaceId });
  assert.strictEqual(onlySeoBefore.length, 1, 'Workspace harus hanya memiliki 1 baris entitlement sebelum beli bundle');
  assert.strictEqual(onlySeoBefore[0].module, 'seo');

  // Modul dimiliki: seo (Rp1.990.000)
  // Modul belum dimiliki: ads_report (Rp1.990.000) + ads_spy (Rp1.490.000) = Rp3.480.000
  // Discounted = 4.490.000 - 1.990.000 = 2.500.000
  // Floor = 3.480.000 * 0.8 = 2.784.000
  // Final = max(2.500.000, 2.784.000) = 2.784.000
  const expectedBundlePrice = 2784000;

  const bundleRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { bundle: 'focus3' }
  });
  assert.strictEqual(bundleRes.status, 200, 'Checkout bundle harus 200 OK');
  assert.strictEqual(bundleRes.data.amount, expectedBundlePrice, `Harga bundle terdiskon harus Rp${expectedBundlePrice}, didapat: ${bundleRes.data.amount}`);

  // 8. Fulfill Bundle Fokus 3
  console.log('7. Menguji Fulfillment Bundle Fokus 3 (aktivasi modul sisa + upgrade kuota bulanan)...');
  const bundlePayment = await db.findOne('payments', { invoice_number: bundleRes.data.invoiceNumber });
  assert.strictEqual(bundlePayment.kind, 'module');
  assert.strictEqual(bundlePayment.item_id, 'focus3');

  const webhookBundle = {
    order: {
      invoice_number: bundleRes.data.invoiceNumber,
      amount: expectedBundlePrice
    },
    transaction: {
      status: 'SUCCESS',
      date: new Date().toISOString()
    },
    payment: {
      payment_method_type: 'QRIS'
    }
  };

  const hookBundleRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhookBundle),
    body: webhookBundle
  });
  assert.strictEqual(hookBundleRes.status, 200);

  // Verifikasi semua modul lifetime aktif (ketiga modul aktif lifetime)
  // seo melewati UPDATE, ads_report dan ads_spy melewati INSERT dengan created_at
  const entSeoAfter = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: 'seo' });
  const entReport = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: 'ads_report' });
  const entSpy = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: 'ads_spy' });
  assert.strictEqual(entSeoAfter.active, true);
  assert.strictEqual(entSeoAfter.source, 'lifetime');
  assert.strictEqual(entReport.active, true);
  assert.strictEqual(entReport.source, 'lifetime');
  assert.strictEqual(entReport.ends_at, null);
  assert.strictEqual(entReport.payment_id, bundlePayment.id);
  assert.strictEqual(entSpy.active, true);
  assert.strictEqual(entSpy.source, 'lifetime');
  assert.strictEqual(entSpy.ends_at, null);
  assert.strictEqual(entSpy.payment_id, bundlePayment.id);

  // Verifikasi total saldo bulanan upgrade ke 600 (100 + 400 + 100)
  const walletAfterBundle = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(walletAfterBundle.balance_sub, 600, 'Saldo bulanan harus di-upgrade menjadi 600 credit (100+400+100)');

  // 9. Menguji Penolakan Pembelian Bundle saat semua modul sudah dimiliki
  console.log('8. Menguji penolakan pembelian bundle saat semua modul sudah dimiliki...');
  const rebuyBundleRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { bundle: 'focus3' }
  });
  assert.strictEqual(rebuyBundleRes.status, 409, 'Beli bundle saat semua modul dimiliki harus 409 Conflict');
  assert.strictEqual(rebuyBundleRes.data.code, 'MODULE_ALREADY_OWNED');

  // 10. Menguji Penolakan Input Modul / Bundle Tidak Valid
  console.log('9. Menguji validasi input modul / bundle tidak valid...');
  const invalidModRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { module: 'non_existent_module' }
  });
  assert.strictEqual(invalidModRes.status, 400, 'Modul palsu harus 400 Bad Request');
  assert.strictEqual(invalidModRes.data.code, 'INVALID_MODULE');

  const emptyModRes = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: {}
  });
  assert.strictEqual(emptyModRes.status, 400, 'Body kosong harus 400 Bad Request');
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
