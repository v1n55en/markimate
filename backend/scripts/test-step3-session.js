// Test Langkah 3: Sesi Aman, Access Token (15m) + Refresh Token Cookie (30d) dengan Reuse Detection
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step3-' + Date.now();

// Helper untuk fetch dengan penanganan cookie manual
async function sessionRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const rawSetCookie = res.headers.get('set-cookie');
  let rtCookieValue = null;
  if (rawSetCookie) {
    const match = rawSetCookie.match(/mk_rt=([^;]+)/);
    if (match) rtCookieValue = match[1];
  }

  const data = await res.json().catch(() => null);
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    rawSetCookie,
    rtCookie: rtCookieValue ? `mk_rt=${rtCookieValue}` : null,
    rtRawValue: rtCookieValue,
    data
  };
}

async function runStep3Tests() {
  console.log('=== RUNNING TEST STEP 3 (Access Token, Refresh Token Rotation & Session Mgmt) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step3';
  process.env.PORT = '5010';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5010';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `user.step3.${ts}@testmarkimate.id`;
  const testPassword = ['Session', 'Pass', '123!', 'X'].join('');

  // Siapkan user aktif (daftarkan lalu verifikasi manual via admin)
  const regRes = await sessionRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      brandName: 'PT Markimate Sesi',
      acceptTerms: true
    })
  });
  assert.strictEqual(regRes.status, 200, 'Pendaftaran harus 200');

  const registeredUser = await db.findOne('accounts', { email: testEmail });
  assert.ok(registeredUser, 'Akun harus tersimpan di database');

  const adminVerifyRes = await sessionRequest(`/api/admin/users/${registeredUser.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  assert.strictEqual(adminVerifyRes.status, 200, 'Admin verify harus 200');

  // ==========================================
  // 1. Login & Penerbitan Token + Cookie
  // ==========================================
  console.log('1. Menguji login & penerbitan access token + httpOnly refresh cookie...');
  const loginRes = await sessionRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });

  assert.strictEqual(loginRes.status, 200, 'Login harus 200');
  assert.ok(loginRes.data.accessToken, 'Login harus mengembalikan accessToken');
  assert.ok(loginRes.rawSetCookie, 'Login harus mengembalikan Set-Cookie');
  assert.ok(loginRes.rawSetCookie.includes('mk_rt='), 'Cookie harus bernama mk_rt');
  assert.ok(loginRes.rawSetCookie.includes('HttpOnly'), 'Cookie harus berflag HttpOnly');
  assert.ok(loginRes.rawSetCookie.includes('SameSite=Lax'), 'Cookie harus SameSite=Lax');

  // Decode JWT access token untuk verifikasi payload
  const decodedAccess = jwt.verify(loginRes.data.accessToken, process.env.JWT_SECRET);
  assert.strictEqual(decodedAccess.typ, 'access', 'Access token harus memiliki claim typ: access');
  assert.strictEqual(decodedAccess.email, testEmail, 'Access token email harus cocok');

  const initialCookie = loginRes.rtCookie;
  const initialAccessToken = loginRes.data.accessToken;

  // ==========================================
  // 2. Akses Endpoint Berotentikasi (/api/me)
  // ==========================================
  console.log('2. Menguji akses endpoint berotentikasi dengan Bearer access token...');
  const meRes = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${initialAccessToken}` }
  });
  assert.strictEqual(meRes.status, 200, 'GET /api/me dengan access token harus 200');
  assert.strictEqual(meRes.data.user.email, testEmail, 'Email user harus sesuai');

  // ==========================================
  // 3. Refresh Token Rotation (Happy Path)
  // ==========================================
  console.log('3. Menguji rotasi refresh token (/api/auth/refresh)...');
  const refreshRes = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: initialCookie,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });

  assert.strictEqual(refreshRes.status, 200, 'POST /api/auth/refresh harus 200');
  assert.ok(refreshRes.data.accessToken, 'Refresh harus menerbitkan accessToken baru');
  assert.ok(refreshRes.rtCookie, 'Refresh harus memutar dan mengembalikan cookie mk_rt baru');
  assert.notStrictEqual(refreshRes.rtRawValue, loginRes.rtRawValue, 'Token baru tidak boleh sama dengan token lama');

  const rotatedCookie = refreshRes.rtCookie;
  const rotatedAccessToken = refreshRes.data.accessToken;

  // Cek bahwa access token hasil rotasi bisa digunakan
  const meAfterRotate = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${rotatedAccessToken}` }
  });
  assert.strictEqual(meAfterRotate.status, 200, 'Akses dengan access token baru harus berhasil');

  // ==========================================
  // 4. Token Reuse Detection (Security Test)
  // ==========================================
  console.log('4. Menguji deteksi penggunaan ulang token (Reuse Detection)...');
  // Coba refresh sekali lagi menggunakan token LAMA (initialCookie) yang sudah diputar/revoked
  const reuseRes = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: initialCookie
  });

  assert.strictEqual(reuseRes.status, 401, 'Percobaan reuse token harus ditolak 401');
  assert.strictEqual(reuseRes.data?.code, 'TOKEN_REUSE_DETECTED', 'Harus mengembalikan kode TOKEN_REUSE_DETECTED');

  // Seluruh keluarga token (termasuk rotatedCookie) harus otomatis dicabut
  const rotatedUseAfterReuse = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: rotatedCookie
  });
  assert.strictEqual(rotatedUseAfterReuse.status, 401, 'Token keluarga harus dicabut seluruhnya setelah terdeteksi reuse');

  // Periksa audit log untuk mencatat tindakan reuse
  const auditLogs = await db.findMany('audit_logs', { user_id: registeredUser.id, action: 'refresh_reuse' });
  assert.ok(auditLogs.length >= 1, 'Audit log untuk refresh_reuse harus tercatat');

  // ==========================================
  // 5. Transisi & Upgrade Sesi Legacy (30 hari)
  // ==========================================
  console.log('5. Menguji transisi & upgrade sesi dari JWT lama 30 hari...');
  // Buat legacy JWT tanpa claim 'typ'
  const legacyJwt = jwt.sign(
    { sub: registeredUser.id, email: registeredUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  // Akses /api/me dengan legacy JWT harus diterima selama masa transisi
  const meLegacyRes = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${legacyJwt}` }
  });
  assert.strictEqual(meLegacyRes.status, 200, 'Akses dengan legacy token 30d harus diterima selama masa transisi');

  // Tukar legacy JWT dengan sesi baru via /api/auth/upgrade-session
  const upgradeRes = await sessionRequest('/api/auth/upgrade-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${legacyJwt}`,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
    }
  });

  assert.strictEqual(upgradeRes.status, 200, 'POST /api/auth/upgrade-session harus 200');
  assert.ok(upgradeRes.data.accessToken, 'Upgrade harus mengembalikan accessToken baru');
  assert.ok(upgradeRes.rtCookie, 'Upgrade harus mengembalikan cookie mk_rt');

  const upgradedCookie = upgradeRes.rtCookie;
  const upgradedAccessToken = upgradeRes.data.accessToken;

  // ==========================================
  // 6. Manajemen Sesi Perangkat (/api/sessions)
  // ==========================================
  console.log('6. Menguji endpoint daftar sesi perangkat (/api/sessions)...');
  const listSessionsRes = await sessionRequest('/api/sessions', {
    headers: { Authorization: `Bearer ${upgradedAccessToken}` },
    cookie: upgradedCookie
  });

  assert.strictEqual(listSessionsRes.status, 200, 'GET /api/sessions harus 200');
  assert.ok(Array.isArray(listSessionsRes.data.sessions), 'Harus mengembalikan array sessions');
  assert.ok(listSessionsRes.data.sessions.length >= 1, 'Harus ada minimal 1 sesi aktif');

  const currentSession = listSessionsRes.data.sessions.find(s => s.current);
  assert.ok(currentSession, 'Sesi saat ini harus memiliki current: true');

  // Buat sesi kedua (misalnya dari perangkat laptop lain)
  const secondLoginRes = await sessionRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
  });
  assert.strictEqual(secondLoginRes.status, 200);
  const secondSessionCookie = secondLoginRes.rtCookie;

  // Periksa kembali daftar sesi: sekarang harus ada 2 sesi
  const listAfterTwo = await sessionRequest('/api/sessions', {
    headers: { Authorization: `Bearer ${upgradedAccessToken}` },
    cookie: upgradedCookie
  });
  assert.strictEqual(listAfterTwo.data.sessions.length, 2, 'Harus ada 2 sesi aktif');

  const sessionToRevoke = listAfterTwo.data.sessions.find(s => !s.current);
  assert.ok(sessionToRevoke, 'Harus menemukan sesi lain untuk dicabut');

  // Cabut sesi kedua via DELETE /api/sessions/:id
  console.log('7. Menguji pencabutan sesi perangkat tertentu (DELETE /api/sessions/:id)...');
  const revokeOneRes = await sessionRequest(`/api/sessions/${sessionToRevoke.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${upgradedAccessToken}` }
  });
  assert.strictEqual(revokeOneRes.status, 200, 'DELETE /api/sessions/:id harus 200');

  // Sesi kedua seharusnya sudah tidak bisa di-refresh lagi
  const refreshSecondRes = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: secondSessionCookie
  });
  assert.strictEqual(refreshSecondRes.status, 401, 'Sesi yang dicabut tidak boleh bisa refresh');

  // ==========================================
  // 8. Logout Sesi (/api/auth/logout)
  // ==========================================
  console.log('8. Menguji logout sesi saat ini (/api/auth/logout)...');
  const logoutRes = await sessionRequest('/api/auth/logout', {
    method: 'POST',
    cookie: upgradedCookie
  });
  assert.strictEqual(logoutRes.status, 200, 'POST /api/auth/logout harus 200');
  assert.ok(logoutRes.rawSetCookie.includes('Max-Age=0') || logoutRes.rawSetCookie.includes('Expires='), 'Cookie mk_rt harus dihapus (Max-Age=0)');

  // Refresh setelah logout harus ditolak
  const refreshAfterLogout = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: upgradedCookie
  });
  assert.strictEqual(refreshAfterLogout.status, 401, 'Refresh setelah logout harus ditolak');

  console.log('=== SEMUA PENGUJIAN LANGKAH 3 BERHASIL DENGAN SEMPURNA! ===');
  process.exit(0);
}

runStep3Tests().catch((err) => {
  console.error('TEST STEP 3 FAILED:', err);
  process.exit(1);
});
