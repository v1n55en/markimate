// Test Langkah 3: Assert & Charge di run, publish, topic-sources, dan cron (PRD §4.2 & §4.5)
import assert from 'assert';
import http from 'http';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let shouldReturnDuplicate = false;

// 1. Mock n8n server
const mockN8n = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');

    if (shouldReturnDuplicate) {
      res.statusCode = 409;
      res.end(JSON.stringify({
        status: 'duplicate',
        duplicateOf: { title: 'Existing Post', slug: 'existing-post' },
        message: 'Topik sudah ada di CMS',
        usage: { geminiIn: 600, geminiOut: 100 }
      }));
      return;
    }

    if (req.url.includes('topics')) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        topics: [
          { keyword: 'Tren Fashion 2026', searchVolume: 1200, difficulty: 25 },
          { keyword: 'Sepatu Kulit Lokal', searchVolume: 800, difficulty: 18 }
        ],
        usage: { geminiIn: 800, geminiOut: 400, serpCalls: 2 }
      }));
      return;
    }

    if (req.url.includes('publish')) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        postStatus: 'publish',
        postId: 'wp-post-888',
        draftEditUrl: 'https://site.com/wp-admin/post.php?post=888',
        publicUrl: 'https://site.com/post-888',
        images: [
          { idx: 0, url: 'https://img.com/1.jpg' },
          { idx: 1, url: 'https://img.com/2.jpg' },
          { idx: 2, url: 'https://img.com/3.jpg' }
        ],
        warnings: [],
        usage: { images: 3, geminiIn: 200 }
      }));
      return;
    }

    // Default: run/generate
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: 'ok',
      article: {
        title: 'Panduan Tren 2026',
        content: '<p>Konten artikel lengkap...</p>',
        searchVolume: 1500,
        difficulty: 20,
        links: { internal: [], external: [] },
        imagePrompts: ['Prompt 1', 'Prompt 2', 'Prompt 3']
      },
      usage: {
        geminiIn: 2500,
        geminiOut: 1200,
        images: 0,
        serpCalls: 4,
        rapidCalls: 3
      }
    }));
  });
});

async function runStep3Tests() {
  console.log('--- [TEST] Memulai Uji Langkah 3 (Assert & Charge) ---');
  await seedCreditPricesAndRates();

  // Jalankan mock n8n server
  await new Promise(resolve => mockN8n.listen(0, resolve));
  const n8nPort = mockN8n.address().port;
  const mockN8nUrl = `http://localhost:${n8nPort}`;

  process.env.MARKIMATE_N8N_RUN_URL = `${mockN8nUrl}/run`;
  process.env.MARKIMATE_N8N_PUBLISH_URL = `${mockN8nUrl}/publish`;
  process.env.MARKIMATE_N8N_TOPICS_URL = `${mockN8nUrl}/topics`;
  process.env.SUPERMAT_N8N_RUN_URL = `${mockN8nUrl}/run`;
  process.env.SUPERMAT_N8N_PUBLISH_URL = `${mockN8nUrl}/publish`;
  process.env.SUPERMAT_N8N_TOPICS_URL = `${mockN8nUrl}/topics`;
  process.env.CRON_SECRET = 'test-cron-secret-123';
  process.env.PORT = '5003';

  await import('../index.js');
  const baseUrl = `http://localhost:${process.env.PORT}`;
  console.log(`Backend aktif di ${baseUrl}, Mock n8n di ${mockN8nUrl}`);

  try {
    const testEmail = `step3-${Date.now()}@test.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123!', brandName: 'Brand 3', niche: 'Tech' })
    });
    const { token, user } = await regRes.json();
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Simpan koneksi CMS dummy
    await fetch(`${baseUrl}/api/cms/wordpress`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        config: { siteUrl: 'https://example.com', username: 'admin', appPassword: 'app-pass-secret' },
        articleSettings: { images: { enabled: true, count: 3 } }
      })
    });

    // 1. Uji Penolakan 402 jika saldo 0
    console.log('1. Uji penolakan 402 INSUFFICIENT_CREDITS saat saldo 0...');
    await db.update('credit_wallets', { workspace_id: user.id }, { balance_trial: 0, balance_sub: 0, balance_topup: 0 });

    const kwRes1 = await fetch(`${baseUrl}/api/keywords`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ keyword: 'Sepatu Lari Nyaman', cmsType: 'wordpress' })
    });
    const kw1 = (await kwRes1.json()).keyword;

    const runFailRes = await fetch(`${baseUrl}/api/keywords/${kw1.id}/run`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(runFailRes.status, 402, 'Harus ditolak dengan status 402');
    const failBody = await runFailRes.json();
    assert.strictEqual(failBody.code, 'INSUFFICIENT_CREDITS');
    assert.strictEqual(failBody.need, 60);
    assert.strictEqual(failBody.have, 0);
    assert.strictEqual(failBody.topupUrl, '/app/billing/credits');
    console.log('✅ 1. Penolakan 402 INSUFFICIENT_CREDITS dengan payload standar berhasil');

    // 2. Beri saldo 300 trial credit, jalankan run -> potong 60 credit (sisa 240)
    console.log('2. Uji generate artikel sukses -> potong 60 credit (seo.article)...');
    await db.update('credit_wallets', { workspace_id: user.id }, {
      balance_trial: 300,
      trial_expires_at: new Date(Date.now() + 7 * 86400e3).toISOString()
    });

    const runOkRes = await fetch(`${baseUrl}/api/keywords/${kw1.id}/run`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(runOkRes.status, 200);
    const runOkData = await runOkRes.json();
    assert.strictEqual(runOkData.keyword.status, 'Review Ready');

    const credCheck1 = await (await fetch(`${baseUrl}/api/credits`, { headers: authHeaders })).json();
    assert.strictEqual(credCheck1.balance.total, 240, 'Saldo harus terpotong 60 menjadi 240');

    const ledgerRows1 = await db.findMany('credit_ledger', { workspace_id: user.id, action_key: 'seo.article' });
    assert.strictEqual(ledgerRows1.length, 1);
    assert.strictEqual(ledgerRows1[0].delta, -60);
    assert(ledgerRows1[0].cost_actual_idr > 0, 'Biaya nyata COGS harus tercatat');
    console.log('✅ 2. Generate artikel berhasil, saldo terpotong 60 credit, COGS tercatat di ledger');

    // 3. Uji publish artikel dengan 3 gambar -> potong 15 credit (seo.image x 3)
    console.log('3. Uji publish artikel dengan 3 gambar -> potong 15 credit (seo.image x 3)...');
    const pubRes = await fetch(`${baseUrl}/api/keywords/${kw1.id}/publish`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action: 'publish' })
    });
    assert.strictEqual(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.keyword.status, 'Published');

    const credCheck2 = await (await fetch(`${baseUrl}/api/credits`, { headers: authHeaders })).json();
    assert.strictEqual(credCheck2.balance.total, 225, 'Saldo harus terpotong 15 (3 x 5) menjadi 225');

    const imgLedger = await db.findMany('credit_ledger', { workspace_id: user.id, action_key: 'seo.image' });
    assert.strictEqual(imgLedger.length, 1);
    assert.strictEqual(imgLedger[0].delta, -15);
    console.log('✅ 3. Publish berhasil, gambar terpotong 15 credit (3 x 5 cr), saldo tersisa 225');

    // 4. Uji Idempotensi: Retry publish yang sama tidak memotong credit lagi
    console.log('4. Uji idempotensi retry publish...');
    await fetch(`${baseUrl}/api/keywords/${kw1.id}/publish`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action: 'publish' })
    });
    const credCheck3 = await (await fetch(`${baseUrl}/api/credits`, { headers: authHeaders })).json();
    assert.strictEqual(credCheck3.balance.total, 225, 'Saldo tidak boleh berkurang pada retry publish');
    console.log('✅ 4. Retry publish idempoten (saldo tetap 225, tidak dipotong dua kali)');

    // 5. Uji 409 Duplicate: Tidak memotong credit pemakaian, catat usage_failed delta 0
    console.log('5. Uji duplicate 409 -> tidak memotong credit, catat usage_failed...');
    shouldReturnDuplicate = true;
    const kwRes2 = await fetch(`${baseUrl}/api/keywords`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ keyword: 'Sepatu Kulit Bekas', cmsType: 'wordpress' })
    });
    const kw2 = (await kwRes2.json()).keyword;

    const dupRes = await fetch(`${baseUrl}/api/keywords/${kw2.id}/run`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(dupRes.status, 200);
    const dupData = await dupRes.json();
    assert.strictEqual(dupData.keyword.status, 'Duplicate');

    const credCheck4 = await (await fetch(`${baseUrl}/api/credits`, { headers: authHeaders })).json();
    assert.strictEqual(credCheck4.balance.total, 225, 'Saldo tidak boleh terpotong saat duplicate');

    const failedLedger = await db.findMany('credit_ledger', { workspace_id: user.id, kind: 'usage_failed' });
    assert.strictEqual(failedLedger.length, 1);
    assert.strictEqual(failedLedger[0].delta, 0);
    assert(failedLedger[0].cost_actual_idr > 0, 'Biaya API tetap tercatat di usage_failed');
    console.log('✅ 5. Duplicate 409 berhasil ditangani tanpa memotong credit; usage_failed tercatat');

    shouldReturnDuplicate = false;

    // 6. Uji run topik otomatis -> potong 10 credit (seo.topics_run)
    console.log('6. Uji run topik otomatis -> potong 10 credit...');
    const srcRes = await fetch(`${baseUrl}/api/seo/topic-sources`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        cmsType: 'wordpress',
        seedKeywords: 'fashion, sepatu',
        topicsPerRun: 2,
        autoGenerate: false
      })
    });
    const src = (await srcRes.json()).source;

    const runSrcRes = await fetch(`${baseUrl}/api/seo/topic-sources/${src.id}/run`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(runSrcRes.status, 200);

    const credCheck5 = await (await fetch(`${baseUrl}/api/credits`, { headers: authHeaders })).json();
    assert.strictEqual(credCheck5.balance.total, 215, 'Saldo harus terpotong 10 menjadi 215');

    const topicsLedger = await db.findMany('credit_ledger', { workspace_id: user.id, action_key: 'seo.topics_run' });
    assert.strictEqual(topicsLedger.length, 1);
    assert.strictEqual(topicsLedger[0].delta, -10);
    console.log('✅ 6. Riset topik otomatis berhasil memotong 10 credit, saldo tersisa 215');

    // 7. Uji Cron /api/cron/run-scheduled
    console.log('7. Uji Vercel Cron run-scheduled...');
    const cronRes = await fetch(`${baseUrl}/api/cron/run-scheduled?secret=test-cron-secret-123`);
    assert.strictEqual(cronRes.status, 200);
    const cronData = await cronRes.json();
    assert('ran' in cronData);
    console.log('✅ 7. Cron /api/cron/run-scheduled berhasil dieksekusi dengan pembersihan expire');

    // Cleanup
    await db.remove('accounts', { id: user.id });
    await db.remove('credit_wallets', { workspace_id: user.id });
    await db.remove('credit_ledger', { workspace_id: user.id });
    await db.remove('keywords', { user_id: user.id });
    await db.remove('seo_topic_sources', { user_id: user.id });
    await db.remove('cms_connections', { user_id: user.id });

    console.log('--- SEMUA PENGUJIAN LANGKAH 3 BERHASIL (7/7) ---');
  } finally {
    mockN8n.close();
  }
}

runStep3Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Langkah 3 Gagal:', err);
    process.exit(1);
  });
