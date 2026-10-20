import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { db, TABLES } from '../db.js';
import { PLANS } from '../lib/plans.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runStep1Tests() {
  console.log('=== RUNNING TEST STEP 1 (Database Migration & DB Methods) ===');

  // 1. Verifikasi File Migrasi SQL 009
  const sqlPath = path.join(__dirname, '../migrations/009_auth_workspace.sql');
  assert.ok(fs.existsSync(sqlPath), 'File 009_auth_workspace.sql harus ada');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(sqlContent.includes('markimate.schema_migrations'), 'Harus menyertakan markimate.schema_migrations');
  assert.ok(sqlContent.includes('markimate.workspaces'), 'Harus menyertakan markimate.workspaces');
  assert.ok(sqlContent.includes('markimate.workspace_members'), 'Harus menyertakan markimate.workspace_members');
  assert.ok(sqlContent.includes('markimate.module_entitlements'), 'Harus menyertakan markimate.module_entitlements');
  assert.ok(sqlContent.includes('markimate.hit_rate_limit'), 'Harus menyertakan fungsi hit_rate_limit');
  console.log('✓ 1. File migrasi backend/migrations/009_auth_workspace.sql valid dan lengkap');

  // 2. Verifikasi TABLES di db.js
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
  console.log('✓ 2. Semua tabel baru terdaftar di db.js dan dapat di-query');

  // 3. Verifikasi db.rpc('hit_rate_limit')
  const testKey = 'test-ip-step1-' + Date.now();
  // Limit 3 hit per 5 detik
  const hit1 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit1, true, 'Hit 1 harus true');
  const hit2 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit2, true, 'Hit 2 harus true');
  const hit3 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit3, true, 'Hit 3 harus true');
  const hit4 = await db.rpc('hit_rate_limit', { p_key: testKey, p_window_seconds: 5, p_max: 3 });
  assert.strictEqual(hit4, false, 'Hit 4 harus false (melebihi batas max 3)');
  console.log('✓ 3. db.rpc("hit_rate_limit") berfungsi secara akurat');

  // 4. Verifikasi PLANS memiliki field modules
  for (const [planId, planObj] of Object.entries(PLANS)) {
    assert.ok(Array.isArray(planObj.modules), `Plan '${planId}' harus memiliki array modules`);
    assert.ok(planObj.modules.length > 0, `Plan '${planId}' modules tidak boleh kosong`);
  }
  assert.deepStrictEqual(PLANS.free.modules, ['seo']);
  assert.deepStrictEqual(PLANS.seo.modules, ['seo']);
  assert.deepStrictEqual(PLANS.ads_report.modules, ['ads_report']);
  assert.deepStrictEqual(PLANS.ads_spy.modules, ['ads_spy']);
  assert.deepStrictEqual(PLANS.focus3.modules, ['seo', 'ads_report', 'ads_spy']);
  assert.deepStrictEqual(PLANS.all_in_one.modules, ['seo', 'ads_report', 'ads_spy']);
  console.log('✓ 4. PLANS.modules terdefinisi dengan tepat di backend/lib/plans.js');

  // 5. Verifikasi Operasi CRUD pada Tabel Baru
  const testWsId = randomUUID();
  const testUserId = randomUUID();

  const ws = await db.insert('workspaces', {
    id: testWsId,
    name: 'Workspace Uji',
    owner_user_id: testUserId
  });
  assert.strictEqual(ws.id, testWsId);

  const member = await db.insert('workspace_members', {
    workspace_id: testWsId,
    user_id: testUserId,
    role: 'owner'
  });
  assert.strictEqual(member.role, 'owner');

  const entitlement = await db.insert('module_entitlements', {
    workspace_id: testWsId,
    module: 'seo',
    active: true,
    source: 'trial'
  });
  assert.strictEqual(entitlement.module, 'seo');

  // Cleanup test records
  await db.remove('module_entitlements', { workspace_id: testWsId });
  await db.remove('workspace_members', { workspace_id: testWsId });
  await db.remove('workspaces', { id: testWsId });
  await db.remove('rate_limits', { key: testKey });

  console.log('✓ 5. Operasi CRUD pada tabel workspaces, workspace_members, & module_entitlements terverifikasi');

  console.log('--- SEMUA PENGUJIAN LANGKAH 1 BERHASIL ---');
}

runStep1Tests().catch(err => {
  console.error('Test Step 1 Failed:', err);
  process.exit(1);
});
