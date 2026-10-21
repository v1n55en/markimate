// PRD generate-timeout: Test suite asinkron callback, penjaga status macet > 10 menit, dan idempotensi kredit
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-gentimeout-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_orders: [],
    cms_connections: [], seo_topic_sources: [], credit_trials: [], payments: [], monthly_grants: [],
    subscriptions: [], webhook_events: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
  process.env.NODE_ENV = 'test';
  process.env.FORCE_LOCAL_DB = 'true';
}

process.env.SUPERMAT_API_KEY = 'mkm_test_supermat_secret_key_123';
process.env.MARKIMATE_API_KEY = 'mkm_test_supermat_secret_key_123';
process.env.CREDITS_ENABLED = 'true';

const { db } = await import('../db.js');
const { default: app } = await import('../index.js');
const { getWallet, grant } = await import('../lib/credits.js');
const { signAccessToken } = await import('../lib/session.js');

console.log('=== RUNNING GENERATE TIMEOUT & ASYNC CALLBACK TESTS ===\n');

try {
  // Setup data awal: User & Workspace
  const testUserId = randomUUID();
  const testWsId = randomUUID();

  await db.insert('accounts', {
    id: testUserId,
    email: 'creator.async@testmarkimate.id',
    name: 'Async Writer',
    status: 'active',
    web_approver: true
  });

  await db.insert('workspaces', {
    id: testWsId,
    owner_user_id: testUserId,
    name: 'Workspace Async Test'
  });

  await db.insert('workspace_members', {
    workspace_id: testWsId,
    user_id: testUserId,
    role: 'admin',
    joined_at: new Date().toISOString()
  });

  await db.insert('module_entitlements', {
    workspace_id: testWsId,
    module: 'seo',
    source: 'admin',
    starts_at: new Date().toISOString()
  });

  // Beri saldo awal 300 kredit
  await grant(testWsId, 'topup', 300, null, 'topup', 'Initial test wallet balance');
  const balanceInitial = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceInitial, 300, 'Saldo awal harus 300 kredit');

  const server = app.listen(0);
  const serverPort = server.address().port;
  const baseUrl = `http://localhost:${serverPort}`;
  const token = signAccessToken({ id: testUserId, email: 'creator.async@testmarkimate.id' });

  // --------------------------------------------------------------------------
  // TEST 1: Callback dengan key salah / tanpa header -> 401
  // --------------------------------------------------------------------------
  console.log('1. Menguji keamanan callback dengan header X-Supermat-Key salah / hilang...');
  const resAuthFail = await fetch(`${baseUrl}/api/n8n/callback/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermat-Key': 'key_palsu_tidak_valid'
    },
    body: JSON.stringify({ requestId: randomUUID(), status: 'ok' })
  });
  assert.strictEqual(resAuthFail.status, 401, 'Harus merespons 401 jika API key salah');
  const jsonAuthFail = await resAuthFail.json();
  assert.strictEqual(jsonAuthFail.code, 'UNAUTHORIZED');
  console.log('   ✓ Callback dengan key salah berhasil ditolak 401.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Run keyword -> membalas 202 dan status tetap 'AI Writing...'
  // --------------------------------------------------------------------------
  console.log('2. Menguji POST /api/keywords/:id/run menghasilkan status 202 & AI Writing...');
  const kw1Id = randomUUID();
  await db.insert('keywords', {
    id: kw1Id,
    user_id: testUserId,
    workspace_id: testWsId,
    keyword: 'rekomendasi framework javascript 2026',
    geo: 'ID',
    ln: 'id',
    status: 'Pending',
    schedule: 'immediate',
    article_options: { length: 'standard', images: { mode: 'none' } }
  });

  // Mock fetch ke n8n agar merespons accepted 202
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('supermat-trigger')) {
      const parsedBody = JSON.parse(opts.body);
      assert.ok(parsedBody.requestId, 'n8n harus menerima requestId');
      assert(parsedBody.callbackUrl.includes('/api/n8n/callback/generate'), 'n8n harus menerima callbackUrl');
      return new Response(JSON.stringify({ accepted: true, status: 'accepted', requestId: parsedBody.requestId }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, opts);
  };

  const resRun = await originalFetch(`${baseUrl}/api/keywords/${kw1Id}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWsId
    }
  });

  assert.strictEqual(resRun.status, 202, 'Endpoint run harus membalas HTTP 202 saat asinkron');
  const jsonRun = await resRun.json();
  assert.strictEqual(jsonRun.keyword.status, 'AI Writing...', 'Status keyword harus AI Writing...');

  // Kredit belum boleh terpotong saat masih AI Writing...
  const balanceAfterRun = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceAfterRun, 300, 'Kredit tidak boleh terpotong saat generate baru dimulai (AI Writing...)');
  console.log('   ✓ Run keyword asinkron membalas 202 dan kredit belum terpotong.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Callback sukses -> artikel tersimpan dan credit terpotong 1x
  // --------------------------------------------------------------------------
  console.log('3. Menguji callback sukses -> artikel tersimpan & kredit terpotong 1× (60 credit)...');
  const resCallbackSuccess = await originalFetch(`${baseUrl}/api/n8n/callback/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermat-Key': process.env.MARKIMATE_API_KEY
    },
    body: JSON.stringify({
      requestId: kw1Id,
      status: 'ok',
      article: {
        title: 'Panduan Framework JavaScript 2026',
        slug: 'panduan-framework-javascript-2026',
        excerpt: 'Ringkasan tren JS 2026.',
        bodyMarkdown: '## Pendahuluan\nFramework modern...',
        searchVolume: 1200,
        difficulty: 25
      }
    })
  });

  assert.strictEqual(resCallbackSuccess.status, 200, 'Callback sukses harus mengembalikan HTTP 200');
  const jsonCb1 = await resCallbackSuccess.json();
  assert.strictEqual(jsonCb1.ok, true);

  const kwDbAfter = await db.findOne('keywords', { id: kw1Id });
  assert.strictEqual(kwDbAfter.status, 'Review Ready', 'Status harus menjadi Review Ready');
  assert.strictEqual(kwDbAfter.article.title, 'Panduan Framework JavaScript 2026');
  assert.strictEqual(kwDbAfter.volume, 1200);

  // Standar 900 kata = 60 credit
  const balanceAfterCb1 = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceAfterCb1, 240, 'Kredit harus terpotong tepat 60 kredit (300 - 60 = 240)');
  console.log('   ✓ Callback sukses menyimpan artikel & memotong tepat 1× biaya kredit.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Callback dua kali -> tetap 1x (idempotensi mutlak)
  // --------------------------------------------------------------------------
  console.log('4. Menguji callback dipanggil dua kali (idempotensi) -> kredit tetap 1×...');
  const resCallbackDup = await originalFetch(`${baseUrl}/api/n8n/callback/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermat-Key': process.env.MARKIMATE_API_KEY
    },
    body: JSON.stringify({
      requestId: kw1Id,
      status: 'ok',
      article: {
        title: 'Panduan Framework JavaScript 2026 (Duplikat callback)',
        bodyMarkdown: '## Pendahuluan\nFramework modern...'
      }
    })
  });

  assert.strictEqual(resCallbackDup.status, 200);
  const jsonCb2 = await resCallbackDup.json();
  assert.strictEqual(jsonCb2.status, 'already_processed', 'Harus mendeteksi sudah diproses');

  const balanceAfterCb2 = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceAfterCb2, 240, 'Saldo harus tetap 240 (kredit tidak boleh terpotong 2x)');
  console.log('   ✓ Callback duplikat berhasil dicegah & saldo tetap utuh.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Penjaga status macet > 10 menit -> Error GENERATE_TIMEOUT, credit 0
  // --------------------------------------------------------------------------
  console.log('5. Menguji penjaga status macet: keyword AI Writing... > 10 menit -> Error GENERATE_TIMEOUT...');
  const stuckKwId = randomUUID();
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  await db.insert('keywords', {
    id: stuckKwId,
    user_id: testUserId,
    workspace_id: testWsId,
    keyword: 'rekomendasi agency automasi', // Kasus nyata produksi 21 Okt
    status: 'AI Writing...',
    created_at: elevenMinutesAgo,
    last_run_at: elevenMinutesAgo
  });

  // Panggil GET /api/keywords (lazy check)
  const resList = await originalFetch(`${baseUrl}/api/keywords`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWsId
    }
  });

  assert.strictEqual(resList.status, 200);
  const jsonList = await resList.json();
  const foundStuck = jsonList.keywords.find(k => k.id === stuckKwId);
  assert(foundStuck, 'Keyword harus ada di list');
  assert.strictEqual(foundStuck.status, 'Error', 'Keyword macet harus otomatis diubah ke Error');
  assert.strictEqual(foundStuck.error, 'GENERATE_TIMEOUT', 'Error code harus GENERATE_TIMEOUT');

  // Pastikan kredit tidak berkurang sama sekali
  const balanceAfterTimeout = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceAfterTimeout, 240, 'Kredit tidak boleh berkurang (tetap 240)');
  console.log('   ✓ Keyword macet > 10 menit berhasil ditandai Error GENERATE_TIMEOUT tanpa memotong kredit.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Tombol Coba Lagi tetap jalan pada keyword yang Error GENERATE_TIMEOUT
  // --------------------------------------------------------------------------
  console.log('6. Menguji tombol "Coba Lagi" pada keyword GENERATE_TIMEOUT...');
  const resRetry = await originalFetch(`${baseUrl}/api/keywords/${stuckKwId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWsId
    }
  });
  assert.strictEqual(resRetry.status, 202, 'Coba lagi harus sukses memicu generate (202)');
  const jsonRetry = await resRetry.json();
  assert.strictEqual(jsonRetry.keyword.status, 'AI Writing...', 'Status harus kembali ke AI Writing...');
  console.log('   ✓ Tombol coba lagi berhasil berjalan dengan mulus.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Keyword dengan last_run_at 2 hari lalu dijalankan ulang -> TIDAK boleh langsung jadi GENERATE_TIMEOUT
  // --------------------------------------------------------------------------
  console.log('7. Menguji keyword dengan last_run_at 2 hari lalu dijalankan ulang tidak langsung jadi GENERATE_TIMEOUT...');
  const oldKwId = randomUUID();
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await db.insert('keywords', {
    id: oldKwId,
    user_id: testUserId,
    workspace_id: testWsId,
    keyword: 'tips seo website ecommerce 2026',
    status: 'Error',
    error: 'GENERATE_TIMEOUT',
    created_at: twoDaysAgo,
    last_run_at: twoDaysAgo,
    updated_at: twoDaysAgo
  });

  // Jalankan ulang keyword yang memiliki last_run_at 2 hari lalu
  const resRerun = await originalFetch(`${baseUrl}/api/keywords/${oldKwId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWsId
    }
  });
  assert.strictEqual(resRerun.status, 202, 'Rerun keyword harus membalas HTTP 202');
  const jsonRerun = await resRerun.json();
  assert.strictEqual(jsonRerun.keyword.status, 'AI Writing...', 'Status harus beralih ke AI Writing...');

  // Segera panggil GET /api/keywords (yang memicu lazy check cleanupStuckKeywords)
  const resListAfterRerun = await originalFetch(`${baseUrl}/api/keywords`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWsId
    }
  });
  assert.strictEqual(resListAfterRerun.status, 200);
  const jsonListAfterRerun = await resListAfterRerun.json();
  const foundRerun = jsonListAfterRerun.keywords.find(k => k.id === oldKwId);
  assert(foundRerun, 'Keyword harus ditemukan di list keywords');
  assert.strictEqual(foundRerun.status, 'AI Writing...', 'Status harus TETAP AI Writing... dan tidak boleh langsung timeout');
  assert.strictEqual(foundRerun.error, '', 'Error harus kosong');

  const kwDbRerun = await db.findOne('keywords', { id: oldKwId });
  assert(new Date(kwDbRerun.last_run_at).getTime() > Date.now() - 10000, 'last_run_at harus di-update ke timestamp saat ini');
  assert(new Date(kwDbRerun.updated_at).getTime() > Date.now() - 10000, 'updated_at harus di-update ke timestamp saat ini');
  console.log('   ✓ Keyword dengan last_run_at 2 hari lalu berhasil di-reset last_run_at & kebal dari false-positive timeout.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Callback yang datang setelah GENERATE_TIMEOUT -> artikel tersimpan dan credit 1x
  // --------------------------------------------------------------------------
  console.log('8. Menguji callback yang datang setelah status GENERATE_TIMEOUT (artikel tersimpan & credit 1x)...');
  const lateKwId = randomUUID();
  await db.insert('keywords', {
    id: lateKwId,
    user_id: testUserId,
    workspace_id: testWsId,
    keyword: 'panduan pemasaran b2b 2026',
    status: 'Error',
    error: 'GENERATE_TIMEOUT',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    last_run_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  });

  const balanceBeforeLate = (await getWallet(testWsId)).totalBalance;

  // Callback n8n sukses datang terlambat
  const latePayload = {
    requestId: lateKwId,
    status: 'ok',
    article: {
      title: 'Panduan Lengkap Pemasaran B2B 2026',
      slug: 'panduan-lengkap-pemasaran-b2b-2026',
      excerpt: 'Ringkasan strategi pemasaran B2B terkini.',
      bodyMarkdown: '# Panduan B2B\n\nIsi artikel pemasaran B2B lengkap.',
      keywords: ['b2b', 'marketing'],
      wordCount: 850
    },
    usage: { promptTokens: 400, candidatesTokens: 900 }
  };

  const resLateCallback = await originalFetch(`${baseUrl}/api/n8n/callback/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermat-Key': 'mkm_test_supermat_secret_key_123'
    },
    body: JSON.stringify(latePayload)
  });

  assert.strictEqual(resLateCallback.status, 200, 'Callback yang datang setelah GENERATE_TIMEOUT harus diterima 200 OK');
  const jsonLateCallback = await resLateCallback.json();
  assert.strictEqual(jsonLateCallback.ok, true);

  // Verifikasi artikel tersimpan di database dan status berubah menjadi Review Ready
  const kwDbLate = await db.findOne('keywords', { id: lateKwId });
  assert.strictEqual(kwDbLate.status, 'Review Ready', 'Status harus pulih menjadi Review Ready');
  assert.strictEqual(kwDbLate.error, '', 'Error GENERATE_TIMEOUT harus di-clear');
  assert.ok(kwDbLate.article, 'Artikel harus tersimpan');
  assert.strictEqual(kwDbLate.article.title, 'Panduan Lengkap Pemasaran B2B 2026');

  // Verifikasi kredit dipotong tepat 1x (60 credit untuk artikel standar)
  const balanceAfterLate = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceBeforeLate - balanceAfterLate, 60, 'Kredit harus dipotong tepat 60 kredit untuk artikel');

  // Verifikasi idempotensi: jika callback terulang dikirim, kredit tidak boleh dipotong lagi
  const resDupCallback = await originalFetch(`${baseUrl}/api/n8n/callback/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermat-Key': 'mkm_test_supermat_secret_key_123'
    },
    body: JSON.stringify(latePayload)
  });
  assert.strictEqual(resDupCallback.status, 200);
  const jsonDupCallback = await resDupCallback.json();
  assert.strictEqual(jsonDupCallback.status, 'already_processed', 'Callback kedua harus terdeteksi already_processed');
  const balanceAfterDup = (await getWallet(testWsId)).totalBalance;
  assert.strictEqual(balanceAfterDup, balanceAfterLate, 'Kredit tidak boleh terpotong untuk kedua kalinya (tetap 1x)');
  console.log('   ✓ Callback terlambat setelah GENERATE_TIMEOUT berhasil menyimpan artikel dan memotong kredit tepat 1x.\n');

  global.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
} finally {
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch (_) {}
  }
}

console.log('🎉 SEMUA TEST GENERATE TIMEOUT & ASYNC CALLBACK LOLOS 100%!\n');
process.exit(0);
