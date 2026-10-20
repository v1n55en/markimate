// Test Workspace: Multi-workspace Isolation, CRUD, Role Enforcement & Workspace API Keys
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-workspace-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], workspace_api_keys: [],
    keywords: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-ws-' + Date.now();

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

async function runWorkspaceTests() {
  console.log('=== RUNNING TEST WORKSPACE (Isolation, Roles & API Keys) ===');

  process.env.JWT_SECRET = 'test-secret-key-ws';
  process.env.PORT = '5012';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5012';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailA = `usera.ws.${ts}@testmarkimate.id`;
  const emailB = `userb.ws.${ts}@testmarkimate.id`;
  const password = ['Workspace', 'Pass', '123!', 'W'].join('');

  // 1. Registrasi & verifikasi User A dan User B
  console.log('1. Mendaftarkan User A dan User B...');
  await req('/api/auth/register', { method: 'POST', body: { email: emailA, password, brandName: 'Brand A Utama', acceptTerms: true } });
  const userARow = await db.findOne('accounts', { email: emailA });
  await req(`/api/admin/users/${userARow.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  await req('/api/auth/register', { method: 'POST', body: { email: emailB, password, brandName: 'Brand B Utama', acceptTerms: true } });
  const userBInit = await db.findOne('accounts', { email: emailB });
  await req(`/api/admin/users/${userBInit.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginARes = await req('/api/auth/login', { method: 'POST', body: { email: emailA, password } });
  const tokenA = loginARes.data.accessToken;

  const loginBRes = await req('/api/auth/login', { method: 'POST', body: { email: emailB, password } });
  const tokenB = loginBRes.data.accessToken;

  // 2. Default Workspace & GET /api/workspaces
  console.log('2. Menguji GET /api/workspaces (daftar workspace milik user)...');
  const wsListA = await req('/api/workspaces', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(wsListA.status, 200);
  assert.ok(Array.isArray(wsListA.data.workspaces));
  assert.strictEqual(wsListA.data.workspaces.length, 1);
  assert.strictEqual(wsListA.data.workspaces[0].role, 'owner');
  const wsA1 = wsListA.data.workspaces[0];

  // 3. Buat Workspace Baru (POST /api/workspaces)
  console.log('3. Menguji pembuatan workspace baru oleh User A...');
  const createWsRes = await req('/api/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Klien Brand A Dua' }
  });
  assert.strictEqual(createWsRes.status, 200);
  assert.strictEqual(createWsRes.data.workspace.name, 'Klien Brand A Dua');
  const wsA2 = createWsRes.data.workspace;

  // Cek membership User A di wsA2
  const memberA2 = await db.findOne('workspace_members', { workspace_id: wsA2.id, user_id: userARow.id });
  assert.strictEqual(memberA2.role, 'owner');

  // User A sekarang punya 2 workspace
  const wsListA2 = await req('/api/workspaces', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(wsListA2.data.workspaces.length, 2);

  // 4. Update Nama Workspace (PATCH /api/workspaces/:id)
  console.log('4. Menguji update nama workspace...');
  const patchWsRes = await req(`/api/workspaces/${wsA2.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Klien Brand A Dua Revisi' }
  });
  assert.strictEqual(patchWsRes.status, 200);
  assert.strictEqual(patchWsRes.data.workspace.name, 'Klien Brand A Dua Revisi');

  // 5. Isolasi Data Keyword per Workspace
  console.log('5. Menguji isolasi data keyword antar workspace...');
  await db.insert('keywords', {
    user_id: userARow.id,
    workspace_id: wsA1.id,
    keyword: 'resep kopi ws1',
    cms_type: 'wordpress',
    status: 'Review Ready',
    created_at: new Date().toISOString()
  });

  await db.insert('keywords', {
    user_id: userARow.id,
    workspace_id: wsA2.id,
    keyword: 'mesin espresso ws2',
    cms_type: 'wordpress',
    status: 'Review Ready',
    created_at: new Date().toISOString()
  });

  // Ambil keywords di wsA1
  const kwListWs1 = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA1.id
    }
  });
  assert.strictEqual(kwListWs1.status, 200);
  const kwTextsWs1 = kwListWs1.data.keywords.map(k => k.keyword);
  assert.ok(kwTextsWs1.includes('resep kopi ws1'), 'Keyword ws1 harus ada di list ws1');
  assert.ok(!kwTextsWs1.includes('mesin espresso ws2'), 'Keyword ws2 TIDAK boleh bocor ke list ws1');

  // Ambil keywords di wsA2
  const kwListWs2 = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA2.id
    }
  });
  assert.strictEqual(kwListWs2.status, 200);
  const kwTextsWs2 = kwListWs2.data.keywords.map(k => k.keyword);
  assert.ok(kwTextsWs2.includes('mesin espresso ws2'), 'Keyword ws2 harus ada di list ws2');
  assert.ok(!kwTextsWs2.includes('resep kopi ws1'), 'Keyword ws1 TIDAK boleh bocor ke list ws2');

  // 6. User B Tidak Boleh Mengakses Workspace Milik User A (404 Anti-Enumeration)
  console.log('6. Menguji proteksi isolasi antar user (User B akses ws User A)...');
  const unauthWsAccess = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA1.id
    }
  });
  assert.strictEqual(unauthWsAccess.status, 404, 'User B harus ditolak 404 saat akses workspace User A (Anti-enumeration)');
  assert.strictEqual(unauthWsAccess.data.code, 'WORKSPACE_NOT_FOUND');

  // Role Enforcement: Tambahkan User B sebagai viewer di wsA2
  const userBRow = await db.findOne('accounts', { email: emailB });
  await db.insert('workspace_members', {
    workspace_id: wsA2.id,
    user_id: userBRow.id,
    role: 'viewer'
  });

  const viewerGet = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA2.id
    }
  });
  assert.strictEqual(viewerGet.status, 200, 'Viewer harus diizinkan GET keywords');

  const viewerPost = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA2.id
    },
    body: { keyword: 'viewer mau nambah kw' }
  });
  assert.strictEqual(viewerPost.status, 403, 'Viewer harus ditolak saat POST keywords');
  assert.strictEqual(viewerPost.data.code, 'FORBIDDEN_ROLE');

  // 7. Workspace API Keys (Manajemen & Otentikasi mkm_live_*)
  console.log('7. Menguji manajemen Workspace API Keys (mkm_live_*)...');
  const keyCreateRes = await req(`/api/workspaces/${wsA1.id}/api-keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Zapier Ingestion Key' }
  });
  assert.strictEqual(keyCreateRes.status, 200);
  const newKey = keyCreateRes.data.apiKey;
  assert.ok(newKey.key.startsWith('mkm_live_'), 'Key harus berformat mkm_live_...');

  // Akses endpoint publik menggunakan Workspace API Key baru
  const apiKeyAuthRes = await req('/api/v1/articles', {
    headers: { Authorization: `Bearer ${newKey.key}` }
  });
  assert.strictEqual(apiKeyAuthRes.status, 200, 'Akses via Workspace API Key harus 200');

  // Cabut Workspace API Key (DELETE)
  const keyRevokeRes = await req(`/api/workspaces/${wsA1.id}/api-keys/${newKey.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(keyRevokeRes.status, 200);

  // Akses setelah key dicabut harus ditolak 401
  const revokedKeyAccess = await req('/api/v1/articles', {
    headers: { Authorization: `Bearer ${newKey.key}` }
  });
  assert.strictEqual(revokedKeyAccess.status, 401, 'Akses via Workspace API Key yang dicabut harus ditolak 401');

  // 8. Larangan Menghapus Workspace Satu-satunya
  console.log('8. Menguji larangan penghapusan workspace terakhir/satu-satunya...');
  // Hapus membership viewer User B di wsA2 agar User B hanya punya 1 workspace
  await db.remove('workspace_members', { workspace_id: wsA2.id, user_id: userBRow.id });

  const wsListB = await req('/api/workspaces', { headers: { Authorization: `Bearer ${tokenB}` } });
  const wsBOnly = wsListB.data.workspaces[0];

  const deleteLastWsRes = await req(`/api/workspaces/${wsBOnly.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.strictEqual(deleteLastWsRes.status, 400, 'Hapus workspace satu-satunya harus ditolak 400');
  assert.strictEqual(deleteLastWsRes.data.code, 'CANNOT_DELETE_LAST_WORKSPACE');

  // Hapus wsA2 milik User A yang memiliki 2 workspace (harus berhasil)
  const deleteWsA2Res = await req(`/api/workspaces/${wsA2.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(deleteWsA2Res.status, 200, 'Hapus workspace sekunder harus berhasil 200');

  const checkWsA2After = await db.findOne('workspaces', { id: wsA2.id });
  assert.ok(checkWsA2After && checkWsA2After.deleted_at, 'Workspace harus ditandai soft-deleted');
  const userAWorkspaces = await req('/api/workspaces', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(userAWorkspaces.data.workspaces.some(w => w.id === wsA2.id), false, 'Workspace yang dihapus tidak boleh muncul di daftar aktif');

  console.log('ALL WORKSPACE TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runWorkspaceTests().catch(err => {
  console.error('Test Workspace Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
