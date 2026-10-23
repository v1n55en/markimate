// Test PRD F16 Langkah 5: Checkout Pack, 410 Module Discontinued & Reconcile Data Lama
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-pack-${randomUUID()}.json`);
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
const { CREDIT_PACKS } = await import('../lib/catalog.js');
const { createCheckout, reconcile } = await import('../lib/payments/service.js');

let baseUrl;
const TEST_CLIENT_ID = 'CLIENT-pack-test-123';
const TEST_SECRET_KEY = 'SK-pack-test-456';

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

async function runPackCheckoutTests() {
  console.log('=== RUNNING TEST PACK CHECKOUT & 410 MODULE DISCONTINUED (PRD F16 §3.7 & §7) ===');

  process.env.JWT_SECRET = 'test-secret-key-pack-min-32chars!';
  process.env.PORT = '5022';
  process.env.CREDITS_ENABLED = 'true';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5022';
  process.env.PAYMENT_PROVIDER = 'doku';
  process.env.DOKU_CLIENT_ID = TEST_CLIENT_ID;
  process.env.DOKU_SECRET_KEY = TEST_SECRET_KEY;

  const TEST_ADMIN_KEY = 'admin-secret-pack-test-32chars!';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  // 1. Registrasi user & autentikasi
  console.log('1. Mendaftarkan user uji...');
  const userEmail = `packowner.${Date.now()}@testmarkimate.id`;
  const dummyPass = 'PackPass123!';
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Pack Tester',
      email: userEmail,
      password: dummyPass,
      brandName: 'Pack Brand Test',
      websiteUrl: 'https://packtest.com',
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

  // 2. Checkout pack_2500 -> amount 2.000.000 dan credits 2.500 (PRD F16 §7)
  console.log('2. Menguji checkout pack_2500 (Rp2.000.000, 2.500 credits) & manipulasi client amount...');
  const res2500 = await req('/api/billing/pack', {
    method: 'POST',
    headers: authHeaders,
    // Client manipulasi amount Rp500
    body: { itemId: 'pack_2500', amount: 500 }
  });
  assert.strictEqual(res2500.status, 200, 'Checkout pack_2500 harus 200 OK');
  assert.strictEqual(res2500.data.amount, 2000000, 'Server wajib menagih Rp2.000.000 (mengabaikan input client)');
  assert.ok(res2500.data.invoiceNumber.startsWith('MKM-P-'), 'Invoice pack harus memiliki prefix MKM-P- (PRD F16 §3.7)');

  const payment2500 = await db.findOne('payments', { invoice_number: res2500.data.invoiceNumber });
  assert.strictEqual(payment2500.amount, 2000000);
  assert.strictEqual(payment2500.credits, 2500);
  assert.strictEqual(payment2500.kind, 'pack');
  assert.strictEqual(payment2500.item_id, 'pack_2500');
  console.log('   OK - Checkout pack_2500 sukses dengan prefix P dan amount server-calculated.');

  // 2b. Checkout pack_1000 -> amount 900.000 dan credits 1000 (Starter)
  console.log('2b. Menguji checkout pack_1000 (Rp900.000, 1000 credits, Starter)...');
  const res1000 = await req('/api/billing/pack', {
    method: 'POST',
    headers: authHeaders,
    body: { itemId: 'pack_1000', amount: 999 }
  });
  assert.strictEqual(res1000.status, 200, 'Checkout pack_1000 harus 200 OK');
  assert.strictEqual(res1000.data.amount, 900000, 'Server wajib menagih Rp900.000 untuk pack_1000');

  const payment1000 = await db.findOne('payments', { invoice_number: res1000.data.invoiceNumber });
  assert.strictEqual(payment1000.amount, 900000);
  assert.strictEqual(payment1000.credits, 1000);
  assert.strictEqual(payment1000.kind, 'pack');
  assert.strictEqual(payment1000.item_id, 'pack_1000');
  console.log('   OK - Checkout pack_1000 sukses dengan amount Rp900.000.');

  // 2c. pack_500 sudah dihapus -> 400 INVALID_PACK
  const res500 = await req('/api/billing/pack', {
    method: 'POST',
    headers: authHeaders,
    body: { itemId: 'pack_500' }
  });
  assert.strictEqual(res500.status, 400, 'pack_500 yang sudah dihapus harus menghasilkan 400');
  assert.strictEqual(res500.data.code, 'INVALID_PACK');

  // 3. Validasi itemId tidak dikenal -> 400 INVALID_PACK (PRD F16 §7)
  console.log('3. Menguji validasi itemId pack tidak dikenal -> 400...');
  const resInvalidPack = await req('/api/billing/pack', {
    method: 'POST',
    headers: authHeaders,
    body: { itemId: 'pack_unknown_999' }
  });
  assert.strictEqual(resInvalidPack.status, 400);
  assert.strictEqual(resInvalidPack.data.code, 'INVALID_PACK');

  const resEmptyPack = await req('/api/billing/pack', {
    method: 'POST',
    headers: authHeaders,
    body: {}
  });
  assert.strictEqual(resEmptyPack.status, 400);
  assert.strictEqual(resEmptyPack.data.code, 'INVALID_PACK');
  console.log('   OK - itemId pack tidak dikenal berhasil ditolak 400 INVALID_PACK.');

  // 4. Webhook DOKU untuk pembayaran pack_2500 & Idempotensi (PRD F16 §7)
  console.log('4. Menguji Webhook DOKU untuk pack_2500 (idempotensi 2x webhook -> credit masuk 1x)...');
  const webhook2500 = {
    order: {
      invoice_number: res2500.data.invoiceNumber,
      amount: 2000000
    },
    transaction: {
      status: 'SUCCESS',
      date: new Date().toISOString()
    },
    payment: {
      payment_method_type: 'QRIS'
    }
  };

  // Webhook panggilan pertama
  const hookRes1 = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhook2500),
    body: webhook2500
  });
  assert.strictEqual(hookRes1.status, 200);
  assert.strictEqual(hookRes1.data.status, 'ok');

  const wallet1 = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(wallet1.balance_topup, 2500, 'Credit topup harus bertambah 2500');
  assert.strictEqual(wallet1.topup_expires_at, null, 'topup_expires_at harus null untuk pack (tidak hangus)');

  // Verifikasi buku besar (credit_ledger)
  const ledgerRows = await db.findMany('credit_ledger', { workspace_id: workspaceId, ref_id: payment2500.id });
  assert.strictEqual(ledgerRows.length, 1);
  assert.strictEqual(ledgerRows[0].delta, 2500);
  assert.strictEqual(ledgerRows[0].bucket, 'topup');
  assert.strictEqual(ledgerRows[0].note, 'Paket Pro (2.500 credit)');

  // Webhook panggilan kedua (duplikat)
  const hookRes2 = await req('/api/webhooks/doku', {
    method: 'POST',
    headers: makeDokuWebhookHeaders(webhook2500),
    body: webhook2500
  });
  assert.strictEqual(hookRes2.status, 200);
  assert.strictEqual(hookRes2.data.status, 'already_processed', 'Webhook duplikat harus already_processed');

  const wallet2 = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.strictEqual(wallet2.balance_topup, 2500, 'Saldo credit wallet TIDAK boleh bertambah lagi pada webhook duplikat');
  console.log('   OK - Webhook pack dua kali terbukti hanya memasukkan kredit 1x (idempoten).');

  // 5. Pengujian Penolakan Checkout Modul -> 410 MODULE_PURCHASE_DISCONTINUED (PRD F16 §3.7 & §7)
  console.log('5. Menguji penolakan checkout modul -> 410 MODULE_PURCHASE_DISCONTINUED...');
  const resModSeo = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { module: 'seo' }
  });
  assert.strictEqual(resModSeo.status, 410, 'Pembelian modul SEO harus 410 Gone');
  assert.strictEqual(resModSeo.data.code, 'MODULE_PURCHASE_DISCONTINUED');

  const resModBundle = await req('/api/billing/modules', {
    method: 'POST',
    headers: authHeaders,
    body: { bundle: 'focus3' }
  });
  assert.strictEqual(resModBundle.status, 410, 'Pembelian bundle harus 410 Gone');
  assert.strictEqual(resModBundle.data.code, 'MODULE_PURCHASE_DISCONTINUED');

  // Direct createCheckout call test
  await assert.rejects(async () => {
    await createCheckout({
      kind: 'module',
      itemId: 'seo',
      workspaceId,
      userId: user.id
    });
  }, (err) => {
    assert.strictEqual(err.status, 410);
    assert.strictEqual(err.code, 'MODULE_PURCHASE_DISCONTINUED');
    return true;
  });
  console.log('   OK - Seluruh checkout module mengembalikan 410 MODULE_PURCHASE_DISCONTINUED.');

  // 6. Jalur Reconcile Data Modul Lama (PRD F16 §3.7)
  console.log('6. Menguji jalur rekonsiliasi data pembayaran modul lama yang pending/paid...');
  const wsOld = randomUUID();
  await db.insert('workspaces', { id: wsOld, name: 'Old Module WS', owner_user_id: user.id });
  const oldPaymentId = randomUUID();
  await db.insert('payments', {
    id: oldPaymentId,
    workspace_id: wsOld,
    user_id: user.id,
    kind: 'module',
    item_id: 'ads_report',
    item_name: 'Ads Report',
    amount: 1990000,
    invoice_number: 'MKM-M-OLD-TEST-999',
    provider: 'doku',
    status: 'paid',
    fulfilled_at: new Date().toISOString(),
    granted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const recRes = await reconcile();
  assert.ok(recRes.fulfilled >= 1, 'Reconcile harus menyelesaikan pembayaran modul lama');

  const paymentAfterRec = await db.findOne('payments', { id: oldPaymentId });
  assert.ok(paymentAfterRec.granted_at, 'granted_at pada pembayaran lama harus terisi');

  const entOld = await db.findOne('module_entitlements', { workspace_id: wsOld, module: 'ads_report' });
  assert.ok(entOld, 'Entitlement modul ads_report harus teraktivasi untuk pelanggan lama');
  assert.strictEqual(entOld.source, 'lifetime');
  console.log('   OK - Data modul lama berhasil direkonsiliasi dan dilayani.');

  console.log('✅ ALL PACK CHECKOUT & 410 MODULE DISCONTINUED TESTS PASSED!');
}

runPackCheckoutTests()
  .then(() => {
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ PACK CHECKOUT TEST FAILED:', err);
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try { fs.unlinkSync(standaloneTmp); } catch (_) {}
    }
    process.exit(1);
  });
