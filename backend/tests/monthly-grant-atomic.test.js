// Test Mutasi Saldo Wallet Atomik & Lazy Monthly Grant (PRD F15 Langkah 4 & §7)
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
  ensureMonthlyGrant,
  clearCreditCache
} = await import('../lib/credits.js');

async function runAtomicWalletTests() {
  console.log('=== RUNNING TEST ATOMIC WALLET & LAZY MONTHLY GRANTS (PRD F15 §7) ===');
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
  console.log('2. Menguji grant_wallet_atomic (idempotensi dan mutasi konkruen)...');
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

  // 3. Pengujian ensureMonthlyGrant: Lazy, Non-Akumulasi, dan Dua Request Bersamaan
  console.log('3. Menguji ensureMonthlyGrant (lazy grant modul lifetime)...');
  const ws3 = randomUUID();

  // Daftarkan modul lifetime: SEO (100) + Ads Creative Spy (100) = 200 credits
  await db.insert('module_entitlements', {
    workspace_id: ws3,
    module: 'seo',
    source: 'lifetime',
    ends_at: null
  });
  await db.insert('module_entitlements', {
    workspace_id: ws3,
    module: 'ads_spy',
    source: 'lifetime',
    ends_at: null
  });

  const nowOct = new Date('2026-10-21T10:00:00+07:00');

  // Jalankan dua pemanggilan ensureMonthlyGrant bersamaan
  const [grantA, grantB] = await Promise.all([
    ensureMonthlyGrant(ws3, nowOct),
    ensureMonthlyGrant(ws3, nowOct)
  ]);

  let w3 = await getWallet(ws3);
  assert.strictEqual(w3.activeBuckets.sub, 200, 'Saldo bulanan sub harus 200');
  assert.strictEqual(w3.totalBalance, 200);

  // Salah satu granted, salah satu alreadyGranted
  assert.ok(grantA.granted || grantB.granted);
  assert.ok(grantA.alreadyGranted || grantB.alreadyGranted);

  // Verifikasi hanya ada 1 record di monthly_grants untuk periode 2026-10
  const mgRows = await db.findMany('monthly_grants', { workspace_id: ws3, period: '2026-10' });
  assert.strictEqual(mgRows.length, 1, 'Hanya tepat 1 record di monthly_grants');
  assert.strictEqual(mgRows[0].credits, 200);
  console.log('   OK - Dua request konkuren menghasilkan tepat 1 grant bulanan (200 credit).');

  // 4. Pembelian Modul Baru di Tengah Bulan (Upgrade Kuota)
  console.log('4. Menguji pembelian modul baru di tengah bulan (upgrade kuota)...');
  // User membeli modul Ads Report (400 credits) -> total kuota sekarang 100 + 100 + 400 = 600 credits
  await db.insert('module_entitlements', {
    workspace_id: ws3,
    module: 'ads_report',
    source: 'lifetime',
    ends_at: null
  });

  const upgradeRes = await ensureMonthlyGrant(ws3, nowOct);
  assert.strictEqual(upgradeRes.granted, true);
  assert.strictEqual(upgradeRes.upgraded, true);
  assert.strictEqual(upgradeRes.credits, 600);
  assert.strictEqual(upgradeRes.diff, 400);

  w3 = await getWallet(ws3);
  assert.strictEqual(w3.activeBuckets.sub, 600, 'Saldo sub harus bertambah selisih 400 menjadi 600');
  console.log('   OK - Upgrade kuota modul di tengah bulan berhasil ditambahkan selisihnya.');

  // 5. Pergantian Bulan (Simulasi Bulan Berikutnya: Non-Akumulasi / Reset)
  console.log('5. Menguji pergantian bulan (non-akumulasi kuota lintas bulan)...');
  // Misal user memakai 100 kredit di bulan Oktober
  await charge(ws3, 'seo.article', 1, { type: 'kw', id: 'oct-use' }); // -60
  w3 = await getWallet(ws3);
  assert.strictEqual(w3.activeBuckets.sub, 540, 'Sisa saldo sub Oktober adalah 540');

  // Waktu berganti ke November 2026
  const nowNov = new Date('2026-11-01T08:00:00+07:00');
  const novRes = await ensureMonthlyGrant(ws3, nowNov);
  assert.strictEqual(novRes.granted, true);
  assert.strictEqual(novRes.period, '2026-11');
  assert.strictEqual(novRes.credits, 600);

  w3 = await getWallet(ws3);
  // Saldo sub harus di-reset menjadi 600, BUKAN 540 + 600 = 1140!
  assert.strictEqual(w3.activeBuckets.sub, 600, 'Saldo bulanan di bulan baru harus 600 (di-reset, bukan diakumulasi)');
  // 6. Menguji lazy trigger otomatis pada charge() saat saldo belum ter-grant
  console.log('6. Menguji lazy trigger otomatis pada charge() saat saldo belum di-grant...');
  const ws4 = randomUUID();
  await db.insert('module_entitlements', {
    workspace_id: ws4,
    module: 'seo',
    source: 'lifetime',
    ends_at: null
  });
  // Wallet kosong (0 credit)
  await db.insert('credit_wallets', {
    workspace_id: ws4,
    balance_trial: 0,
    balance_sub: 0,
    balance_topup: 0,
    daily_cap: 500
  });

  // Pemanggilan charge langsung: harus memicu ensureMonthlyGrant (dapat 100 credit), lalu memotong 60 credit -> sisa 40
  const lazyChargeRes = await charge(ws4, 'seo.article', 1, { type: 'kw', id: 'lazy-charge-01' });
  assert.strictEqual(lazyChargeRes.charged, 60, 'Charge harus berhasil memotong 60 credit setelah lazy grant');
  const w4 = await getWallet(ws4);
  assert.strictEqual(w4.activeBuckets.sub, 40, 'Sisa saldo sub setelah lazy grant (100) dan charge (60) harus 40');
  console.log('   OK - charge() berhasil memicu ensureMonthlyGrant secara transparan dan otomatis.');

  console.log('✅ ALL ATOMIC WALLET & LAZY MONTHLY GRANTS TESTS PASSED!');
}

runAtomicWalletTests().catch(err => {
  console.error('❌ Test atomic wallet failed:', err);
  process.exit(1);
});
