// Test Suite: Platform Admin Unlimited, Admin Session & Security (PRD F14 Langkah 1)
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-admin-platform-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { ensurePlatformAdmin, isPlatformAdmin, isWorkspacePlatformAdmin } = await import('../lib/admin.js');
const { getModules } = await import('../lib/entitlements.js');
const { assertAffordable, charge } = await import('../lib/credits.js');
const { calculateUsageAndMargin } = await import('../lib/margin.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-key-test-32-chars-long!!';
const ADMIN_EMAIL = 'admin.tester.unlimited@testmarkimate.id';
const NORMAL_EMAIL = 'normal.tester.regular@testmarkimate.id';

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

async function runAdminPlatformTests() {
  console.log('=== RUNNING PLATFORM ADMIN & UNLIMITED SUITE (PRD F14 Langkah 1) ===');

  process.env.JWT_SECRET = 'test-secret-key-admin-platform-32ch!';
  process.env.PORT = '5019';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.PLATFORM_ADMIN_EMAILS = `someone@test.id, ${ADMIN_EMAIL}, other@test.id`;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5019';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const password = ['Admin', 'Pass', '123!', 'X'].join('');

  // 1. Registrasi akun admin (email di env tapi belum diverifikasi)
  console.log('1. Menguji akun di PLATFORM_ADMIN_EMAILS sebelum email terverifikasi...');
  const regAdmin = await req('/api/auth/register', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password, brandName: '3Our Platform HQ', acceptTerms: true }
  });
  assert.strictEqual(regAdmin.status, 200);

  let adminAcc = await db.findOne('accounts', { email: ADMIN_EMAIL });
  assert.strictEqual(Boolean(adminAcc.is_platform_admin), false, 'Akun belum terverifikasi tidak boleh menjadi admin');
  assert.strictEqual(adminAcc.email_verified_at, null);

  // Pastikan memanggil ensurePlatformAdmin pada akun yang belum terverifikasi tetap aman
  const ensuredBefore = await ensurePlatformAdmin(adminAcc);
  assert.strictEqual(ensuredBefore, false, 'ensurePlatformAdmin wajib menolak akun belum terverifikasi');
  adminAcc = await db.findOne('accounts', { email: ADMIN_EMAIL });
  assert.strictEqual(adminAcc.email_verified_at, null, 'ensurePlatformAdmin dilarang mengisi email_verified_at');
  console.log('✓ Akun belum terverifikasi ditolak menjadi platform admin');

  // 2. Verifikasi email admin
  console.log('2. Memverifikasi email admin dan memastikan flag is_platform_admin serta entitlement admin...');
  await req(`/api/admin/users/${adminAcc.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  adminAcc = await db.findOne('accounts', { email: ADMIN_EMAIL });
  assert.strictEqual(Boolean(adminAcc.is_platform_admin), true, 'Setelah verifikasi, akun wajib menjadi platform admin');

  const adminWorkspaces = await db.findMany('workspaces', { owner_user_id: adminAcc.id });
  const adminWs = adminWorkspaces[0] || { id: adminAcc.id };

  const adminModules = await getModules(adminWs.id);
  assert.ok(adminModules.includes('seo'));
  assert.ok(adminModules.includes('ads_report'));
  assert.ok(adminModules.includes('ads_spy'));
  assert.strictEqual(adminModules.details.seo.source, 'admin', 'Source entitlement admin wajib "admin"');
  assert.strictEqual(adminModules.details.ads_report.source, 'admin');
  assert.strictEqual(adminModules.details.ads_spy.source, 'admin');
  assert.strictEqual(adminModules.details.seo.ends_at, null, 'Entitlement admin tidak boleh expired (ends_at null)');
  console.log('✓ Flag is_platform_admin dan entitlement source: admin berhasil terverifikasi');

  // 3. Login akun admin & verifikasi token / session
  console.log('3. Menguji login akun admin dan respon /api/me serta publicUser...');
  const loginAdmin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password }
  });
  assert.strictEqual(loginAdmin.status, 200);
  assert.strictEqual(loginAdmin.data.user.isPlatformAdmin, true, 'publicUser wajib menyertakan isPlatformAdmin: true');
  const adminToken = loginAdmin.data.accessToken;

  // 4. Menguji proteksi /api/admin/*
  console.log('4. Menguji akses /api/admin/* dengan berbagai metode autentikasi...');
  // 4a. Tanpa token dan tanpa key -> 401
  const noAuth = await req('/api/admin/credits/margin', { method: 'GET' });
  assert.strictEqual(noAuth.status, 401, 'Tanpa auth harus 401');

  // 4b. Menggunakan default key lama yang sudah dihapus -> 401
  const oldKey = await req('/api/admin/credits/margin', {
    method: 'GET',
    headers: { 'X-Admin-Key': 'default-admin-secret-key' }
  });
  assert.strictEqual(oldKey.status, 401, 'Fallback default-admin-secret-key wajib ditolak 401');

  // 4c. Menggunakan valid X-Admin-Key -> 200
  const validKey = await req('/api/admin/credits/margin', {
    method: 'GET',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  assert.strictEqual(validKey.status, 200, 'X-Admin-Key valid harus 200');

  // 4d. Menggunakan sesi user platform admin (Bearer token) -> 200
  const sessionAdmin = await req('/api/admin/credits/margin', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(sessionAdmin.status, 200, 'Sesi platform admin harus 200');

  // 4e. User biasa mencoba mengakses /api/admin/* -> 401
  const regNormal = await req('/api/auth/register', {
    method: 'POST',
    body: { email: NORMAL_EMAIL, password, brandName: 'Normal User Brand', acceptTerms: true }
  });
  const normalAcc = await db.findOne('accounts', { email: NORMAL_EMAIL });
  await req(`/api/admin/users/${normalAcc.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  const loginNormal = await req('/api/auth/login', {
    method: 'POST',
    body: { email: NORMAL_EMAIL, password }
  });
  const normalToken = loginNormal.data.accessToken;
  assert.strictEqual(loginNormal.data.user.isPlatformAdmin, false, 'User biasa isPlatformAdmin harus false');

  const normalAccessAdmin = await req('/api/admin/credits/margin', {
    method: 'GET',
    headers: { Authorization: `Bearer ${normalToken}` }
  });
  assert.strictEqual(normalAccessAdmin.status, 401, 'User biasa harus ditolak 401 saat akses /api/admin/*');
  console.log('✓ Proteksi endpoint /api/admin/* (sesi admin vs key vs user biasa) terverifikasi akurat');

  // 5. Menguji bypass kredit unlimited dan pencatatan admin_usage di ledger
  console.log('5. Menguji bypass saldo assertCredits dan pencatatan admin_usage di ledger...');
  const affordableCheck = await assertAffordable(adminWs.id, 'seo.article', 1);
  assert.strictEqual(affordableCheck.affordable, true);
  assert.strictEqual(affordableCheck.unlimited, true);

  // Pastikan wallet admin TIDAK DIISI 999.999
  const walletBefore = await db.findOne('credit_wallets', { workspace_id: adminWs.id });
  const balanceBefore = Number(walletBefore?.balance_topup || 0);
  assert.notStrictEqual(balanceBefore, 999999, 'Wallet admin dilarang diisi angka artifisial 999999');

  // Lakukan charge pemakaian aksi oleh admin
  const chargeRes = await charge(adminWs.id, 'seo.article', 1, null, {
    geminiIn: 1000,
    geminiOut: 1500,
    images: 1,
    serpCalls: 1
  });
  assert.strictEqual(chargeRes.charged, 0, 'Charged untuk admin harus 0');
  assert.strictEqual(chargeRes.unlimited, true);
  assert.strictEqual(chargeRes.ledgerRows.length, 1);
  assert.strictEqual(chargeRes.ledgerRows[0].kind, 'admin_usage', 'Ledger kind wajib admin_usage');
  assert.strictEqual(chargeRes.ledgerRows[0].delta, 0, 'Ledger delta wajib 0');
  assert.ok(chargeRes.ledgerRows[0].cost_actual_idr > 0, 'Biaya API riil tetap harus terhitung');

  // Pastikan wallet admin tetap tidak berubah
  const walletAfter = await db.findOne('credit_wallets', { workspace_id: adminWs.id });
  assert.strictEqual(Number(walletAfter?.balance_topup || 0), balanceBefore, 'Wallet admin tidak boleh berubah');
  console.log('✓ Bypass kredit unlimited dan pencatatan admin_usage berhasil');

  // 6. Menguji laporan margin dengan pemisahan baris internal 3Our
  console.log('6. Menguji laporan margin dengan pemisahan pemakaian internal 3Our...');
  const marginData = await calculateUsageAndMargin();
  assert.ok(marginData.internal_admin_usage, 'Laporan margin wajib memuat internal_admin_usage');
  assert.strictEqual(marginData.internal_admin_usage.label, 'Pemakaian internal 3Our');
  assert.ok(marginData.internal_admin_usage.actions_count >= 1, 'Actions count admin internal harus tercatat');
  assert.ok(marginData.internal_admin_usage.cost_actual_idr > 0, 'Cost actual admin internal harus tercatat');
  console.log('✓ Pemakaian internal 3Our berhasil dipisahkan di laporan margin');

  // 7. Menguji respon GET /api/credits untuk workspace admin
  console.log('7. Menguji respon GET /api/credits untuk workspace admin...');
  const creditsRes = await req('/api/credits', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}`, 'X-Workspace-Id': adminWs.id }
  });
  assert.strictEqual(creditsRes.status, 200);
  assert.strictEqual(creditsRes.data.isUnlimited, true, 'isUnlimited wajib bernilai true');
  console.log('✓ GET /api/credits mengembalikan isUnlimited: true');

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN PLATFORM ADMIN & UNLIMITED (F14 LANGKAH 1) LULUS 100%!');
  console.log('======================================================');
  process.exit(0);
}

runAdminPlatformTests().catch((err) => {
  console.error('TEST PLATFORM ADMIN FAILED:', err);
  process.exit(1);
});
