// Unit test untuk sistem Credit & Free Trial Markimate (Langkah 1 PRD)
import assert from 'assert';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';
import {
  getWallet,
  estimate,
  assertAffordable,
  charge,
  recordFailedUsage,
  grant,
  expireBuckets,
  costOf,
  clearCreditCache
} from '../lib/credits.js';

async function runTests() {
  console.log('--- [TEST] Memulai Unit Test Credits ---');
  clearCreditCache();

  // 1. Seed data
  await seedCreditPricesAndRates();

  // 2. Test Estimasi
  const estArticle = await estimate('seo.article', 1);
  assert.strictEqual(estArticle.credits, 60, 'Harga seo.article harus 60');

  const estArticleWithImages = await estimate('seo.article', 1, { images: 3 });
  assert.strictEqual(estArticleWithImages.credits, 75, 'seo.article + 3 gambar harus 60 + 15 = 75');

  const estTopics = await estimate('seo.topics_run', 1);
  assert.strictEqual(estTopics.credits, 10, 'seo.topics_run harus 10');

  console.log('✅ 1. Estimasi harga credit sesuai spesifikasi');

  // 3. Test Cost Of (biaya aktual API vendor)
  const sampleUsage = {
    geminiIn: 2000,
    geminiOut: 1000,
    images: 3,
    serpCalls: 5,
    rapidCalls: 4
  };
  const cost = await costOf(sampleUsage);
  assert(cost > 0, 'Cost of usage harus bernilai positif');
  console.log(`✅ 2. Perhitungan biaya nyata API (COGS): Rp${cost} untuk sample usage`);

  // 4. Test Wallet & Grant
  const testWorkspaceId = randomUUID();
  const initialWallet = await getWallet(testWorkspaceId);
  assert.strictEqual(initialWallet.totalBalance, 0, 'Saldo awal harus 0');

  // Grant Trial 300 (berlaku 7 hari)
  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await grant(testWorkspaceId, 'trial', 300, in7Days, 'grant_trial', 'Free trial 7 hari');
  let w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 300, 'Saldo trial harus 300');
  assert.strictEqual(w.activeBuckets.trial, 300);

  console.log('✅ 3. Wallet dan grant trial 300 credit berhasil');

  // 5. Test Charge Artikel (60 credit)
  const refArticle = { type: 'keyword', id: 'kw-101', note: 'Generate artikel 1' };
  const chargeRes1 = await charge(testWorkspaceId, 'seo.article', 1, refArticle, {
    geminiIn: 1500,
    geminiOut: 800,
    images: 0,
    serpCalls: 3,
    rapidCalls: 2
  });
  assert.strictEqual(chargeRes1.charged, 60);
  assert.strictEqual(chargeRes1.balanceAfter, 240);
  assert.strictEqual(chargeRes1.ledgerRows.length, 1);
  assert.strictEqual(chargeRes1.ledgerRows[0].bucket, 'trial');
  assert.strictEqual(chargeRes1.ledgerRows[0].delta, -60);
  assert(chargeRes1.costActualIdr > 0, 'Cost actual IDR harus tercatat');

  console.log('✅ 4. Pemotongan artikel -60 berhasil, sisa saldo 240, biaya nyata tercatat');

  // 6. Test Idempoten: Charge ulang dengan ref yang sama
  const chargeResIdempotent = await charge(testWorkspaceId, 'seo.article', 1, refArticle);
  assert.strictEqual(chargeResIdempotent.charged, 0);
  assert.strictEqual(chargeResIdempotent.idempotent, true, 'Harus terdeteksi sebagai idempoten');
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 240, 'Saldo tidak boleh terpotong dua kali untuk ref sama');

  console.log('✅ 5. Idempotensi terverifikasi (retry dengan ref yang sama tidak memotong credit)');

  // 7. Test Bucket Order Deduction (trial -> sub -> topup)
  // Saat ini trial punya 240. Tambahkan sub 100 dan topup 50.
  const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const in365Days = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  await grant(testWorkspaceId, 'sub', 100, in30Days, 'grant_sub', 'Paket bulanan');
  await grant(testWorkspaceId, 'topup', 50, in365Days, 'topup', 'Topup tambahan');
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.totalBalance, 390, 'Saldo total harus 240 + 100 + 50 = 390');

  // Potong 260 credit: harus menghabiskan trial (240) dan mengambil 20 dari sub (sisa sub = 80). Topup tetap 50.
  const refCrossBucket = { type: 'ads_report', id: 'rep-201' };
  // ads.report unit price = 400, kita simulasikan actionKey lain atau custom qty
  // Gunakan actionKey 'ads.report_rerun' (100) x 2.6 atau 'seo.article' 4 qty (240) + 'seo.topics_run' (20)
  // Mari coba charge 'seo.article' (60) x 4 = 240
  await charge(testWorkspaceId, 'seo.article', 4, { type: 'batch', id: 'b1' });
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.activeBuckets.trial, 0, 'Bucket trial harus habis (0)');
  assert.strictEqual(w.activeBuckets.sub, 100, 'Bucket sub masih utuh 100');

  // Charge 120 credit: 100 dari sub (habis), 20 dari topup (sisa 30)
  // 'seo.article' 2 qty = 120
  await charge(testWorkspaceId, 'seo.article', 2, { type: 'batch', id: 'b2' });
  w = await getWallet(testWorkspaceId);
  assert.strictEqual(w.activeBuckets.sub, 0, 'Bucket sub harus habis (0)');
  assert.strictEqual(w.activeBuckets.topup, 30, 'Bucket topup harus tersisa 30 (50 - 20)');
  assert.strictEqual(w.totalBalance, 30, 'Saldo total harus tersisa 30');

  console.log('✅ 6. Urutan pemotongan bucket (trial -> sub -> topup) bekerja sempurna');

  // 8. Test Insufficient Credits (402)
  let insufficientCaught = false;
  try {
    await charge(testWorkspaceId, 'seo.article', 1, { type: 'batch', id: 'b3' }); // butuh 60, ada 30
  } catch (err) {
    insufficientCaught = true;
    assert.strictEqual(err.status, 402);
    assert.strictEqual(err.code, 'INSUFFICIENT_CREDITS');
    assert.strictEqual(err.need, 60);
    assert.strictEqual(err.have, 30);
  }
  assert.strictEqual(insufficientCaught, true, 'Harus melempar error 402 INSUFFICIENT_CREDITS');
  console.log('✅ 7. Penolakan 402 INSUFFICIENT_CREDITS terverifikasi');

  // 9. Test Daily Cap (500 credit/hari)
  // Berikan topup 600
  await grant(testWorkspaceId, 'topup', 600, in365Days, 'topup', 'Topup besar');
  // Hari ini sudah terpakai: 60 + 240 + 120 = 420.
  // Jika kita charge 100 lagi (total 520 > 500 cap):
  let dailyCapCaught = false;
  try {
    await charge(testWorkspaceId, 'ads.report_rerun', 1, { type: 'batch', id: 'b4' }); // butuh 100, 420 + 100 = 520 > 500
  } catch (err) {
    dailyCapCaught = true;
    assert.strictEqual(err.status, 402);
    assert.strictEqual(err.code, 'DAILY_CAP');
    assert.strictEqual(err.need, 100);
    assert.strictEqual(err.dailyCap, 500);
  }
  assert.strictEqual(dailyCapCaught, true, 'Harus melempar error 402 DAILY_CAP saat batas harian terlampaui');
  console.log('✅ 8. Batas harian 500 credit/hari (anti-loop) terverifikasi');

  // 10. Test Record Failed Usage (delta = 0, cost_actual_idr > 0)
  const failedUsage = { geminiIn: 1000, geminiOut: 500 };
  const failedRow = await recordFailedUsage(testWorkspaceId, 'seo.article', failedUsage, {
    type: 'keyword',
    id: 'kw-failed',
    note: 'Gagal karena duplicate 409'
  });
  assert.strictEqual(failedRow.delta, 0, 'Delta harus 0 untuk aksi gagal');
  assert.strictEqual(failedRow.kind, 'usage_failed');
  assert(failedRow.cost_actual_idr > 0, 'Biaya nyata harus tetap tercatat');
  console.log('✅ 9. Pencatatan aksi gagal / 409 (delta 0, biaya nyata tercatat) terverifikasi');

  // 11. Test Expire Buckets
  const expiredWorkspaceId = randomUUID();
  const pastDate = new Date(Date.now() - 1000); // 1 detik lalu
  await grant(expiredWorkspaceId, 'trial', 150, pastDate, 'grant_trial', 'Trial kedaluwarsa');
  let expW = await getWallet(expiredWorkspaceId);
  assert.strictEqual(expW.totalBalance, 0, 'Saldo trial kedaluwarsa harus otomatis dinolkan');
  assert.strictEqual(expW.wallet.balance_trial, 0);

  const expLedger = await db.findMany('credit_ledger', { workspace_id: expiredWorkspaceId, kind: 'expire' });
  assert.strictEqual(expLedger.length, 1, 'Harus ada pencatatan expire di ledger');
  assert.strictEqual(expLedger[0].delta, -150);
  console.log('✅ 10. Pengosongan bucket kedaluwarsa dan pencatatan expire ledger terverifikasi');

  // Bersihkan data tes
  await db.remove('credit_wallets', { workspace_id: testWorkspaceId });
  await db.remove('credit_ledger', { workspace_id: testWorkspaceId });
  await db.remove('credit_wallets', { workspace_id: expiredWorkspaceId });
  await db.remove('credit_ledger', { workspace_id: expiredWorkspaceId });

  console.log('--- SEMUA PENGUJIAN LANGKAH 1 BERHASIL (10/10) ---');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Gagal:', err);
    process.exit(1);
  });
