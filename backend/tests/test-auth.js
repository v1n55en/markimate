// Test Komprehensif Auth End-to-End (PRD F1 + F2 Langkah 10)
// Alur: register → verify → login → refresh rotasi → reuse detection → forgot/reset → workspace isolation → viewer 403 → delete + purge.
import assert from 'assert';
import { db } from '../db.js';
import { purgeDeletedAccounts } from '../lib/account-lifecycle.js';
import { newToken, hashToken } from '../lib/tokens.js';

const PORT = 5017;
const baseUrl = `http://localhost:${PORT}`;

function makeDummyPass(tag = '1') {
  return ['Mock', 'Auth', 'Sec', String(tag), '!A1'].join('');
}

async function req(path, options = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual'
  });

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  const rawSetCookie = res.headers.get('set-cookie') || '';
  const rtMatch = rawSetCookie.match(/mk_rt=([^;]+)/);

  return {
    status: res.status,
    headers: res.headers,
    data,
    text,
    rtCookie: rtMatch ? `mk_rt=${rtMatch[1]}` : null,
    rawSetCookie
  };
}

async function runFullAuthSuite() {
  console.log('================================================================');
  console.log('RUNNING FULL END-TO-END AUTH SUITE (PRD F1 + F2 LANGKAH 10)');
  console.log('================================================================\n');

  process.env.PORT = String(PORT);
  process.env.ADMIN_KEY = 'test-admin-key-step10';
  await db.remove('rate_limits', {});
  await import('../index.js');

  const ts = Date.now();
  const passwordA1 = makeDummyPass('A1');
  const passwordA2 = makeDummyPass('A2');
  const passwordB = makeDummyPass('B');

  const emailA = `test.e2e.a.${ts}@testmarkimate.id`;
  const emailB = `test.e2e.b.${ts}@testmarkimate.id`;

  // -------------------------------------------------------------
  // 1. REGISTER
  // -------------------------------------------------------------
  console.log('1. [REGISTER] Mendaftarkan User A...');
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: emailA, password: passwordA1, brandName: 'Brand E2E Alpha', acceptTerms: true }
  });
  assert.strictEqual(regRes.status, 200, 'Registrasi harus berhasil 200');
  assert.strictEqual(regRes.data.status, 'verification_sent');

  const userARow = await db.findOne('accounts', { email: emailA });
  assert.ok(userARow, 'User A harus ada di database');
  assert.strictEqual(userARow.status, 'unverified', 'Status awal harus unverified');

  // Ambil token verifikasi dari tabel email_verifications
  const verifRow = await db.findOne('email_verifications', { user_id: userARow.id });
  assert.ok(verifRow, 'Record verifikasi harus tersimpan');

  // -------------------------------------------------------------
  // 2. VERIFY
  // -------------------------------------------------------------
  console.log('2. [VERIFY] Memverifikasi email User A via endpoint admin...');
  const verifyRes = await req(`/api/admin/users/${userARow.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });
  assert.strictEqual(verifyRes.status, 200, 'Verifikasi email harus 200');

  const verifiedUser = await db.findOne('accounts', { id: userARow.id });
  assert.strictEqual(verifiedUser.status, 'active', 'User harus berstatus active');
  assert.ok(verifiedUser.email_verified_at, 'email_verified_at harus terisi');

  // Pastikan workspace dibuat dan module trial aktif
  const membersA = await db.findMany('workspace_members', { user_id: verifiedUser.id });
  assert.ok(membersA.length >= 1, 'Workspace default harus ada');
  const workspaceAId = membersA[0].workspace_id;
  const entitlementsA = await db.findMany('module_entitlements', { workspace_id: workspaceAId });
  assert.ok(entitlementsA.some(e => e.module === 'seo' && e.active), 'Entitlement SEO harus aktif');

  // -------------------------------------------------------------
  // 3. LOGIN
  // -------------------------------------------------------------
  console.log('3. [LOGIN] Masuk menggunakan email & kata sandi...');
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: passwordA1 }
  });
  assert.strictEqual(loginRes.status, 200, 'Login harus 200');
  assert.ok(loginRes.data.token, 'Access token JWT harus dikembalikan');
  assert.ok(loginRes.rtCookie, 'HttpOnly cookie mk_rt harus diterbitkan');

  const token1 = loginRes.data.token;
  const cookie1 = loginRes.rtCookie;

  // -------------------------------------------------------------
  // 4. REFRESH TOKEN ROTATION
  // -------------------------------------------------------------
  console.log('4. [REFRESH] Menguji rotasi refresh token...');
  const refreshRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: cookie1
  });
  assert.strictEqual(refreshRes.status, 200, 'Refresh token harus 200');
  assert.ok(refreshRes.data.accessToken, 'Access token baru harus dikembalikan');
  assert.ok(refreshRes.rtCookie, 'Refresh token baru harus diterbitkan');
  assert.notStrictEqual(refreshRes.rtCookie, cookie1, 'Refresh token baru harus berbeda dari token lama (rotasi)');

  const cookie2 = refreshRes.rtCookie;

  // -------------------------------------------------------------
  // 5. REUSE DETECTION & GRACE WINDOW (Langkah 2.3)
  // -------------------------------------------------------------
  console.log('5. [GRACE WINDOW & REUSE DETECTION] Menguji grace window 30s & deteksi reuse token...');
  // 5a. Grace window: pemanggilan token lama dalam <30 detik tetap berhasil (multi-tab support)
  const graceRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: cookie1
  });
  assert.strictEqual(graceRes.status, 200, 'Refresh dalam grace window 30s harus mengembalikan 200 OK');

  // 5b. Penggunaan di luar grace window (>30 detik) memicu deteksi reuse & pencabutan sesi
  const tokenVal = cookie1.split('mk_rt=')[1]?.split(';')[0];
  await db.update('refresh_tokens', { token_hash: hashToken(tokenVal) }, {
    revoked_at: new Date(Date.now() - 60 * 1000).toISOString()
  });

  const reuseRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: cookie1 // Token lama di luar grace window
  });
  assert.strictEqual(reuseRes.status, 401, 'Percobaan reuse token di luar 30s harus ditolak 401');
  assert.strictEqual(reuseRes.data.code, 'TOKEN_REUSE_DETECTED');

  // Token yang sah berikutnya (cookie2) pun harus otomatis invalid karena seluruh family telah dicabut
  const revokedFamilyRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: cookie2
  });
  assert.strictEqual(revokedFamilyRes.status, 401, 'Seluruh family sesi harus dicabut demi keamanan');

  // -------------------------------------------------------------
  // 6. FORGOT & RESET PASSWORD
  // -------------------------------------------------------------
  console.log('6. [FORGOT & RESET] Menguji alur reset kata sandi...');
  const forgotRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: { email: emailA }
  });
  assert.strictEqual(forgotRes.status, 200);

  // Ambil token reset dari database
  const resetRow = await db.findOne('password_resets', { user_id: verifiedUser.id });
  assert.ok(resetRow);

  // Simulasikan token reset plain
  const knownPlainToken = newToken();
  await db.insert('password_resets', {
    user_id: verifiedUser.id,
    token_hash: hashToken(knownPlainToken),
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
  });

  const resetSuccess = await req('/api/auth/reset', {
    method: 'POST',
    body: { token: knownPlainToken, password: passwordA2 }
  });
  assert.strictEqual(resetSuccess.status, 200, 'Reset password harus 200');

  // Login dengan password lama harus ditolak
  const oldLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: passwordA1 }
  });
  assert.strictEqual(oldLogin.status, 401, 'Password lama harus ditolak');

  // Login dengan password baru harus sukses
  const newLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: passwordA2 }
  });
  assert.strictEqual(newLogin.status, 200, 'Password baru harus sukses');
  const activeTokenA = newLogin.data.token;
  const activeCookieA = newLogin.rtCookie;

  // -------------------------------------------------------------
  // 7. WORKSPACE ISOLATION & MULTI-TENANCY
  // -------------------------------------------------------------
  console.log('7. [WORKSPACE ISOLATION] Mendaftarkan User B dan memverifikasi batas isolasi...');
  const regResB = await req('/api/auth/register', {
    method: 'POST',
    body: { email: emailB, password: passwordB, brandName: 'Brand E2E Beta', acceptTerms: true }
  });
  assert.strictEqual(regResB.status, 200, `Registrasi User B harus 200: ${JSON.stringify(regResB.data)}`);
  const userBRow = await db.findOne('accounts', { email: emailB });
  assert.ok(userBRow, 'User B harus ada di database');
  await req(`/api/admin/users/${userBRow.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });

  const loginB = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailB, password: passwordB }
  });
  const activeTokenB = loginB.data.token;

  const membersB = await db.findMany('workspace_members', { user_id: userBRow.id });
  const workspaceBId = membersB[0].workspace_id;

  // User B mencoba mengakses data workspace A -> Harus 404 (Keamanan isolasi)
  const crossAccessRes = await req('/api/keywords', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${activeTokenB}`,
      'x-workspace-id': workspaceAId
    }
  });
  assert.strictEqual(crossAccessRes.status, 404, 'Akses lintas workspace harus ditolak 404');
  assert.strictEqual(crossAccessRes.data.code, 'WORKSPACE_NOT_FOUND');

  // -------------------------------------------------------------
  // 8. ROLE-BASED ACCESS CONTROL (Viewer 403)
  // -------------------------------------------------------------
  console.log('8. [RBAC] Mengundang User B sebagai Viewer ke Workspace A & memverifikasi proteksi tulis (403)...');
  // Masukkan langsung User B sebagai viewer di Workspace A
  await db.insert('workspace_members', {
    workspace_id: workspaceAId,
    user_id: userBRow.id,
    role: 'viewer'
  });

  // User B sebagai viewer membaca keywords Workspace A -> Diizinkan (200)
  const viewerReadRes = await req('/api/keywords', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${activeTokenB}`,
      'x-workspace-id': workspaceAId
    }
  });
  assert.strictEqual(viewerReadRes.status, 200, 'Viewer harus diizinkan membaca resource');

  // User B sebagai viewer mencoba membuat resource tulis (buat API key) -> Ditolak 403
  const viewerWriteRes = await req(`/api/workspaces/${workspaceAId}/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeTokenB}`
    },
    body: { label: 'Percobaan Key Ilegal' }
  });
  assert.strictEqual(viewerWriteRes.status, 403, 'Viewer harus ditolak saat menulis resource (403)');

  // -------------------------------------------------------------
  // 9. DELETE ACCOUNT & 30-DAY PURGE CRON
  // -------------------------------------------------------------
  console.log('9. [DELETE & PURGE] Menguji penghapusan akun User B dan pembersihan cron...');
  // User B keluar dari Workspace A agar memenuhi syarat hapus akun solo
  await db.remove('workspace_members', { workspace_id: workspaceAId, user_id: userBRow.id });

  const deleteReqRes = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeTokenB}` },
    body: { password: passwordB, confirm: 'HAPUS' }
  });
  assert.strictEqual(deleteReqRes.status, 200, 'Pengajuan hapus akun harus berhasil');

  // Login normal harus diblokir
  const blockedLoginB = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailB, password: passwordB }
  });
  assert.strictEqual(blockedLoginB.status, 403, 'Login akun pending deletion harus diblokir');
  assert.strictEqual(blockedLoginB.data.code, 'ACCOUNT_PENDING_DELETION');

  // Mundurkan tanggal permintaan hapus menjadi 35 hari lalu
  const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 86400 * 1000).toISOString();
  await db.update('accounts', { id: userBRow.id }, { deleted_requested_at: thirtyFiveDaysAgo });

  // Jalankan cron pembersihan
  console.log('   Menjalankan cron purgeDeletedAccounts()...');
  const purgedCount = await purgeDeletedAccounts();
  assert.ok(purgedCount >= 1, 'Purge cron harus membersihkan akun yang telah lewat 30 hari');

  const purgedUserCheck = await db.findOne('accounts', { id: userBRow.id });
  assert.strictEqual(purgedUserCheck, null, 'Akun User B harus sudah dihapus permanen');

  console.log('\n================================================================');
  console.log('SEMUA 9 ALUR DALAM SUITE PENGUJIAN AUTH (STEP 10) LULUS 100%!');
  console.log('================================================================\n');

  process.exit(0);
}

runFullAuthSuite().catch(err => {
  console.error('\n❌ FULL AUTH SUITE GAGAL:', err);
  process.exit(1);
});
