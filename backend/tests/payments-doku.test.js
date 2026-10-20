// Test DOKU Checkout & Provider Layer: Signature Vectors, Catalog, Topup, Checkout, Webhooks, Idempotency & Reconciliation
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-doku-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_orders: [],
    payments: [], subscriptions: [], webhook_events: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { DokuPaymentProvider } = await import('../lib/payments/doku.js');
const { MockPaymentProvider } = await import('../lib/payments/mock.js');
const { setProvider } = await import('../lib/payments/index.js');
const { generateInvoiceNumber } = await import('../lib/payments/service.js');

let baseUrl;
const TEST_ADMIN_KEY = 'test-admin-secret-doku-long-key-32chars!';

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

async function runDokuPaymentsTests() {
  console.log('=== RUNNING TEST PAYMENTS DOKU (Signature, Catalog, Checkout, Webhook, Idempotency & Reconcile) ===');

  process.env.JWT_SECRET = 'test-secret-key-doku';
  process.env.PORT = '5019';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'test-cron-secret-key-999';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5019';
  process.env.PAYMENT_PROVIDER = 'mock';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  // ----------------------------------------------------
  // 1. Unit Test Signature DOKU Checkout (PRD F14 §3)
  // ----------------------------------------------------
  console.log('1. Menguji Test Vector Signature DOKU Checkout (Non-SNAP)...');
  const testSecretKey = 'SK-sample-secret-key-12345';
  const testClientId = 'CLIENT-sample-id-67890';
  const testRequestId = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
  const testTimestamp = '2026-10-20T08:00:00Z';
  const testPath = '/checkout/v1/payment';
  const testBody = JSON.stringify({ order: { amount: 500000, invoice_number: 'MKM-T-261020-TEST01' } });

  const dokuAdapter = new DokuPaymentProvider({
    clientId: testClientId,
    secretKey: testSecretKey,
    env: 'sandbox'
  });

  const digest = dokuAdapter.calculateDigest(testBody);
  const expectedDigest = crypto.createHash('sha256').update(testBody).digest('base64');
  assert.strictEqual(digest, expectedDigest, 'Digest harus berupa base64 sha256 dari raw body');

  const component = `Client-Id:${testClientId}\nRequest-Id:${testRequestId}\nRequest-Timestamp:${testTimestamp}\nRequest-Target:${testPath}\nDigest:${digest}`;
  const expectedSignature = 'HMACSHA256=' + crypto.createHmac('sha256', testSecretKey).update(component).digest('base64');

  const generatedSignature = dokuAdapter.generateSignature({
    clientId: testClientId,
    requestId: testRequestId,
    timestamp: testTimestamp,
    requestTarget: testPath,
    digest,
    secretKey: testSecretKey
  });
  assert.strictEqual(generatedSignature, expectedSignature, 'Signature harus cocok persis dengan formula HMAC-SHA256 DOKU');

  // Test verifikasi notifikasi webhook DOKU
  const webhookSignature = dokuAdapter.generateSignature({
    clientId: testClientId,
    requestId: testRequestId,
    timestamp: testTimestamp,
    requestTarget: '/api/webhooks/doku',
    digest,
    secretKey: testSecretKey
  });

  const validMockReq = {
    headers: {
      'client-id': testClientId,
      'request-id': testRequestId,
      'request-timestamp': testTimestamp,
      'signature': webhookSignature
    },
    originalUrl: '/api/webhooks/doku',
    rawBody: testBody,
    body: JSON.parse(testBody)
  };
  assert.strictEqual(dokuAdapter.verifyNotification(validMockReq), true, 'Verifikasi notification dengan signature valid harus true');

  const invalidMockReq = {
    headers: {
      'client-id': testClientId,
      'request-id': testRequestId,
      'request-timestamp': testTimestamp,
      'signature': 'HMACSHA256=invalid-signature'
    },
    originalUrl: '/api/webhooks/doku',
    rawBody: testBody,
    body: JSON.parse(testBody)
  };
  assert.strictEqual(dokuAdapter.verifyNotification(invalidMockReq), false, 'Verifikasi notification dengan signature palsu harus false');

  // Format invoice check
  const topupInv = generateInvoiceNumber('topup');
  assert.ok(topupInv.startsWith('MKM-T-'), `Topup invoice harus diawali MKM-T-, dapat: ${topupInv}`);
  const subInv = generateInvoiceNumber('subscription');
  assert.ok(subInv.startsWith('MKM-S-'), `Sub invoice harus diawali MKM-S-, dapat: ${subInv}`);

  // ----------------------------------------------------
  // 2. Registrasi User & Pengujian Katalog
  // ----------------------------------------------------
  console.log('2. Mendaftarkan user uji dan menguji GET /api/billing/catalog...');
  const testEmail = `doku-user-${Date.now()}@example.com`;
  const dummyPass = ['Test', 'Pass', '12345', '!'].join('');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: dummyPass, brandName: 'Brand Doku Test', acceptTerms: true }
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
  const authHeaders = { Authorization: `Bearer ${token}` };

  const catalogRes = await req('/api/billing/catalog');
  assert.strictEqual(catalogRes.status, 200);
  assert.strictEqual(catalogRes.data.currency, 'IDR');
  assert.ok(Array.isArray(catalogRes.data.topupPackages));
  assert.ok(Array.isArray(catalogRes.data.plans));
  assert.strictEqual(catalogRes.data.topupPackages.length, 3);

  // ----------------------------------------------------
  // 3. Top-Up Credit via DOKU Checkout
  // ----------------------------------------------------
  console.log('3. Menguji pembuatan order Top-Up Credit (POST /api/billing/topup)...');
  const mockProvider = new MockPaymentProvider();
  setProvider(mockProvider);

  const topupRes = await req('/api/billing/topup', {
    method: 'POST',
    headers: authHeaders,
    body: { packageId: 'growth' }
  });
  assert.strictEqual(topupRes.status, 200);
  assert.ok(topupRes.data.checkoutUrl);
  assert.ok(topupRes.data.invoiceNumber.startsWith('MKM-T-'));
  const topupInvoice = topupRes.data.invoiceNumber;

  const paymentRecord = await db.findOne('payments', { invoice_number: topupInvoice });
  assert.ok(paymentRecord);
  assert.strictEqual(paymentRecord.status, 'pending');
  assert.strictEqual(paymentRecord.amount, 1000000);
  assert.strictEqual(paymentRecord.credits, 1050);

  // Cek GET /api/billing/payments/:invoice
  const paymentDetailRes = await req(`/api/billing/payments/${topupInvoice}`, {
    headers: authHeaders
  });
  assert.strictEqual(paymentDetailRes.status, 200);
  assert.strictEqual(paymentDetailRes.data.invoiceNumber, topupInvoice);
  assert.strictEqual(paymentDetailRes.data.status, 'pending');

  // ----------------------------------------------------
  // 4. Webhook Notifikasi & Idempotensi
  // ----------------------------------------------------
  console.log('4. Menguji Webhook Notifikasi & Idempotensi (POST /api/webhooks/doku)...');
  // 4a. Signature invalid ditolak 401
  const badSigWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: { Signature: 'invalid-signature' },
    body: { order: { invoice_number: topupInvoice }, status: 'SUCCESS' }
  });
  assert.strictEqual(badSigWebhookRes.status, 401);

  // 4b. Webhook sukses diterima
  const goodWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: { Signature: 'valid' },
    body: {
      order: { invoice_number: topupInvoice },
      status: 'SUCCESS',
      transaction: { status: 'SUCCESS', date: new Date().toISOString() },
      method: 'QRIS'
    }
  });
  assert.strictEqual(goodWebhookRes.status, 200);
  assert.strictEqual(goodWebhookRes.data.paymentStatus, 'paid');

  // Verifikasi saldo top-up bertambah
  const walletCheck1 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(walletCheck1.data.balance.topup, 1050);

  const updatedPayment = await db.findOne('payments', { invoice_number: topupInvoice });
  assert.strictEqual(updatedPayment.status, 'paid');
  assert.ok(updatedPayment.fulfilled_at);

  // 4c. Notifikasi berulang (idempoten)
  const repeatWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: { Signature: 'valid' },
    body: {
      order: { invoice_number: topupInvoice },
      status: 'SUCCESS',
      transaction: { status: 'SUCCESS' }
    }
  });
  assert.strictEqual(repeatWebhookRes.status, 200);
  assert.strictEqual(repeatWebhookRes.data.status, 'already_processed');

  // Saldo tidak boleh dobel
  const walletCheck2 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(walletCheck2.data.balance.topup, 1050);

  // ----------------------------------------------------
  // 5. Beli Paket Langganan via DOKU Checkout
  // ----------------------------------------------------
  console.log('5. Menguji Checkout Langganan Paket (POST /api/billing/checkout)...');
  const subCheckoutRes = await req('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { plan: 'focus3' }
  });
  assert.strictEqual(subCheckoutRes.status, 200);
  assert.ok(subCheckoutRes.data.checkoutUrl);
  assert.ok(subCheckoutRes.data.invoiceNumber.startsWith('MKM-S-'));
  const subInvoice = subCheckoutRes.data.invoiceNumber;

  // Kirim webhook sukses untuk langganan
  const subWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: { Signature: 'valid' },
    body: {
      order: { invoice_number: subInvoice },
      status: 'SUCCESS',
      transaction: { status: 'SUCCESS', date: new Date().toISOString() },
      method: 'VIRTUAL_ACCOUNT'
    }
  });
  assert.strictEqual(subWebhookRes.status, 200);
  assert.strictEqual(subWebhookRes.data.paymentStatus, 'paid');

  // Verifikasi langganan aktif, kredit balance_sub masuk (3200), dan entitlement 3 modul aktif
  const walletCheckSub = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(walletCheckSub.data.balance.sub, 3200);

  const subEntitlements = await db.findMany('module_entitlements', { workspace_id: userRow.id });
  const activeModules = subEntitlements.filter(e => e.active).map(e => e.module);
  assert.ok(activeModules.includes('seo'));
  assert.ok(activeModules.includes('ads_report'));
  assert.ok(activeModules.includes('ads_spy'));

  // ----------------------------------------------------
  // 6. Riwayat Pembayaran (GET /api/billing/payments)
  // ----------------------------------------------------
  console.log('6. Menguji GET /api/billing/payments...');
  const paymentsListRes = await req('/api/billing/payments', {
    headers: authHeaders
  });
  assert.strictEqual(paymentsListRes.status, 200);
  assert.ok(Array.isArray(paymentsListRes.data.payments));
  assert.strictEqual(paymentsListRes.data.payments.length, 2);

  // ----------------------------------------------------
  // 7. Rekonsiliasi Pembayaran (GET /api/cron/payments-reconcile)
  // ----------------------------------------------------
  console.log('7. Menguji Rekonsiliasi Cron (/api/cron/payments-reconcile)...');
  // Tanpa auth cron secret -> 401
  const unauthCron = await req('/api/cron/payments-reconcile');
  assert.strictEqual(unauthCron.status, 401);

  // Buat payment pending yang sudah lewat 3 menit
  const pendingOldInvoice = generateInvoiceNumber('topup');
  const pastTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const futureExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.insert('payments', {
    workspace_id: userRow.id,
    user_id: userRow.id,
    kind: 'topup',
    item_id: 'starter',
    item_name: 'Starter Pack',
    amount: 500000,
    currency: 'IDR',
    credits: 500,
    period_days: 365,
    provider: 'mock',
    invoice_number: pendingOldInvoice,
    status: 'pending',
    created_at: pastTime,
    updated_at: pastTime,
    expires_at: futureExpires
  });

  // Mock status provider mengembalikan 'paid'
  mockProvider.setMockStatus(pendingOldInvoice, 'paid', 'MOCK_QRIS');

  const cronRes = await req('/api/cron/payments-reconcile', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  assert.strictEqual(cronRes.status, 200);
  assert.strictEqual(cronRes.data.result.fulfilled, 1);

  const reconciledPayment = await db.findOne('payments', { invoice_number: pendingOldInvoice });
  assert.strictEqual(reconciledPayment.status, 'paid');
  assert.ok(reconciledPayment.fulfilled_at);

  console.log('✅ ALL DOKU PAYMENTS TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runDokuPaymentsTests().catch(err => {
  console.error('❌ DOKU Payments Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
