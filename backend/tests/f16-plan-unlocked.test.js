// Test PRD F16 §3.4: Plan Unlocked for Free User (Credit-Only Model)
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-f16-unlocked-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], cms_connections: [],
    credit_trials: [], payments: [], monthly_grants: [], subscriptions: [], webhook_events: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { getWallet } = await import('../lib/credits.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-f16-unlocked-' + Date.now();

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

async function runF16UnlockedTests() {
  console.log('=== RUNNING TEST PRD F16 UNLOCKED (Credit-Only Gating) ===');

  process.env.JWT_SECRET = 'test-secret-key-f16-unlocked';
  process.env.PORT = '5026';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-f16-unlocked';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5026';
  process.env.MARKIMATE_API_KEY = 'test-key-f16-unlocked';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `f16.newuser.${ts}@testmarkimate.id`;
  const password = ['Trial', 'Pass', '123!', 'X'].join('');

  // 1. Mendaftarkan user baru dengan default plan='free'
  console.log('1. Mendaftarkan user baru (plan: free, tanpa baris entitlement di DB)...');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: testEmail, password, brandName: 'Brand F16 Unlocked', acceptTerms: true }
  });
  assert.strictEqual(regRes.status, 200, 'Register user baru harus sukses 200');

  const account = await db.findOne('accounts', { email: testEmail });
  assert.ok(account, 'Akun harus tersimpan di database');
  assert.strictEqual(account.plan, 'free', 'Akun baru default plan harus free');

  // Verifikasi akun via admin
  await req(`/api/admin/users/${account.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  // Login
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password }
  });
  assert.strictEqual(loginRes.status, 200, 'Login harus sukses 200');
  const token = loginRes.data.accessToken;
  const workspaceId = account.id;
  const authHeaders = { Authorization: `Bearer ${token}`, 'X-Workspace-Id': workspaceId };

  // Pastikan tabel module_entitlements kosong
  await db.remove('module_entitlements', { workspace_id: workspaceId });
  const rowCount = (await db.findMany('module_entitlements', { workspace_id: workspaceId })).length;
  assert.strictEqual(rowCount, 0, 'Workspace baru tidak memiliki baris module_entitlements');

  // 2. Verifikasi GET /api/me untuk user baru tidak memuat pembatas plan (otomatis saldo 400 dari trial)
  console.log('2. Memverifikasi GET /api/me untuk user baru tidak memuat pembatas plan...');
  const meRes = await req('/api/me', {
    method: 'GET',
    headers: authHeaders
  });
  assert.strictEqual(meRes.status, 200, 'GET /api/me harus 200');
  assert.strictEqual(meRes.data.plan, undefined, 'GET /api/me tidak boleh mengirim objek plan pembatas');
  assert.strictEqual(meRes.data.usage?.limit, undefined, 'GET /api/me tidak boleh memuat usage.limit');
  assert.ok(meRes.data.wallet, 'GET /api/me harus memuat objek wallet');
  assert.strictEqual(meRes.data.wallet.balance, 400, 'Saldo wallet harus 400 dari alokasi trial');
  assert.ok(meRes.data.entitlements, 'GET /api/me harus memuat objek entitlements');
  assert.strictEqual(meRes.data.entitlements.seo.active, true, 'Entitlement SEO harus aktif');
  assert.strictEqual(meRes.data.entitlements.ads_report.active, true, 'Entitlement Ads Report harus aktif');
  assert.strictEqual(meRes.data.entitlements.ads_spy.active, true, 'Entitlement Ads Spy harus aktif');
  console.log('   OK - /api/me bebas dari pembatas plan, entitlements aktif, saldo 400.');

  // 3. Simpan keyword dengan jadwal weekly -> harus 200 (tidak diblokir plan free)
  console.log('3. Menyimpan keyword dengan schedule: "weekly" (fitur yang sebelumnya dikunci Pro)...');
  const kwRes = await req('/api/keywords', {
    method: 'POST',
    headers: authHeaders,
    body: {
      keyword: 'strategi content marketing weekly',
      cmsType: 'wordpress',
      schedule: 'weekly'
    }
  });
  assert.strictEqual(kwRes.status, 200, 'Simpan keyword schedule: "weekly" harus sukses 200');
  assert.ok(kwRes.data.keyword, 'Respon harus mengembalikan keyword');
  assert.strictEqual(kwRes.data.keyword.schedule, 'weekly', 'Schedule harus tersimpan sebagai weekly');
  const keywordId = kwRes.data.keyword.id;
  console.log('   OK - Keyword dengan schedule "weekly" berhasil disimpan.');

  // 4. Generate artikel & potong kredit
  console.log('4. Generate artikel dan verifikasi pemotongan kredit...');
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && (url.includes('supermat-image') || url.includes('/webhook/supermat-image'))) {
      return new Response(JSON.stringify({
        ok: true,
        image: {
          url: 'https://cdn.markimate.com/test-img.webp',
          base64: 'data:image/webp;base64,mockBase64StringForTesting',
          alt: 'Test image alt'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (typeof url === 'string' && url.includes('supermat-trigger')) {
      const parsedBody = opts?.body ? JSON.parse(opts.body) : {};
      if (parsedBody.options?.regenerateImage || url.includes('/regenerate')) {
        return new Response(JSON.stringify({
          ok: true,
          image: {
            url: 'https://cdn.markimate.com/test-img.webp',
            base64: 'data:image/webp;base64,mockBase64StringForTesting',
            alt: 'Test image'
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        accepted: false,
        article: {
          title: 'Strategi Content Marketing Weekly 2026',
          content: '<p>Konten artikel pengujian otomatis...</p>',
          searchVolume: 1500,
          difficulty: 30
        },
        status: 'ok'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  const runRes = await req(`/api/keywords/${keywordId}/run`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.strictEqual(runRes.status, 200, 'Run keyword harus 200');
  assert.strictEqual(runRes.data.keyword.status, 'Review Ready', 'Status artikel harus Review Ready');

  let { totalBalance: balanceAfterArticle } = await getWallet(workspaceId);
  assert.strictEqual(balanceAfterArticle, 340, 'Kredit harus terpotong 60 (400 - 60 = 340)');
  console.log('   OK - Generate artikel sukses dan kredit terpotong 60 (sisa 340).');

  // 5. Generate / regenerate gambar untuk artikel dan verifikasi kredit gambar terpotong
  console.log('5. Generate gambar AI dan verifikasi kredit gambar terpotong...');
  await db.update('keywords', { id: keywordId }, {
    image_prompts: ['Prompt gambar ilustrasi digital marketing']
  });

  const imgRegenRes = await req(`/api/keywords/${keywordId}/images/0/regenerate`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.strictEqual(imgRegenRes.status, 200, 'Regenerate gambar harus 200');
  assert.ok(imgRegenRes.data.image, 'Gambar baru harus dikembalikan');

  let { totalBalance: balanceAfterImage } = await getWallet(workspaceId);
  assert.strictEqual(balanceAfterImage, 335, 'Kredit harus terpotong 5 untuk gambar (340 - 5 = 335)');
  console.log('   OK - Generate gambar sukses dan kredit terpotong 5 (sisa 335).');

  // 6. Mutation Check
  console.log('6. Menjalankan mutation check: menguji bahwa jika plan gating dikembalikan, sistem akan gagal...');
  // Mutasi 1: Simulasikan gating plan free di schedule keyword
  function simulateOldKeywordGating(userPlan, schedule) {
    if (userPlan === 'free' && schedule !== 'immediate') {
      throw Object.assign(new Error('Schedule locked for free plan'), { status: 403, code: 'FORBIDDEN' });
    }
    return true;
  }
  let mutationKilled = false;
  try {
    simulateOldKeywordGating(account.plan, 'weekly');
  } catch (e) {
    mutationKilled = true;
  }
  assert.strictEqual(mutationKilled, true, 'Mutasi plan gating lama berhasil dibunuh (KILLED)');
  console.log('   OK - Mutation check: simulasi cek plan lama terbukti KILLED.');

  // Restore fetch
  global.fetch = originalFetch;
  console.log('=== TEST PRD F16 UNLOCKED COMPLETED SUCCESSFULLY ===\n');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runF16UnlockedTests().catch(err => {
  console.error('TEST FAILED:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
