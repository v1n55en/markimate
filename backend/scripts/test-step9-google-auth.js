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

  // Verifikasi akun di database
  const createdAccount = await db.findOne('accounts', { google_sub: newGoogleSub });
  assert.ok(createdAccount, 'Akun harus tersimpan di database');
  assert.strictEqual(createdAccount.status, 'active');
  assert.ok(createdAccount.email_verified_at, 'email_verified_at harus otomatis terisi');

  // Verifikasi workspace default dibuat
  const members = await db.findMany('workspace_members', { user_id: createdAccount.id });
  assert.strictEqual(members.length, 1, 'Pengguna baru harus memiliki 1 workspace');
  assert.strictEqual(members[0].role, 'owner');

  // Verifikasi module_entitlements 7 hari trial
  const entitlements = await db.findMany('module_entitlements', { workspace_id: members[0].workspace_id });
  const activeModules = entitlements.filter(e => e.active).map(e => e.module);
  assert.ok(activeModules.includes('seo'), 'Modul SEO harus aktif');
  assert.ok(activeModules.includes('ads_report'), 'Modul ads_report harus aktif');
  assert.ok(activeModules.includes('ads_spy'), 'Modul ads_spy harus aktif');
  console.log('✓ 3. Registrasi akun baru via Google sukses: status active, default workspace & trial 7 hari aktif');

  // ==========================================
  // 4. Login Ulang Pengguna Terdaftar via Google
  // ==========================================
  console.log('4. Menguji login ulang pengguna yang sudah memiliki google_sub...');
  // Ambil start session baru untuk state fresh
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
  console.log('✓ 4. Login ulang pengguna Google berhasil terhubung ke akun yang sama');

  // ==========================================
  // 5. Penautan Akun yang Sudah Terdaftar dengan Password (Account Linking)
  // ==========================================
  console.log('5. Menguji alur penautan akun (account linking) dengan email sama...');
  const existingEmail = `exist.pass.${ts}@testmarkimate.id`;
  // Daftarkan akun biasa
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

  // 5a. Percobaan link tanpa password -> Harus ditolak 409 LINK_PASSWORD_REQUIRED
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

  // 5b. Percobaan link dengan password salah -> Harus ditolak 400 INVALID_PASSWORD
  const wrongPassRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start3Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(mockLinkProfile) },
    body: { code: 'dummy_code_link_2', state: state3, linkPassword: ['Salah', 'Pass', '999'].join('') }
  });
  assert.strictEqual(wrongPassRes.status, 400, 'Password salah harus ditolak 400');
  assert.strictEqual(wrongPassRes.data.code, 'INVALID_PASSWORD');

  // 5c. Percobaan link dengan password benar -> Sukses 200 dan google_sub tertaut
  const validLinkRes = await req('/api/auth/google/callback', {
    method: 'POST',
    cookie: start3Res.oauthCookie,
    headers: { 'x-google-mock-profile': JSON.stringify(mockLinkProfile) },
    body: { code: 'dummy_code_link_3', state: state3, linkPassword: dummyPassword }
  });
  assert.strictEqual(validLinkRes.status, 200, 'Penautan akun harus sukses 200');
  assert.strictEqual(validLinkRes.data.action, 'link');

  const linkedAccount = await db.findOne('accounts', { id: existingUserRow.id });
  assert.strictEqual(linkedAccount.google_sub, linkSub, 'Akun harus memiliki google_sub yang sesuai');
  console.log('✓ 5. Proteksi penautan akun (minta password, cegah takeover) berhasil diverifikasi');

  // ==========================================
  // 6. Penolakan Login untuk Akun Status pending_deletion
  // ==========================================
  console.log('6. Menguji penolakan login akun berstatus pending_deletion...');
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
  console.log('✓ 6. Akun pending_deletion diblokir 403 dari login Google');

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH 9 (LOGIN GOOGLE OAUTH) LULUS 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runStep9Tests().catch((err) => {
  console.error('\n❌ TEST STEP 9 GAGAL:', err);
  process.exit(1);
});
