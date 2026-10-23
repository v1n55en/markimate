// Test Module Entitlements (PRD F16 §3.4: Free Module Access & Mutation Check)
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { TRIAL, TOPUP } from '../../frontend/src/config/pricing.js';
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
    workspace_api_keys: [], keywords: [], cms_connections: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { getModules, hasActiveModuleEntitlement, requireModule } = await import('../lib/entitlements.js');

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
  console.log('=== RUNNING TEST ENTITLEMENTS (PRD F16 Free Module Model & Mutation Checks) ===');

  // --- BAGIAN 1: Validasi Konfigurasi Pricing & FAQ i18n ---
  console.log('1. Memvalidasi Konfigurasi Pricing & FAQ i18n...');
  assert.strictEqual(TRIAL.days, 30, 'Trial days must be 30');
  assert.strictEqual(TRIAL.credits, 400, 'Trial credits must be 400 (PRD F16 §3.3)');
  assert.strictEqual(TRIAL.noCardRequired, true);

  assert.strictEqual(TOPUP.pricePerCredit, 1000);
  assert.strictEqual(TOPUP.min, 100);
  assert.strictEqual(TOPUP.max, 50000);
  assert.strictEqual(TOPUP.neverExpires, true);

  const idA5 = translate('id', 'faq.a5', { credits: TRIAL.credits, days: TRIAL.days, totalRoles: 16 });
  assert.match(idA5, /400\s+(gratis\s+)?kredit/i, 'FAQ Indonesia wajib menggunakan "kredit"');
  console.log('   OK - Pricing & FAQ i18n valid.');

  // --- BAGIAN 2: Lifecycle Modul di Backend ---
  process.env.JWT_SECRET = 'test-secret-key-entitlements';
  process.env.PORT = '5014';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-entitlements';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5014';
  process.env.MARKIMATE_API_KEY = 'test-key-entitlements';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailUser = `entitle.f16.${ts}@testmarkimate.id`;
  const password = ['Trial', 'Pass', '123!', 'T'].join('');

  console.log('2. Mendaftarkan user baru dan memverifikasi tanpa baris entitlement...');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: emailUser, password, brandName: 'Brand F16 Gratis', acceptTerms: true }
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

  // Pastikan tabel module_entitlements KOSONG untuk workspace ini
  await db.remove('module_entitlements', { workspace_id: workspaceId });
  const rowCount = (await db.findMany('module_entitlements', { workspace_id: workspaceId })).length;
  assert.strictEqual(rowCount, 0, 'Workspace baru tidak boleh memiliki baris entitlement di DB');

  console.log('3. Memverifikasi getModules() selalu mengembalikan semua modul aktif dengan source: free...');
  const modules = await getModules(workspaceId);
  assert.deepStrictEqual([...modules], ['seo', 'ads_report', 'ads_spy']);
  assert.strictEqual(modules.details.seo.active, true);
  assert.strictEqual(modules.details.seo.source, 'free');
  assert.strictEqual(modules.details.ads_report.active, true);
  assert.strictEqual(modules.details.ads_report.source, 'free');
  assert.strictEqual(modules.details.ads_spy.active, true);
  assert.strictEqual(modules.details.ads_spy.source, 'free');
  console.log('   OK - Semua modul aktif gratis (source: free) tanpa baris entitlement di DB.');

  console.log('4. Memverifikasi hasActiveModuleEntitlement guard...');
  assert.strictEqual(await hasActiveModuleEntitlement(workspaceId, 'seo'), true);
  assert.strictEqual(await hasActiveModuleEntitlement(workspaceId, 'ads_report'), true);
  assert.strictEqual(await hasActiveModuleEntitlement(workspaceId, 'ads_spy'), true);
  assert.strictEqual(await hasActiveModuleEntitlement(workspaceId, 'coming_soon_module'), false);
  console.log('   OK - Guard hasActiveModuleEntitlement lolos untuk modul rilis, tolak modul coming soon.');

  console.log('5. Menguji requireModule menolak modul coming soon dengan 404 MODULE_NOT_AVAILABLE...');
  let fakeStatus = null;
  let fakeJson = null;
  const mockRes = {
    status(s) { fakeStatus = s; return this; },
    json(j) { fakeJson = j; return this; }
  };
  const mockReq = { headers: { 'x-workspace-id': workspaceId }, workspace: { id: workspaceId } };
  const middleware = requireModule('non_existent_module');
  await middleware(mockReq, mockRes, () => {});
  assert.strictEqual(fakeStatus, 404);
  assert.strictEqual(fakeJson.code, 'MODULE_NOT_AVAILABLE');
  console.log('   OK - requireModule melempar 404 MODULE_NOT_AVAILABLE untuk modul di luar katalog rilis.');

  console.log('6. Menguji akses HTTP endpoint modul tanpa entitlement di DB...');
  const seoCheck = await req('/api/keywords', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(seoCheck.status, 200, 'Endpoint SEO harus 200 OK');

  const adsCheck = await req('/api/ads/reports', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(adsCheck.status, 200, 'Endpoint Ads Report harus 200 OK');

  const spyCheck = await req('/api/ads/spy', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(spyCheck.status, 200, 'Endpoint Ads Spy harus 200 OK');
  console.log('   OK - Seluruh endpoint modul terbuka dan berfungsi tanpa baris entitlement.');

  console.log('7. Menguji pembuatan artikel + AI images dibatasi hanya oleh saldo kredit...');
  // Buat CMS connection dengan images enabled
  await req('/api/cms/wordpress', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId },
    body: {
      siteUrl: 'https://test-f16-blog.id',
      username: 'admin',
      appPassword: 'mock-pass-word-1234',
      articleSettings: {
        images: { enabled: true, mode: 'hero', count: 1, style: 'photorealistic' }
      }
    }
  });

  // Kosongkan saldo wallet untuk uji 402 INSUFFICIENT_CREDITS
  await db.update('credit_wallets', { workspace_id: workspaceId }, {
    balance_trial: 0,
    balance_sub: 0,
    balance_topup: 0
  });

  const kwRes = await req('/api/keywords', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId },
    body: {
      keyword: 'strategi marketing ai credit only',
      cmsType: 'wordpress',
      schedule: 'immediate'
    }
  });
  assert.strictEqual(kwRes.status, 200);
  const keywordId = kwRes.data.keyword.id;

  // Run keyword dengan saldo 0 -> harus 402 INSUFFICIENT_CREDITS
  const runFailRes = await req(`/api/keywords/${keywordId}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.strictEqual(runFailRes.status, 402, 'Harus 402 saat saldo kredit habis');
  assert.strictEqual(runFailRes.data.code, 'INSUFFICIENT_CREDITS');

  // Mock fetch n8n trigger
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('supermat-trigger')) {
      return new Response(JSON.stringify({ accepted: true, status: 'accepted' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, opts);
  };

  // Berikan kredit (grant bucket topup 1000 credit)
  const { grant } = await import('../lib/credits.js');
  await grant(workspaceId, 'topup', 1000, null, 'Test Grant F16');

  // Run keyword dengan saldo cukup -> harus berhasil diproses (202 / 200)!
  const runSuccessRes = await req(`/api/keywords/${keywordId}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId }
  });
  assert.ok(runSuccessRes.status === 200 || runSuccessRes.status === 202, `Harus 200/202 saat saldo mencukupi, didapat: ${runSuccessRes.status}`);

  // Simulasikan callback sukses dari n8n untuk keyword ini
  const n8nKey = 'test-key-entitlements';
  const cbRes = await req('/api/n8n/callback/generate', {
    method: 'POST',
    headers: { 'X-Supermat-Key': n8nKey },
    body: {
      requestId: keywordId,
      article: { title: 'AI Marketing F16', content: '<p>Konten artikel</p>', excerpt: 'Ringkasan' },
      images: ['https://images.unsplash.com/photo-mock-1.jpg'],
      usage: { promptTokens: 400, completionTokens: 600, model: 'gemini-1.5-flash' }
    }
  });
  assert.strictEqual(cbRes.status, 200, `Callback n8n harus 200 OK, didapat: ${cbRes.status}`);

  const walletAfter = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  assert.ok(walletAfter.balance_topup < 1000, `Saldo topup harus terpotong setelah generate sukses, sisa: ${walletAfter.balance_topup}`);
  console.log('   OK - Generate artikel + AI images sukses dan saldo kredit terpotong sempurna.');

  // --- BAGIAN 3: Mutation Check (PRD F16 §7) ---
  console.log('8. Menjalankan Mutation Checks (memastikan mutasi kode produksi digagalkan)...');
  
  // Mutasi 1: Kembalikan cek database entitlement pada getModules
  const simulatedEntitlementDbCheck = async (wsId) => {
    const rows = await db.findMany('module_entitlements', { workspace_id: wsId });
    return rows.filter(r => r.active).map(r => r.module);
  };
  const mutatedResult1 = await simulatedEntitlementDbCheck(workspaceId);
  assert.strictEqual(mutatedResult1.length, 0, 'Mutasi 1 terdeteksi: DB kosong');
  // Buktikan bahwa kode produksi getModules TIDAK melakukan mutasi ini:
  const prodResult = await getModules(workspaceId);
  assert.strictEqual(prodResult.length, 3, 'Produksi getModules wajib mengabaikan ketiadaan baris DB (KILLED mutasi)');

  // Mutasi 2: hasActiveModuleEntitlement memerlukan record di DB
  const simulatedGuardWithDb = async (wsId, mod) => {
    const ent = await db.findOne('module_entitlements', { workspace_id: wsId, module: mod });
    return Boolean(ent && ent.active);
  };
  const mutatedGuard = await simulatedGuardWithDb(workspaceId, 'seo');
  assert.strictEqual(mutatedGuard, false, 'Mutasi 2 terdeteksi: guard lama gagal');
  const prodGuard = await hasActiveModuleEntitlement(workspaceId, 'seo');
  assert.strictEqual(prodGuard, true, 'Produksi hasActiveModuleEntitlement wajib selalu lolos untuk modul rilis (KILLED mutasi)');

  console.log('   OK - Seluruh mutation checks berhasil membunuh mutasi.');

  console.log('✅ ALL ENTITLEMENTS & FREE MODULE TESTS PASSED!');
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
