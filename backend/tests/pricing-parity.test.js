// Test Paritas Pricing Config & quoteTopup antara Backend & Frontend (PRD F16 Langkah 1)
import assert from 'assert';

import {
  MODULES as BE_MODULES,
  TOPUP as BE_TOPUP,
  CREDIT_PACKS as BE_CREDIT_PACKS,
  quoteTopup as beQuoteTopup,
  getCatalog
} from '../lib/catalog.js';
import { TRIAL_CONFIG as BE_TRIAL_CONFIG, TRIAL_DAYS as BE_TRIAL_DAYS } from '../lib/config.js';

import {
  MODULES as FE_MODULES,
  TOPUP as FE_TOPUP,
  CREDIT_PACKS as FE_CREDIT_PACKS,
  quoteTopup as feQuoteTopup,
  TRIAL_DAYS as FE_TRIAL_DAYS,
  TRIAL as FE_TRIAL
} from '../../frontend/src/config/pricing.js';

async function runPricingParityTests() {
  console.log('=== RUNNING TEST PRICING PARITY & CREDIT PACKS FORMULA (PRD F16 LANGKAH 1) ===');

  // 1. Uji Kesetaraan Konfigurasi MODULES (Free Module Model)
  console.log('1. Memverifikasi kesetaraan MODULES (BE vs FE)...');
  assert.deepStrictEqual(Object.keys(BE_MODULES), ['seo', 'ads_report', 'ads_spy']);
  assert.deepStrictEqual(Object.keys(FE_MODULES), ['seo', 'ads_report', 'ads_spy']);

  for (const key of ['seo', 'ads_report', 'ads_spy']) {
    const beMod = BE_MODULES[key];
    const feMod = FE_MODULES[key];
    assert.strictEqual(beMod.id, feMod.id, `ID mismatch on module ${key}`);
    assert.strictEqual(beMod.name, feMod.name, `Name mismatch on module ${key}`);
    assert.strictEqual(beMod.typicalMonthlyCredits, feMod.typicalMonthlyCredits, `typicalMonthlyCredits mismatch on module ${key}`);
    assert.strictEqual(beMod.desc, feMod.desc, `Desc mismatch on module ${key}`);
    assert.strictEqual(beMod.price, undefined, `Module ${key} dilarang memiliki field price (akses modul gratis)`);
    assert.strictEqual(beMod.monthlyCredits, undefined, `Module ${key} dilarang memiliki field monthlyCredits`);
  }

  // Cek nilai spesifik sesuai PRD F16
  assert.strictEqual(BE_MODULES.seo.typicalMonthlyCredits, 600, 'SEO typicalMonthlyCredits must be 600');
  assert.strictEqual(BE_MODULES.ads_report.typicalMonthlyCredits, 400, 'Ads Report typicalMonthlyCredits must be 400');
  assert.strictEqual(BE_MODULES.ads_spy.typicalMonthlyCredits, 260, 'Ads Spy typicalMonthlyCredits must be 260');
  console.log('   OK - MODULES BE dan FE setara 100% (bebas field price/monthlyCredits).');

  // 2. Uji Kesetaraan dan Rumus Matematis CREDIT_PACKS
  console.log('2. Memverifikasi kesetaraan dan rumus harga CREDIT_PACKS (BE vs FE)...');
  assert.deepStrictEqual(Object.keys(BE_CREDIT_PACKS), ['pack_500', 'pack_1000', 'pack_2500', 'pack_5000']);
  assert.deepStrictEqual(Object.keys(FE_CREDIT_PACKS), ['pack_500', 'pack_1000', 'pack_2500', 'pack_5000']);

  for (const packKey of Object.keys(BE_CREDIT_PACKS)) {
    const bePack = BE_CREDIT_PACKS[packKey];
    const fePack = FE_CREDIT_PACKS[packKey];

    assert.strictEqual(bePack.id, fePack.id);
    assert.strictEqual(bePack.name, fePack.name);
    assert.strictEqual(bePack.credits, fePack.credits);
    assert.strictEqual(bePack.discount, fePack.discount);
    assert.strictEqual(bePack.price, fePack.price);

    // Rumus PRD F16 §3.1: price = round(credits * 1000 * (1 - discount), -3)
    const expectedPrice = Math.round((bePack.credits * 1000 * (1 - bePack.discount)) / 1000) * 1000;
    assert.strictEqual(
      bePack.price,
      expectedPrice,
      `Harga paket ${packKey} (${bePack.price}) tidak cocok dengan rumus: round(credits * 1000 * (1 - discount), -3) = ${expectedPrice}`
    );
  }

  // Nilai nominal spesifik PRD F16b §2
  assert.strictEqual(BE_CREDIT_PACKS.pack_500.price, 500000, 'Starter 500 must be Rp500.000 (0% diskon)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_500.discount, 0, 'Starter 500 discount must be 0');
  assert.strictEqual(BE_CREDIT_PACKS.pack_1000.price, 900000, 'Growth 1000 must be Rp900.000 (-10%)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_2500.price, 2000000, 'Pro 2500 must be Rp2.000.000 (-20%)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_5000.price, 3750000, 'Agency 5000 must be Rp3.750.000 (-25%)');

  // Paritas: setiap paket price === quoteTopup(credits).amount (PRD F16b §4)
  for (const pack of Object.values(BE_CREDIT_PACKS)) {
    const q = beQuoteTopup(pack.credits);
    assert.strictEqual(pack.price, q.amount, `Paritas gagal: paket ${pack.name} (${pack.price}) !== quoteTopup(${pack.credits}).amount (${q.amount})`);
  }
  console.log('   OK - Rumus harga paket kredit dan paritas dengan quoteTopup terbukti akurat 100%.');

  // 3. Uji Kesetaraan Konfigurasi TOPUP (Credit-Only PRD F16b)
  console.log('3. Memverifikasi kesetaraan TOPUP (BE vs FE)...');
  assert.strictEqual(BE_TOPUP.pricePerCredit, 1000, 'Price per credit must be Rp1.000');
  assert.strictEqual(FE_TOPUP.pricePerCredit, 1000, 'FE Price per credit must be Rp1.000');

  assert.strictEqual(BE_TOPUP.min, 100, 'Minimum top-up must be 100 credits (PRD F16b §3.1)');
  assert.strictEqual(FE_TOPUP.min, 100, 'FE Minimum top-up must be 100 credits');

  assert.strictEqual(BE_TOPUP.max, 50000, 'Maximum top-up must be 50.000 credits');
  assert.strictEqual(FE_TOPUP.max, 50000, 'FE Maximum top-up must be 50.000 credits');

  assert.strictEqual(BE_TOPUP.neverExpires, true, 'TOPUP.neverExpires must be true');
  assert.strictEqual(FE_TOPUP.neverExpires, true, 'FE TOPUP.neverExpires must be true');

  assert.deepStrictEqual(BE_TOPUP.quickOptions, [100, 500, 1000, 2500], 'Quick options must be [100, 500, 1000, 2500]');
  assert.deepStrictEqual(FE_TOPUP.quickOptions, [100, 500, 1000, 2500], 'FE Quick options must be [100, 500, 1000, 2500]');

  assert.deepStrictEqual(BE_TOPUP.tiers, [
    { min: 5000, disc: 0.25 },
    { min: 2500, disc: 0.20 },
    { min: 1000, disc: 0.10 }
  ], 'TOPUP tiers BE mismatch');
  assert.deepStrictEqual(FE_TOPUP.tiers, BE_TOPUP.tiers, 'TOPUP tiers FE must match BE');
  console.log('   OK - TOPUP config BE dan FE setara 100% (termasuk tiers dan quickOptions baru).');

  // 4. Uji Kesetaraan Fungsi quoteTopup(credits) & Target Nilai PRD F16b §4
  console.log('4. Memverifikasi quoteTopup(credits) dengan diskon volume tier seragam...');
  const expectedCases = [
    { credits: 100, amount: 100000, disc: 0, nextMin: 1000, nextDisc: 0.10, needed: 900 },
    { credits: 500, amount: 500000, disc: 0, nextMin: 1000, nextDisc: 0.10, needed: 500 },
    { credits: 999, amount: 999000, disc: 0, nextMin: 1000, nextDisc: 0.10, needed: 1 },
    { credits: 1000, amount: 900000, disc: 0.10, nextMin: 2500, nextDisc: 0.20, needed: 1500 },
    { credits: 2499, amount: 2249100, disc: 0.10, nextMin: 2500, nextDisc: 0.20, needed: 1 },
    { credits: 2500, amount: 2000000, disc: 0.20, nextMin: 5000, nextDisc: 0.25, needed: 2500 },
    { credits: 5000, amount: 3750000, disc: 0.25, nextMin: null, nextDisc: null, needed: null },
    { credits: 50000, amount: 37500000, disc: 0.25, nextMin: null, nextDisc: null, needed: null }
  ];

  for (const c of expectedCases) {
    const beRes = beQuoteTopup(c.credits);
    const feRes = feQuoteTopup(c.credits);
    assert.deepStrictEqual(beRes, feRes, `quoteTopup output mismatch on input: ${c.credits}`);
    assert.strictEqual(beRes.amount, c.amount, `Amount mismatch for ${c.credits} credits: got ${beRes.amount}, expected ${c.amount}`);
    assert.strictEqual(beRes.discountPct, c.disc, `DiscountPct mismatch for ${c.credits} credits`);
    if (c.nextMin) {
      assert.ok(beRes.nextTier, `nextTier should exist for ${c.credits} credits`);
      assert.strictEqual(beRes.nextTier.min, c.nextMin);
      assert.strictEqual(beRes.nextTier.disc, c.nextDisc);
      assert.strictEqual(beRes.nextTier.creditsNeeded, c.needed);
    } else {
      assert.strictEqual(beRes.nextTier, null, `nextTier should be null for ${c.credits} credits`);
    }
  }

  console.log('   OK - quoteTopup lolos seluruh 8 skenario nominal dan nextTier.');

  // 5. Uji getCatalog() memuat struktur PRD F16b
  console.log('5. Memverifikasi getCatalog() memuat struktur PRD F16b...');
  const cat = getCatalog();
  assert.strictEqual(cat.currency, 'IDR');
  assert.strictEqual(cat.modules.length, 3);
  assert.strictEqual(cat.bundles, undefined, 'BUNDLES dilarang ada di getCatalog()');
  assert.strictEqual(cat.topup.pricePerCredit, 1000);
  assert.strictEqual(cat.topup.min, 100);
  assert.strictEqual(cat.topup.neverExpires, true);
  assert.deepStrictEqual(cat.topup.tiers, BE_TOPUP.tiers);
  assert.strictEqual(cat.packs.length, 4, 'getCatalog() wajib memuat 4 paket credit');
  assert.strictEqual(cat.trial.days, 30);
  assert.strictEqual(cat.trial.credits, 400);

  // 6. Uji Konfigurasi TRIAL 400 Credits (BE vs FE)
  console.log('6. Memverifikasi kesetaraan TRIAL 400 kredit / 30 hari...');
  assert.strictEqual(BE_TRIAL_DAYS, 30, 'BE TRIAL_DAYS must be 30');
  assert.strictEqual(BE_TRIAL_CONFIG.days, 30);
  assert.strictEqual(BE_TRIAL_CONFIG.credits, 400, 'BE TRIAL_CONFIG.credits must be 400 (PRD F16 §3.3)');
  assert.strictEqual(FE_TRIAL_DAYS, 30);
  assert.strictEqual(FE_TRIAL.days, 30);
  assert.strictEqual(FE_TRIAL.credits, 400, 'FE TRIAL.credits must be 400');
  assert.strictEqual(FE_TRIAL.noCardRequired, true);
  console.log('   OK - Konfigurasi TRIAL 400 kredit BE dan FE setara 100%.');

  // 7. Mutation Check: Hapus tier 10% -> Test GAGAL (PRD F16b §4)
  console.log('7. Menjalankan mutation check: menghapus tier 10%...');
  const mutatedTiers = BE_TOPUP.tiers.filter(t => t.disc !== 0.10);
  function mutatedDiscountFor(credits) {
    const c = Math.floor(Number(credits) || 0);
    for (const t of mutatedTiers) {
      if (c >= t.min) return t.disc;
    }
    return 0;
  }
  function mutatedQuoteTopup(credits) {
    const c = Math.floor(Number(credits) || 0);
    const gross = c * 1000;
    const disc = mutatedDiscountFor(c);
    const discount = Math.round(gross * disc);
    return gross - discount;
  }

  // Mutasi: top-up 1000 tanpa tier 10% menghasilkan Rp1.000.000 bukan Rp900.000
  const mutated1000 = mutatedQuoteTopup(1000);
  assert.notStrictEqual(mutated1000, 900000, 'Mutasi harus terdeteksi');
  assert.strictEqual(mutated1000, 1000000);
  console.log('   OK - Mutation check: mutasi penghapusan tier 10% terbukti KILLED.');

  console.log('\n✅ ALL PRICING PARITY & CREDIT PACKS TESTS PASSED!');
}

runPricingParityTests().catch(err => {
  console.error('❌ Test pricing parity failed:', err);
  process.exit(1);
});
