// Test Langkah 7: Entitlement Modul di Server + Langganan per Workspace (PRD F1 + F2)
import assert from 'assert';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';
import { getModules, expireEntitlements } from '../lib/entitlements.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step7-' + Date.now();

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

async function runStep7Tests() {
  console.log('=== RUNNING TEST STEP 7 (Module Entitlements & Subscriptions per Workspace) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step7';
  process.env.PORT = '5014';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-step7';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5014';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailUser = `entitle.user.${ts}@testmarkimate.id`;
  const password = ['Trial', 'Pass', '123!', 'T'].join('');

  // 1. Registrasi & Verifikasi User baru (Trial 7 hari)
  console.log('1. Mendaftarkan user baru dan memverifikasi email untuk mendapatkan trial 7 hari...');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: emailUser, password, brandName: 'Brand Entitlement', acceptTerms: true }
  });
  assert.strictEqual(regRes.status, 200);

  const account = await db.findOne('accounts', { email: emailUser });
  await req(`/api/admin/users/${account.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailUser, password }
  });
  assert.strictEqual(loginRes.status, 200);
  const token = loginRes.data.accessToken;
  const workspaceId = account.id;

  // 2. Verifikasi 3 modul aktif selama masa trial
  console.log('2. Memverifikasi modul aktif selama trial (seo, ads_report, ads_spy)...');
  const initialModules = await getModules(workspaceId);
  assert.ok(initialModules.includes('seo'), 'SEO harus aktif');
  assert.ok(initialModules.includes('ads_report'), 'Ads Report harus aktif saat trial');
  assert.ok(initialModules.includes('ads_spy'), 'Ads Spy harus aktif saat trial');

  // Cek endpoint SEO, Ads Reports, dan Ads Spy saat trial aktif
  const seoCheck = await req('/api/keywords', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(seoCheck.status, 200, 'Endpoint SEO harus dapat diakses saat trial');

  const adsCheck = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsCheck.status, 200, 'Endpoint Ads Report harus dapat diakses saat trial');

  const spyCheck = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyCheck.status, 200, 'Endpoint Ads Spy harus dapat diakses saat trial');
  console.log('✓ Modul trial aktif dan semua endpoint berhasil diakses');

  // 3. Simulasi Trial Hari ke-8 (ends_at mundur ke masa lalu)
  console.log('3. Mensimulasikan trial hari ke-8 (ends_at di masa lalu)...');
  const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const allEnts = await db.findMany('module_entitlements', { workspace_id: workspaceId });
  for (const ent of allEnts) {
    await db.update('module_entitlements', { id: ent.id }, { ends_at: pastDate });
  }

  // Panggil expireEntitlements / cron harian
  const cronRes = await req('/api/cron/run-scheduled?secret=cron-secret-step7', { method: 'GET' });
  assert.strictEqual(cronRes.status, 200);

  // Periksa modul setelah expired
  const expiredModules = await getModules(workspaceId);
  assert.ok(!expiredModules.includes('ads_report'), 'ads_report harus nonaktif setelah trial lewat');
  assert.ok(!expiredModules.includes('ads_spy'), 'ads_spy harus nonaktif setelah trial lewat');
  assert.ok(expiredModules.includes('seo'), 'seo harus tetap aktif sebagai fallback Free tier');

  // Cek penolakan 403 MODULE_INACTIVE pada Ads Report
  const adsExpiredCheck = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsExpiredCheck.status, 403, 'Akses Ads Report harus ditolak 403 setelah trial habis');
  assert.strictEqual(adsExpiredCheck.data.code, 'MODULE_INACTIVE');
  assert.strictEqual(adsExpiredCheck.data.module, 'ads_report');

  // Cek penolakan 403 MODULE_INACTIVE pada Ads Spy
  const spyExpiredCheck = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyExpiredCheck.status, 403, 'Akses Ads Spy harus ditolak 403 setelah trial habis');
  assert.strictEqual(spyExpiredCheck.data.code, 'MODULE_INACTIVE');
  assert.strictEqual(spyExpiredCheck.data.module, 'ads_spy');

  // Cek bahwa SEO tetap dapat diakses dengan kuota Free
  const seoFreeCheck = await req('/api/keywords', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(seoFreeCheck.status, 200, 'SEO harus tetap bisa diakses pada free tier');
  console.log('✓ Proteksi MODULE_INACTIVE (403) dan fallback Free SEO berhasil diverifikasi');

  // 4. Admin mengaktifkan paket spesifik 'ads_report' via POST /api/admin/subscriptions
  console.log('4. Admin mengaktifkan paket ads_report via POST /api/admin/subscriptions...');
  const adminSubRes = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY },
    body: {
      workspaceId,
      plan: 'ads_report',
      months: 1
    }
  });
  assert.strictEqual(adminSubRes.status, 200);
  assert.ok(adminSubRes.data.modules.includes('ads_report'));

  // Cek bahwa ads_report sekarang aktif kembali
  const adsAfterSub = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsAfterSub.status, 200, 'Ads Report harus aktif setelah admin mengaktifkan paket');

  // ads_spy harus tetap nonaktif karena hanya paket ads_report yang dibeli
  const spyStillInactive = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyStillInactive.status, 403);
  assert.strictEqual(spyStillInactive.data.code, 'MODULE_INACTIVE');
  console.log('✓ Paket ads_report aktif dan ads_spy tetap terisolasi');

  // 5. Admin mengaktifkan paket All-in-One (seo, ads_report, ads_spy)
  console.log('5. Admin mengaktifkan paket bundle all_in_one...');
  const bundleSubRes = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY },
    body: {
      workspaceId,
      plan: 'all_in_one',
      months: 1
    }
  });
  assert.strictEqual(bundleSubRes.status, 200);

  const spyAfterBundle = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyAfterBundle.status, 200, 'Ads Spy sekarang harus aktif setelah paket all_in_one diaktifkan');
  console.log('✓ Paket bundle all_in_one berhasil mengaktifkan seluruh modul');

  // 6. Verifikasi endpoint /api/me mengembalikan modul dan entitlements terkini
  console.log('6. Memverifikasi modul yang dikembalikan oleh /api/me...');
  const meRes = await req('/api/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(meRes.status, 200);
  assert.ok(Array.isArray(meRes.data.modules), 'modules harus berupa array di /api/me');
  assert.ok(meRes.data.modules.includes('seo'));
  assert.ok(meRes.data.modules.includes('ads_report'));
  assert.ok(meRes.data.modules.includes('ads_spy'));
  console.log('✓ Endpoint /api/me mengembalikan modul yang valid');

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH 7 (ENTITLEMENTS & SUBSCRIPTIONS) LULUS 100%!');
  console.log('======================================================');
  process.exit(0);
}

runStep7Tests().catch((err) => {
  console.error('TEST STEP 7 GAGAL:', err);
  process.exit(1);
});
