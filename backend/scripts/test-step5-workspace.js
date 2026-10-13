// Test Langkah 5: Workspace di Backend, Isolasi Data & Role Enforcement (PRD F1 + F2)
import assert from 'assert';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step5-' + Date.now();

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

async function runStep5Tests() {
  console.log('=== RUNNING TEST STEP 5 (Workspace Isolation, Roles & Workspace API Keys) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step5';
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

  // Login User A
  const loginA = await req('/api/auth/login', { method: 'POST', body: { email: emailA, password } });
  assert.strictEqual(loginA.status, 200, 'User A harus berhasil login');
  const tokenA = loginA.data.accessToken;

  // Login User B
  const loginB = await req('/api/auth/login', { method: 'POST', body: { email: emailB, password } });
  assert.strictEqual(loginB.status, 200, 'User B harus berhasil login');
  const tokenB = loginB.data.accessToken;

  console.log('   OK - User A dan User B berhasil login.');

  // 2. Cek Default Workspace User A
  console.log('2. Memeriksa default workspace User A...');
  const meA = await req('/api/me', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(meA.status, 200, 'GET /api/me User A harus 200');
  assert.ok(meA.data.workspaces && meA.data.workspaces.length >= 1, 'User A harus memiliki minimal 1 workspace');
  assert.strictEqual(meA.data.user.apiKey, undefined, 'Raw apiKey tidak boleh bocor di user object');
  const wsA1 = meA.data.workspaces[0];
  assert.strictEqual(wsA1.role, 'owner', 'Role User A di default workspace harus owner');
  console.log(`   OK - User A workspace utama ID: ${wsA1.id}`);

  // 3. User A membuat Workspace ke-2
  console.log('3. User A membuat Workspace ke-2...');
  const createWsRes = await req('/api/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Kopi Kenangan User A', niche: 'F&B' }
  });
  assert.strictEqual(createWsRes.status, 200, 'Membuat workspace harus berhasil (200)');
  const wsA2 = createWsRes.data.workspace;
  assert.ok(wsA2 && wsA2.id, 'Workspace baru harus memiliki ID');
  assert.strictEqual(wsA2.name, 'Kopi Kenangan User A');
  assert.strictEqual(wsA2.role, 'owner');

  const listWsA = await req('/api/workspaces', { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(listWsA.data.workspaces.length, 2, 'User A sekarang harus memiliki 2 workspace');
  console.log(`   OK - Workspace ke-2 dibuat dengan ID: ${wsA2.id}`);

  // 4. Isolasi Keywords antar Workspace User A
  console.log('4. Pengujian isolasi keywords per workspace...');
  const kw1Res = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA1.id
    },
    body: { keyword: 'resep kopi ws1', cmsType: 'wordpress' }
  });
  assert.strictEqual(kw1Res.status, 200, 'Insert keyword ws1 harus berhasil');

  const kw2Res = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA2.id
    },
    body: { keyword: 'mesin espresso ws2', cmsType: 'wordpress' }
  });
  assert.strictEqual(kw2Res.status, 200, 'Insert keyword ws2 harus berhasil');

  const listKwWs1 = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA1.id
    }
  });
  const listKwWs2 = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA2.id
    }
  });

  const kwTextsWs1 = listKwWs1.data.keywords.map(k => k.keyword);
  const kwTextsWs2 = listKwWs2.data.keywords.map(k => k.keyword);

  assert.ok(kwTextsWs1.includes('resep kopi ws1'), 'Keyword ws1 harus ada di list ws1');
  assert.ok(!kwTextsWs1.includes('mesin espresso ws2'), 'Keyword ws2 TIDAK boleh bocor ke list ws1');
  assert.ok(kwTextsWs2.includes('mesin espresso ws2'), 'Keyword ws2 harus ada di list ws2');
  assert.ok(!kwTextsWs2.includes('resep kopi ws1'), 'Keyword ws1 TIDAK boleh bocor ke list ws2');
  console.log('   OK - Keywords terisolasi sempurna antar workspace.');

  // 5. Anti-Enumeration & Keamanan Lintas User (User A mencoba akses Workspace User B)
  console.log('5. Pengujian isolasi lintas User (User A akses workspace User B)...');
  const meB = await req('/api/me', { headers: { Authorization: `Bearer ${tokenB}` } });
  const wsB = meB.data.workspaces[0];

  const stealAttempt = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsB.id
    }
  });
  assert.strictEqual(stealAttempt.status, 404, 'Akses ke workspace user lain harus mengembalikan 404 (Anti-enumeration)');
  assert.strictEqual(stealAttempt.data.code, 'WORKSPACE_NOT_FOUND');
  console.log('   OK - Server mengembalikan 404 WORKSPACE_NOT_FOUND (ID aman dari enumeration).');

  // 6. Role Enforcement (Viewer vs Admin/Owner)
  console.log('6. Pengujian Role Enforcement...');
  // Masukkan User B sebagai 'viewer' di Workspace 2 milik User A
  const userBRow = await db.findOne('accounts', { email: emailB });
  await db.insert('workspace_members', {
    workspace_id: wsA2.id,
    user_id: userBRow.id,
    role: 'viewer'
  });

  // User B melihat data di Workspace 2 milik User A -> Harus BOLEH (viewer)
  const viewerGet = await req('/api/keywords', {
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA2.id
    }
  });
  assert.strictEqual(viewerGet.status, 200, 'Viewer harus diizinkan GET /api/keywords');
  assert.ok(viewerGet.data.keywords.some(k => k.keyword === 'mesin espresso ws2'));

  // User B mencoba membuat keyword di Workspace 2 -> Harus DITOLAK (viewer tidak punya hak tulis)
  const viewerPost = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA2.id
    },
    body: { keyword: 'viewer mau nambah kw' }
  });
  assert.strictEqual(viewerPost.status, 403, 'Viewer harus ditolak saat POST /api/keywords');
  assert.strictEqual(viewerPost.data.code, 'FORBIDDEN_ROLE');

  // User B mencoba menghapus keyword di Workspace 2 -> Harus DITOLAK
  const kw2Id = kw2Res.data.keyword.id;
  const viewerDelete = await req(`/api/keywords/${kw2Id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsA2.id
    }
  });
  assert.strictEqual(viewerDelete.status, 403, 'Viewer harus ditolak saat DELETE /api/keywords');
  assert.strictEqual(viewerDelete.data.code, 'FORBIDDEN_ROLE');
  console.log('   OK - Role permissions (Viewer diizinkan baca, ditolak tulis 403 FORBIDDEN_ROLE).');

  // 7. Workspace API Keys
  console.log('7. Pengujian Workspace API Keys (mkm_live_...)...');
  const createKeyRes = await req(`/api/workspaces/${wsA1.id}/api-keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Zapier Ingestion Key' }
  });
  assert.strictEqual(createKeyRes.status, 200, 'Membuat API key harus berhasil (200)');
  const newKey = createKeyRes.data.apiKey;
  assert.ok(newKey.key.startsWith('mkm_live_'), 'Key harus berformat mkm_live_...');
  console.log(`   OK - Key dibuat: ${newKey.keyPrefix}...`);

  // Panggil endpoint /api/v1/articles menggunakan API key baru
  const apiCallRes = await req('/api/v1/articles', {
    headers: { Authorization: `Bearer ${newKey.key}` }
  });
  assert.strictEqual(apiCallRes.status, 200, 'Panggilan API dengan Bearer mkm_live_... harus 200');
  assert.ok(apiCallRes.data.articles.some(a => a.keyword === 'resep kopi ws1'), 'Harus menampilkan artikel ws1');
  assert.ok(!apiCallRes.data.articles.some(a => a.keyword === 'mesin espresso ws2'), 'Tidak boleh menampilkan artikel ws2');

  // Revoke API Key
  const deleteKeyRes = await req(`/api/workspaces/${wsA1.id}/api-keys/${newKey.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(deleteKeyRes.status, 200, 'Revoke API key harus berhasil (200)');

  // Coba panggil lagi dengan key yang sudah dicabut -> Harus 401
  const revokedCallRes = await req('/api/v1/articles', {
    headers: { Authorization: `Bearer ${newKey.key}` }
  });
  assert.strictEqual(revokedCallRes.status, 401, 'API key yang dicabut harus mengembalikan 401');
  console.log('   OK - Workspace API key lifecycle (generate, authenticate, revoke) berfungsi normal.');

  // 8. Isolasi Saldo Credit per Workspace
  console.log('8. Pengujian isolasi saldo credit per workspace...');
  const credWs1 = await req('/api/credits', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA1.id
    }
  });
  assert.strictEqual(credWs1.status, 200);
  assert.ok(credWs1.data.balance && credWs1.data.balance.total > 0, 'Workspace 1 (utama) harus memiliki credit trial awal');

  const credWs2 = await req('/api/credits', {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Workspace-Id': wsA2.id
    }
  });
  assert.strictEqual(credWs2.status, 200);
  assert.strictEqual(credWs2.data.balance.total, 0, 'Workspace 2 baru harus memiliki saldo 0 (tidak otomatis dapat trial)');
  console.log('   OK - Saldo dompet credit terisolasi antar workspace.');

  console.log('\n=== ALL STEP 5 WORKSPACE TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runStep5Tests().catch(err => {
  console.error('\n❌ STEP 5 TEST FAILED:', err);
  process.exit(1);
});
