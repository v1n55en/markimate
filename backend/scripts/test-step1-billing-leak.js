// Test Langkah 1 PRD Hapus Mode Demo & Tutup Kebocoran Billing
// Memastikan:
// 1. POST /api/billing/checkout ditolak 403 BILLING_DISABLED saat BILLING_DUMMY != 'true'
// 2. POST /api/billing/checkout berfungsi saat BILLING_DUMMY == 'true'
// 3. POST /api/admin/subscriptions (dengan X-Admin-Key) mengaktifkan paket manual & grant_sub di ledger
// 4. POST /api/admin/credits/grant (dengan X-Admin-Key) menambah saldo bucket & tercatat sebagai kind 'admin'

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

async function runStep1BillingLeakTests() {
  console.log('=== RUNNING TEST STEP 1 (Billing Leak Guard & Admin Endpoints) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step1-leak';
  process.env.PORT = '5007';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = 'test-admin-secret-key-123';
  delete process.env.BILLING_DUMMY; // Simulasi produksi default (false)

  await seedCreditPricesAndRates();

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const adminHeaders = { 'X-Admin-Key': process.env.ADMIN_KEY };

  // 1. Registrasi user uji
  const testEmail = `leak-test-${Date.now()}@example.com`;
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: 'password123', brandName: 'Brand Uji Leak' })
  });
  assert.strictEqual(regRes.status, 200, 'Register harus sukses');
  const token = regRes.data.token;
  const user = regRes.data.user;
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('1. User uji terdaftar dengan 300 trial credit.');

  // 2. Uji POST /api/billing/checkout saat BILLING_DUMMY tidak aktif (default / produksi)
  const leakRes = await request('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ plan: 'seo', method: 'qris' })
  });
  assert.strictEqual(leakRes.status, 403, 'Checkout harus ditolak 403');
  assert.strictEqual(leakRes.data.code, 'BILLING_DISABLED');
  assert.strictEqual(leakRes.data.error, 'Pembayaran langsung belum tersedia. Hubungi 3Our untuk aktivasi paket.');

  // Pastikan saldo TIDAK bertambah dan paket user tetap 'free'
  const creditCheck1 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck1.data.balance.sub, 0, 'balance_sub harus tetap 0');
  assert.strictEqual(creditCheck1.data.balance.total, 300, 'total saldo harus tetap 300');

  const meCheck1 = await request('/api/me', { headers: authHeaders });
  assert.strictEqual(meCheck1.data.user.plan, 'free', 'Plan harus tetap free');
  console.log('✓ 2. Checkout dummy berhasil ditolak di produksi (403 BILLING_DISABLED, saldo tidak bocor)');

  // 3. Uji POST /api/billing/checkout saat BILLING_DUMMY diset 'true' (mode dev)
  process.env.BILLING_DUMMY = 'true';
  const dummyRes = await request('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ plan: 'premium', method: 'qris' })
  });
  assert.strictEqual(dummyRes.status, 200, 'Checkout harus berhasil saat BILLING_DUMMY=true');
  assert.strictEqual(dummyRes.data.user.plan, 'premium');

  const creditCheck2 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck2.data.balance.sub, 1500, 'balance_sub harus 1500');
  console.log('✓ 3. Mode dev lokal (BILLING_DUMMY=true) berhasil mengizinkan checkout simulasi');
  delete process.env.BILLING_DUMMY; // Kembalikan ke false/undefined

  // 4. Uji POST /api/admin/subscriptions
  // 4a. Tanpa X-Admin-Key -> 401
  const noKeySub = await request('/api/admin/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, plan: 'focus3', months: 1 })
  });
  assert.strictEqual(noKeySub.status, 401, 'Harus ditolak 401 jika tanpa X-Admin-Key');

  // 4b. Email tidak terdaftar -> 404
  const notFoundSub = await request('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: 'nonexistent@example.com', plan: 'focus3', months: 1 })
  });
  assert.strictEqual(notFoundSub.status, 404, 'Harus 404 jika user tidak ditemukan');

  // 4c. Plan tidak valid atau 'free' -> 400
  const invalidPlanSub = await request('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: testEmail, plan: 'free', months: 1 })
  });
  assert.strictEqual(invalidPlanSub.status, 400, 'Harus 400 jika plan tidak berbayar');

  // 4d. Sukses aktivasi manual Paket Fokus 3 (3.200 credit)
  const successSub = await request('/api/admin/subscriptions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: testEmail, plan: 'focus3', months: 1 })
  });
  assert.strictEqual(successSub.status, 200, 'Admin subscription harus sukses');
  assert.strictEqual(successSub.data.user.plan, 'focus3');
  assert.strictEqual(successSub.data.subscription.dummy, false, 'Subscription manual dummy harus false');
  assert.strictEqual(successSub.data.subscription.method, 'manual');
  assert.strictEqual(successSub.data.creditsGranted, 3200);

  const creditCheck3 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck3.data.balance.sub, 3200, 'balance_sub harus ter-update menjadi 3200');

  // Cek ledger entry grant_sub
  const ledgerRows = await db.findMany('credit_ledger', { workspace_id: user.id });
  const subLedger = ledgerRows.find(r => r.kind === 'grant_sub' && r.note === 'Aktivasi manual oleh admin');
  assert.ok(subLedger, 'Harus ada ledger entry grant_sub dengan note "Aktivasi manual oleh admin"');
  console.log('✓ 4. POST /api/admin/subscriptions berhasil mengaktifkan paket manual & mencatat grant_sub di ledger');

  // 5. Uji POST /api/admin/credits/grant
  // 5a. Tanpa X-Admin-Key -> 401
  const noKeyGrant = await request('/api/admin/credits/grant', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, bucket: 'topup', amount: 500, days: 30 })
  });
  assert.strictEqual(noKeyGrant.status, 401, 'Harus 401 jika tanpa X-Admin-Key');

  // 5b. Email tidak terdaftar -> 404
  const notFoundGrant = await request('/api/admin/credits/grant', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: 'ghost@example.com', bucket: 'topup', amount: 500 })
  });
  assert.strictEqual(notFoundGrant.status, 404, 'Harus 404 jika email tidak ada');

  // 5c. Valid grant 500 topup credits untuk akun reviewer
  const grantRes = await request('/api/admin/credits/grant', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: testEmail,
      bucket: 'topup',
      amount: 500,
      days: 60,
      note: 'Akun Reviewer Shopee & TikTok'
    })
  });
  assert.strictEqual(grantRes.status, 200, 'Admin grant harus sukses');
  assert.strictEqual(grantRes.data.granted.amount, 500);
  assert.strictEqual(grantRes.data.granted.bucket, 'topup');
  assert.strictEqual(grantRes.data.granted.kind, 'admin');

  // Cek saldo akhir
  const creditCheck4 = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditCheck4.data.balance.topup, 500, 'balance_topup harus 500');

  // Cek ledger entry kind 'admin'
  const updatedLedgerRows = await db.findMany('credit_ledger', { workspace_id: user.id });
  const adminLedger = updatedLedgerRows.find(r => r.kind === 'admin' && r.delta === 500);
  assert.ok(adminLedger, 'Harus ada ledger entry kind admin dengan delta 500');
  assert.strictEqual(adminLedger.note, 'Akun Reviewer Shopee & TikTok');
  console.log('✓ 5. POST /api/admin/credits/grant berhasil menambah saldo bucket & mencatat kind admin di ledger');

  console.log('--- SEMUA PENGUJIAN LANGKAH 1 BERHASIL ---');
  process.exit(0);
}

runStep1BillingLeakTests().catch(err => {
  console.error('Test gagal:', err);
  process.exit(1);
});
