import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { db, TABLES, JsonStore } = await import('../db.js');
const { buildSchemaContract, validateRowContract } = await import('../lib/schema-contract.js');

async function runSchemaContractTests() {
  console.log('=== RUNNING TEST SCHEMA CONTRACT & MIGRATIONS ===');

  // 1. Membaca semua migrasi dan membuat daftar kontrak kolom
  console.log('1. Membaca file migrasi (supabase.sql, 006 s/d 011)...');
  const contract = buildSchemaContract();
  const tables = Object.keys(contract);

  assert.ok(tables.includes('accounts'), 'Tabel accounts harus ada di kontrak');
  assert.ok(tables.includes('workspaces'), 'Tabel workspaces harus ada di kontrak');
  assert.ok(tables.includes('refresh_tokens'), 'Tabel refresh_tokens harus ada di kontrak');
  assert.ok(tables.includes('oauth_pending_links'), 'Tabel oauth_pending_links harus ada di kontrak');
  assert.ok(tables.includes('module_entitlements'), 'Tabel module_entitlements harus ada di kontrak');
  assert.ok(tables.includes('credit_alerts'), 'Tabel credit_alerts harus ada di kontrak');

  console.log(`   OK - Ditemukan ${tables.length} tabel dalam kontrak skema.`);

  // 2. Verifikasi status NOT NULL tanpa default
  console.log('2. Memverifikasi kolom NOT NULL tanpa default...');
  assert.ok(!contract.accounts.notNullNoDefault.has('password_hash'), 'accounts.password_hash harus nullable (bukan NOT NULL tanpa default)');
  assert.ok(contract.accounts.notNullNoDefault.has('email'), 'accounts.email harus NOT NULL tanpa default');

  assert.ok(contract.workspace_members.notNullNoDefault.has('workspace_id'));
  assert.ok(contract.workspace_members.notNullNoDefault.has('user_id'));
  assert.ok(contract.workspace_members.notNullNoDefault.has('role'));

  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('token_hash'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('user_id'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('email'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('google_sub'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('expires_at'));

  console.log('   OK - Daftar kolom NOT NULL tanpa default terverifikasi akurat.');

  // 3. Menguji penolakan kolom yang tidak ada dalam skema
  console.log('3. Menguji penolakan kolom yang tidak ada dalam skema...');
  assert.throws(() => {
    validateRowContract('accounts', {
      email: 'test@markimate.id',
      kolom_ngawur_tidak_ada: 'value'
    }, true);
  }, /does not exist in table "accounts"/);
  console.log('   OK - Kolom asing berhasil ditolak.');

  // 4. Menguji penolakan kolom NOT NULL tanpa default yang tidak diisi
  console.log('4. Menguji penolakan insert tanpa kolom NOT NULL tanpa default...');
  assert.throws(() => {
    validateRowContract('accounts', {
      brand_name: 'Tanpa Email'
    }, true);
  }, /Column "email" in table "accounts" is NOT NULL/);
  console.log('   OK - Missing NOT NULL column ditolak.');

  // 5. Menguji penolakan tipe UUID yang salah
  console.log('5. Menguji validasi tipe data (UUID)...');
  assert.throws(() => {
    validateRowContract('accounts', {
      id: 'bukan-uuid-valid',
      email: 'uuid-fail@markimate.id'
    }, true);
  }, /is type UUID, but received invalid value/);

  // Penolakan jika workspace_id diisi non-UUID (misal 'system')
  assert.throws(() => {
    validateRowContract('credit_alerts', {
      workspace_id: 'system',
      alert_type: 'margin_low',
      sent_to: 'admin@test.com'
    }, true);
  }, /is type UUID, but received invalid value/);
  console.log('   OK - Format UUID tidak valid berhasil ditolak.');

  // 6. Verifikasi File Migrasi SQL 009
  const sqlPath = path.join(__dirname, '../migrations/009_auth_workspace.sql');
  assert.ok(fs.existsSync(sqlPath), 'File 009_auth_workspace.sql harus ada');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(sqlContent.includes('markimate.schema_migrations'), 'Harus menyertakan markimate.schema_migrations');
  assert.ok(sqlContent.includes('markimate.workspaces'), 'Harus menyertakan markimate.workspaces');
  assert.ok(sqlContent.includes('markimate.workspace_members'), 'Harus menyertakan markimate.workspace_members');
  assert.ok(sqlContent.includes('markimate.module_entitlements'), 'Harus menyertakan markimate.module_entitlements');
  assert.ok(sqlContent.includes('markimate.hit_rate_limit'), 'Harus menyertakan fungsi hit_rate_limit');
  console.log('✓ 6. File migrasi backend/migrations/009_auth_workspace.sql valid dan lengkap');

  // 7. Verifikasi TABLES di db.js
  const requiredNewTables = [
    'schema_migrations',
    'email_verifications',
    'password_resets',
    'refresh_tokens',
    'rate_limits',
    'workspaces',
    'workspace_members',
    'workspace_invites',
    'module_entitlements',
    'workspace_api_keys',
    'audit_logs',
    'webhook_events'
  ];

  for (const table of requiredNewTables) {
    assert.ok(TABLES.includes(table), `TABLES harus menyertakan tabel '${table}'`);
    const rows = await db.findMany(table);
    assert.ok(Array.isArray(rows), `Tabel '${table}' harus bisa di-query via db.findMany`);
  }
  console.log('✓ 7. Semua tabel baru terdaftar di db.js dan dapat di-query');

  // 8. Verifikasi db.rpc('hit_rate_limit')
  const testKey = 'test-ip-step1-' + Date.now();
  const hit1 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit1, true, 'Hit 1 harus true');
  const hit2 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit2, true, 'Hit 2 harus true');
  const hit3 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit3, true, 'Hit 3 harus true');
  const hit4 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit4, false, 'Hit 4 harus false (melebihi batas max 3)');
  console.log('✓ 8. db.rpc("hit_rate_limit") berfungsi secara akurat');

  console.log('ALL SCHEMA CONTRACT TESTS PASSED!');
  process.exit(0);
}

runSchemaContractTests().catch(err => {
  console.error('Test Schema Contract Failed:', err);
  process.exit(1);
});
