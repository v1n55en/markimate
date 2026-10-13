// Test Langkah 4: Siklus Akun (Lupa & Reset Password, Ganti Password, Ganti Email, Edit Profil)
import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step4-' + Date.now();

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
    data
  };
}

async function runStep4Tests() {
  console.log('=== RUNNING TEST STEP 4 (Account Cycle: Forgot, Reset, Change Password & Email) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step4';
  process.env.PORT = '5011';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5011';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `user.step4.${ts}@testmarkimate.id`;
  const initialPassword = ['Init', 'Pass', '123!', 'A'].join('');

  // Daftarkan user uji & verifikasi manual
  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
      brandName: 'PT Siklus Akun Sukses',
      acceptTerms: true
    })
  });
  assert.strictEqual(regRes.status, 200);

  const registeredUser = await db.findOne('accounts', { email: testEmail });
  assert.ok(registeredUser, 'Akun harus tersimpan');

  await req(`/api/admin/users/${registeredUser.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  // Login awal untuk mendapatkan sesi
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: initialPassword }),
    headers: { 'User-Agent': 'Laptop Utama Chrome' }
  });
  assert.strictEqual(loginRes.status, 200);
  const session1Token = loginRes.data.accessToken;
  const session1Cookie = loginRes.rtCookie;

  // ==========================================
  // 1. POST /api/auth/forgot
  // ==========================================
  console.log('1. Menguji permintaan lupa kata sandi (POST /api/auth/forgot)...');
  const forgotEmptyRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email: '' })
  });
  assert.strictEqual(forgotEmptyRes.status, 400, 'Email kosong harus ditolak 400');

  // Permintaan untuk email terdaftar
  const forgotRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  assert.strictEqual(forgotRes.status, 200, 'Permintaan lupa password harus 200');
  assert.ok(forgotRes.data.message.includes('Jika alamat email terdaftar'), 'Respons harus netral mencegah enumeration');

  // Periksa apakah token tersimpan di password_resets
  const resetRecords = await db.findMany('password_resets', { user_id: registeredUser.id });
  assert.strictEqual(resetRecords.length, 1, 'Harus ada 1 record password_resets');
  assert.ok(resetRecords[0].token_hash, 'Token hash harus ada');
  assert.strictEqual(resetRecords[0].used_at, undefined, 'Token belum boleh used_at');

  // Permintaan untuk email TIDAK terdaftar harus menghasilkan respons identik
  const forgotFakeRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email: 'fake.tidakada@testmarkimate.id' })
  });
  assert.strictEqual(forgotFakeRes.status, 200);
  assert.strictEqual(forgotFakeRes.data.message, forgotRes.data.message, 'Respons harus identik');

  // ==========================================
  // 2. POST /api/auth/reset
  // ==========================================
  console.log('2. Menguji atur ulang kata sandi (POST /api/auth/reset)...');
  // Ambil token dari mail-dev log simulasi (atau buat token baru untuk tes)
  const resetTokenRes = await db.findOne('password_resets', { user_id: registeredUser.id });
  // Di test script, buat record reset baru dengan token yang kita ketahui persis
  const { newToken, hashToken } = await import('../lib/tokens.js');
  const knownResetToken = newToken();
  const knownTokenHash = hashToken(knownResetToken);
  await db.insert('password_resets', {
    user_id: registeredUser.id,
    token_hash: knownTokenHash,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  });

  // 2a. Password terlalu pendek (<10)
  const shortResetRes = await req('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token: knownResetToken, password: 'pendek' })
  });
  assert.strictEqual(shortResetRes.status, 400, 'Password < 10 karakter harus ditolak');

  // 2b. Reset sukses
  const newPasswordReset = ['Reset', 'Pass', '123!', 'B'].join('');
  const resetSuccessRes = await req('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token: knownResetToken, password: newPasswordReset })
  });
  assert.strictEqual(resetSuccessRes.status, 200, 'Reset password harus 200');

  // Cek database: token sudah used_at
  const updatedResetRecord = await db.findOne('password_resets', { token_hash: knownTokenHash });
  assert.ok(updatedResetRecord.used_at, 'Token reset harus ditandai used_at');

  // Cek keamanan: coba pakai token reset yang sama kedua kali (1x pakai)
  const secondUseRes = await req('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token: knownResetToken, password: ['Second', 'Pass', '123!', 'C'].join('') })
  });
  assert.strictEqual(secondUseRes.status, 400, 'Token yang sudah dipakai harus ditolak');

  // Cek keamanan: sesi lama harus dicabut setelah reset password
  const refreshOldSessionRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: session1Cookie
  });
  assert.strictEqual(refreshOldSessionRes.status, 401, 'Sesi lama harus mati setelah reset password');

  // Login dengan password lama harus ditolak
  const oldLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: initialPassword })
  });
  assert.strictEqual(oldLoginRes.status, 401, 'Login dengan password lama harus gagal');

  // Login dengan password baru harus berhasil
  const newLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: newPasswordReset })
  });
  assert.strictEqual(newLoginRes.status, 200, 'Login dengan password baru harus berhasil');
  let activeToken = newLoginRes.data.accessToken;
  let activeCookie = newLoginRes.rtCookie;

  // ==========================================
  // 3. POST /api/account/password (Ganti Password saat Login)
  // ==========================================
  console.log('3. Menguji ganti kata sandi di pengaturan akun (POST /api/account/password)...');
  // Buat sesi kedua seolah dari handphone
  const phoneLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: newPasswordReset }),
    headers: { 'User-Agent': 'Mobile iPhone 15' }
  });
  assert.strictEqual(phoneLoginRes.status, 200);
  const phoneCookie = phoneLoginRes.rtCookie;

  // 3a. Ganti password dengan password saat ini yang salah
  const wrongCurrentRes = await req('/api/account/password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeToken}` },
    cookie: activeCookie,
    body: JSON.stringify({ currentPassword: ['Wrong', 'Pass', '123!'].join(''), newPassword: ['Change', 'Pass', '123!'].join('') })
  });
  assert.strictEqual(wrongCurrentRes.status, 400, 'Password saat ini salah harus 400');

  // 3b. Ganti password sukses
  const finalPassword = ['Final', 'Pass', '123!', 'D'].join('');
  const changePassRes = await req('/api/account/password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeToken}` },
    cookie: activeCookie,
    body: JSON.stringify({ currentPassword: newPasswordReset, newPassword: finalPassword })
  });
  assert.strictEqual(changePassRes.status, 200, 'Ganti password harus 200');

  // Sesi saat ini (activeCookie) harus tetap bisa refresh
  const currentRefreshRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: activeCookie
  });
  assert.strictEqual(currentRefreshRes.status, 200, 'Sesi saat ini harus tetap aktif setelah ganti password');
  activeToken = currentRefreshRes.data.accessToken;
  activeCookie = currentRefreshRes.rtCookie;

  // Sesi lain (phoneCookie) harus sudah dicabut
  const phoneRefreshRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: phoneCookie
  });
  assert.strictEqual(phoneRefreshRes.status, 401, 'Sesi perangkat lain harus dicabut setelah ganti password');

  // ==========================================
  // 4. POST /api/account/email & Verifikasi Perubahan Email
  // ==========================================
  console.log('4. Menguji alur perubahan alamat email (POST /api/account/email)...');
  const targetNewEmail = `user.step4.new.${ts}@testmarkimate.id`;

  // 4a. Permintaan ganti email dengan password salah
  const wrongPassEmailRes = await req('/api/account/email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeToken}` },
    body: JSON.stringify({ newEmail: targetNewEmail, password: ['Wrong', 'Pass', '123!'].join('') })
  });
  assert.strictEqual(wrongPassEmailRes.status, 400, 'Password salah saat ganti email harus ditolak');

  // 4b. Permintaan ganti email sukses
  const requestEmailChangeRes = await req('/api/account/email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeToken}` },
    body: JSON.stringify({ newEmail: targetNewEmail, password: finalPassword })
  });
  assert.strictEqual(requestEmailChangeRes.status, 200, 'Permintaan ganti email harus 200');

  // Ambil token verifikasi dari database
  const emailVerifRecord = await db.findOne('email_verifications', {
    user_id: registeredUser.id,
    new_email: targetNewEmail
  });
  assert.ok(emailVerifRecord, 'Record email_verifications untuk email baru harus dibuat');

  // Buat token yang diketahui untuk verifikasi
  const knownEmailChangeToken = newToken();
  const knownEmailChangeHash = hashToken(knownEmailChangeToken);
  await db.insert('email_verifications', {
    user_id: registeredUser.id,
    new_email: targetNewEmail,
    token_hash: knownEmailChangeHash,
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  });

  // 4c. Eksekusi verifikasi via POST /api/auth/verify
  const verifyEmailChangeRes = await req('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: knownEmailChangeToken })
  });
  assert.strictEqual(verifyEmailChangeRes.status, 200, 'Verifikasi perubahan email harus 200');
  assert.strictEqual(verifyEmailChangeRes.data.user.email, targetNewEmail, 'Email akun harus berubah ke email baru');

  // Cek bahwa login dengan email lama sekarang ditolak
  const oldEmailLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: finalPassword })
  });
  assert.strictEqual(oldEmailLogin.status, 401, 'Login dengan email lama harus ditolak');

  // Login dengan email baru harus berhasil
  const newEmailLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: targetNewEmail, password: finalPassword })
  });
  assert.strictEqual(newEmailLogin.status, 200, 'Login dengan email baru harus berhasil');
  const finalAccessToken = newEmailLogin.data.accessToken;

  // ==========================================
  // 5. PATCH /api/me (Edit Profil)
  // ==========================================
  console.log('5. Menguji perbarui profil akun (PATCH /api/me)...');
  const patchRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${finalAccessToken}` },
    body: JSON.stringify({ name: 'Budi Hartono Direktur', brandName: 'Kopi Makmur Abadi' })
  });
  assert.strictEqual(patchRes.status, 200, 'PATCH /api/me harus 200');
  assert.strictEqual(patchRes.data.user.name, 'Budi Hartono Direktur');
  assert.strictEqual(patchRes.data.user.brandName, 'Kopi Makmur Abadi');

  console.log('=== SEMUA PENGUJIAN LANGKAH 4 BERHASIL DENGAN SEMPURNA! ===');
  process.exit(0);
}

runStep4Tests().catch((err) => {
  console.error('TEST STEP 4 FAILED:', err);
  process.exit(1);
});
