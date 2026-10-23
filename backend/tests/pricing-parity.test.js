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

  // Nilai nominal spesifik PRD F16 §3.2
  assert.strictEqual(BE_CREDIT_PACKS.pack_500.price, 475000, 'Starter 500 must be Rp475.000 (-5%)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_1000.price, 900000, 'Growth 1000 must be Rp900.000 (-10%)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_2500.price, 2000000, 'Pro 2500 must be Rp2.000.000 (-20%)');
  assert.strictEqual(BE_CREDIT_PACKS.pack_5000.price, 3750000, 'Agency 5000 must be Rp3.750.000 (-25%)');
  console.log('   OK - Rumus harga paket kredit terbukti akurat 100%.');

  // 3. Uji Kesetaraan Konfigurasi TOPUP (Credit-Only PRD F16)
  console.log('3. Memverifikasi kesetaraan TOPUP (BE vs FE)...');
  assert.strictEqual(BE_TOPUP.pricePerCredit, 1000, 'Price per credit must be Rp1.000');
  assert.strictEqual(FE_TOPUP.pricePerCredit, 1000, 'FE Price per credit must be Rp1.000');

  assert.strictEqual(BE_TOPUP.min, 100, 'Minimum top-up must be 100 credits (PRD F16 §3.1)');
  assert.strictEqual(FE_TOPUP.min, 100, 'FE Minimum top-up must be 100 credits');

  assert.strictEqual(BE_TOPUP.max, 50000, 'Maximum top-up must be 50.000 credits');
  assert.strictEqual(FE_TOPUP.max, 50000, 'FE Maximum top-up must be 50.000 credits');

  assert.strictEqual(BE_TOPUP.neverExpires, true, 'TOPUP.neverExpires must be true');
  assert.strictEqual(FE_TOPUP.neverExpires, true, 'FE TOPUP.neverExpires must be true');

  assert.deepStrictEqual(BE_TOPUP.quickOptions, [100, 250, 500]);
  assert.deepStrictEqual(FE_TOPUP.quickOptions, [100, 250, 500]);

  assert.strictEqual(BE_TOPUP.tiers, undefined, 'TOPUP tiers discount must be removed');
  console.log('   OK - TOPUP config BE dan FE setara 100%.');

  // 4. Uji Kesetaraan Fungsi quoteTopup(credits) (Tanpa Diskon Tier)
  console.log('4. Memverifikasi quoteTopup(credits) tanpa diskon tier...');
  const testAmounts = [
    0, 50, 99, 100, 250, 500, 750, 999, 1000, 1500, 2500, 5000, 50000, '100', '1000'
  ];

  for (const input of testAmounts) {
    const beResult = beQuoteTopup(input);
    const feResult = feQuoteTopup(input);
    assert.deepStrictEqual(beResult, feResult, `quoteTopup output mismatch on input: ${input}`);
    assert.strictEqual(beResult.discountPct, 0, 'Diskon tier pada topup custom harus 0% (PRD F16 §3.1)');
    const expectedAmount = Math.floor(Number(input) || 0) * 1000;
    assert.strictEqual(beResult.amount, expectedAmount);
  }

  console.log('   OK - quoteTopup tanpa diskon tier terverifikasi akurat.');

  // 5. Uji getCatalog() memuat struktur PRD F16
  console.log('5. Memverifikasi getCatalog() memuat struktur PRD F16...');
  const cat = getCatalog();
  assert.strictEqual(cat.currency, 'IDR');
  assert.strictEqual(cat.modules.length, 3);
  assert.strictEqual(cat.bundles, undefined, 'BUNDLES dilarang ada di getCatalog()');
  assert.strictEqual(cat.topup.pricePerCredit, 1000);
  assert.strictEqual(cat.topup.min, 100);
  assert.strictEqual(cat.topup.neverExpires, true);
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

  console.log('\n✅ ALL PRICING PARITY & CREDIT PACKS TESTS PASSED!');
}

runPricingParityTests().catch(err => {
  console.error('❌ Test pricing parity failed:', err);
  process.exit(1);
});
