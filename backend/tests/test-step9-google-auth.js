// Test Langkah 9: Login dengan Google (OAuth2 + PKCE + Auto-link & Trial Credit)
import assert from 'assert';
import { db } from '../db.js';
import { generateGoogleAuthUrl, parseGoogleOAuthCookie } from '../lib/google-auth.js';

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

async function runStep9Tests() {
  console.log('=== RUNNING TEST STEP 9 (Google OAuth2, PKCE, Linking & Trial) ===');

  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'development';
  process.env.GOOGLE_AUTH_MOCK = 'true';
  process.env.ADMIN_KEY = 'supermat-admin-secret-dev';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-999';
  process.env.APP_URL = 'http://localhost:5173';

  await import('../index.js');

  const ts = Date.now();
  const dummyPassword = ['Sec', 'Pass', '123!', 'G'].join('');

  // ==========================================
  // 1. GET /api/auth/google/start (PKCE & State Cookie)
  // ==========================================
  console.log('1. Menguji inisiasi auth Google (GET /api/auth/google/start)...');
  const startRes = await req('/api/auth/google/start?format=json');
  assert.strictEqual(startRes.status, 200, 'Inisiasi harus berhasil 200');
  assert.ok(startRes.data.authUrl, 'Respons harus berisi authUrl');
  assert.ok(startRes.oauthCookie, 'Server harus mengirimkan cookie mk_g_oauth');

  const authUrl = new URL(startRes.data.authUrl);
  assert.strictEqual(authUrl.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.strictEqual(authUrl.searchParams.get('response_type'), 'code');
  assert.strictEqual(authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(authUrl.searchParams.get('scope'), 'openid email profile');
  const generatedState = authUrl.searchParams.get('state');
  assert.ok(generatedState, 'State harus ada di Google auth URL');
  console.log('✓ 1. Endpoint /api/auth/google/start menghasilkan URL Google PKCE & cookie httpOnly yang valid');

  // ==========================================
  // 2. Proteksi State Mismatch & Cookie Tidak Ada
  // ==========================================
  console.log('2. Menguji proteksi invalid state pada callback...');
  const invalidStateRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes.oauthCookie,
    body: { code: 'dummy_code', state: 'state_palsu_999' }
  });
  assert.strictEqual(invalidStateRes.status, 400);
  assert.strictEqual(invalidStateRes.data.code, 'INVALID_STATE');
  console.log('✓ 2. Proteksi INVALID_STATE berhasil diverifikasi');

  // ==========================================
  // 3. Pendaftaran Akun Baru via Google (Trial & Workspace Otomatis)
  // ==========================================
  console.log('3. Menguji pendaftaran user baru via Google OAuth...');
  const newGoogleSub = `g-sub-new-${ts}`;
  const newGoogleEmail = `user.google.new.${ts}@testmarkimate.id`;
  const mockNewProfile = {
    sub: newGoogleSub,
    email: newGoogleEmail,
    name: 'Pengguna Google Baru',
    emailVerified: true
  };

  const registerGoogleRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: startRes.oauthCookie,
    headers: {
      'x-google-mock-profile': JSON.stringify(mockNewProfile)
    },
    body: { code: 'dummy_code_new', state: generatedState }
  });

  assert.strictEqual(registerGoogleRes.status, 200, 'Registrasi via Google harus 200');
  assert.strictEqual(registerGoogleRes.data.action, 'register');
  assert.ok(registerGoogleRes.data.accessToken, 'Access token harus diterbitkan');
  assert.ok(registerGoogleRes.rtCookie, 'Refresh token cookie mk_rt harus diterbitkan');

  // Verifikasi 1.3: Row akun mentah TIDAK bocor ke klien
  const resKeys = Object.keys(registerGoogleRes.data);
  const userKeys = Object.keys(registerGoogleRes.data.user || {});
  assert.ok(!resKeys.includes('password_hash'), 'Response tidak boleh memiliki password_hash');
  assert.ok(!resKeys.includes('google_sub'), 'Response tidak boleh memiliki google_sub');
  assert.ok(!resKeys.includes('api_key'), 'Response tidak boleh memiliki api_key');
  assert.ok(!userKeys.includes('password_hash'), 'user tidak boleh memiliki password_hash');
  assert.ok(!userKeys.includes('google_sub'), 'user tidak boleh memiliki google_sub');
  assert.ok(!userKeys.includes('api_key'), 'user tidak boleh memiliki api_key');
  console.log('✓ 3a. Response registrasi steril dari password_hash, google_sub, dan api_key');

  // Verifikasi akun di database
  const createdAccount = await db.findOne('accounts', { google_sub: newGoogleSub });
  assert.ok(createdAccount, 'Akun harus tersimpan di database');
  assert.strictEqual(createdAccount.status, 'active');
  assert.strictEqual(createdAccount.password_hash, null, 'password_hash akun Google baru harus null');
  assert.ok(createdAccount.email_verified_at, 'email_verified_at harus otomatis terisi');

  // Verifikasi workspace default dibuat
  const members = await db.findMany('workspace_members', { user_id: createdAccount.id });
  assert.strictEqual(members.length, 1, 'Pengguna baru harus memiliki 1 workspace');
  assert.strictEqual(members[0].role, 'owner');

  // Verifikasi module_entitlements 7 hari trial & entitlement seo free (1.7)
  const entitlements = await db.findMany('module_entitlements', { workspace_id: members[0].workspace_id });
  const activeModules = entitlements.filter(e => e.active).map(e => e.module);
  assert.ok(activeModules.includes('seo'), 'Modul SEO harus aktif');
  assert.ok(activeModules.includes('ads_report'), 'Modul ads_report harus aktif');
  assert.ok(activeModules.includes('ads_spy'), 'Modul ads_spy harus aktif');

  const seoEnts = entitlements.filter(e => e.module === 'seo');
  assert.ok(seoEnts.some(e => e.source === 'free'), 'Entitlement seo source free harus selalu ada');
  console.log('✓ 3b. Registrasi akun baru via Google sukses: status active, default workspace & trial 7 hari aktif');

  // ==========================================
  // 3c. Pengujian 1.2: Login Password untuk Akun Google-only
  // ==========================================
  console.log('3c. Menguji login password untuk akun Google-only (harus 401 PASSWORD_NOT_SET)...');
  const googleOnlyLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: newGoogleEmail, password: 'apapun-passwordnya' }
  });
  assert.strictEqual(googleOnlyLoginRes.status, 401);
  assert.strictEqual(googleOnlyLoginRes.data.code, 'PASSWORD_NOT_SET');
  assert.ok(googleOnlyLoginRes.data.error.includes('Google'), 'Pesan harus mengarahkan ke login Google');
  console.log('✓ 3c. Login password untuk akun Google-only mengembalikan 401 PASSWORD_NOT_SET dengan tepat');

  // ==========================================
  // 4. Login Ulang Pengguna Terdaftar via Google
  // ==========================================
  console.log('4. Menguji login ulang pengguna yang sudah memiliki google_sub...');
  const start2Res = await req('/api/auth/google/start?format=json');
  const state2 = new URL(start2Res.data.authUrl).searchParams.get('state');

  const loginGoogleRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start2Res.oauthCookie,
    headers: {
      'x-google-mock-profile': JSON.stringify(mockNewProfile)
    },
    body: { code: 'dummy_code_login', state: state2 }
  });

  assert.strictEqual(loginGoogleRes.status, 200);
  assert.strictEqual(loginGoogleRes.data.action, 'login');
  assert.strictEqual(loginGoogleRes.data.user.id, createdAccount.id);
  assert.ok(loginGoogleRes.data.accessToken);

  // Verifikasi sanitasi respons 1.3
  assert.ok(!Object.keys(loginGoogleRes.data).includes('password_hash'));
  assert.ok(!Object.keys(loginGoogleRes.data.user).includes('password_hash'));
  console.log('✓ 4. Login ulang pengguna Google berhasil terhubung ke akun yang sama');

  // ==========================================
  // 5. Penautan Akun dengan Password via Pending Token (1.4)
  // ==========================================
  console.log('5. Menguji alur penautan akun (account linking) via pending token...');
  const existingEmail = `exist.pass.${ts}@testmarkimate.id`;
  await req('/api/auth/register', {
    method: 'POST',
    body: { email: existingEmail, password: dummyPassword, brandName: 'Brand Password Manual', acceptTerms: true }
  });
  const existingUserRow = await db.findOne('accounts', { email: existingEmail });
  await req(`/api/admin/users/${existingUserRow.id}/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY }
  });

  const linkSub = `g-sub-link-${ts}`;
  const mockLinkProfile = {
    sub: linkSub,
    email: existingEmail,
    name: 'Akun Link Password',
    emailVerified: true
  };

  const start3Res = await req('/api/auth/google/start?format=json');
  const state3 = new URL(start3Res.data.authUrl).searchParams.get('state');

  const requirePassRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start3Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(mockLinkProfile) },
    body: { code: 'dummy_code_link_1', state: state3 }
  });
  assert.strictEqual(requirePassRes.status, 409, 'Harus ditolak 409 LINK_PASSWORD_REQUIRED');
  assert.strictEqual(requirePassRes.data.code, 'LINK_PASSWORD_REQUIRED');
  assert.strictEqual(requirePassRes.data.email, existingEmail);
  assert.ok(requirePassRes.data.pendingToken, 'Harus mengembalikan pendingToken');

  const pendingToken = requirePassRes.data.pendingToken;

  // 5b. Uji link dengan password salah
  const wrongPassRes = await req('/api/auth/google/link', {
    method: 'POST',
    body: { pendingToken, password: 'SalahPassword123' }
  });
  assert.strictEqual(wrongPassRes.status, 400);
  assert.strictEqual(wrongPassRes.data.code, 'INVALID_PASSWORD');

  // 5c. Uji link dengan password benar
  const validLinkRes = await req('/api/auth/google/link', {
    method: 'POST',
    body: { pendingToken, password: dummyPassword }
  });
  assert.strictEqual(validLinkRes.status, 200, 'Penautan akun harus sukses 200');
  assert.strictEqual(validLinkRes.data.action, 'link');
  assert.ok(validLinkRes.data.accessToken);

  // Verifikasi sanitasi respons 1.3
  assert.ok(!Object.keys(validLinkRes.data).includes('password_hash'));
  assert.ok(!Object.keys(validLinkRes.data.user).includes('password_hash'));

  // 5d. Uji token sekali pakai (reuse token)
  const reusedTokenRes = await req('/api/auth/google/link', {
    method: 'POST',
    body: { pendingToken, password: dummyPassword }
  });
  assert.strictEqual(reusedTokenRes.status, 400);
  assert.strictEqual(reusedTokenRes.data.code, 'INVALID_PENDING_TOKEN');

  const linkedAccount = await db.findOne('accounts', { id: existingUserRow.id });
  assert.strictEqual(linkedAccount.google_sub, linkSub, 'Akun harus memiliki google_sub yang sesuai');
  console.log('✓ 5. Penautan akun via pendingToken sukses, aman dari token reuse');

  // ==========================================
  // 6. Pengujian 1.6: Klaim Akun Unverified oleh Pemilik Email Google Asli
  // ==========================================
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

  const auditEvents = await db.findMany('audit_logs', { user_id: unverifiedAcc.id, action: 'google_claimed_unverified' });
  assert.ok(auditEvents.length > 0, 'Harus mencatat log audit google_claimed_unverified');
  console.log('✓ 6. Klaim akun unverified oleh Google email_verified=true berhasil dan dicatat di audit');

  // ==========================================
  // 7. Penolakan Login untuk Akun Status pending_deletion
  // ==========================================
  console.log('7. Menguji penolakan login akun berstatus pending_deletion...');
  await db.update('accounts', { id: linkedAccount.id }, {
    status: 'pending_deletion',
    deleted_requested_at: new Date().toISOString()
  });

  const start4Res = await req('/api/auth/google/start?format=json');
  const state4 = new URL(start4Res.data.authUrl).searchParams.get('state');

  const blockedPendingRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start4Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(mockLinkProfile) },
    body: { code: 'dummy_code_pending', state: state4 }
  });
  assert.strictEqual(blockedPendingRes.status, 403);
  assert.strictEqual(blockedPendingRes.data.code, 'ACCOUNT_PENDING_DELETION');
  console.log('✓ 7. Akun pending_deletion diblokir 403 dari login Google');

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH 9 (LOGIN GOOGLE OAUTH - LANGKAH 1 PRD) LULUS 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runStep9Tests().catch((err) => {
  console.error('\n❌ TEST STEP 9 GAGAL:', err);
  process.exit(1);
});
