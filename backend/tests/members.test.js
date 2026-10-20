// Test Workspace Members: Invites, Role Enforcement, Member Removal & Ownership Transfer
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-members-${randomUUID()}.json`);
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

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-members-' + Date.now();

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

async function runMembersTests() {
  console.log('=== RUNNING TEST MEMBERS (Invites, Roles & Transfer) ===');

  process.env.JWT_SECRET = 'test-secret-key-members';
  process.env.PORT = '5013';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5013';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailA = `ownera.ws.${ts}@testmarkimate.id`;
  const emailB = `invitee.ws.${ts}@testmarkimate.id`;
  const emailC = `other.ws.${ts}@testmarkimate.id`;
  const passwordA = ['Owner', 'Pass', '123!', 'A'].join('');
  const passwordBC = ['Member', 'Pass', '123!', 'B'].join('');

  // 1. Registrasi & verifikasi User A, B, C
  console.log('1. Mendaftarkan User A (Owner), User B (Calon Member), dan User C (Orang Lain)...');
  await req('/api/auth/register', { method: 'POST', body: { email: emailA, password: passwordA, brandName: 'Brand Alpha Kolaborasi', acceptTerms: true } });
  const rowA = await db.findOne('accounts', { email: emailA });
  await req(`/api/admin/users/${rowA.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  await req('/api/auth/register', { method: 'POST', body: { email: emailB, password: passwordBC, brandName: 'Brand Beta', acceptTerms: true } });
  const rowB = await db.findOne('accounts', { email: emailB });
  await req(`/api/admin/users/${rowB.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  await req('/api/auth/register', { method: 'POST', body: { email: emailC, password: passwordBC, brandName: 'Brand Charlie', acceptTerms: true } });
  const rowC = await db.findOne('accounts', { email: emailC });
  await req(`/api/admin/users/${rowC.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  // Login ketiganya
  const loginA = await req('/api/auth/login', { method: 'POST', body: { email: emailA, password: passwordA } });
  const tokenA = loginA.data.accessToken;

  const loginB = await req('/api/auth/login', { method: 'POST', body: { email: emailB, password: passwordBC } });
  const tokenB = loginB.data.accessToken;

  const loginC = await req('/api/auth/login', { method: 'POST', body: { email: emailC, password: passwordBC } });
  const tokenC = loginC.data.accessToken;

  const meA = await req('/api/me', { headers: { Authorization: `Bearer ${tokenA}` } });
  const wsAId = meA.data.workspaces[0].id;
  console.log(`   OK - Workspace Target ID: ${wsAId}`);

  // 2. Daftar anggota awal
  console.log('2. Memeriksa daftar anggota awal workspace...');
  const membersInit = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(membersInit.status, 200);
  assert.strictEqual(membersInit.data.members.length, 1);
  assert.strictEqual(membersInit.data.members[0].role, 'owner');
  console.log('   OK - Hanya ada 1 anggota awal (Owner).');

  // 3. Owner A mengundang User B sebagai Viewer
  console.log('3. Owner A mengirim undangan ke email User B sebagai viewer...');
  const inviteRes = await req(`/api/workspaces/${wsAId}/invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { email: emailB, role: 'viewer' }
  });
  assert.strictEqual(inviteRes.status, 200, 'Kirim undangan harus 200');
  const inviteData = inviteRes.data.invite;
  assert.ok(inviteData.inviteLink, 'Harus mengembalikan inviteLink');
  assert.strictEqual(inviteData.email, emailB);
  assert.strictEqual(inviteData.role, 'viewer');

  const parsedUrl = new URL(inviteData.inviteLink);
  const rawToken = parsedUrl.searchParams.get('token');
  assert.ok(rawToken, 'Token undangan harus ada');

  // 4. Publik Cek Info Undangan
  console.log('4. Memeriksa info undangan publik (GET /api/invites/info)...');
  const infoRes = await req(`/api/invites/info?token=${encodeURIComponent(rawToken)}`);
  assert.strictEqual(infoRes.status, 200);
  assert.strictEqual(infoRes.data.valid, true);
  assert.strictEqual(infoRes.data.invite.email, emailB);
  assert.strictEqual(infoRes.data.invite.role, 'viewer');

  // 5. Accept invite: User C mencoba menerima token milik User B -> harus gagal (403 EMAIL_MISMATCH)
  console.log('5. Menguji proteksi token undangan terhadap akun lain...');
  const acceptByC = await req('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenC}` },
    body: { token: rawToken }
  });
  assert.strictEqual(acceptByC.status, 403);
  assert.strictEqual(acceptByC.data.code, 'EMAIL_MISMATCH');

  // 6. User B menerima undangan
  console.log('6. User B menerima undangan resmi...');
  const acceptByB = await req('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { token: rawToken }
  });
  assert.strictEqual(acceptByB.status, 200);
  assert.strictEqual(acceptByB.data.workspace.role, 'viewer');

  // Mengundang lagi setelah sudah jadi member -> harus gagal (400 ALREADY_MEMBER)
  const dupInvite = await req(`/api/workspaces/${wsAId}/invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { email: emailB, role: 'admin' }
  });
  assert.strictEqual(dupInvite.status, 400);
  assert.strictEqual(dupInvite.data.code, 'ALREADY_MEMBER');

  // 7. Cek daftar anggota sekarang: harus 2 orang
  const membersAfter = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(membersAfter.status, 200);
  assert.strictEqual(membersAfter.data.members.length, 2);
  const memberBEntry = membersAfter.data.members.find(m => m.email === emailB);
  assert.ok(memberBEntry);
  assert.strictEqual(memberBEntry.role, 'viewer');

  // 8. Role enforcement: Viewer dilarang menulis keyword -> 403 FORBIDDEN_ROLE
  console.log('7. Menguji batasan RBAC untuk role viewer...');
  const viewerWrite = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsAId
    },
    body: { keyword: 'keyword dari viewer dilarang' }
  });
  assert.strictEqual(viewerWrite.status, 403, 'Viewer dilarang menulis (403)');
  assert.strictEqual(viewerWrite.data.code, 'FORBIDDEN_ROLE');

  // 9. Owner A mengubah role B dari viewer ke admin
  console.log('8. Mengubah role member...');
  const promoRes = await req(`/api/workspaces/${wsAId}/members/${rowB.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { role: 'admin' }
  });
  assert.strictEqual(promoRes.status, 200);
  assert.strictEqual(promoRes.data.member.role, 'admin');

  // Sekarang User B (admin) bisa membuat keyword
  const adminWrite = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsAId
    },
    body: { keyword: 'keyword dari admin diperbolehkan' }
  });
  assert.strictEqual(adminWrite.status, 200, 'Admin diizinkan menulis keyword');

  // 10. Transfer Ownership dari User A ke User B
  console.log('9. Menguji transfer kepemilikan workspace...');
  const transferRes = await req(`/api/workspaces/${wsAId}/transfer-ownership`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { userId: rowB.id, password: passwordA }
  });
  assert.strictEqual(transferRes.status, 200);
  assert.strictEqual(transferRes.data.code, 'WORKSPACE_OWNERSHIP_TRANSFERRED');

  // Cek posisi setelah transfer: User B jadi owner, User A jadi admin
  const membersAfterTransfer = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenB}` } });
  const entryA = membersAfterTransfer.data.members.find(m => (m.userId || m.user_id) === rowA.id);
  const entryB = membersAfterTransfer.data.members.find(m => (m.userId || m.user_id) === rowB.id);
  assert.strictEqual(entryB.role, 'owner');
  assert.strictEqual(entryA.role, 'admin');

  // 11. Hapus member: User A keluar dari workspace
  console.log('10. User A keluar dari workspace...');
  const removeRes = await req(`/api/workspaces/${wsAId}/members/${rowA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(removeRes.status, 200);

  const finalMembers = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenB}` } });
  assert.strictEqual(finalMembers.data.members.length, 1);
  assert.strictEqual((finalMembers.data.members[0].userId || finalMembers.data.members[0].user_id), rowB.id);

  console.log('✅ ALL WORKSPACE MEMBERS TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runMembersTests().catch(err => {
  console.error('❌ Members Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
