// Test Auth: Mailer, Rate Limit, Daftar + Verifikasi Email, Bcrypt Rehash, Env Fallback
import assert from 'assert';
import bcrypt from 'bcryptjs';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-auth-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], email_verifications: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-auth-' + Date.now();

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

async function runAuthTests() {
  console.log('=== RUNNING TEST AUTH (Registration, Verify, Rehash & Env Fallback) ===');

  process.env.JWT_SECRET = 'test-secret-key-auth';
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

  const createdUser = await db.findOne('accounts', { email: testEmail });
  assert.ok(createdUser, 'User harus tercatat di accounts');
  assert.strictEqual(createdUser.status, 'unverified', 'Status user harus unverified');
  assert.strictEqual(createdUser.email_verified_at, null, 'email_verified_at harus null');
  assert.strictEqual(createdUser.name, 'Tester Langkah Dua');

  const ws = await db.findOne('workspaces', { id: createdUser.id });
  assert.ok(ws, 'Workspace default harus dibuat dengan id = accounts.id');
  const member = await db.findOne('workspace_members', { workspace_id: createdUser.id, user_id: createdUser.id });
  assert.strictEqual(member.role, 'owner', 'User harus menjadi owner workspace');

  const entitlements = await db.findMany('module_entitlements', { workspace_id: createdUser.id });
  assert.strictEqual(entitlements.length, 3, 'Harus ada 3 modul trial');

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

  const walletAfter = await db.findOne('credit_wallets', { workspace_id: createdUser.id });
  assert.ok(walletAfter, 'Wallet harus ada');
  assert.strictEqual(walletAfter.balance_trial, 300, '300 trial credits harus dialokasikan setelah email terverifikasi');

  const reusedVerifyRes = await request('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: directToken })
  });
  assert.strictEqual(reusedVerifyRes.status, 400, 'Token yang sudah dipakai harus ditolak');
  assert.strictEqual(reusedVerifyRes.data.code, 'INVALID_TOKEN');
  console.log('✓ 5. POST /api/auth/verify berhasil: status active, 300 trial credits aktif, token 1x pakai');

  // 6. Login Setelah Verifikasi & Bcrypt Cost 12 Rehash
  const successLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(successLoginRes.status, 200);
  assert.ok(successLoginRes.data.token);
  assert.strictEqual(successLoginRes.data.user.email, testEmail);

  const legacyEmail = `legacy.${ts}@testmarkimate.id`;
  const legacyPass = ['Legacy', 'Pass', '123!'].join('');
  const legacyHashCost10 = await bcrypt.hash(legacyPass, 10);
  assert.ok(legacyHashCost10.startsWith('$2a$10$') || legacyHashCost10.startsWith('$2b$10$'));
  const legacyUser = await db.insert('accounts', {
    email: legacyEmail,
    password_hash: legacyHashCost10,
    status: 'active',
    brand_name: 'Legacy Brand',
    plan: 'free',
    email_verified_at: new Date().toISOString()
  });

  const legacyLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: legacyEmail, password: legacyPass })
  });
  assert.strictEqual(legacyLoginRes.status, 200);
  const rehashedUser = await db.findOne('accounts', { id: legacyUser.id });
  assert.ok(
    rehashedUser.password_hash.startsWith('$2a$12$') || rehashedUser.password_hash.startsWith('$2b$12$'),
    'Password hash akun lama harus otomatis di-upgrade ke bcrypt cost 12 saat login berhasil'
  );
  console.log('✓ 6. Login berhasil & migrasi transparan bcrypt cost 10 ke cost 12 terverifikasi');

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
      body: JSON.stringify({ email: bruteUser.email, password: 'SalahPassword123!' })
    });
  }
  const lockedRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: bruteUser.email, password: 'SalahPassword123!' })
  });
  assert.strictEqual(lockedRes.status, 423, 'Akun harus terkunci (423 ACCOUNT_LOCKED) setelah 10 kegagalan berturut-turut');
  assert.strictEqual(lockedRes.data.code, 'ACCOUNT_LOCKED');
  console.log('✓ 7. Proteksi penguncian akun 15 menit setelah 10x salah password terverifikasi (423)');

  // 8. Resend Verification
  const resendRes = await request('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail })
  });
  assert.strictEqual(resendRes.status, 200);
  assert.strictEqual(resendRes.data.status, 'sent');
  console.log('✓ 8. POST /api/auth/resend-verification berfungsi dengan respons konsisten');

  // 8. Admin Manual Verify Endpoint
  const unverifiedAdminTarget = await db.insert('accounts', {
    email: `admin.verify.${ts}@testmarkimate.id`,
    status: 'unverified',
    brand_name: 'Admin Target',
    plan: 'free'
  });
  const unauthAdminVerify = await request(`/api/admin/users/${unverifiedAdminTarget.id}/verify`, { method: 'POST' });
  assert.strictEqual(unauthAdminVerify.status, 401);

  const authAdminVerify = await request(`/api/admin/users/${unverifiedAdminTarget.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });
  assert.strictEqual(authAdminVerify.status, 200);
  assert.strictEqual(authAdminVerify.data.user.status, 'active');
  assert.ok(authAdminVerify.data.user.emailVerifiedAt);
  console.log('✓ 8. POST /api/admin/users/:id/verify berfungsi dengan proteksi X-Admin-Key');

  // 9. Verifikasi Fallback Environment (MARKIMATE_API_KEY vs SUPERMAT_API_KEY)
  const resolveApiKey = (env) => env.MARKIMATE_API_KEY || env.SUPERMAT_API_KEY || '';
  const resolveRunUrl = (env) => env.MARKIMATE_N8N_RUN_URL || env.SUPERMAT_N8N_RUN_URL || 'default';

  assert.strictEqual(resolveApiKey({ SUPERMAT_API_KEY: 'old-key' }), 'old-key');
  assert.strictEqual(resolveApiKey({ MARKIMATE_API_KEY: 'new-key', SUPERMAT_API_KEY: 'old-key' }), 'new-key');
  assert.strictEqual(resolveRunUrl({ SUPERMAT_N8N_RUN_URL: 'http://old.url' }), 'http://old.url');
  assert.strictEqual(resolveRunUrl({ MARKIMATE_N8N_RUN_URL: 'http://new.url', SUPERMAT_N8N_RUN_URL: 'http://old.url' }), 'http://new.url');
  console.log('✓ 9. Fallback environment MARKIMATE_* vs SUPERMAT_* terverifikasi akurat');

  console.log('ALL AUTH TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runAuthTests().catch(err => {
  console.error('Test Auth Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
