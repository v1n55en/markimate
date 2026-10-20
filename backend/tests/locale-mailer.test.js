// Test Locale & Mailer: Bilingual Transactional Emails, Pronoun Check, Locale Switcher & Upper-Snake Error Codes
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-locale-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const {
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
} = await import('../lib/mailer.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-locale-' + Date.now();

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

async function runLocaleMailerTests() {
  console.log('=== RUNNING TEST LOCALE & BILINGUAL MAILER (Emails, Pronouns & Error Codes) ===');

  // 1. Normalisasi Locale & Formatting Tanggal
  console.log('1. Menguji normalisasi locale & formatting tanggal...');
  assert.strictEqual(normalizeLocale('id'), 'id');
  assert.strictEqual(normalizeLocale('ID'), 'id');
  assert.strictEqual(normalizeLocale('en'), 'en');
  assert.strictEqual(normalizeLocale('en-US'), 'en');
  assert.strictEqual(normalizeLocale('fr'), 'id', 'Fallback locale non-EN harus id');

  const testDate = new Date('2026-11-13T10:00:00.000Z');
  const formattedEn = formatEmailDate(testDate, 'en');
  const formattedId = formatEmailDate(testDate, 'id');
  assert.match(formattedEn, /November\s+13,\s+2026/);
  assert.match(formattedId, /13\s+November\s+2026/);

  // 2. Unit Test 8 Email Transaksional (EN & ID)
  console.log('2. Menguji 8 template email bilingual...');
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
        sendWorkspaceInviteEmail({ to: 'member@test.io', workspaceName: 'Workspace Alpha', inviterName: 'John Doe', inviteLink: 'http://localhost:5017/invite?token=abc', role: 'admin', locale: 'en' }),
        sendWorkspaceInviteEmail({ to: 'member@test.io', workspaceName: 'Workspace Alpha', inviterName: 'Budi Santoso', inviteLink: 'http://localhost:5017/invite?token=abc', role: 'admin', locale: 'id' })
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

    for (const [res, loc] of [[resEn, 'en'], [resId, 'id']]) {
      assert(res.subject && res.subject.length > 5);
      assert(res.html && res.html.length > 20);
      assert(!res.html.includes('undefined'));
      assert(!res.html.includes('NaN'));
      assert(!/\{[a-zA-Z0-9_]+\}/.test(res.html), `Leaked placeholder found in ${suite.name}`);
    }

    const allIdContent = `${resId.subject} ${resId.html} ${resId.text || ''}`;
    assert(!/\bkamu\b/i.test(allIdContent), `${suite.name} [id] contains disallowed word "kamu"!`);
    assert(allIdContent.includes('Anda') || allIdContent.includes('Halo'));
  }
  console.log('   OK - Seluruh email lulus verifikasi tanpa kata "kamu" dan tanpa placeholder bocor.');

  // 3. Server API Integration: Locale Switcher & Standardized Error Codes
  process.env.JWT_SECRET = 'test-secret-key-locale';
  process.env.PORT = '5017';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5017';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const enUserEmail = `locale.en.${ts}@example.com`;
  const defaultUserEmail = `locale.def.${ts}@example.com`;
  const password = ['Strong', 'Pass', '123!', 'Locale'].join('');

  console.log('3. Menguji registrasi & PATCH /api/me untuk locale...');
  const regEnRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: enUserEmail, password, brandName: 'Brand EN', acceptTerms: true, locale: 'en' }
  });
  assert.strictEqual(regEnRes.status, 200);

  const enAccount = await db.findOne('accounts', { email: enUserEmail });
  assert.strictEqual(enAccount.locale, 'en');

  await req(`/api/admin/users/${enAccount.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': TEST_ADMIN_KEY }
  });

  const loginEnRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: enUserEmail, password }
  });
  assert.strictEqual(loginEnRes.status, 200);
  assert.strictEqual(loginEnRes.data.user.locale, 'en');
  const tokenEn = loginEnRes.data.accessToken || loginEnRes.data.token;

  // Switch ke 'id'
  const patchIdRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { locale: 'id' }
  });
  assert.strictEqual(patchIdRes.status, 200);
  assert.strictEqual(patchIdRes.data.user.locale, 'id');

  // Tolak locale tidak valid 'fr' -> 400 INVALID_LOCALE
  const patchInvalidRes = await req('/api/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { locale: 'fr' }
  });
  assert.strictEqual(patchInvalidRes.status, 400);
  assert.strictEqual(patchInvalidRes.data.code, 'INVALID_LOCALE');

  // 4. Verifikasi Standar Kode Error UPPER_SNAKE
  console.log('4. Menguji audit error code UPPER_SNAKE...');
  const errEmailRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password, acceptTerms: true }
  });
  assert.strictEqual(errEmailRes.status, 400);
  assert.strictEqual(errEmailRes.data.code, 'INVALID_EMAIL');

  const errPassRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: `valid.${ts}@test.io`, password: '123', acceptTerms: true }
  });
  assert.strictEqual(errPassRes.status, 400);
  assert.strictEqual(errPassRes.data.code, 'PASSWORD_TOO_SHORT');

  const errTermsRes = await req('/api/auth/register', {
    method: 'POST',
    body: { email: `valid2.${ts}@test.io`, password: 'StrongPassword123!', acceptTerms: false }
  });
  assert.strictEqual(errTermsRes.status, 400);
  assert.strictEqual(errTermsRes.data.code, 'TERMS_REQUIRED');

  const errForgotRes = await req('/api/auth/forgot', {
    method: 'POST',
    body: {}
  });
  assert.strictEqual(errForgotRes.status, 400);
  assert.strictEqual(errForgotRes.data.code, 'EMAIL_REQUIRED');

  const errWsRes = await req('/api/workspaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenEn}` },
    body: { name: '' }
  });
  assert.strictEqual(errWsRes.status, 400);
  assert.strictEqual(errWsRes.data.code, 'NAME_REQUIRED');

  const errNotFoundRes = await req('/api/this-endpoint-does-not-exist');
  assert.strictEqual(errNotFoundRes.status, 404);
  assert.strictEqual(errNotFoundRes.data.code, 'NOT_FOUND');

  console.log('✅ ALL LOCALE & MAILER TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runLocaleMailerTests().catch(err => {
  console.error('❌ Locale Mailer Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
