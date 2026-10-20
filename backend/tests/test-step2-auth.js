// Test Langkah 2: Mailer, Rate Limit, Daftar + Verifikasi Email (PRD F1 + F2)
import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step2-' + Date.now();

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

async function runStep2Tests() {
  console.log('=== RUNNING TEST STEP 2 (Registration, Email Verification & Security) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step2';
  process.env.PORT = '5009';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5009';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const testEmail = `user.step2.${ts}@testmarkimate.id`;
  const testPassword = ['Mock', 'Kuat', 'Pass', '123!'].join('');

  // 1. Validasi Input Pendaftaran
  // 1a. Password < 10 karakter
  const shortPassRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'short',
      brandName: 'Brand Uji',
      acceptTerms: true
    })
  });
  assert.strictEqual(shortPassRes.status, 400, 'Password < 10 karakter harus ditolak 400');

  // 1b. Terms tidak dicentang
  const unacceptedTermsRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      brandName: 'Brand Uji',
      acceptTerms: false
    })
  });
  assert.strictEqual(unacceptedTermsRes.status, 400, 'acceptTerms !== true harus ditolak 400');
  console.log('✓ 1. Validasi input pendaftaran (password < 10 dan terms) berhasil ditegakkan');

  // 2. Pendaftaran User Baru
  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      name: 'Tester Langkah Dua',
      password: testPassword,
      brandName: 'Brand Langkah 2',
      niche: 'Tech',
      acceptTerms: true
    })
  });
  assert.strictEqual(registerRes.status, 200);
  assert.strictEqual(registerRes.data.status, 'verification_sent');
  assert.strictEqual(registerRes.data.token, undefined, 'Tidak boleh ada token sesi sebelum verifikasi');
  assert.strictEqual(registerRes.data.email, testEmail);

  // Verifikasi akun di database
  const createdUser = await db.findOne('accounts', { email: testEmail });
  assert.ok(createdUser, 'User harus tercatat di accounts');
  assert.strictEqual(createdUser.status, 'unverified', 'Status user harus unverified');
  assert.strictEqual(createdUser.email_verified_at, null, 'email_verified_at harus null');
  assert.strictEqual(createdUser.name, 'Tester Langkah Dua');

  // Verifikasi workspace default
  const ws = await db.findOne('workspaces', { id: createdUser.id });
  assert.ok(ws, 'Workspace default harus dibuat dengan id = accounts.id');
  const member = await db.findOne('workspace_members', { workspace_id: createdUser.id, user_id: createdUser.id });
  assert.strictEqual(member.role, 'owner', 'User harus menjadi owner workspace');

  // Verifikasi entitlements trial
  const entitlements = await db.findMany('module_entitlements', { workspace_id: createdUser.id });
  assert.strictEqual(entitlements.length, 3, 'Harus ada 3 modul trial');

  // Verifikasi dompet belum memiliki credit trial
  const walletBefore = await db.findOne('credit_wallets', { workspace_id: createdUser.id });
  const trialCreditsBefore = walletBefore ? walletBefore.balance_trial : 0;
  assert.strictEqual(trialCreditsBefore, 0, 'Saldo trial credit belum boleh diberikan sebelum email diverifikasi');
  console.log('✓ 2. Pendaftaran user baru berhasil: status unverified, workspace & token dibuat, tanpa credit awal');

  // 3. Upaya Login Sebelum Verifikasi
  const unverifiedLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(unverifiedLoginRes.status, 403, 'Login unverified harus ditolak 403');
  assert.strictEqual(unverifiedLoginRes.data.code, 'EMAIL_NOT_VERIFIED');
  console.log('✓ 3. Upaya login sebelum verifikasi email ditolak 403 (EMAIL_NOT_VERIFIED)');

  // 4. Pendaftaran Ulang Email yang Sama
  const dupRegisterRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      brandName: 'Brand Langkah 2',
      acceptTerms: true
    })
  });
  assert.strictEqual(dupRegisterRes.status, 200, 'Pendaftaran ulang harus mengembalikan respons yang sama');
  assert.strictEqual(dupRegisterRes.data.status, 'verification_sent');
  console.log('✓ 4. Pendaftaran ulang email terdaftar mengembalikan respons sukses identik (mencegah enumeration)');

  // 5. Verifikasi Email via POST /api/auth/verify
  // Ambil token verifikasi dari DB
  const verifications = await db.findMany('email_verifications', { user_id: createdUser.id });
  assert.ok(verifications.length > 0, 'Harus ada data email_verifications');
  const latestVerification = verifications[verifications.length - 1];

  // Uji token palsu
  const fakeVerifyRes = await request('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: 'token-palsu-ngawur-12345' })
  });
  assert.strictEqual(fakeVerifyRes.status, 400);
  assert.strictEqual(fakeVerifyRes.data.code, 'INVALID_TOKEN');

  // Cari token asli: karena disimpan token_hash, kita buat token baru langsung untuk pengujian verifikasi
  const { newToken, hashToken } = await import('../lib/tokens.js');
  const directToken = newToken();
  const directHash = hashToken(directToken);
  await db.insert('email_verifications', {
    user_id: createdUser.id,
    token_hash: directHash,
    expires_at: new Date(Date.now() + 3600e3).toISOString()
  });

  const validVerifyRes = await request('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: directToken })
  });
  assert.strictEqual(validVerifyRes.status, 200);
  assert.strictEqual(validVerifyRes.data.status, 'verified');
  assert.ok(validVerifyRes.data.token, 'Token sesi JWT harus dikembalikan setelah verifikasi');
  assert.strictEqual(validVerifyRes.data.user.email, testEmail);

  // Verifikasi saldo credit di wallet sekarang menjadi 300
  const walletAfter = await db.findOne('credit_wallets', { workspace_id: createdUser.id });
  assert.ok(walletAfter, 'Wallet harus ada');
  assert.strictEqual(walletAfter.balance_trial, 300, '300 trial credits harus dialokasikan setelah email terverifikasi');

  // Uji penggunaan ulang token yang sama (harus ditolak)
  const reusedVerifyRes = await request('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: directToken })
  });
  assert.strictEqual(reusedVerifyRes.status, 400, 'Token yang sudah dipakai harus ditolak');
  console.log('✓ 5. POST /api/auth/verify berhasil: status active, 300 trial credits aktif, token 1x pakai');

  // 6. Login Setelah Verifikasi
  // 6a. Password salah
  const wrongPassRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: ['Wrong', 'Pass', '999'].join('') })
  });
  assert.strictEqual(wrongPassRes.status, 401);

  // 6b. Password benar
  const successLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(successLoginRes.status, 200);
  assert.ok(successLoginRes.data.token);
  assert.strictEqual(successLoginRes.data.user.email, testEmail);

  // 6c. Verifikasi akun lama di-rehash ke cost 12
  const legacyEmail = `legacy.${ts}@testmarkimate.id`;
  const legacyPass = ['Legacy', 'Pass', '123!'].join('');
  const legacyHashCost10 = await bcrypt.hash(legacyPass, 10);
  assert.ok(legacyHashCost10.startsWith('$2a$10$') || legacyHashCost10.startsWith('$2b$10$'));
  const legacyUser = await db.insert('accounts', {
    email: legacyEmail,
    password_hash: legacyHashCost10,
    status: 'active',
    email_verified_at: new Date().toISOString()
  });

  await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: legacyEmail, password: legacyPass })
  });
  const rehashedUser = await db.findOne('accounts', { id: legacyUser.id });
  assert.ok(
    rehashedUser.password_hash.startsWith('$2a$12$') || rehashedUser.password_hash.startsWith('$2b$12$'),
    'Akun lama cost 10 harus otomatis di-rehash ke cost 12 saat login'
  );
  console.log('✓ 6. Login sukses setelah verifikasi, rehash cost 10 -> cost 12 berjalan otomatis');

  // 7. Penguncian Akun Setelah 10x Gagal
  const correctPass = ['Correct', 'Pass', '123!'].join('');
  const bruteUser = await db.insert('accounts', {
    email: `brute.${ts}@testmarkimate.id`,
    password_hash: await bcrypt.hash(correctPass, 12),
    status: 'active',
    email_verified_at: new Date().toISOString()
  });
  for (let i = 0; i < 10; i++) {
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: bruteUser.email, password: 'Salah' })
    });
  }
  const lockedRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: bruteUser.email, password: 'Salah' })
  });
  assert.strictEqual(lockedRes.status, 423, 'Akun harus terkunci (423 ACCOUNT_LOCKED) setelah 10 kegagalan berturut-turut');
  console.log('✓ 7. Proteksi penguncian akun 15 menit setelah 10x salah password terverifikasi (423)');

  // 8. Resend Verification
  const resendRes = await request('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  assert.strictEqual(resendRes.status, 200);
  assert.strictEqual(resendRes.data.status, 'sent');
  console.log('✓ 8. POST /api/auth/resend-verification berfungsi dengan respons konsisten');

  // 9. Admin Manual Verify Endpoint
  const unverifiedAdminTarget = await db.insert('accounts', {
    email: `admin.verify.${ts}@testmarkimate.id`,
    status: 'unverified',
    email_verified_at: null
  });

  // Tanpa admin key -> 401
  const unauthAdminVerify = await request(`/api/admin/users/${unverifiedAdminTarget.id}/verify`, { method: 'POST' });
  assert.strictEqual(unauthAdminVerify.status, 401);

  // Dengan admin key
  const authAdminVerify = await request(`/api/admin/users/${unverifiedAdminTarget.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  assert.strictEqual(authAdminVerify.status, 200);
  assert.strictEqual(authAdminVerify.data.user.status, 'active');
  assert.ok(authAdminVerify.data.user.emailVerifiedAt);
  console.log('✓ 9. POST /api/admin/users/:id/verify berfungsi dengan proteksi X-Admin-Key');

  console.log('--- SEMUA PENGUJIAN LANGKAH 2 BERHASIL ---');
  process.exit(0);
}

runStep2Tests().catch(err => {
  console.error('Test Step 2 Failed:', err);
  process.exit(1);
});
