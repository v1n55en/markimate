// Test Langkah 6: Anggota Workspace, Undangan, RBAC & Transfer Ownership (PRD F1 + F2)
import assert from 'assert';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step6-' + Date.now();

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

async function runStep6Tests() {
  console.log('=== RUNNING TEST STEP 6 (Workspace Members, Invites, Roles & Transfer) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step6';
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
  console.log('   OK - Undangan berhasil dibuat.');

  // 4. Publik Cek Info Undangan
  console.log('4. Memeriksa info undangan publik (GET /api/invites/info)...');
  const infoRes = await req(`/api/invites/info?token=${encodeURIComponent(rawToken)}`);
  assert.strictEqual(infoRes.status, 200);
  assert.strictEqual(infoRes.data.valid, true);
  assert.strictEqual(infoRes.data.invite.email, emailB);
  assert.strictEqual(infoRes.data.invite.role, 'viewer');
  console.log('   OK - Info undangan valid.');

  // 5. Pencegahan Mismatch Email (User C mencoba menerima undangan User B)
  console.log('5. Menguji proteksi EMAIL_MISMATCH (User C mencoba terima undangan User B)...');
  const wrongUserAccept = await req('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenC}` },
    body: { token: rawToken }
  });
  assert.strictEqual(wrongUserAccept.status, 403, 'User C harus ditolak karena email berbeda (403)');
  assert.strictEqual(wrongUserAccept.data.code, 'EMAIL_MISMATCH');
  console.log('   OK - Ditolak 403 EMAIL_MISMATCH.');

  // 6. User B menerima undangan
  console.log('6. User B menerima undangan yang sesuai...');
  const validAccept = await req('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { token: rawToken }
  });
  assert.strictEqual(validAccept.status, 200, 'User B harus berhasil menerima undangan');
  assert.strictEqual(validAccept.data.workspace.role, 'viewer');
  console.log('   OK - User B berhasil bergabung ke workspace.');

  // 7. Verifikasi keanggotaan dan RBAC viewer
  console.log('7. Verifikasi User B menjadi viewer dan penolakan hak tulis...');
  const membersAfter = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenA}` } });
  assert.strictEqual(membersAfter.data.members.length, 2);
  const memberB = membersAfter.data.members.find(m => m.email === emailB);
  assert.ok(memberB);
  assert.strictEqual(memberB.role, 'viewer');

  // User B mencoba membuat keyword -> Ditolak 403 FORBIDDEN_ROLE
  const viewerWrite = await req('/api/keywords', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Workspace-Id': wsAId
    },
    body: { keyword: 'keyword dari viewer dilarang' }
  });
  assert.strictEqual(viewerWrite.status, 403, 'Viewer dilarang menulis (403)');
  console.log('   OK - User B tercatat sebagai viewer dan tidak bisa menulis keyword.');

  // 8. Owner A mengubah peran User B menjadi Admin
  console.log('8. Owner A mempromosikan User B menjadi Admin (PATCH /api/workspaces/:id/members/:userId)...');
  const promoRes = await req(`/api/workspaces/${wsAId}/members/${rowB.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { role: 'admin' }
  });
  assert.strictEqual(promoRes.status, 200, 'Promosi admin harus berhasil');

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
  console.log('   OK - Promosi role berhasil dan User B sekarang memiliki hak admin.');

  // 9. Admin B tidak bisa mengubah role Owner A
  console.log('9. Memastikan Admin B tidak bisa menurunkan role Owner A...');
  const demoteOwnerAttempt = await req(`/api/workspaces/${wsAId}/members/${rowA.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { role: 'viewer' }
  });
  assert.strictEqual(demoteOwnerAttempt.status, 400, 'Mengubah role owner harus ditolak (400)');
  console.log('   OK - Proteksi role owner terbukti aman.');

  // 10. Transfer Ownership dari User A ke User B
  console.log('10. Pengujian transfer kepemilikan workspace dari User A ke User B...');
  // Percobaan dengan kata sandi salah
  const wrongPassTransfer = await req(`/api/workspaces/${wsAId}/transfer-ownership`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { userId: rowB.id, password: ['Wrong', 'Pass', '123!'].join('') }
  });
  assert.strictEqual(wrongPassTransfer.status, 400, 'Password salah harus ditolak (400)');

  // Transfer dengan kata sandi benar
  const validTransfer = await req(`/api/workspaces/${wsAId}/transfer-ownership`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { userId: rowB.id, password: passwordA }
  });
  assert.strictEqual(validTransfer.status, 200, 'Transfer kepemilikan harus 200');

  // Periksa daftar anggota setelah transfer
  const membersAfterTransfer = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenB}` } });
  const roleA = membersAfterTransfer.data.members.find(m => m.userId === rowA.id).role;
  const roleB = membersAfterTransfer.data.members.find(m => m.userId === rowB.id).role;
  assert.strictEqual(roleB, 'owner', 'User B sekarang harus menjadi owner');
  assert.strictEqual(roleA, 'admin', 'User A sekarang menjadi admin');
  console.log('   OK - Transfer ownership sukses. User B adalah Owner baru.');

  // 11. User A keluar dari workspace
  console.log('11. User A keluar dari workspace (DELETE /api/workspaces/:id/members/:userAId)...');
  const leaveRes = await req(`/api/workspaces/${wsAId}/members/${rowA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(leaveRes.status, 200, 'User A keluar harus 200');

  const finalMembers = await req(`/api/workspaces/${wsAId}/members`, { headers: { Authorization: `Bearer ${tokenB}` } });
  assert.strictEqual(finalMembers.data.members.length, 1);
  assert.strictEqual(finalMembers.data.members[0].userId, rowB.id);
  console.log('   OK - User A berhasil keluar dari workspace.');

  console.log('\n=== ALL STEP 6 MEMBERS & INVITES TESTS PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runStep6Tests().catch(err => {
  console.error('\n❌ STEP 6 TEST FAILED:', err);
  process.exit(1);
});
