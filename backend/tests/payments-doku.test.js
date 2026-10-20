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
const { setProvider, getProvider } = await import('../lib/payments/index.js');
const { generateInvoiceNumber, fulfillPayment, processSubscriptionRenewalReminders } = await import('../lib/payments/service.js');

let baseUrl;
const TEST_ADMIN_KEY = 'test-admin-secret-doku-long-key-32chars!';
const TEST_CLIENT_ID = 'CLIENT-sample-id-67890';
const TEST_SECRET_KEY = 'SK-sample-secret-key-12345';

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
    clientId: options.clientId || TEST_CLIENT_ID,
    secretKey: options.secretKey || TEST_SECRET_KEY,
    env: 'sandbox'
  });
  const digest = dokuHelper.calculateDigest(rawBody);
  const signature = options.invalidSignature
    ? 'HMACSHA256=invalid-signature'
    : dokuHelper.generateSignature({
        clientId: options.clientId || TEST_CLIENT_ID,
        requestId: reqId,
        timestamp: ts,
        requestTarget: '/api/webhooks/doku',
        digest,
        secretKey: options.secretKey || TEST_SECRET_KEY
      });

  return {
    'Client-Id': options.clientId || TEST_CLIENT_ID,
    'Request-Id': reqId,
    'Request-Timestamp': ts,
    'Signature': signature,
    'Content-Type': 'application/json'
  };
}

async function runDokuPaymentsTests() {
  console.log('=== RUNNING TEST PAYMENTS DOKU (Signature, Catalog, Checkout, Webhook, Idempotency & Reconcile) ===');

  process.env.JWT_SECRET = 'test-secret-key-doku-min-32chars-ok!';
  process.env.PORT = '5019';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'test-cron-secret-key-999';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5019';
  process.env.PAYMENT_PROVIDER = 'doku';
  process.env.DOKU_CLIENT_ID = TEST_CLIENT_ID;
  process.env.DOKU_SECRET_KEY = TEST_SECRET_KEY;

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  // ----------------------------------------------------
  // 1. Unit Test Signature DOKU Checkout & Validasi Secret
  // ----------------------------------------------------
  console.log('1. Menguji Test Vector Signature DOKU Checkout (Non-SNAP)...');
  const testRequestId = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
  const testTimestamp = '2026-10-20T08:00:00Z';
  const testPath = '/checkout/v1/payment';
  const testBody = JSON.stringify({ order: { amount: 500000, invoice_number: 'MKM-T-261020-TEST01' } });

  const dokuAdapter = new DokuPaymentProvider({
    clientId: TEST_CLIENT_ID,
    secretKey: TEST_SECRET_KEY,
    env: 'sandbox'
  });

  const digest = dokuAdapter.calculateDigest(testBody);
  const expectedDigest = crypto.createHash('sha256').update(testBody).digest('base64');
  assert.strictEqual(digest, expectedDigest, 'Digest harus berupa base64 sha256 dari raw body');

  const component = `Client-Id:${TEST_CLIENT_ID}\nRequest-Id:${testRequestId}\nRequest-Timestamp:${testTimestamp}\nRequest-Target:${testPath}\nDigest:${digest}`;
  const expectedSignature = 'HMACSHA256=' + crypto.createHmac('sha256', TEST_SECRET_KEY).update(component).digest('base64');

  const generatedSignature = dokuAdapter.generateSignature({
    clientId: TEST_CLIENT_ID,
    requestId: testRequestId,
    timestamp: testTimestamp,
    requestTarget: testPath,
    digest,
    secretKey: TEST_SECRET_KEY
  });
  assert.strictEqual(generatedSignature, expectedSignature, 'Signature harus cocok persis dengan formula HMAC-SHA256 DOKU');

  // Validasi secret kosong menolak webhook & checkout
  const emptyDoku = new DokuPaymentProvider({ clientId: '', secretKey: '' });
  assert.strictEqual(emptyDoku.verifyNotification({ headers: {} }), false, 'Provider tanpa secret wajib menolak webhook');
  await assert.rejects(
    async () => emptyDoku.createCheckout({ invoiceNumber: 'X', amount: 100 }),
    (err) => err.status === 503 && err.code === 'GATEWAY_NOT_CONFIGURED'
  );

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
  // 3. Top-Up Credit Order & Checkout URL
  // ----------------------------------------------------
  console.log('3. Menguji pembuatan order Top-Up Credit (POST /api/billing/topup)...');
  // Mock pemanggilan createCheckout eksternal tanpa mengganggu verifikasi webhook DOKU asli
  dokuAdapter.createCheckout = async (params) => ({
    checkoutUrl: `https://sandbox.doku.com/checkout/${params.invoiceNumber}`,
    providerRef: `DOKU-REF-${params.invoiceNumber}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  setProvider(dokuAdapter);

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

  // ----------------------------------------------------
  // 4. Webhook HTTP Nyata DOKU (Signature, Amount Matching, Idempotency)
  // ----------------------------------------------------
  console.log('4. Menguji Webhook DOKU lewat HTTP sungguhan (/api/webhooks/doku)...');
  const validWebhookPayload = {
    order: { invoice_number: topupInvoice, amount: 1000000 },
    status: 'SUCCESS',
    transaction: { status: 'SUCCESS', date: new Date().toISOString() },
    channel: { id: 'QRIS' }
  };

  // 4a. Signature palsu -> 401
  const badSigHeaders = makeDokuWebhookHeaders(validWebhookPayload, { invalidSignature: true });
  const badSigRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: badSigHeaders,
    body: validWebhookPayload
  });
  assert.strictEqual(badSigRes.status, 401, 'Webhook dengan signature palsu wajib ditolak 401');

  // 4b. Client-Id palsu / beda -> 401
  const fakeClientHeaders = makeDokuWebhookHeaders(validWebhookPayload, { clientId: 'FAKE-CLIENT-ID' });
  const fakeClientRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: fakeClientHeaders,
    body: validWebhookPayload
  });
  assert.strictEqual(fakeClientRes.status, 401, 'Webhook dengan Client-Id asing wajib ditolak 401');

  // 4c. Nominal order.amount tidak cocok -> ignored (amount_mismatch)
  const mismatchPayload = {
    order: { invoice_number: topupInvoice, amount: 250000 }, // DB: 1.000.000
    status: 'SUCCESS'
  };
  const mismatchHeaders = makeDokuWebhookHeaders(mismatchPayload);
  const mismatchRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: mismatchHeaders,
    body: mismatchPayload
  });
  assert.strictEqual(mismatchRes.status, 200);
  assert.strictEqual(mismatchRes.data.reason, 'amount_mismatch');

  // 4c-2. SUCCESS tanpa amount (kosong) -> wajib ditolak (amount_mismatch)
  const missingAmountPayload = {
    order: { invoice_number: topupInvoice }, // amount undefined
    status: 'SUCCESS'
  };
  const missingAmountHeaders = makeDokuWebhookHeaders(missingAmountPayload);
  const missingAmountRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: missingAmountHeaders,
    body: missingAmountPayload
  });
  assert.strictEqual(missingAmountRes.status, 200);
  assert.strictEqual(missingAmountRes.data.reason, 'amount_mismatch', 'SUCCESS notification tanpa amount harus ditolak');

  // 4c-3. SUCCESS dengan amount 0 -> wajib ditolak (amount_mismatch)
  const zeroAmountPayload = {
    order: { invoice_number: topupInvoice, amount: 0 },
    status: 'SUCCESS'
  };
  const zeroAmountHeaders = makeDokuWebhookHeaders(zeroAmountPayload);
  const zeroAmountRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: zeroAmountHeaders,
    body: zeroAmountPayload
  });
  assert.strictEqual(zeroAmountRes.status, 200);
  assert.strictEqual(zeroAmountRes.data.reason, 'amount_mismatch', 'SUCCESS notification dengan amount 0 harus ditolak');

  const paymentStillPending = await db.findOne('payments', { invoice_number: topupInvoice });
  assert.strictEqual(paymentStillPending.status, 'pending', 'Payment nominal mismatch harus tetap pending');

  // 4d. Webhook valid resmi DOKU -> 200, paid, kredit bertambah
  const goodHeaders = makeDokuWebhookHeaders(validWebhookPayload);
  const goodWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: goodHeaders,
    body: validWebhookPayload
  });
  assert.strictEqual(goodWebhookRes.status, 200);
  assert.strictEqual(goodWebhookRes.data.paymentStatus, 'paid');

  const walletCheck1 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(walletCheck1.data.balance.topup, 1050, 'Kredit topup harus bertambah 1050');

  const updatedPayment = await db.findOne('payments', { invoice_number: topupInvoice });
  assert.strictEqual(updatedPayment.status, 'paid');
  assert.ok(updatedPayment.fulfilled_at);

  // 4e. Notifikasi berulang (idempoten)
  const repeatWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: goodHeaders,
    body: validWebhookPayload
  });
  assert.strictEqual(repeatWebhookRes.status, 200);
  assert.strictEqual(repeatWebhookRes.data.status, 'already_processed');

  const walletCheck2 = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(walletCheck2.data.balance.topup, 1050, 'Saldo kredit tidak boleh bertambah ganda');

  // ----------------------------------------------------
  // 5. Uji Atomisitas Fulfillment (Double Fulfill Concurrent)
  // ----------------------------------------------------
  console.log('5. Menguji atomisitas fulfillment secara konkuren...');
  const testPaymentRow = await db.insert('payments', {
    workspace_id: userRow.id,
    user_id: userRow.id,
    kind: 'topup',
    item_id: 'starter',
    item_name: 'Starter Pack',
    provider: 'doku',
    amount: 500000,
    credits: 500,
    period_days: 365,
    invoice_number: generateInvoiceNumber('topup'),
    status: 'pending',
    fulfilled_at: null
  });

  // Eksekusi dua fulfillPayment secara bersamaan (Promise.all)
  const [f1, f2] = await Promise.all([
    fulfillPayment(testPaymentRow),
    fulfillPayment(testPaymentRow)
  ]);
  const successCount = [f1, f2].filter(r => r.fulfilled).length;
  assert.strictEqual(successCount, 1, 'Hanya tepat 1 proses fulfillment yang boleh berhasil (atomik)');

  // ----------------------------------------------------
  // 5b. Uji Rollback Klaim saat Grant Throw Error & Sukses di Retry DOKU
  // ----------------------------------------------------
  console.log('5b. Menguji grant gagal throw error -> webhook 500 -> retry sukses -> kredit tepat 1x...');
  const retryInvoice = generateInvoiceNumber('topup');
  const retryPayment = await db.insert('payments', {
    workspace_id: userRow.id,
    user_id: userRow.id,
    kind: 'topup',
    item_id: 'starter',
    item_name: 'Starter Pack',
    provider: 'doku',
    amount: 500000,
    credits: 500,
    period_days: 365,
    invoice_number: retryInvoice,
    status: 'pending',
    fulfilled_at: null
  });

  const retryWebhookPayload = {
    order: { invoice_number: retryInvoice, amount: 500000 },
    status: 'SUCCESS',
    transaction: { status: 'SUCCESS', date: new Date().toISOString() },
    channel: { id: 'QRIS' }
  };
  const retryHeaders = makeDokuWebhookHeaders(retryWebhookPayload);

  // Ambil saldo awal
  const preWalletRes = await req('/api/credits', { headers: authHeaders });
  const preBalance = preWalletRes.data.balance.topup;

  // Mock sementara db.insert('credit_ledger') agar throw error simulasi kegagalan grant
  const origInsert = db.insert.bind(db);
  let failOnce = true;
  db.insert = async function (table, row) {
    if (table === 'credit_ledger' && failOnce) {
      failOnce = false;
      throw new Error('Simulated Database I/O failure during credit_ledger insertion');
    }
    return origInsert(table, row);
  };

  // 1. Panggilan webhook pertama: harus throw dan dibalas HTTP 500
  const failWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: retryHeaders,
    body: retryWebhookPayload
  });
  assert.strictEqual(failWebhookRes.status, 500, 'Webhook wajib mengembalikan HTTP 500 jika fulfillment/grant gagal');

  // Verifikasi rollback: status harus kembali 'pending' dan fulfilled_at harus kembali null
  const rolledBackPayment = await db.findOne('payments', { invoice_number: retryInvoice });
  assert.strictEqual(rolledBackPayment.status, 'pending', 'Status pembayaran wajib di-rollback menjadi pending');
  assert.strictEqual(rolledBackPayment.fulfilled_at, null, 'fulfilled_at wajib di-rollback menjadi null');

  // Verifikasi saldo belum bertambah
  const midWalletRes = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(midWalletRes.data.balance.topup, preBalance, 'Saldo tidak boleh bertambah saat grant gagal');

  // 2. Simulasi Retry dari DOKU (db.insert sudah normal)
  const retryWebhookRes = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: retryHeaders,
    body: retryWebhookPayload
  });
  assert.strictEqual(retryWebhookRes.status, 200, 'Retry webhook harus berhasil 200 setelah error pulih');

  // Verifikasi pembayaran sukses ter-fulfill
  const successPayment = await db.findOne('payments', { invoice_number: retryInvoice });
  assert.strictEqual(successPayment.status, 'paid');
  assert.ok(successPayment.fulfilled_at);

  // Verifikasi saldo bertambah tepat 1x (+500)
  const postWalletRes = await req('/api/credits', { headers: authHeaders });
  assert.strictEqual(postWalletRes.data.balance.topup, preBalance + 500, 'Saldo harus bertambah tepat 1x');

  // Pulihkan fungsi db.insert
  db.insert = origInsert;

  // ----------------------------------------------------
  // 6. Uji Proteksi Webhook Mock di Mode Production
  // ----------------------------------------------------
  console.log('6. Menguji penolakan webhook mock di mode production...');
  process.env.NODE_ENV = 'production';
  const mockWebhookRes = await req('/api/webhooks/mock', {
    method: 'POST',
    body: { invoice_number: 'TEST-MOCK' }
  });
  assert.strictEqual(mockWebhookRes.status, 404, 'Di mode production, /api/webhooks/mock wajib return 404');
  process.env.NODE_ENV = 'test';

  // ----------------------------------------------------
  // 7. Uji Proteksi Cron Reconcile & Eksekusi Sukses
  // ----------------------------------------------------
  console.log('7. Menguji proteksi dan eksekusi cron reconcile...');
  // Tanpa auth cron secret -> 401
  const unauthCron = await req('/api/cron/payments-reconcile');
  assert.strictEqual(unauthCron.status, 401, 'Cron tanpa auth wajib 401');

  // Cron secret salah -> 401
  const badCron = await req('/api/cron/payments-reconcile', {
    headers: { Authorization: 'Bearer wrong-secret' }
  });
  assert.strictEqual(badCron.status, 401, 'Cron dengan secret salah wajib 401');

  // Siapkan invoice pending untuk diuji reconcile
  const pendingOldInvoice = generateInvoiceNumber('topup');
  const pastTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
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
    provider: 'doku',
    invoice_number: pendingOldInvoice,
    status: 'pending',
    created_at: pastTime,
    updated_at: pastTime,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });

  // Mock getStatus pada adapter untuk simulasi status PAID dari DOKU
  dokuAdapter.getStatus = async (inv) => ({
    status: inv === pendingOldInvoice ? 'paid' : 'pending',
    paidAt: new Date().toISOString(),
    method: 'DOKU_VA',
    raw: { transaction: { status: 'SUCCESS' } }
  });

  const validCron = await req('/api/cron/payments-reconcile', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  assert.strictEqual(validCron.status, 200);
  assert.strictEqual(validCron.data.result.fulfilled, 1);

  const reconciledPayment = await db.findOne('payments', { invoice_number: pendingOldInvoice });
  assert.strictEqual(reconciledPayment.status, 'paid');
  assert.ok(reconciledPayment.fulfilled_at);

  // ----------------------------------------------------
  // 8. Uji Pengingat Langganan H-7 dan H-1
  // ----------------------------------------------------
  console.log('8. Menguji pengingat perpanjangan langganan H-7...');
  const subH7Ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert('subscriptions', {
    workspace_id: userRow.id,
    user_id: userRow.id,
    plan: 'seo',
    status: 'active',
    ends_at: subH7Ends
  });

  const reminderSummary = await processSubscriptionRenewalReminders();
  assert.ok(reminderSummary.sentH7 >= 1, 'Pengingat H-7 harus terkirim');

  // Idempotensi: eksekusi kedua tidak boleh mengirim ulang
  const repeatReminder = await processSubscriptionRenewalReminders();
  assert.strictEqual(repeatReminder.sentH7, 0, 'Pengingat H-7 tidak boleh dikirim dua kali');

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
