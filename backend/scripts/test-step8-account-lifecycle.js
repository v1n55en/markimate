// Test Langkah 8: Hapus Akun, Purge Cron, Ekspor Data, Meta Data Deletion, dan Audit Log (PRD F1 + F2)
import assert from 'assert';
import crypto from 'crypto';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_ADMIN_KEY = 'admin-secret-step8-' + Date.now();
const TEST_META_SECRET = 'test_meta_app_secret_step8';

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

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    data
  };
}

// Helper untuk membuat Meta signed_request uji
function makeMetaSignedRequest(payload, secret) {
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${sig}.${payloadStr}`;
}

async function runStep8Tests() {
  console.log('=== RUNNING TEST STEP 8 (Account Lifecycle, Purge, Export, Meta Deletion, Audit) ===');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-step8';
  process.env.PORT = '5015';
  process.env.CREDITS_ENABLED = 'true';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.CRON_SECRET = 'cron-secret-step8';
  process.env.META_APP_SECRET = TEST_META_SECRET;
  process.env.MAIL_DEV_LOG = 'true';
  process.env.APP_URL = 'http://localhost:5015';

  await seedCreditPricesAndRates();
  await db.remove('rate_limits', {});
  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const ts = Date.now();
  const emailOwner = `delete.owner.${ts}@testmarkimate.id`;
  const emailMember = `delete.member.${ts}@testmarkimate.id`;
  const emailSolo = `delete.solo.${ts}@testmarkimate.id`;
  const password = ['Delete', 'Pass', '123!', 'L'].join('');

  // 1. Mendaftarkan User Owner, User Member, dan User Solo
  console.log('1. Mendaftarkan pengguna uji...');
  await req('/api/auth/register', { method: 'POST', body: { email: emailOwner, password, brandName: 'Owner Brand', acceptTerms: true } });
  const accOwner = await db.findOne('accounts', { email: emailOwner });
  await req(`/api/admin/users/${accOwner.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  await req('/api/auth/register', { method: 'POST', body: { email: emailMember, password, brandName: 'Member Brand', acceptTerms: true } });
  const accMember = await db.findOne('accounts', { email: emailMember });
  await req(`/api/admin/users/${accMember.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  await req('/api/auth/register', { method: 'POST', body: { email: emailSolo, password, brandName: 'Solo Brand', acceptTerms: true } });
  const accSolo = await db.findOne('accounts', { email: emailSolo });
  await req(`/api/admin/users/${accSolo.id}/verify`, { method: 'POST', headers: { 'X-Admin-Key': TEST_ADMIN_KEY } });

  // Login Owner
  const loginOwner = await req('/api/auth/login', { method: 'POST', body: { email: emailOwner, password } });
  const tokenOwner = loginOwner.data.accessToken;

  // Login Solo
  const loginSolo = await req('/api/auth/login', { method: 'POST', body: { email: emailSolo, password } });
  const tokenSolo = loginSolo.data.accessToken;

  // 2. Tambahkan User Member ke workspace User Owner agar User Owner memiliki anggota lain
  console.log('2. Menambahkan User Member ke workspace User Owner...');
  const wsOwnerId = accOwner.id;
  await db.insert('workspace_members', {
    workspace_id: wsOwnerId,
    user_id: accMember.id,
    role: 'viewer'
  });

  // 3. User Owner mencoba hapus akun -> Harus DITOLAK 409 TRANSFER_OWNERSHIP_FIRST
  console.log('3. Menguji penolakan 409 TRANSFER_OWNERSHIP_FIRST jika workspace masih memiliki anggota lain...');
  const blockedDeleteRes = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenOwner}` },
    body: { password, confirm: 'HAPUS' }
  });
  assert.strictEqual(blockedDeleteRes.status, 409, 'Owner dengan anggota lain harus ditolak 409');
  assert.strictEqual(blockedDeleteRes.data.code, 'TRANSFER_OWNERSHIP_FIRST');
  assert.ok(Array.isArray(blockedDeleteRes.data.workspaces), 'Harus menyertakan daftar workspace yang terblokir');
  console.log('✓ Proteksi 409 TRANSFER_OWNERSHIP_FIRST berhasil diverifikasi');

  // 4. Ekspor Data Akun (GET /api/account/export)
  console.log('4. Menguji ekspor data akun (GET /api/account/export)...');
  // Tambah beberapa keyword dan cms untuk user solo
  await db.insert('keywords', {
    user_id: accSolo.id,
    workspace_id: accSolo.id,
    keyword: 'baju batik pria modern',
    geo: 'ID',
    ln: 'id',
    cms_type: 'wordpress',
    status: 'Ready',
    schedule: 'immediate'
  });
  await db.insert('cms_connections', {
    user_id: accSolo.id,
    workspace_id: accSolo.id,
    cms_type: 'wordpress',
    config_enc: 'enc_secret_key',
    config_iv: 'iv_secret',
    verified: true,
    article_settings: { autoDraft: true }
  });

  const exportRes = await req('/api/account/export', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenSolo}` }
  });
  assert.strictEqual(exportRes.status, 200);
  assert.ok(exportRes.headers.get('content-disposition')?.includes('attachment; filename='), 'Harus berupa file attachment');
  const exportJson = typeof exportRes.data === 'string' ? JSON.parse(exportRes.data) : exportRes.data;
  assert.strictEqual(exportJson.profile.email, emailSolo);
  assert.ok(!exportJson.profile.password_hash, 'Password hash TIDAK BOLEH diekspor');
  assert.ok(Array.isArray(exportJson.workspaces));
  assert.strictEqual(exportJson.workspaces[0].keywords[0].keyword, 'baju batik pria modern');
  assert.ok(!exportJson.workspaces[0].cmsConnections[0].config_enc, 'Kredensial CMS TIDAK BOLEH diekspor');
  console.log('✓ Ekspor data akun JSON berhasil dan aman dari kebocoran rahasia');

  // 5. Permintaan Hapus Akun oleh User Solo (POST /api/account/delete)
  console.log('5. Menguji pengajuan hapus akun (POST /api/account/delete)...');
  // Konfirmasi salah -> ditolak 400
  const wrongConfirmRes = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSolo}` },
    body: { password, confirm: 'SALAH' }
  });
  assert.strictEqual(wrongConfirmRes.status, 400);

  // Konfirmasi benar
  const deleteRes = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSolo}` },
    body: { password, confirm: 'HAPUS' }
  });
  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.data.success, true);

  const updatedSolo = await db.findOne('accounts', { id: accSolo.id });
  assert.strictEqual(updatedSolo.status, 'pending_deletion');
  assert.ok(updatedSolo.deleted_requested_at);
  console.log('✓ Akun berstatus pending_deletion dan jadwal penghapusan tercatat');

  // 6. Coba login saat pending_deletion -> harus ditolak 403 ACCOUNT_PENDING_DELETION
  console.log('6. Menguji login akun pending_deletion (harus ditolak sebelum membatalkan)...');
  const loginPendingRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailSolo, password }
  });
  assert.strictEqual(loginPendingRes.status, 403);
  assert.strictEqual(loginPendingRes.data.code, 'ACCOUNT_PENDING_DELETION');
  console.log('✓ Login ditolak 403 ACCOUNT_PENDING_DELETION');

  // 7. Batalkan penghapusan akun (POST /api/account/delete/cancel)
  console.log('7. Menguji pembatalan penghapusan akun (POST /api/account/delete/cancel)...');
  const cancelRes = await req('/api/account/delete/cancel', {
    method: 'POST',
    body: { email: emailSolo, password }
  });
  assert.strictEqual(cancelRes.status, 200);
  assert.ok(cancelRes.data.accessToken, 'Harus menerbitkan access token sesi baru');

  const restoredSolo = await db.findOne('accounts', { id: accSolo.id });
  assert.strictEqual(restoredSolo.status, 'active');
  assert.strictEqual(restoredSolo.deleted_requested_at, null);

  // Coba login kembali setelah pembatalan -> sekarang SUKSES
  const loginRestoredRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: emailSolo, password }
  });
  assert.strictEqual(loginRestoredRes.status, 200);
  console.log('✓ Pembatalan berhasil dan akun dapat login normal kembali');

  // 8. Uji Purge Cron (> 30 hari)
  console.log('8. Menguji purge cron (akun pending_deletion > 30 hari)...');
  // Ajukan hapus akun lagi
  const deleteAgainRes = await req('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginRestoredRes.data.accessToken}` },
    body: { password, confirm: 'HAPUS' }
  });
  assert.strictEqual(deleteAgainRes.status, 200);

  // Tambahkan transaksi credit_orders agar diuji anonimisasinya
  await db.insert('credit_orders', {
    user_id: accSolo.id,
    workspace_id: accSolo.id,
    amount: 1500000,
    status: 'paid',
    meta: { email: emailSolo }
  });

  // Mundurkan deleted_requested_at menjadi 31 hari yang lalu
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
  await db.update('accounts', { id: accSolo.id }, {
    deleted_requested_at: thirtyOneDaysAgo
  });

  // Jalankan cron harian
  const cronRes = await req('/api/cron/run-scheduled?secret=cron-secret-step8', { method: 'GET' });
  assert.strictEqual(cronRes.status, 200);

  // Periksa bahwa akun User Solo sudah terhapus permanen dari accounts
  const purgedAcc = await db.findOne('accounts', { id: accSolo.id });
  assert.strictEqual(purgedAcc, null, 'Akun harus terhapus permanen');

  // Periksa bahwa keywords miliknya terhapus
  const remainingKws = await db.findMany('keywords', { workspace_id: accSolo.id });
  assert.strictEqual(remainingKws.length, 0, 'Data keywords workspace harus terhapus');

  // Periksa bahwa credit_orders tetap tersimpan tapi dianomisasi (user_id = null)
  const remainingOrders = await db.findMany('credit_orders', { workspace_id: accSolo.id });
  assert.ok(remainingOrders.length > 0, 'Riwayat pesanan kredit pajak harus dipertahankan');
  assert.strictEqual(remainingOrders[0].user_id, null, 'user_id pesanan harus dianomisasi');

  // Periksa bahwa audit_logs dianomisasi
  const soloAuditLogs = await db.findMany('audit_logs', { workspace_id: accSolo.id });
  for (const log of (soloAuditLogs || [])) {
    assert.strictEqual(log.user_id, null, 'user_id di audit log harus null');
    if (log.meta?.email) {
      assert.ok(!log.meta.email.includes('@'), 'Email di meta audit log harus berupa hash sha256');
    }
  }
  console.log('✓ Purge cron berhasil menghapus data akun & menganonimkan riwayat transaksi pajak');

  // 9. Menguji Webhook Meta Data Deletion (POST /api/data-deletion/meta)
  console.log('9. Menguji webhook Meta Data Deletion Callback (POST /api/data-deletion/meta)...');
  const sampleMetaPayload = {
    user_id: 'meta_user_123456789',
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000)
  };

  // 9a. Panggil dengan signature valid
  const validSignedRequest = makeMetaSignedRequest(sampleMetaPayload, TEST_META_SECRET);
  const metaSuccessRes = await req('/api/data-deletion/meta', {
    method: 'POST',
    body: { signed_request: validSignedRequest }
  });
  assert.strictEqual(metaSuccessRes.status, 200);
  assert.ok(metaSuccessRes.data.confirmation_code, 'Harus mengembalikan confirmation_code');
  assert.ok(metaSuccessRes.data.url?.includes('/data-deletion?code='), 'Harus mengembalikan tracking URL');
  const confirmationCode = metaSuccessRes.data.confirmation_code;

  // 9b. Panggil dengan signature salah -> harus ditolak 400
  const invalidSignedRequest = makeMetaSignedRequest(sampleMetaPayload, 'wrong_secret');
  const metaInvalidRes = await req('/api/data-deletion/meta', {
    method: 'POST',
    body: { signed_request: invalidSignedRequest }
  });
  assert.strictEqual(metaInvalidRes.status, 400);

  // 9c. Panggil status dari confirmation code (GET /api/data-deletion/status?code=...)
  const statusRes = await req(`/api/data-deletion/status?code=${confirmationCode}`, { method: 'GET' });
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusRes.data.confirmationCode, confirmationCode);
  assert.strictEqual(statusRes.data.status, 'completed');
  console.log('✓ Meta Data Deletion callback & status tracker berhasil diverifikasi');

  // 10. Menguji Audit Log Workspace (GET /api/workspaces/:id/audit)
  console.log('10. Menguji pengambilan audit log workspace (GET /api/workspaces/:id/audit)...');
  const auditRes = await req(`/api/workspaces/${wsOwnerId}/audit`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` }
  });
  assert.strictEqual(auditRes.status, 200);
  assert.ok(Array.isArray(auditRes.data.logs), 'Harus mengembalikan array logs');
  console.log(`✓ Audit logs workspace berhasil diambil (${auditRes.data.logs.length} catatan)`);

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH 8 BERHASIL DENGAN 100% SUKSES!');
  console.log('======================================================');
  process.exit(0);
}

runStep8Tests().catch((err) => {
  console.error('TEST STEP 8 GAGAL:', err);
  process.exit(1);
});
