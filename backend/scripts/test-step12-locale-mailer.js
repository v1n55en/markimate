// Test Langkah 2: Error code standar UPPER_SNAKE, locale akun, & email transaksional bilingual (PRD F3)
import assert from 'assert';
import { db } from '../db.js';
import {
  normalizeLocale,
  formatEmailDate,
  renderEmailTemplate,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
  sendEmailChangeVerification,
  sendEmailChangeNoticeToOldEmail,
  sendWorkspaceInviteEmail,
  sendAccountDeletionScheduledEmail,
  sendAccountPurgedEmail
} from '../lib/mailer.js';

let baseUrl;

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

async function runStep12Tests() {
  console.log('=== RUNNING TEST STEP 12: ERROR CODES, ACCOUNT LOCALE & BILINGUAL MAILER (PRD F3 LANGKAH 2) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step12';
  process.env.PORT = '5022';
  process.env.CREDITS_ENABLED = 'true';
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5022';

  await db.remove('rate_limits', {});

  // -------------------------------------------------------------
  // BAGIAN 1: Unit Test 8 Email Transaksional Bilingual & Formatting
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Mailer Formatting & Normalization ---');
  assert.strictEqual(normalizeLocale('id'), 'id');
  assert.strictEqual(normalizeLocale('ID'), 'id');
  assert.strictEqual(normalizeLocale('en'), 'en');
  assert.strictEqual(normalizeLocale('en-US'), 'en');
  assert.strictEqual(normalizeLocale('fr'), 'id', 'Fallback locale non-EN harus id');

  const testDate = new Date('2026-11-13T10:00:00.000Z');
  const formattedEn = formatEmailDate(testDate, 'en');
  const formattedId = formatEmailDate(testDate, 'id');
  console.log(`Formatted EN Date: "${formattedEn}" | ID Date: "${formattedId}"`);
  assert.match(formattedEn, /November\s+13,\s+2026/, 'EN date harus berformat US/English');
  assert.match(formattedId, /13\s+November\s+2026/, 'ID date harus berformat Indonesia');

  console.log('\n--- 2. Testing 8 Transactional Email Templates (EN & ID) ---');
  const emailSuites = [
    {
      name: 'sendVerificationEmail',
      fn: () => [
        sendVerificationEmail({ to: 'user@test.io', token: 'tok_verify_123', locale: 'en' }),
        sendVerificationEmail({ to: 'user@test.io', token: 'tok_verify_123', locale: 'id' })
      ]
    },
    {
      name: 'sendPasswordResetEmail',
      fn: () => [
        sendPasswordResetEmail({ to: 'user@test.io', token: 'tok_reset_123', locale: 'en' }),
        sendPasswordResetEmail({ to: 'user@test.io', token: 'tok_reset_123', locale: 'id' })
      ]
    },
    {
      name: 'sendPasswordChangedNotice',
      fn: () => [
        sendPasswordChangedNotice({ to: 'user@test.io', locale: 'en' }),
        sendPasswordChangedNotice({ to: 'user@test.io', locale: 'id' })
      ]
    },
    {
      name: 'sendEmailChangeVerification',
      fn: () => [
        sendEmailChangeVerification({ to: 'new@test.io', token: 'tok_change_123', locale: 'en' }),
        sendEmailChangeVerification({ to: 'new@test.io', token: 'tok_change_123', locale: 'id' })
      ]
    },
    {
      name: 'sendEmailChangeNoticeToOldEmail',
      fn: () => [
        sendEmailChangeNoticeToOldEmail({ to: 'old@test.io', newEmail: 'new@test.io', locale: 'en' }),
        sendEmailChangeNoticeToOldEmail({ to: 'old@test.io', newEmail: 'new@test.io', locale: 'id' })
      ]
    },
    {
      name: 'sendWorkspaceInviteEmail',
      fn: () => [
        sendWorkspaceInviteEmail({ to: 'member@test.io', workspaceName: 'Workspace Alpha', inviterName: 'John Doe', inviteLink: 'http://localhost:5022/invite?token=abc', role: 'admin', locale: 'en' }),
        sendWorkspaceInviteEmail({ to: 'member@test.io', workspaceName: 'Workspace Alpha', inviterName: 'Budi Santoso', inviteLink: 'http://localhost:5022/invite?token=abc', role: 'admin', locale: 'id' })
      ]
    },
    {
      name: 'sendAccountDeletionScheduledEmail',
      fn: () => [
        sendAccountDeletionScheduledEmail({ to: 'user@test.io', scheduledDate: new Date(Date.now() + 30 * 86400e3), locale: 'en' }),
        sendAccountDeletionScheduledEmail({ to: 'user@test.io', scheduledDate: new Date(Date.now() + 30 * 86400e3), locale: 'id' })
      ]
    },
    {
      name: 'sendAccountPurgedEmail',
      fn: () => [
        sendAccountPurgedEmail({ to: 'user@test.io', locale: 'en' }),
        sendAccountPurgedEmail({ to: 'user@test.io', locale: 'id' })
      ]
    }
  ];

  for (const suite of emailSuites) {
    const [resEn, resId] = await Promise.all(suite.fn());
    assert(resEn.success, `${suite.name} EN should succeed`);
    assert(resId.success, `${suite.name} ID should succeed`);

    // Pastikan tidak ada placeholder bocor seperti {token}, {workspaceName}, undefined, NaN
    for (const [res, loc] of [[resEn, 'en'], [resId, 'id']]) {
      assert(res.subject && res.subject.length > 5, `${suite.name} [${loc}] subject is missing or too short`);
      assert(res.html && res.html.length > 20, `${suite.name} [${loc}] html is missing or too short`);
      assert(!res.html.includes('undefined'), `${suite.name} [${loc}] html contains literal 'undefined'`);
      assert(!res.html.includes('NaN'), `${suite.name} [${loc}] html contains literal 'NaN'`);
      assert(!/\{[a-zA-Z0-9_]+\}/.test(res.html), `${suite.name} [${loc}] html contains unrendered placeholder`);
    }

    // Periksa aturan PRD F3: sapaan hormat "Anda" dan ZERO kata "kamu" di seluruh email ID
    const htmlId = resId.html;
    const textId = resId.text || '';
    const subjectId = resId.subject;
    const allIdContent = `${subjectId} ${htmlId} ${textId}`;

    assert(!/\bkamu\b/i.test(allIdContent), `${suite.name} [id] contains disallowed word "kamu"!`);
    assert(
      allIdContent.includes('Anda') || allIdContent.includes('Halo'),
      `${suite.name} [id] must use respectful pronouns ("Anda" or formal greeting)`
    );
    console.log(`✓ ${suite.name} passed EN & ID verification (0 kata "kamu", no leaked placeholders)`);
  }

  // -------------------------------------------------------------
  // BAGIAN 2: Server API Integration (Register, Login, Me, PATCH Locale)
  // -------------------------------------------------------------
  console.log('\n--- 3. Starting Server & Testing API Endpoints ---');
  process.env.ADMIN_KEY = 'test-admin-key-step12';
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const enUserEmail = `locale.en.${ts}@example.com`;
  const defaultUserEmail = `locale.def.${ts}@example.com`;
  const password = 'StrongPassword123!';

  // 2.1 Registrasi dengan locale: 'en'
  console.log('2.1 Registrasi user dengan locale: "en"...');
  const regEnRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: enUserEmail, password, brandName: 'Brand EN', acceptTerms: true, locale: 'en' }
  });
  assert.strictEqual(regEnRes.status, 200);
  assert.strictEqual(regEnRes.data.status, 'verification_sent');

  // Periksa langsung di database
  const enAccount = await db.findOne('accounts', { email: enUserEmail });
  assert(enAccount, 'Account should exist in DB');
  assert.strictEqual(enAccount.locale, 'en', 'DB accounts.locale should be "en"');

  // Verifikasi email via admin endpoint
  const adminVerifyRes = await req(`/api/admin/users/${enAccount.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });
  assert.strictEqual(adminVerifyRes.status, 200, 'Admin verify should succeed');

  // Login dan cek user.locale di login response & GET /api/me
  const loginEnRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: enUserEmail, password }
  });
  assert.strictEqual(loginEnRes.status, 200);
  assert(loginEnRes.data.user, 'Login response should contain user object');
  assert.strictEqual(loginEnRes.data.user.locale, 'en', 'Login response user.locale should be "en"');

  const tokenEn = loginEnRes.data.token;
  const meEnRes = await req('/api/me', {
    headers: { Authorization: `Bearer ${tokenEn}` }
  });
  assert.strictEqual(meEnRes.status, 200);
  assert.strictEqual(meEnRes.data.user.locale, 'en', 'GET /api/me should return locale: "en"');

  // 2.2 Update locale via PATCH /api/me
  console.log('2.2 Testing PATCH /api/me untuk update locale...');
  // Valid update ke 'id'
  const patchIdRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { locale: 'id' }
  });
  assert.strictEqual(patchIdRes.status, 200);
  assert.strictEqual(patchIdRes.data.user.locale, 'id', 'PATCH /api/me should return updated locale "id"');

  const enAccountAfterUpdate = await db.findOne('accounts', { id: enAccount.id });
  assert.strictEqual(enAccountAfterUpdate.locale, 'id', 'DB accounts.locale should now be "id"');

  // Invalid update ke 'fr' -> ditolak 400 INVALID_LOCALE
  const patchInvalidRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { locale: 'fr' }
  });
  assert.strictEqual(patchInvalidRes.status, 400, 'Invalid locale should be rejected with 400');
  assert.strictEqual(patchInvalidRes.data.code, 'INVALID_LOCALE', 'Error code should be INVALID_LOCALE');
  assert(typeof patchInvalidRes.data.error === 'string', 'Error message should be present');

  // Valid update kembali ke 'en'
  const patchEnRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { locale: 'en' }
  });
  assert.strictEqual(patchEnRes.status, 200);
  assert.strictEqual(patchEnRes.data.user.locale, 'en');

  // 2.3 Registrasi default tanpa locale -> 'id'
  console.log('2.3 Registrasi default tanpa parameter locale...');
  await db.remove('rate_limits', {});
  const regDefRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: defaultUserEmail, password, brandName: 'Brand Default', acceptTerms: true }
  });
  assert.strictEqual(regDefRes.status, 200);
  assert.strictEqual(regDefRes.data.status, 'verification_sent');

  const defAccount = await db.findOne('accounts', { email: defaultUserEmail });
  assert.strictEqual(defAccount.locale, 'id', 'DB default accounts.locale must be "id"');

  // -------------------------------------------------------------
  // BAGIAN 3: Audit Error Codes UPPER_SNAKE & English Fallbacks
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Standardized Error Codes & English Fallbacks ---');

  // 3.1 Register missing email
  const errEmailRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password, acceptTerms: true }
  });
  assert.strictEqual(errEmailRes.status, 400);
  assert.strictEqual(errEmailRes.data.code, 'INVALID_EMAIL');
  assert.strictEqual(errEmailRes.data.error, 'Please provide a valid email address.');

  // 3.2 Register short password
  const errPassRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: `valid.${ts}@test.io`, password: '123', acceptTerms: true }
  });
  assert.strictEqual(errPassRes.status, 400);
  assert.strictEqual(errPassRes.data.code, 'PASSWORD_TOO_SHORT');
  assert.strictEqual(errPassRes.data.error, 'Password must be at least 10 characters.');

  // 3.3 Register missing terms
  const errTermsRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: `valid2.${ts}@test.io`, password: 'StrongPassword123!', acceptTerms: false }
  });
  assert.strictEqual(errTermsRes.status, 400);
  assert.strictEqual(errTermsRes.data.code, 'TERMS_REQUIRED');
  assert.strictEqual(errTermsRes.data.error, 'You must agree to the Terms of Service and Privacy Policy.');

  // 3.4 Login wrong credentials
  const errLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: defaultUserEmail, password: 'WrongPassword999!' }
  });
  assert.strictEqual(errLoginRes.status, 401);
  assert.strictEqual(errLoginRes.data.code, 'INVALID_CREDENTIALS');
  assert.strictEqual(errLoginRes.data.error, 'Invalid email or password.');

  // 3.5 Forgot password missing email
  const errForgotRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: {}
  });
  assert.strictEqual(errForgotRes.status, 400);
  assert.strictEqual(errForgotRes.data.code, 'EMAIL_REQUIRED');
  assert.strictEqual(errForgotRes.data.error, 'Email address is required.');

  // 3.6 Create workspace without name
  const errWsRes = await req('/api/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { name: '' }
  });
  assert.strictEqual(errWsRes.status, 400);
  assert.strictEqual(errWsRes.data.code, 'NAME_REQUIRED');
  assert.strictEqual(errWsRes.data.error, 'Workspace name is required.');

  // 3.7 404 Route Not Found
  const errNotFoundRes = await req('/api/this-endpoint-does-not-exist');
  assert.strictEqual(errNotFoundRes.status, 404);
  assert.strictEqual(errNotFoundRes.data.code, 'NOT_FOUND');
  assert.strictEqual(errNotFoundRes.data.error, 'Route not found.');

  console.log('✓ All standard error codes & English fallback messages verified successfully.');
  console.log('\n=== ALL STEP 12 TESTS PASSED PERFECTLY (100%) ===\n');
  process.exit(0);
}

runStep12Tests().catch(err => {
  console.error('\n❌ STEP 12 TEST FAILED:', err);
  process.exit(1);
});
