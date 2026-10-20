import assert from 'assert';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { SYSTEM_WORKSPACE_ID } from '../lib/config.js';

// Setup environment sebelum import DB
process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-margin-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

let baseUrl;
const TEST_ADMIN_KEY = 'super-secret-admin-key-margin';

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

async function runMarginTests() {
  console.log('=== RUNNING TEST ADMIN MARGIN & CIRCUIT BREAKER ===');

  process.env.JWT_SECRET = 'test-secret-key-for-margin';
  process.env.PORT = '5008';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-margin';
  process.env.COST_DAILY_ALERT_IDR = '50000'; // Rp50.000 untuk pengujian circuit breaker

  await seedCreditPricesAndRates();

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const adminHeaders = { 'X-Admin-Key': TEST_ADMIN_KEY };

  // 1. Verifikasi Proteksi Autentikasi Admin (X-Admin-Key)
  const unauthRes = await request('/api/admin/credits/usage');
  assert.strictEqual(unauthRes.status, 401, 'Request without X-Admin-Key must return 401');

  const wrongKeyRes = await request('/api/admin/credits/usage', {
    headers: { 'X-Admin-Key': 'wrong-key-value' }
  });
  assert.strictEqual(wrongKeyRes.status, 401, 'Request with invalid X-Admin-Key must return 401');

  const authRes = await request('/api/admin/credits/usage', { headers: adminHeaders });
  assert.strictEqual(authRes.status, 200, 'Valid X-Admin-Key must return 200');
  assert.ok(authRes.data.actions, 'Response should contain actions list');
  assert.ok(authRes.data.totals, 'Response should contain totals summary');
  console.log('✓ 1. Proteksi autentikasi X-Admin-Key terverifikasi (401 unauth / 200 ok)');

  // 2. Verifikasi Dashboard Margin (GET /api/admin/credits/margin)
  const marginRes = await request('/api/admin/credits/margin', { headers: adminHeaders });
  assert.strictEqual(marginRes.status, 200);
  assert.ok(Array.isArray(marginRes.data.actions));
  const seoAction = marginRes.data.actions.find(a => a.action_key === 'seo.article');
  assert.ok(seoAction, 'seo.article must be present in margin dashboard');
  assert.strictEqual(seoAction.price_credits, 60);
  console.log('✓ 2. Endpoint margin dashboard GET /api/admin/credits/margin mengembalikan daftar aksi & harga');

  // 3. Verifikasi Update Harga Aksi (PUT /api/admin/credit-prices)
  const updatePriceRes = await request('/api/admin/credit-prices', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      actionKey: 'seo.article',
      credits: 65,
      label: 'Generate artikel SEO v2',
      needsReview: false
    })
  });
  assert.strictEqual(updatePriceRes.status, 200);
  assert.strictEqual(updatePriceRes.data.updated.credits, 65);

  // Verifikasi perubahan tersimpan dan cache di-reset
  const marginAfterPriceUpdate = await request('/api/admin/credits/margin', { headers: adminHeaders });
  const seoAfter = marginAfterPriceUpdate.data.actions.find(a => a.action_key === 'seo.article');
  assert.strictEqual(seoAfter.price_credits, 65, 'Price update must reflect immediately in margin dashboard');

  // Kembalikan ke 60
  await request('/api/admin/credit-prices', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ actionKey: 'seo.article', credits: 60 })
  });
  console.log('✓ 3. Update harga aksi PUT /api/admin/credit-prices berfungsi & cache dinonaktifkan seketika');

  // 4. Verifikasi Manajemen Tarif Vendor (GET & PUT /api/admin/credit-cost-rates)
  const getRatesRes = await request('/api/admin/credit-cost-rates', { headers: adminHeaders });
  assert.strictEqual(getRatesRes.status, 200);
  assert.ok(Array.isArray(getRatesRes.data.rates));

  const updateRateRes = await request('/api/admin/credit-cost-rates', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      rateKey: 'image',
      idr: 600,
      note: 'Tarif gambar disesuaikan'
    })
  });
  assert.strictEqual(updateRateRes.status, 200);
  assert.strictEqual(updateRateRes.data.updated.idr, 600);
  console.log('✓ 4. Manajemen tarif vendor PUT /api/admin/credit-cost-rates berhasil diperbarui');

  // 5. Verifikasi Penjaga Margin Otomatis (Cron Margin Sentinel < 60%)
  const testWorkspaceId = randomUUID();
  await db.insert('credit_ledger', {
    workspace_id: testWorkspaceId,
    delta: -5,
    bucket: 'sub',
    kind: 'usage',
    action_key: 'seo.relink',
    ref_type: 'test',
    ref_id: 'test-margin-1',
    balance_after: 100,
    cost_actual_idr: 3500, // Biaya Rp3.500 vs Pendapatan Rp5.000 = margin 30% (< 60%)
    note: 'Simulasi margin rendah',
    created_at: new Date().toISOString()
  });

  // Jalankan cron
  const cronRes = await request('/api/cron/run-scheduled', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });
  assert.strictEqual(cronRes.status, 200);

  // Verifikasi bahwa credit_prices.needs_review ditandai true
  const relinkPriceRow = await db.findOne('credit_prices', { action_key: 'seo.relink' });
  assert.strictEqual(relinkPriceRow.needs_review, true, 'seo.relink must be marked needs_review = true');

  // Verifikasi alert admin benar-benar tersimpan di credit_alerts dengan workspace_id = SYSTEM_WORKSPACE_ID
  const alerts = await db.findMany('credit_alerts', { alert_type: 'margin_low' });
  assert.ok(alerts.length > 0, 'Margin low alert must be recorded in credit_alerts');
  const alertRow = alerts.find(a => a.metadata?.action_key === 'seo.relink');
  assert.ok(alertRow, 'Alert for seo.relink must exist in credit_alerts');
  assert.strictEqual(alertRow.workspace_id, SYSTEM_WORKSPACE_ID, 'Alert workspace_id must be valid SYSTEM_WORKSPACE_ID sentinel');
  assert.strictEqual(alertRow.metadata?.scope, 'system', 'Alert metadata must have scope: system');
  console.log('✓ 5. Penjaga margin otomatis berhasil mendeteksi margin < 60%, menandai needs_review=true, dan menyimpan alert di credit_alerts (SYSTEM_WORKSPACE_ID)');

  // 6. Verifikasi Circuit Breaker Biaya Harian (Total API Cost > COST_DAILY_ALERT_IDR)
  await db.insert('credit_ledger', {
    workspace_id: testWorkspaceId,
    delta: -60,
    bucket: 'sub',
    kind: 'usage',
    action_key: 'seo.article',
    ref_type: 'test',
    ref_id: 'test-circuit-breaker',
    balance_after: 40,
    cost_actual_idr: 60000,
    created_at: new Date().toISOString()
  });

  await request('/api/cron/run-scheduled', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  });

  const breakerAlerts = await db.findMany('credit_alerts', { alert_type: 'cost_high' });
  assert.ok(breakerAlerts.length > 0, 'Circuit breaker cost_high alert must be triggered and stored');
  const breakerAlert = breakerAlerts[0];
  assert.strictEqual(breakerAlert.workspace_id, SYSTEM_WORKSPACE_ID, 'Circuit breaker alert workspace_id must be SYSTEM_WORKSPACE_ID');
  assert.strictEqual(breakerAlert.metadata?.scope, 'system', 'Circuit breaker metadata must have scope: system');
  console.log('✓ 6. Circuit breaker global berhasil memicu notifikasi peringatan saat biaya harian melebihi ambang batas dan tersimpan di DB');

  console.log('ALL ADMIN MARGIN TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runMarginTests().catch(err => {
  console.error('Test Admin Margin Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
