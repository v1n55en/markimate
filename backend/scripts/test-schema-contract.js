// Test Langkah 4: Kontrak Skema SQL vs JsonStore (PRD F1+F2 Fix Pack)
import assert from 'assert';
import { randomUUID } from 'crypto';
import { JsonStore } from '../db.js';
import { buildSchemaContract, validateRowContract } from '../lib/schema-contract.js';

async function runSchemaContractTests() {
  console.log('=== RUNNING TEST SCHEMA CONTRACT (Postgres Migrations vs JsonStore) ===');

  // 1. Membaca semua migrasi dan membuat daftar kontrak kolom
  console.log('1. Membaca file migrasi (supabase.sql, 006 s/d 011)...');
  const contract = buildSchemaContract();
  const tables = Object.keys(contract);

  assert.ok(tables.includes('accounts'), 'Tabel accounts harus ada di kontrak');
  assert.ok(tables.includes('workspaces'), 'Tabel workspaces harus ada di kontrak');
  assert.ok(tables.includes('refresh_tokens'), 'Tabel refresh_tokens harus ada di kontrak');
  assert.ok(tables.includes('oauth_pending_links'), 'Tabel oauth_pending_links harus ada di kontrak');
  assert.ok(tables.includes('module_entitlements'), 'Tabel module_entitlements harus ada di kontrak');

  console.log(`   OK - Ditemukan ${tables.length} tabel dalam kontrak skema.`);

  // 2. Verifikasi status NOT NULL tanpa default
  console.log('2. Memverifikasi kolom NOT NULL tanpa default...');
  // accounts.password_hash harus TIDAK berada di notNullNoDefault (berkat migrasi 011)
  assert.ok(!contract.accounts.notNullNoDefault.has('password_hash'), 'accounts.password_hash harus nullable (bukan NOT NULL tanpa default)');
  assert.ok(contract.accounts.notNullNoDefault.has('email'), 'accounts.email harus NOT NULL tanpa default');

  // workspace_members harus memiliki workspace_id, user_id, role sebagai NOT NULL tanpa default
  assert.ok(contract.workspace_members.notNullNoDefault.has('workspace_id'));
  assert.ok(contract.workspace_members.notNullNoDefault.has('user_id'));
  assert.ok(contract.workspace_members.notNullNoDefault.has('role'));

  // oauth_pending_links
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('token_hash'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('user_id'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('email'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('google_sub'));
  assert.ok(contract.oauth_pending_links.notNullNoDefault.has('expires_at'));

  console.log('   OK - Daftar kolom NOT NULL tanpa default terverifikasi akurat.');

  // 3. Menguji penolakan kolom yang tidak ada dalam skema (a)
  console.log('3. Menguji penolakan kolom yang tidak ada dalam skema...');
  assert.throws(() => {
    validateRowContract('accounts', {
      email: 'test@markimate.id',
      kolom_ngawur_tidak_ada: 'value'
    }, true);
  }, /does not exist in table "accounts"/);
  console.log('   OK - Kolom asing berhasil ditolak.');

  // 4. Menguji penolakan kolom NOT NULL tanpa default yang tidak diisi (b)
  console.log('4. Menguji penolakan insert tanpa kolom NOT NULL tanpa default...');
  assert.throws(() => {
    // Insert accounts tanpa email
    validateRowContract('accounts', {
      brand_name: 'Tanpa Email'
    }, true);
  }, /Column "email" in table "accounts" is NOT NULL/);
  console.log('   OK - Insert tanpa kolom NOT NULL tanpa default berhasil ditolak.');

  // 5. Menguji penolakan nilai non-UUID pada kolom bertipe UUID (c)
  console.log('5. Menguji penolakan nilai non-UUID pada kolom bertipe UUID...');
  assert.throws(() => {
    validateRowContract('workspace_members', {
      workspace_id: 'bukan-uuid-123',
      user_id: randomUUID(),
      role: 'admin'
    }, true);
  }, /Column "workspace_id" in table "workspace_members" is type UUID/);
  console.log('   OK - Nilai non-UUID pada kolom UUID berhasil ditolak.');

  // 6. Menguji penerimaan data valid (termasuk password_hash null pada akun Google baru)
  console.log('6. Menguji penerimaan data valid yang sesuai skema SQL...');
  const validGoogleAccount = {
    email: 'user.google.valid@markimate.id',
    name: 'Google User',
    password_hash: null, // Boleh null berkat migrasi 011
    google_sub: 'google-sub-valid-123',
    status: 'active',
    plan: 'free'
  };
  assert.strictEqual(validateRowContract('accounts', validGoogleAccount, true), true);
  console.log('   OK - Data akun Google dengan password_hash null lolos kontrak skema.');

  // 7. Menguji integrasi dengan JsonStore aktif
  console.log('7. Menguji integrasi validasi kontrak skema pada JsonStore...');
  process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
  const testStore = new JsonStore();

  // 7a. Insert valid ke JsonStore
  const inserted = await testStore.insert('accounts', {
    email: `valid.contract.${Date.now()}@markimate.id`,
    password_hash: null,
    plan: 'free',
    name: 'Valid Schema Account'
  });
  assert.ok(inserted && inserted.id, 'Insert valid ke JsonStore harus berhasil');

  // 7b. Insert tidak valid ke JsonStore (harus melempar error)
  let rejectedError = null;
  try {
    await testStore.insert('accounts', {
      email: `fail.contract.${Date.now()}@markimate.id`,
      kolom_ilegal: 123
    });
  } catch (err) {
    rejectedError = err;
  }
  assert.ok(rejectedError, 'JsonStore harus melempar error saat insert kolom asing');
  assert.ok(rejectedError.message.includes('kolom_ilegal'), 'Pesan error harus menyebutkan kolom_ilegal');
  console.log('   OK - JsonStore menolak insert yang melanggar kontrak skema SQL.');

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH 4 (KONTRAK SKEMA SQL) LULUS 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runSchemaContractTests().catch(err => {
  console.error('\n❌ TEST SCHEMA CONTRACT FAILED:', err);
  process.exit(1);
});
