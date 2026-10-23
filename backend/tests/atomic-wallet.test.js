// Test Mutasi Saldo Wallet Atomik (PRD F15 Langkah 4 & PRD F16 §3.5)
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
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-atomic-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], monthly_grants: [], payments: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const {
  getWallet,
  charge,
  grant,
  clearCreditCache
} = await import('../lib/credits.js');

async function runAtomicWalletTests() {
  console.log('=== RUNNING TEST ATOMIC WALLET (PRD F16 §3.5) ===');
  clearCreditCache();
  await seedCreditPricesAndRates();

  // 1. Pengujian charge_wallet_atomic: Mencegah Race Condition Double Spending
  console.log('1. Menguji charge_wallet_atomic (mencegah double-spending pada request konkuren)...');
  const ws1 = randomUUID();
  const exp30 = new Date(Date.now() + 30 * 86400e3);
  await grant(ws1, 'topup', 100, exp30, 'topup', 'Topup 100 credits');

  let w1 = await getWallet(ws1);
  assert.strictEqual(w1.totalBalance, 100, 'Saldo awal harus 100');

  // Jalankan dua request pemotongan 60 secara bersamaan (keduanya butuh 60, total butuh 120 > 100)
  const refA = { type: 'run', id: 'run-a-' + randomUUID() };
  const refB = { type: 'run', id: 'run-b-' + randomUUID() };

  const [resA, resB] = await Promise.allSettled([
    charge(ws1, 'seo.article', 1, refA),
    charge(ws1, 'seo.article', 1, refB)
  ]);

  const fulfilled = [resA, resB].filter(r => r.status === 'fulfilled');
  const rejected = [resA, resB].filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1, 'Tepat satu pemotongan yang boleh berhasil');
  assert.strictEqual(rejected.length, 1, 'Pemotongan kedua harus gagal karena saldo tidak cukup');
  assert.strictEqual(rejected[0].reason.code, 'INSUFFICIENT_CREDITS');

  w1 = await getWallet(ws1);
  assert.strictEqual(w1.totalBalance, 40, 'Saldo akhir harus tepat 40 (100 - 60)');
  console.log('   OK - Double-spending berhasil dicegah 100% secara atomik.');

  // 2. Pengujian grant_wallet_atomic: Penambahan Bersamaan & Idempotensi
  console.log('2. Menguji grant_wallet_atomic (idempotensi dan mutasi konkuren)...');
  const ws2 = randomUUID();
  const grantRefSame = { refId: 'grant-atomic-' + randomUUID() };

  const [grantRes1, grantRes2] = await Promise.all([
    grant(ws2, 'topup', 50, exp30, 'topup', 'Grant retry 1', grantRefSame),
    grant(ws2, 'topup', 50, exp30, 'topup', 'Grant retry 2', grantRefSame)
  ]);

  let w2 = await getWallet(ws2);
  assert.strictEqual(w2.totalBalance, 50, 'Saldo hanya boleh bertambah 50 untuk refId yang sama');
  assert.ok(grantRes1.idempotent || grantRes2.idempotent, 'Salah satu grant harus mengembalikan flag idempotent');

  // Grant dengan refId berbeda secara bersamaan
  await Promise.all([
    grant(ws2, 'topup', 50, exp30, 'topup', 'Grant diff 1', { refId: randomUUID() }),
    grant(ws2, 'topup', 50, exp30, 'topup', 'Grant diff 2', { refId: randomUUID() })
  ]);
  w2 = await getWallet(ws2);
  assert.strictEqual(w2.totalBalance, 150, 'Saldo harus bertambah 100 menjadi 150');
  console.log('   OK - grant_wallet_atomic terbukti aman secara konkuren dan idempoten.');

  console.log('✅ ALL ATOMIC WALLET TESTS PASSED!');
}

runAtomicWalletTests().catch(err => {
  console.error('❌ Test atomic wallet failed:', err);
  process.exit(1);
});
