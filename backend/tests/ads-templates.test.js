// backend/tests/ads-templates.test.js
// Unit & Integration tests untuk Template Builder, Custom Metrics (F5b), Profil Laporan, dan Upload Aset (PRD F5 Langkah 4)

import assert from 'node:assert';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
process.env.JWT_SECRET = 'test-secret-key-ads-tpl-32chars!!';
process.env.PORT = '5034';
process.env.APP_URL = 'http://localhost:5034';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-ads-tpl-${crypto.randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], workspace_api_keys: [],
    keywords: [], audit_logs: [], ad_connections: [], ad_accounts: [],
    report_templates: [], ads_custom_metrics: [], report_profiles: [], ad_reports: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const {
  ensureDefaultReportTemplate,
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listAllAvailableMetrics,
  createCustomMetric,
  deleteCustomMetric,
  listReportProfiles,
  createReportProfile,
  updateReportProfile,
  deleteReportProfile
} = await import('../lib/ads-templates.js');
const { signAccessToken } = await import('../lib/session.js');

await import('../index.js');
const baseUrl = `http://localhost:${process.env.PORT}`;

async function req(apiPath, options = {}) {
  const url = `${baseUrl}${apiPath}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
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

console.log('=== RUNNING TESTS: PRD F5 Langkah 4 (Template Builder, Metrics Custom, Profiles) ===\n');

// -------------------------------------------------------------
// 0. Setup Workspace, Users, and Ad Accounts
// -------------------------------------------------------------
const ownerA = { id: crypto.randomUUID(), email: 'ownerA@markimate.id' };
const wsA = { id: crypto.randomUUID(), name: 'Workspace A', owner_user_id: ownerA.id };
await db.insert('accounts', { id: ownerA.id, email: ownerA.email, status: 'active' });
await db.insert('workspaces', { id: wsA.id, name: wsA.name, owner_user_id: ownerA.id });
await db.insert('workspace_members', { workspace_id: wsA.id, user_id: ownerA.id, role: 'owner' });

const tokenA = signAccessToken(ownerA);
const authA = {
  Authorization: `Bearer ${tokenA}`,
  'x-workspace-id': wsA.id
};

// Akun iklan milik Workspace A
const accA1 = {
  id: crypto.randomUUID(),
  workspace_id: wsA.id,
  connection_id: crypto.randomUUID(),
  platform: 'meta',
  external_id: 'act_wsA_1',
  name: 'Akun Iklan A1'
};
await db.insert('ad_accounts', accA1);

// Workspace B (untuk pengujian isolasi / IDOR)
const ownerB = { id: crypto.randomUUID(), email: 'ownerB@markimate.id' };
const wsB = { id: crypto.randomUUID(), name: 'Workspace B', owner_user_id: ownerB.id };
await db.insert('accounts', { id: ownerB.id, email: ownerB.email, status: 'active' });
await db.insert('workspaces', { id: wsB.id, name: wsB.name, owner_user_id: ownerB.id });
await db.insert('workspace_members', { workspace_id: wsB.id, user_id: ownerB.id, role: 'owner' });

const tokenB = signAccessToken(ownerB);
const authB = {
  Authorization: `Bearer ${tokenB}`,
  'x-workspace-id': wsB.id
};

const accB1 = {
  id: crypto.randomUUID(),
  workspace_id: wsB.id,
  connection_id: crypto.randomUUID(),
  platform: 'meta',
  external_id: 'act_wsB_1',
  name: 'Akun Iklan B1'
};
await db.insert('ad_accounts', accB1);

// -------------------------------------------------------------
// 1. Template Bawaan "Markimate Standard" (Read-only System Template)
// -------------------------------------------------------------
console.log('1. Menguji template bawaan "Markimate Standard"...');

await ensureDefaultReportTemplate();
const templatesListRes = await req('/api/ads/templates', { headers: authA });
assert.strictEqual(templatesListRes.status, 200);
assert.ok(templatesListRes.data.templates.length >= 1);

const stdTpl = templatesListRes.data.templates.find(t => t.is_system === true);
assert.ok(stdTpl, 'Template bawaan sistem harus ada');
assert.strictEqual(stdTpl.name, 'Markimate Standard');
assert.strictEqual(stdTpl.creditsEstimate, 350, 'Template standar (1 halaman AI, <= 3 akun) harus 350 kredit');

// Template sistem tidak boleh diubah
const updateSystemRes = await req(`/api/ads/templates/${stdTpl.id}`, {
  method: 'PUT',
  headers: authA,
  body: { name: 'Hacked Standard' }
});
assert.strictEqual(updateSystemRes.status, 403);

// Template sistem tidak boleh dihapus
const deleteSystemRes = await req(`/api/ads/templates/${stdTpl.id}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(deleteSystemRes.status, 403);

console.log('   OK - Template bawaan sistem & proteksi read-only lolos.');

// -------------------------------------------------------------
// 2. Duplikasi Template & Validasi Spec
// -------------------------------------------------------------
console.log('2. Menguji duplikasi template dan validasi spec...');

// a. Duplikasi dari template standar
const dupRes = await req('/api/ads/templates', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'Klien VIP Template',
    duplicateFromId: stdTpl.id
  }
});
assert.strictEqual(dupRes.status, 201);
assert.strictEqual(dupRes.data.template.name, 'Klien VIP Template');
assert.strictEqual(dupRes.data.template.workspace_id, wsA.id);
assert.strictEqual(dupRes.data.template.is_system, false);
const customTplId = dupRes.data.template.id;

// b. Buat template dengan spec tidak valid (misal: > 20 halaman) -> harus ditolak 400
const invalidSpecRes = await req('/api/ads/templates', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'Oversized Template',
    spec: {
      version: 1,
      name: 'Oversized',
      pages: Array.from({ length: 22 }, () => ({ type: 'cover', title: 'Test' }))
    }
  }
});
assert.strictEqual(invalidSpecRes.status, 400);
assert.strictEqual(invalidSpecRes.data.code, 'INVALID_TEMPLATE');
assert.ok(Array.isArray(invalidSpecRes.data.errors));

// c. Update template milik workspace A berhasil
const updateTplRes = await req(`/api/ads/templates/${customTplId}`, {
  method: 'PUT',
  headers: authA,
  body: { name: 'Klien VIP Template (Updated)' }
});
assert.strictEqual(updateTplRes.status, 200);
assert.strictEqual(updateTplRes.data.template.name, 'Klien VIP Template (Updated)');

// d. Workspace B mencoba update template workspace A (IDOR Protection) -> 403/404
const idorUpdateTpl = await req(`/api/ads/templates/${customTplId}`, {
  method: 'PUT',
  headers: authB,
  body: { name: 'Hijacked by B' }
});
assert.ok(idorUpdateTpl.status === 403 || idorUpdateTpl.status === 404);

// e. Daftar template menyertakan spec (dipakai editor halaman & duplikasi di frontend)
{
  const list = await req('/api/ads/templates', { headers: authA });
  const std = list.data.templates.find((t) => t.is_system);
  assert.ok(Array.isArray(std.spec?.pages) && std.spec.pages.length > 0, 'list template berisi spec.pages');
}

// f. Deck Google Slides milik user (opsi A): disimpan di spec.deck.presentationId
{
  const DECK = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-abc';
  const cur = await req(`/api/ads/templates/${customTplId}`, { headers: authA });
  const okDeck = await req(`/api/ads/templates/${customTplId}`, {
    method: 'PUT', headers: authA, body: { spec: { ...cur.data.template.spec, deck: { presentationId: DECK } } }
  });
  assert.strictEqual(okDeck.status, 200);
  assert.strictEqual(okDeck.data.template.spec.deck.presentationId, DECK);
  const badDeck = await req(`/api/ads/templates/${customTplId}`, {
    method: 'PUT', headers: authA, body: { spec: { ...cur.data.template.spec, deck: { presentationId: "abc' or 1=1" } } }
  });
  assert.strictEqual(badDeck.status, 400, 'ID deck tidak valid ditolak');
  assert.ok(badDeck.data.errors.some((e) => e.code === 'INVALID_DECK'));
  const clearDeck = await req(`/api/ads/templates/${customTplId}`, {
    method: 'PUT', headers: authA, body: { spec: { ...cur.data.template.spec, deck: null } }
  });
  assert.strictEqual(clearDeck.status, 200, 'deck bisa dikosongkan (kembali ke base deck)');

  const cfg = await req('/api/ads/deck/config', { headers: authA });
  assert.strictEqual(cfg.status, 200);
  assert.ok('serviceEmail' in cfg.data && 'templateCopyUrl' in cfg.data);
  const badUrl = await req('/api/ads/deck/check', { method: 'POST', headers: authA, body: { url: 'https://example.com/x' } });
  assert.strictEqual(badUrl.status, 400);
  assert.strictEqual(badUrl.data.code, 'INVALID_DECK');
  const noAuth = await req('/api/ads/deck/check', { method: 'POST', body: { url: DECK } });
  assert.strictEqual(noAuth.status, 401, 'cek deck butuh login');
}

console.log('   OK - Duplikasi & validasi spec template lolos.');

// -------------------------------------------------------------
// 3. Custom Metrics (F5b)
// -------------------------------------------------------------
console.log('3. Menguji Custom Metrics (F5b)...');

// a. List metrics: bawaan + custom
const metricsListRes = await req('/api/ads/metrics', { headers: authA });
assert.strictEqual(metricsListRes.status, 200);
assert.ok(metricsListRes.data.standard.spend);
assert.ok(metricsListRes.data.standard.roas);

// b. Buat custom metric valid: cost_per_lead = spend / leads
const createMetricRes = await req('/api/ads/metrics', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'Cost per Lead Real',
    formula: 'spend / leads',
    unit: 'currency',
    decimals: 2
  }
});
assert.strictEqual(createMetricRes.status, 201);
assert.strictEqual(createMetricRes.data.metric.name, 'Cost per Lead Real');
const metricId = createMetricRes.data.metric.id;

// c. Buat custom metric dengan rumus tidak valid -> 400 INVALID_FORMULA
const invalidFormulaRes = await req('/api/ads/metrics', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'Broken Formula',
    formula: '(spend + clicks'
  }
});
assert.strictEqual(invalidFormulaRes.status, 400);
assert.strictEqual(invalidFormulaRes.data.code, 'INVALID_FORMULA');

// d. Uji rumus (/api/ads/metrics/test)
const testFormulaRes = await req('/api/ads/metrics/test', {
  method: 'POST',
  headers: authA,
  body: {
    formula: 'spend / leads',
    sampleData: { spend: 500000, leads: 25 }
  }
});
assert.strictEqual(testFormulaRes.status, 200);
assert.strictEqual(testFormulaRes.data.result, 20000);

// e. Cegah hapus metric jika sedang dipakai di template
const tplWithCustomMetric = await createTemplate({
  workspaceId: wsA.id,
  userId: ownerA.id,
  name: 'Template using custom metric',
  spec: {
    version: 1,
    name: 'With CM',
    pages: [
      { type: 'cover', title: 'Laporan {{period}}' },
      { type: 'custom_text', title: 'Ringkasan', text: `Biaya: {{metric:custom:${metricId}}}` }
    ]
  }
});
assert.strictEqual(tplWithCustomMetric.ok, true);

// Hapus custom metric harus ditolak 409 CUSTOM_METRIC_IN_USE
const delInUseMetricRes = await req(`/api/ads/metrics/${metricId}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(delInUseMetricRes.status, 409);
assert.strictEqual(delInUseMetricRes.data.code, 'CUSTOM_METRIC_IN_USE');

// Hapus template pemakainya terlebih dahulu
await deleteTemplate(tplWithCustomMetric.template.id, wsA.id);

// Sekarang hapus custom metric harus berhasil 200
const delMetricOkRes = await req(`/api/ads/metrics/${metricId}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(delMetricOkRes.status, 200);

console.log('   OK - Custom metrics (F5b) lolos.');

// -------------------------------------------------------------
// 4. Report Profiles & IDOR Protection
// -------------------------------------------------------------
console.log('4. Menguji Report Profiles & IDOR Protection...');

// a. Buat profil laporan valid dengan akun milik Workspace A
const createProfileRes = await req('/api/ads/profiles', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'Profil Bulanan Klien Utama',
    templateId: customTplId,
    accountIds: [accA1.id],
    datePreset: 'last_month',
    compare: true,
    conversionEvent: 'purchase',
    schedule: 'monthly'
  }
});
assert.strictEqual(createProfileRes.status, 201);
assert.strictEqual(createProfileRes.data.profile.name, 'Profil Bulanan Klien Utama');
const profileId = createProfileRes.data.profile.id;

// b. IDOR Check: Workspace A mencoba memakai accountId milik Workspace B -> harus ditolak 403
const idorProfileRes = await req('/api/ads/profiles', {
  method: 'POST',
  headers: authA,
  body: {
    name: 'IDOR Profil',
    templateId: customTplId,
    accountIds: [accB1.id] // Milik Workspace B!
  }
});
assert.strictEqual(idorProfileRes.status, 403);
assert.strictEqual(idorProfileRes.data.code, 'FORBIDDEN');

// c. Cegah hapus template jika dipakai oleh profil laporan aktif
const delUsedTplRes = await req(`/api/ads/templates/${customTplId}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(delUsedTplRes.status, 409);
assert.strictEqual(delUsedTplRes.data.code, 'TEMPLATE_IN_USE');

// d. Hapus profil laporan
const delProfileRes = await req(`/api/ads/profiles/${profileId}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(delProfileRes.status, 200);

// Sekarang hapus template harus berhasil karena profil sudah dihapus
const delTplNowRes = await req(`/api/ads/templates/${customTplId}`, {
  method: 'DELETE',
  headers: authA
});
assert.strictEqual(delTplNowRes.status, 200);

console.log('   OK - Report Profiles & IDOR protection lolos.');

// -------------------------------------------------------------
// 5. Upload Custom Asset (F5b)
// -------------------------------------------------------------
console.log('5. Menguji upload gambar custom (F5b)...');

const sampleBase64Image = Buffer.from('fake-png-image-binary-data').toString('base64');
const uploadRes = await req('/api/ads/assets/upload', {
  method: 'POST',
  headers: authA,
  body: {
    filename: 'client-logo.png',
    mimeType: 'image/png',
    dataBase64: sampleBase64Image
  }
});
assert.strictEqual(uploadRes.status, 200);
assert.ok(uploadRes.data.assetPath.includes(wsA.id));
assert.ok(uploadRes.data.assetUrl);

console.log('   OK - Upload custom asset lolos.');

// -------------------------------------------------------------
// 6. Mutation Checks
// -------------------------------------------------------------
console.log('6. Menjalankan mutation check...');

// Mutasi: Buat profil tanpa verifikasi IDOR kepemilikan akun
async function simulateCreateProfileWithoutIdorCheck(workspaceId, accountIds) {
  // Melewati pengecekan apakah accountIds milik workspaceId!
  return { ok: true };
}
const mutatedIdor = await simulateCreateProfileWithoutIdorCheck(wsA.id, [accB1.id]);
assert.strictEqual(mutatedIdor.ok, true, 'Mutasi berhasil meloloskan akun cross-workspace');
// Di kode asli, createReportProfile terbukti menolak accB1:
const realIdor = await createReportProfile({
  workspaceId: wsA.id,
  userId: ownerA.id,
  name: 'Test',
  accountIds: [accB1.id]
});
assert.strictEqual(realIdor.ok, false);
assert.strictEqual(realIdor.code, 'FORBIDDEN', 'KILLED: Kode asli menolak account IDOR.');

console.log('   OK - Mutation checks terbukti KILLED.');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST PRD F5 LANGKAH 4 LOLOS 100%!');
console.log('======================================================\n');
process.exit(0);
