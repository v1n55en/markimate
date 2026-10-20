// Test Google Auth: OAuth2 + PKCE + Auto-link & Trial Credit
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-google-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], oauth_pending_links: [],
    audit_logs: [], credit_trials: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { generateGoogleAuthUrl, parseGoogleOAuthCookie } = await import('../lib/google-auth.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');

const PORT = 5016;
let baseUrl = `http://localhost:${PORT}`;

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
  const oauthMatch = rawSetCookie.match(/mk_g_oauth=([^;]+)/);

  return {
    status: res.status,
    headers: res.headers,
    data,
    text,
    rtCookie: rtMatch ? `mk_rt=${rtMatch[1]}` : null,
    oauthCookie: oauthMatch ? `mk_g_oauth=${oauthMatch[1]}` : null,
    rawSetCookie
  };
}

async function runGoogleAuthTests() {
  console.log('=== RUNNING TEST GOOGLE AUTH (OAuth2, PKCE, Linking & Trial) ===');

  process.env.PORT = String(PORT);
  process.env.GOOGLE_AUTH_MOCK = 'true';
  process.env.ADMIN_KEY = 'supermat-admin-secret-dev';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-999';
  process.env.APP_URL = 'http://localhost:5173';

  await seedCreditPricesAndRates();
  await import('../index.js');

  const ts = Date.now();
  const dummyPassword = ['Sec', 'Pass', '123!', 'G'].join('');

  // 1. Verifikasi /api/auth/google/start (PKCE & Cookie State)
  console.log('1. Menguji inisiasi OAuth2 Google (/api/auth/google/start)...');
  const startRes = await req('/api/auth/google/start?format=json');
  assert.strictEqual(startRes.status, 200);
  assert.ok(startRes.data.authUrl, 'Harus mengembalikan authUrl');
  assert.ok(startRes.data.authUrl.includes('code_challenge='), 'authUrl harus memuat parameter code_challenge');
  assert.ok(startRes.data.authUrl.includes('code_challenge_method=S256'), 'authUrl harus memuat code_challenge_method=S256');
  assert.ok(startRes.data.authUrl.includes('state='), 'authUrl harus memuat parameter state');
  assert.ok(startRes.oauthCookie, 'Harus mengembalikan cookie mk_g_oauth');

  const authUrl = new URL(startRes.data.authUrl);
  assert.strictEqual(authUrl.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.strictEqual(authUrl.searchParams.get('response_type'), 'code');
  assert.strictEqual(authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(authUrl.searchParams.get('scope'), 'openid email profile');
  const generatedState = authUrl.searchParams.get('state');
  assert.ok(generatedState, 'State harus ada di Google auth URL');

  // 2. State Mismatch / Expired Protection
  console.log('2. Menguji proteksi CSRF state mismatch pada callback...');
  const invalidStateRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes.oauthCookie,
    body: { code: 'dummy-code', state: 'wrong-state-xyz' }
  });
  assert.strictEqual(invalidStateRes.status, 400);
  assert.strictEqual(invalidStateRes.data.code, 'INVALID_STATE');

  // 3. Pendaftaran Akun Baru via Google OAuth2
  console.log('3. Menguji pendaftaran user baru via Google OAuth...');
  const newGoogleEmail = `new.google.${ts}@example.com`;
  const mockGoogleProfile = {
    sub: `google_sub_${ts}`,
    email: newGoogleEmail,
    name: 'Pengguna Google Baru',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    emailVerified: true
  };

  const newGoogleRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes.oauthCookie,
    headers: {
      'x-google-mock-profile': JSON.stringify(mockGoogleProfile)
    },
    body: { code: 'valid-mock-code', state: generatedState }
  });

  assert.strictEqual(newGoogleRes.status, 200, 'Callback pendaftaran Google baru harus 200 OK');
  assert.strictEqual(newGoogleRes.data.action, 'register');
  assert.ok(newGoogleRes.data.accessToken, 'Harus menerbitkan accessToken');
  assert.ok(newGoogleRes.rtCookie, 'Harus menerbitkan cookie mk_rt');
  assert.strictEqual(newGoogleRes.data.user.email, newGoogleEmail);

  // Verifikasi kebersihan respon (tidak membocorkan hash/sub)
  const resKeys = Object.keys(newGoogleRes.data);
  const userKeys = Object.keys(newGoogleRes.data.user);
  assert.ok(!resKeys.includes('password_hash'), 'Response tidak boleh memiliki password_hash');
  assert.ok(!resKeys.includes('google_sub'), 'Response tidak boleh memiliki google_sub');
  assert.ok(!userKeys.includes('password_hash'), 'user tidak boleh memiliki password_hash');
  assert.ok(!userKeys.includes('google_sub'), 'user tidak boleh memiliki google_sub');

  // Verifikasi database: akun aktif langsung terverifikasi tanpa password
  const newAccountInDb = await db.findOne('accounts', { email: newGoogleEmail });
  assert.ok(newAccountInDb);
  assert.strictEqual(newAccountInDb.password_hash, null, 'Akun pendaftaran Google murni tidak boleh punya password');
  assert.strictEqual(newAccountInDb.google_sub, mockGoogleProfile.sub);
  assert.strictEqual(newAccountInDb.status, 'active');
  assert.ok(newAccountInDb.email_verified_at, 'Email harus langsung terverifikasi');

  // Verifikasi workspace default dibuat
  const members = await db.findMany('workspace_members', { user_id: newAccountInDb.id });
  assert.strictEqual(members.length, 1, 'Pengguna baru harus memiliki 1 workspace');
  assert.strictEqual(members[0].role, 'owner');

  // Verifikasi module_entitlements 7 hari trial
  const entitlements = await db.findMany('module_entitlements', { workspace_id: members[0].workspace_id });
  const activeModules = entitlements.filter(e => e.active).map(e => e.module);
  assert.ok(activeModules.includes('seo'), 'Modul SEO harus aktif');
  assert.ok(activeModules.includes('ads_report'), 'Modul ads_report harus aktif');
  assert.ok(activeModules.includes('ads_spy'), 'Modul ads_spy harus aktif');

  const wallet = await db.findOne('credit_wallets', { workspace_id: members[0].workspace_id });
  if (wallet) {
    assert.strictEqual(wallet.balance_trial, 300, 'Akun baru via Google harus menerima 300 credit trial');
  }

  // 4. Login Akun Google-only via Password Endpoint Harus Ditolak (PASSWORD_NOT_SET)
  console.log('4. Menguji login akun Google-only via form email/password...');
  const googleOnlyLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: newGoogleEmail, password: 'apapun-passwordnya' }
  });
  assert.strictEqual(googleOnlyLoginRes.status, 401);
  assert.strictEqual(googleOnlyLoginRes.data.code, 'PASSWORD_NOT_SET');

  // 5. Login Ulang Akun Google yang Sudah Ada (Happy Path)
  console.log('5. Menguji login ulang user Google yang sudah terdaftar...');
  const startRes2 = await req('/api/auth/google/start?format=json');
  const state2 = new URL(startRes2.data.authUrl).searchParams.get('state');

  const loginGoogleRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes2.oauthCookie,
    headers: {
      'x-google-mock-profile': JSON.stringify(mockGoogleProfile)
    },
    body: { code: 'valid-mock-code-2', state: state2 }
  });
  assert.strictEqual(loginGoogleRes.status, 200);
  assert.strictEqual(loginGoogleRes.data.action, 'login');
  assert.ok(loginGoogleRes.data.accessToken);

  // 6. Akun Terdaftar Password Tertaut ke Google (Linking Flow)
  console.log('6. Menguji alur penautan akun password yang sudah ada (Linking flow)...');
  const existingEmail = `existing.pass.${ts}@example.com`;
  await req('/api/auth/register', {
    method: 'POST',
    body: {
      email: existingEmail,
      name: 'User Terdaftar',
      password: dummyPassword,
      brandName: 'Brand Terdaftar',
      acceptTerms: true
    }
  });

  const existingUserRow = await db.findOne('accounts', { email: existingEmail });
  await req(`/api/admin/users/${existingUserRow.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });

  const startRes3 = await req('/api/auth/google/start?format=json');
  const state3 = new URL(startRes3.data.authUrl).searchParams.get('state');

  const existingMockGoogle = {
    sub: `google_sub_link_${ts}`,
    email: existingEmail,
    name: 'User Google Sama Email',
    emailVerified: true
  };

  const linkReqRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes3.oauthCookie,
    headers: {
      'x-google-mock-profile': JSON.stringify(existingMockGoogle)
    },
    body: { code: 'code-link', state: state3 }
  });
  assert.strictEqual(linkReqRes.status, 409, 'Harus 409 Conflict saat akun ada password');
  assert.strictEqual(linkReqRes.data.code, 'LINK_PASSWORD_REQUIRED');
  assert.ok(linkReqRes.data.pendingToken, 'Harus mengembalikan pendingToken untuk verifikasi kepemilikan');

  const pendingToken = linkReqRes.data.pendingToken;

  // Verifikasi link dengan password salah
  const wrongLinkRes = await req('/api/auth/google/link', {
    method: 'POST',
    body: { pendingToken, password: 'SalahPassword123!' }
  });
  assert.strictEqual(wrongLinkRes.status, 400);
  assert.strictEqual(wrongLinkRes.data.code, 'INVALID_PASSWORD');

  // Verifikasi link dengan password benar
  const validLinkRes = await req('/api/auth/google/link', {
    method: 'POST',
    body: { pendingToken, password: dummyPassword }
  });
  assert.strictEqual(validLinkRes.status, 200, 'Penautan harus berhasil 200 OK');
  assert.strictEqual(validLinkRes.data.action, 'link');
  assert.ok(validLinkRes.data.accessToken);

  // Verifikasi database: google_sub sudah tersimpan
  const linkedAccountInDb = await db.findOne('accounts', { email: existingEmail });
  assert.strictEqual(linkedAccountInDb.google_sub, existingMockGoogle.sub);

  // 6. Klaim Akun Unverified oleh Pemilik Email Google Asli
  console.log('6. Menguji klaim akun unverified oleh pemilik email Google...');
  const unverifiedEmail = `unverified.${ts}@testmarkimate.id`;
  await req('/api/auth/register', {
    method: 'POST',
    body: { email: unverifiedEmail, password: dummyPassword, brandName: 'Brand Unverified', acceptTerms: true }
  });

  const unverifiedAcc = await db.findOne('accounts', { email: unverifiedEmail });
  assert.strictEqual(unverifiedAcc.status, 'unverified');

  const claimSub = `g-sub-claim-${ts}`;
  const mockClaimProfile = {
    sub: claimSub,
    email: unverifiedEmail,
    name: 'Pemilik Asli Google',
    emailVerified: true
  };

  const start5Res = await req('/api/auth/google/start?format=json');
  const state5 = new URL(start5Res.data.authUrl).searchParams.get('state');

  const claimRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start5Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(mockClaimProfile) },
    body: { code: 'dummy_code_claim', state: state5 }
  });

  assert.strictEqual(claimRes.status, 200);
  assert.strictEqual(claimRes.data.action, 'claim_unverified');
  assert.ok(claimRes.data.accessToken);

  const claimedAcc = await db.findOne('accounts', { id: unverifiedAcc.id });
  assert.strictEqual(claimedAcc.status, 'active');
  assert.strictEqual(claimedAcc.password_hash, null, 'Password unverified lama harus dihapus');
  assert.strictEqual(claimedAcc.google_sub, claimSub);
  assert.ok(claimedAcc.email_verified_at);
  console.log('✓ 6. Klaim akun unverified oleh Google email_verified=true berhasil');

  // 7. Penolakan Login untuk Akun Status pending_deletion
  console.log('7. Menguji penolakan login akun berstatus pending_deletion...');
  await db.update('accounts', { id: linkedAccountInDb.id }, {
    status: 'pending_deletion',
    deleted_requested_at: new Date().toISOString()
  });

  const start4Res = await req('/api/auth/google/start?format=json');
  const state4 = new URL(start4Res.data.authUrl).searchParams.get('state');

  const blockedPendingRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start4Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(existingMockGoogle) },
    body: { code: 'dummy_code_pending', state: state4 }
  });
  assert.strictEqual(blockedPendingRes.status, 403);
  assert.strictEqual(blockedPendingRes.data.code, 'ACCOUNT_PENDING_DELETION');
  console.log('✓ 7. Akun pending_deletion diblokir 403 dari login Google');

  console.log('ALL GOOGLE AUTH TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    fs.unlinkSync(standaloneTmp);
  }
  process.exit(0);
}

runGoogleAuthTests().catch(err => {
  console.error('Test Google Auth Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
