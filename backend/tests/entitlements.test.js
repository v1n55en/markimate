// Test Module Entitlements: Trial, Expiration, Access Control & Pricing Config
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { TRIAL, MODULE_CREDITS, TOPUP_PACKS } from '../../frontend/src/config/pricing.js';
import { translate, TRANSLATIONS } from '../../frontend/src/i18n/index.js';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-entitlements-${randomUUID()}.json`);
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
const { getModules } = await import('../lib/entitlements.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-entitlements-' + Date.now();

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

async function runEntitlementsTests() {
  console.log('=== RUNNING TEST ENTITLEMENTS (Pricing Config & Module Lifecycle) ===');

  // --- BAGIAN 1: Validasi Konfigurasi Pricing & FAQ i18n ---
  console.log('1. Memvalidasi Konfigurasi Pricing & FAQ i18n...');
  assert.strictEqual(TRIAL.days, 30, 'Trial days must be 30');
  assert.strictEqual(TRIAL.credits, 300, 'Trial credits must be 300');
  assert.strictEqual(TRIAL.noCardRequired, true);

  assert.strictEqual(MODULE_CREDITS.seo, 1500);
  assert.strictEqual(MODULE_CREDITS.ads_report, 1500);
  assert.strictEqual(MODULE_CREDITS.ads_spy, 1000);
  assert.strictEqual(MODULE_CREDITS.focus3, 3200);
  assert.strictEqual(MODULE_CREDITS.all_in_one, 7875);

  assert.strictEqual(TOPUP_PACKS.length, 3);
  const starter = TOPUP_PACKS.find(p => p.id === 'starter');
  const growth = TOPUP_PACKS.find(p => p.id === 'growth');
  const scale = TOPUP_PACKS.find(p => p.id === 'scale');

  assert.strictEqual(starter.credits, 500);
  assert.strictEqual(starter.price, 500000);
  assert.strictEqual(growth.credits, 1050);
  assert.strictEqual(growth.price, 1000000);
  assert.strictEqual(scale.credits, 2750);
  assert.strictEqual(scale.price, 2500000);

  // Verifikasi FAQ: Pastikan ID menggunakan "kredit", bukan "credit"
  assert.ok(TRANSLATIONS.en.faq.q4);
  assert.ok(TRANSLATIONS.en.faq.q5);
  assert.ok(TRANSLATIONS.en.faq.q6);
  const enA5 = translate('en', 'faq.a5', { credits: TRIAL.credits, days: TRIAL.days, totalRoles: 16 });
  assert.match(enA5, /300\s+(free\s+)?credits?/i);

  assert.ok(TRANSLATIONS.id.faq.q4);
  assert.ok(TRANSLATIONS.id.faq.q5);
  assert.ok(TRANSLATIONS.id.faq.q6);
  const idA5 = translate('id', 'faq.a5', { credits: TRIAL.credits, days: TRIAL.days, totalRoles: 16 });
  assert.match(idA5, /300\s+(gratis\s+)?kredit/i, 'FAQ Indonesia wajib menggunakan "kredit"');
  assert.doesNotMatch(idA5, /300\s+credit/i, 'FAQ Indonesia tidak boleh menerima "300 credit"');
  console.log('   OK - Pricing & FAQ i18n valid.');

  // --- BAGIAN 2: Lifecycle Modul di Backend ---
  process.env.JWT_SECRET = 'test-secret-key-entitlements';
  process.env.PORT = '5014';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-entitlements';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5014';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailUser = `entitle.user.${ts}@testmarkimate.id`;
  const password = ['Trial', 'Pass', '123!', 'T'].join('');

  console.log('2. Mendaftarkan user baru untuk mendapatkan trial 7 hari...');
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

  console.log('3. Memverifikasi modul aktif saat trial (seo, ads_report, ads_spy)...');
  const initialModules = await getModules(workspaceId);
  assert.ok(initialModules.includes('seo'), 'SEO harus aktif');
  assert.ok(initialModules.includes('ads_report'), 'Ads Report harus aktif saat trial');
  assert.ok(initialModules.includes('ads_spy'), 'Ads Spy harus aktif saat trial');

  const seoCheck = await req('/api/keywords', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(seoCheck.status, 200);

  const adsCheck = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsCheck.status, 200);

  const spyCheck = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyCheck.status, 200);

  console.log('4. Mensimulasikan masa trial berakhir dan pemanggilan cron...');
  const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const allEnts = await db.findMany('module_entitlements', { workspace_id: workspaceId });
  for (const ent of allEnts) {
    await db.update('module_entitlements', { id: ent.id }, { ends_at: pastDate });
  }

  const cronRes = await req(`/api/cron/run-scheduled?secret=${process.env.CRON_SECRET}`, { method: 'GET' });
  assert.strictEqual(cronRes.status, 200);

  const expiredModules = await getModules(workspaceId);
  assert.ok(!expiredModules.includes('ads_report'));
  assert.ok(!expiredModules.includes('ads_spy'));
  assert.ok(expiredModules.includes('seo'), 'SEO harus tetap aktif sebagai fallback free tier');

  const adsExpiredCheck = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsExpiredCheck.status, 403);
  assert.strictEqual(adsExpiredCheck.data.code, 'MODULE_INACTIVE');

  const spyExpiredCheck = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyExpiredCheck.status, 403);
  assert.strictEqual(spyExpiredCheck.data.code, 'MODULE_INACTIVE');

  console.log('5. Mengaktifkan paket ads_report via admin subscription...');
  const adminSubRes = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY },
    body: { workspaceId, plan: 'ads_report', months: 1 }
  });
  assert.strictEqual(adminSubRes.status, 200);
  assert.ok(adminSubRes.data.modules.includes('ads_report'));

  const adsAfterSub = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsAfterSub.status, 200);

  console.log('6. Mengaktifkan paket all_in_one via admin...');
  const bundleSubRes = await req('/api/admin/subscriptions', {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY },
    body: { workspaceId, plan: 'all_in_one', months: 1 }
  });
  assert.strictEqual(bundleSubRes.status, 200);

  const spyAfterBundle = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyAfterBundle.status, 200);

  console.log('✅ ALL ENTITLEMENTS TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runEntitlementsTests().catch(err => {
  console.error('❌ Entitlements Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
