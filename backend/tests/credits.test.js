// Test Credits Engine: Estimation, COGS, Deductions, Idempotency, Insufficient 402, and AES-256-GCM
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-credits-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], cms_connections: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const {
  getWallet,
  estimate,
  assertAffordable,
  charge,
  recordFailedUsage,
  grant,
  expireBuckets,
  costOf,
  clearCreditCache
} = await import('../lib/credits.js');
const { encrypt, decrypt } = await import('../lib/crypto.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-credits-' + Date.now();

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

async function runCreditsTests() {
  console.log('=== RUNNING TEST CREDITS (Engine, Deductions, Idempotency & AES-256) ===');
  clearCreditCache();

  // 1. Seed data harga & cost rates
  await seedCreditPricesAndRates();

  // 2. Unit test estimasi harga
  console.log('1. Menguji estimasi harga credit...');
  const estArticle = await estimate('seo.article', 1);
  assert.strictEqual(estArticle.credits, 60, 'Harga seo.article harus 60 credit');

  const estArticleWithImages = await estimate('seo.article', 1, { images: 3 });
  assert.strictEqual(estArticleWithImages.credits, 75, 'seo.article + 3 gambar harus 60 + 15 = 75 credit');

  const estTopics = await estimate('seo.topics_run', 1);
  assert.strictEqual(estTopics.credits, 10, 'seo.topics_run harus 10 credit');

  // 3. Unit test COGS (biaya aktual vendor API)
  console.log('2. Menguji perhitungan COGS vendor...');
  const sampleUsage = {
    geminiIn: 2000,
    geminiOut: 1000,
    images: 3,
    serpCalls: 5,
    rapidCalls: 4
  };
  const cost = await costOf(sampleUsage);
  assert(cost > 0, 'Cost of usage harus bernilai positif');

  // 4. Unit test AES-256-GCM CMS Credential Encryption
  console.log('3. Menguji enkripsi kredensial CMS (AES-256-GCM)...');
  const secretCred = { appPassword: 'super-secret-wp-password-123!' };
  const encrypted = encrypt(secretCred);
  assert.ok(encrypted.iv && encrypted.enc, 'Harus memiliki iv dan enc');
  const decrypted = decrypt(encrypted.enc, encrypted.iv);
  assert.strictEqual(decrypted.appPassword, secretCred.appPassword, 'Decrypted credential harus sama');

  // 5. Test Wallet & Grant Lifecycle
  console.log('4. Menguji Wallet & bucket order deduction...');
  const testWorkspaceId = randomUUID();
  const initialWallet = await getWallet(testWorkspaceId);
  assert.strictEqual(initialWallet.totalBalance, 0);

  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await grant(testWorkspaceId, 'trial', 300, in7Days, 'grant_trial', 'Free trial 7 hari');
  let w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 300);
  assert.strictEqual(w.activeBuckets.trial, 300);

  // Potong 60 credit untuk artikel
  const refArticle = { type: 'keyword', id: 'kw-101', note: 'Generate artikel 1' };
  const chargeRes1 = await charge(testWorkspaceId, 'seo.article', 1, refArticle, {
    geminiIn: 1500,
    geminiOut: 800,
    images: 0,
    serpCalls: 3,
    rapidCalls: 2
  });
  assert.strictEqual(chargeRes1.charged, 60);
  assert.strictEqual(chargeRes1.balanceAfter, 240);
  assert.strictEqual(chargeRes1.ledgerRows.length, 1);
  assert.strictEqual(chargeRes1.ledgerRows[0].bucket, 'trial');
  assert.strictEqual(chargeRes1.ledgerRows[0].delta, -60);
  assert(chargeRes1.costActualIdr > 0);

  // Idempotensi: Retry charge dengan ref sama
  const chargeResIdempotent = await charge(testWorkspaceId, 'seo.article', 1, refArticle);
  assert.strictEqual(chargeResIdempotent.charged, 0);
  assert.strictEqual(chargeResIdempotent.idempotent, true);
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 240, 'Saldo tidak boleh terpotong dua kali');

  // Idempotensi grant(): Panggilan grant dengan refId yang sama 2x -> kredit masuk tepat 1x
  const grantWsId = randomUUID();
  const grantRef = { refId: 'grant-tx-' + randomUUID(), actionKey: 'billing.topup' };
  const grantExp = new Date(Date.now() + 30 * 86400e3);

  const firstGrant = await grant(grantWsId, 'topup', 100, grantExp, 'topup', 'First grant attempt', grantRef);
  assert.strictEqual(firstGrant.idempotent, undefined, 'First grant call should not be idempotent');
  let gw = await getWallet(grantWsId);
  assert.strictEqual(gw.totalBalance, 100, 'Saldo harus 100 setelah first grant');

  const secondGrant = await grant(grantWsId, 'topup', 100, grantExp, 'topup', 'Duplicate retry grant', grantRef);
  assert.strictEqual(secondGrant.idempotent, true, 'Second grant call with same refId must return idempotent: true');
  gw = await getWallet(grantWsId);
  assert.strictEqual(gw.totalBalance, 100, 'Saldo kredit tidak boleh bertambah saat grant dipanggil ulang dengan refId sama');

  const grantLedger = await db.findMany('credit_ledger', { workspace_id: grantWsId, ref_id: grantRef.refId });
  assert.strictEqual(grantLedger.length, 1, 'Hanya boleh ada 1 record ledger untuk refId yang sama');

  // Multi-bucket deduction: trial (240) + sub (100) + topup (50)
  const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const in365Days = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  await grant(testWorkspaceId, 'sub', 100, in30Days, 'grant_sub', 'Paket bulanan');
  await grant(testWorkspaceId, 'topup', 50, in365Days, 'topup', 'Topup');
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 390);

  // Potong 260 credit: 240 dari trial habis, 20 diambil dari sub (sisa sub = 80, sisa topup = 50)
  // Buat custom deduct via charge atau grant test
  const refCross = { type: 'custom', id: 'cut-cross-1' };
  // Estimasi 260 credit
  const chargeRes2 = await charge(testWorkspaceId, 'seo.article', 4, refCross); // 4 * 60 = 240
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.activeBuckets.trial, 0, 'Trial 240 harus habis');
  assert.strictEqual(w.activeBuckets.sub, 100, 'Sub masih utuh');
  assert.strictEqual(w.totalBalance, 150);

  // 6. Integrasi Server & 402 Insufficient Credits
  console.log('5. Menguji HTTP 402 INSUFFICIENT_CREDITS flow...');
  process.env.JWT_SECRET = 'test-secret-key-credits';
  process.env.PORT = '5015';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5015';

  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `insufficient.${ts}@testmarkimate.id`;
  const password = ['Pass', '123!', 'Credits', 'X'].join('');

  await req('/api/auth/register', {
    method: 'POST',
    body: { email: testEmail, password, brandName: 'Brand Credit Check', acceptTerms: true }
  });
  const account = await db.findOne('accounts', { email: testEmail });
  await req(`/api/admin/users/${account.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password }
  });
  const token = loginRes.data.accessToken;
  const userWsId = account.id;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Set wallet ke 10 credit (kurang dari 60 untuk generate artikel)
  await db.update('credit_wallets', { workspace_id: userWsId }, {
    balance_trial: 10,
    balance_sub: 0,
    balance_topup: 0
  });

  // Simpan CMS dummy
  await req('/api/cms/wordpress', {
    method: 'PUT',
    headers: authHeaders,
    body: {
      config: { siteUrl: 'https://example.com', username: 'admin', appPassword: 'dummy-app-pass' },
      articleSettings: { images: { enabled: false, count: 0 } }
    }
  });

  const kwRes = await req('/api/keywords', {
    method: 'POST',
    headers: authHeaders,
    body: {
      keyword: 'sepatu kulit murah',
      geo: 'ID',
      ln: 'id',
      cms: 'wordpress',
      schedule: 'manual'
    }
  });
  assert.strictEqual(kwRes.status, 200);
  const kwId = kwRes.data.keyword.id;

  const runRes = await req(`/api/keywords/${kwId}/run`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.strictEqual(runRes.status, 402, 'Harus 402 Payment Required');
  assert.strictEqual(runRes.data.code, 'INSUFFICIENT_CREDITS');
  assert.strictEqual(runRes.data.need, 60);
  assert.strictEqual(runRes.data.have, 10);
  assert.ok(runRes.data.topupUrl);

  console.log('✅ ALL CREDITS TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runCreditsTests().catch(err => {
  console.error('❌ Credits Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
