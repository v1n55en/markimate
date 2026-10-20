// Test Account Lifecycle: Forgot/Reset Password, Change Password/Email, Profile Edit, Deletion Schedule, Export Data, Hard Purge, Meta Deletion
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-acct-lifecycle-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], password_resets: [],
    email_verifications: [], audit_logs: [], credit_orders: [], webhook_events: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { purgeDeletedAccounts } = await import('../lib/account-lifecycle.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-lifecycle-' + Date.now();
const TEST_META_SECRET = 'test_meta_app_secret_lifecycle';

async function req(path, options = {}) {
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
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  const rawSetCookie = res.headers.get('set-cookie');
  let rtCookieValue = null;
  if (rawSetCookie) {
    const match = rawSetCookie.match(/mk_rt=([^;]+)/);
    if (match) rtCookieValue = match[1];
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    rawSetCookie,
    rtCookie: rtCookieValue ? `mk_rt=${rtCookieValue}` : null,
    data
  };
}

function makeMetaSignedRequest(payload, secret) {
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${sig}.${payloadStr}`;
}

async function runAccountLifecycleTests() {
  console.log('=== RUNNING TEST ACCOUNT LIFECYCLE (Forgot, Reset, Change Email/Pass, Schedule Delete, Purge, Export) ===');

  process.env.JWT_SECRET = 'test-secret-key-lifecycle';
  process.env.PORT = '5011';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-lifecycle';
  process.env.META_APP_SECRET = TEST_META_SECRET;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5011';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `user.cycle.${ts}@testmarkimate.id`;
  const testPassword = ['Mock', 'Cycle', 'Pass', '123!'].join('');

  // 1. Pendaftaran & Verifikasi Akun Utama
  await req('/api/auth/register', {
    method: 'POST',
    body: {
      email: testEmail,
      name: 'User Cycle',
      password: testPassword,
      brandName: 'Cycle Brand',
      acceptTerms: true
    }
  });

  const user = await db.findOne('accounts', { email: testEmail });
  await req(`/api/admin/users/${user.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  });
  assert.strictEqual(loginRes.status, 200);
  let accessToken = loginRes.data.accessToken;

  // 2. Forgot Password Flow
  console.log('2. Menguji alur forgot & reset password (netralitas anti-enumeration & single-use token)...');
  
  // 2a. Email kosong ditolak 400
  const forgotEmptyRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: { email: '' }
  });
  assert.strictEqual(forgotEmptyRes.status, 400, 'Email kosong harus ditolak 400');
  assert.strictEqual(forgotEmptyRes.data.code, 'EMAIL_REQUIRED');

  // 2b. Permintaan untuk email terdaftar
  const forgotRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: { email: testEmail }
  });
  assert.strictEqual(forgotRes.status, 200, 'Permintaan lupa password email terdaftar harus 200');

  // 2c. Permintaan untuk email TIDAK terdaftar (Anti-enumeration check)
  const fakeEmail = `ghost.unregistered.${Date.now()}@testmarkimate.id`;
  const forgotFakeRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: { email: fakeEmail }
  });
  assert.strictEqual(forgotFakeRes.status, 200, 'Email tidak terdaftar harus tetap mengembalikan status 200');
  assert.strictEqual(forgotFakeRes.status, forgotRes.status, 'Status code terdaftar vs tidak terdaftar harus identik');
  assert.strictEqual(forgotFakeRes.data.success, forgotRes.data.success, 'Flag success harus identik');
  assert.strictEqual(forgotFakeRes.data.message, forgotRes.data.message, 'Message respons harus identik untuk mencegah enumerasi');
  assert.deepStrictEqual(Object.keys(forgotFakeRes.data).sort(), Object.keys(forgotRes.data).sort(), 'Bentuk struktur respons body harus identik');

  const resetRecord = await db.findOne('password_resets', { user_id: user.id });
  assert.ok(resetRecord, 'Data password_resets harus tercatat di database');
  assert.ok(resetRecord.token_hash, 'Token hash harus ada');

  const { newToken, hashToken } = await import('../lib/tokens.js');
  const directResetToken = newToken();
  const directHash = hashToken(directResetToken);
  await db.insert('password_resets', {
    user_id: user.id,
    token_hash: directHash,
    expires_at: new Date(Date.now() + 3600e3).toISOString()
  });

  // 2d. Password terlalu pendek ditolak
  const shortPassRes = await req('/api/auth/reset', {
    method: 'POST',
    body: { token: directResetToken, password: 'short' }
  });
  assert.strictEqual(shortPassRes.status, 400, 'Password < 10 karakter harus ditolak 400');

  // 2e. Reset password sukses
  const newPass = ['New', 'Cycle', 'Pass', '999!'].join('');
  const resetRes = await req('/api/auth/reset', {
    method: 'POST',
    body: { token: directResetToken, password: newPass }
  });
  assert.strictEqual(resetRes.status, 200, 'Reset password harus sukses 200');

  // 2f. Token tidak boleh bisa dipakai kedua kali (Single-use)
  const reuseResetRes = await req('/api/auth/reset', {
    method: 'POST',
    body: { token: directResetToken, password: ['Second', 'Try', 'Pass', '888!'].join('') }
  });
  assert.strictEqual(reuseResetRes.status, 400, 'Token reset yang sudah dipakai harus ditolak');

  // 2g. Sesi lama dicabut setelah reset
  const oldSessionRefresh = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: loginRes.rtCookie
  });
  assert.strictEqual(oldSessionRefresh.status, 401, 'Sesi lama harus dibatalkan setelah password di-reset');

  const reLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: newPass }
  });
  assert.strictEqual(reLoginRes.status, 200, 'Login dengan password baru harus sukses');
  accessToken = reLoginRes.data.accessToken;
  console.log('✓ 2. Forgot & reset password berhasil dengan netralitas anti-enumeration dan keamanan single-use token');

  // 3. Change Password
  console.log('3. Menguji perubahan password saat login...');
  const newerPass = ['Newer', 'Cycle', 'Pass', '888!'].join('');
  const changePassRes = await req('/api/account/password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { currentPassword: newPass, newPassword: newerPass }
  });
  assert.strictEqual(changePassRes.status, 200, 'Change password harus 200');

  // Login ulang untuk mendapatkan token baru
  const loginAfterChange = await req('/api/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: newerPass }
  });
  assert.strictEqual(loginAfterChange.status, 200);
  accessToken = loginAfterChange.data.accessToken;
  console.log('✓ 3. Change password berhasil dan dapat login dengan password baru');

  // 4. Change Email Flow
  console.log('4. Menguji alur perubahan email akun...');
  const newEmail = `user.cycle.new.${ts}@testmarkimate.id`;
  const reqEmailChangeRes = await req('/api/account/email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { newEmail, password: newerPass }
  });
  assert.strictEqual(reqEmailChangeRes.status, 200);

  const emailVerifyToken = newToken();
  await db.insert('email_verifications', {
    user_id: user.id,
    token_hash: hashToken(emailVerifyToken),
    new_email: newEmail,
    expires_at: new Date(Date.now() + 3600e3).toISOString()
  });

  const verifyEmailChangeRes = await req('/api/auth/verify', {
    method: 'POST',
    body: { token: emailVerifyToken }
  });
  assert.strictEqual(verifyEmailChangeRes.status, 200);
  assert.strictEqual(verifyEmailChangeRes.data.emailChanged, true);
  accessToken = verifyEmailChangeRes.data.accessToken;

  const updatedUser = await db.findOne('accounts', { id: user.id });
  assert.strictEqual(updatedUser.email, newEmail, 'Email user harus terupdate');
  console.log('✓ 4. Perubahan alamat email berhasil diverifikasi');

  // 5. Update Profile (Name & BrandName)
  console.log('5. Menguji pembaruan profil user...');
  const updateProfileRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { name: 'Super Cycle User', brandName: 'Cycle Brand Updated' }
  });
  assert.strictEqual(updateProfileRes.status, 200);
  assert.strictEqual(updateProfileRes.data.user.name, 'Super Cycle User');
  assert.strictEqual(updateProfileRes.data.user.brandName, 'Cycle Brand Updated');
  console.log('✓ 5. Update profil berhasil');

  // 6. Data Export (ZIP / JSON)
  console.log('6. Menguji ekspor data akun (GDPR compliance)...');
  const exportRes = await req('/api/account/export', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  assert.strictEqual(exportRes.status, 200);
  assert.ok(exportRes.headers.get('content-disposition')?.includes('attachment; filename='), 'Harus berupa file attachment');
  console.log('✓ 6. Ekspor data akun berhasil diunduh');

  // 7. Schedule Account Deletion & Cancel Deletion
  console.log('7. Menguji penjadwalan hapus akun & pembatalan...');
  const deleteReq = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { password: newerPass, confirm: 'HAPUS' }
  });
  assert.strictEqual(deleteReq.status, 200);
  assert.strictEqual(deleteReq.data.code, 'ACCOUNT_DELETION_SCHEDULED');

  const pendingUser = await db.findOne('accounts', { id: user.id });
  assert.strictEqual(pendingUser.status, 'pending_deletion');

  // Batalkan penghapusan akun
  const cancelDeleteRes = await req('/api/account/delete/cancel', {
    method: 'POST',
    body: { email: newEmail, password: newerPass }
  });
  assert.strictEqual(cancelDeleteRes.status, 200);
  assert.strictEqual(cancelDeleteRes.data.code, 'ACCOUNT_DELETION_CANCELLED');
  assert.strictEqual(cancelDeleteRes.data.user.status, 'active');
  accessToken = cancelDeleteRes.data.accessToken;
  console.log('✓ 7. Jadwal hapus akun & pembatalan (30 hari grace period) berfungsi');

  // 8. Hard Purge Cron Job (Eksekusi Pembersihan Permanen)
  console.log('8. Menguji hard purge akun yang sudah melewati 30 hari...');
  // Jadwalkan kembali penghapusan akun
  await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { password: newerPass, confirm: 'HAPUS' }
  });

  // Mundurkan deleted_requested_at ke 31 hari yang lalu
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
  await db.update('accounts', { id: user.id }, {
    status: 'pending_deletion',
    deleted_requested_at: thirtyOneDaysAgo
  });

  // Jalankan hard purge
  const purgedCount = await purgeDeletedAccounts();
  assert.ok(purgedCount >= 1, 'Harus ada minimal 1 akun ter-purge');

  const purgedUser = await db.findOne('accounts', { id: user.id });
  assert.strictEqual(purgedUser, null, 'Akun harus terhapus permanen dari accounts');

  const purgedWs = await db.findOne('workspaces', { id: user.id });
  assert.strictEqual(purgedWs, null, 'Workspace akun harus terhapus');
  console.log('✓ 8. Hard purge cron job berhasil membersihkan data akun secara permanen');

  // 9. Meta Data Deletion Callback (Facebook GDPR URL Callback)
  console.log('9. Menguji endpoint Meta Data Deletion Callback...');
  const fakeFbUserId = `fb_${ts}`;
  const signedReq = makeMetaSignedRequest({ user_id: fakeFbUserId }, TEST_META_SECRET);
  const metaReq = await req('/api/data-deletion/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `signed_request=${encodeURIComponent(signedReq)}`
  });
  assert.strictEqual(metaReq.status, 200);
  assert.ok(metaReq.data.url?.includes('/data-deletion?code='), 'Harus mengembalikan tracking URL Meta deletion');

  const statusRes = await req(`/api/data-deletion/status?code=${metaReq.data.confirmation_code}`);
  assert.strictEqual(statusRes.status, 200);
  assert.ok(['received', 'completed'].includes(statusRes.data.status), 'Status harus received atau completed');
  console.log('✓ 9. Meta data deletion callback & status berhasil diverifikasi');

  console.log('ALL ACCOUNT LIFECYCLE TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runAccountLifecycleTests().catch(err => {
  console.error('Test Account Lifecycle Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
