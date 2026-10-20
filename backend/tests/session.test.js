// Test Session: Access Token (15m), Refresh Token Rotation, Multi-Tab Grace Window, Device Sessions, Logout
import assert from 'assert';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-session-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-session-' + Date.now();

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

async function runSessionTests() {
  console.log('=== RUNNING TEST SESSION (Access Token, Refresh Token Rotation & Session Mgmt) ===');

  process.env.JWT_SECRET = 'test-secret-key-session';
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
  const testEmail = `user.session.${ts}@testmarkimate.id`;
  const testPassword = ['Mock', 'Session', 'Pass', '123!'].join('');

  // Setup user
  const regRes = await sessionRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      name: 'Session Tester',
      password: testPassword,
      brandName: 'Session Brand',
      acceptTerms: true
    })
  });
  assert.strictEqual(regRes.status, 200);

  const registeredUser = await db.findOne('accounts', { email: testEmail });
  assert.ok(registeredUser, 'User harus tercatat di DB');

  const adminVerifyRes = await sessionRequest(`/api/admin/users/${registeredUser.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  assert.strictEqual(adminVerifyRes.status, 200, 'Admin verify harus 200');

  // 1. Login Happy Path
  console.log('1. Menguji login & penerbitan token sesi...');
  const loginRes = await sessionRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });

  assert.strictEqual(loginRes.status, 200, 'Login harus 200 OK');
  assert.ok(loginRes.data.accessToken, 'Harus mengembalikan accessToken');
  assert.strictEqual(loginRes.data.expiresIn, 900, 'Masa berlaku accessToken harus 900 detik (15 menit)');
  assert.ok(loginRes.rawSetCookie.includes('mk_rt='), 'Cookie harus bernama mk_rt');
  assert.ok(loginRes.rawSetCookie.includes('HttpOnly'), 'Cookie harus berflag HttpOnly');
  assert.ok(loginRes.rawSetCookie.includes('SameSite=Lax'), 'Cookie harus SameSite=Lax');

  const initialAccessToken = loginRes.data.accessToken;
  const initialCookie = loginRes.rtCookie;

  const decodedAccess = jwt.verify(initialAccessToken, process.env.JWT_SECRET);
  assert.strictEqual(decodedAccess.sub, registeredUser.id, 'Claim sub harus sesuai userId');
  assert.strictEqual(decodedAccess.email, testEmail, 'Claim email harus sesuai');
  assert.strictEqual(decodedAccess.typ, 'access', 'Claim typ harus access');

  // 2. Akses dengan Access Token
  console.log('2. Menguji akses endpoint berotentikasi dengan Bearer access token...');
  const meRes = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${initialAccessToken}` }
  });
  assert.strictEqual(meRes.status, 200, 'GET /api/me dengan access token harus 200');
  assert.strictEqual(meRes.data.user.email, testEmail, 'Email user harus sesuai');

  // 3. Refresh Token Rotation
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

  const meAfterRotate = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${rotatedAccessToken}` }
  });
  assert.strictEqual(meAfterRotate.status, 200, 'Akses dengan access token baru harus berhasil');

  // 4. Token Reuse Detection
  console.log('4. Menguji deteksi penggunaan ulang token (Reuse Detection)...');
  const oldHash = (await import('../lib/tokens.js')).hashToken(loginRes.rtRawValue);
  await db.update('refresh_tokens', { token_hash: oldHash }, {
    revoked_at: new Date(Date.now() - 60 * 1000).toISOString()
  });

  const reuseRes = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: initialCookie
  });
  assert.strictEqual(reuseRes.status, 401, 'Penggunaan token yang sudah dicabut harus ditolak 401');
  assert.strictEqual(reuseRes.data?.code, 'TOKEN_REUSE_DETECTED', 'Harus mengembalikan kode TOKEN_REUSE_DETECTED');

  const rotatedUseAfterReuse = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: rotatedCookie
  });
  assert.strictEqual(rotatedUseAfterReuse.status, 401, 'Token keluarga harus dicabut seluruhnya setelah terdeteksi reuse');

  // 5. Transisi & Upgrade Sesi Legacy (30 hari)
  console.log('5. Menguji transisi & upgrade sesi dari JWT lama 30 hari...');
  const legacyJwt = jwt.sign(
    { sub: registeredUser.id, email: registeredUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const meLegacyRes = await sessionRequest('/api/me', {
    headers: { Authorization: `Bearer ${legacyJwt}` }
  });
  assert.strictEqual(meLegacyRes.status, 200, 'Akses dengan legacy token 30d harus diterima selama masa transisi');

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

  // 6. Manajemen Sesi Perangkat (/api/sessions)
  console.log('6. Menguji endpoint daftar sesi perangkat (/api/sessions)...');
  const listSessionsRes = await sessionRequest('/api/sessions', {
    headers: { Authorization: `Bearer ${upgradedAccessToken}` },
    cookie: upgradedCookie
  });

  assert.strictEqual(listSessionsRes.status, 200, 'GET /api/sessions harus 200');
  assert.ok(Array.isArray(listSessionsRes.data.sessions), 'Harus mengembalikan array sessions');
  assert.ok(listSessionsRes.data.sessions.length >= 1, 'Harus ada minimal 1 sesi aktif');

  const secondLoginRes = await sessionRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword }),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
  });
  assert.strictEqual(secondLoginRes.status, 200, 'Login kedua harus sukses');
  const secondSessionCookie = secondLoginRes.rtCookie;

  const listAfterSecond = await sessionRequest('/api/sessions', {
    headers: { Authorization: `Bearer ${upgradedAccessToken}` },
    cookie: upgradedCookie
  });
  assert.strictEqual(listAfterSecond.data.sessions.length, 2, 'Harus ada 2 sesi aktif yang terdaftar');
  const sessionToRevoke = listAfterSecond.data.sessions.find(s => !s.current);
  assert.ok(sessionToRevoke, 'Harus ada sesi non-current untuk dicabut');

  // Validasi ID non-UUID pada DELETE /api/sessions/:id
  const invalidSessionIdRes = await sessionRequest('/api/sessions/invalid-id-bukan-uuid', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${upgradedAccessToken}` }
  });
  assert.strictEqual(invalidSessionIdRes.status, 404, 'ID sesi non-UUID harus mengembalikan 404');

  // Cabut sesi via DELETE /api/sessions/:id
  const revokeOneRes = await sessionRequest(`/api/sessions/${sessionToRevoke.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${upgradedAccessToken}` }
  });
  assert.strictEqual(revokeOneRes.status, 200, 'DELETE /api/sessions/:id harus 200');

  const refreshSecondRes = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: secondSessionCookie
  });
  assert.strictEqual(refreshSecondRes.status, 401, 'Sesi yang dicabut tidak boleh bisa refresh');

  // 7. Grace Window 30 Detik untuk Refresh Bersamaan (Multi-Tab)
  console.log('7. Menguji Grace Window 30 Detik untuk Refresh Bersamaan (Multi-Tab)...');
  const multiTabLogin = await sessionRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(multiTabLogin.status, 200);
  const sharedCookie = multiTabLogin.rtCookie;

  const tab1Refresh = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: sharedCookie
  });
  assert.strictEqual(tab1Refresh.status, 200, 'Tab 1 refresh pertama harus berhasil 200');

  const tab2Refresh = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: sharedCookie
  });
  assert.strictEqual(tab2Refresh.status, 200, 'Tab 2 dalam grace window 30s harus berhasil 200');

  // 8. Logout Sesi (/api/auth/logout)
  console.log('8. Menguji logout sesi saat ini (/api/auth/logout)...');
  const logoutRes = await sessionRequest('/api/auth/logout', {
    method: 'POST',
    cookie: upgradedCookie
  });
  assert.strictEqual(logoutRes.status, 200, 'POST /api/auth/logout harus 200');
  assert.ok(logoutRes.rawSetCookie.includes('Max-Age=0') || logoutRes.rawSetCookie.includes('Expires='), 'Cookie mk_rt harus dihapus');

  const refreshAfterLogout = await sessionRequest('/api/auth/refresh', {
    method: 'POST',
    cookie: upgradedCookie
  });
  assert.strictEqual(refreshAfterLogout.status, 401, 'Refresh setelah logout harus ditolak');

  console.log('ALL SESSION TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runSessionTests().catch(err => {
  console.error('Test Session Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
