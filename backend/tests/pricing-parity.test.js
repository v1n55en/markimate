// Test Paritas Pricing Config & quoteTopup antara Backend & Frontend (PRD F15 Langkah 1)
import assert from 'assert';

import {
  MODULES as BE_MODULES,
  BUNDLES as BE_BUNDLES,
  TOPUP as BE_TOPUP,
  quoteTopup as beQuoteTopup,
  getCatalog
} from '../lib/catalog.js';
import { TRIAL_DAYS as BE_TRIAL_DAYS } from '../lib/config.js';

import {
  MODULES as FE_MODULES,
  LIFETIME_BUNDLES as FE_LIFETIME_BUNDLES,
  BUNDLES as FE_BUNDLES,
  TOPUP as FE_TOPUP,
  quoteTopup as feQuoteTopup,
  TRIAL_DAYS as FE_TRIAL_DAYS,
  TRIAL as FE_TRIAL
} from '../../frontend/src/config/pricing.js';

async function runPricingParityTests() {
  console.log('=== RUNNING TEST PRICING PARITY (BE vs FE, PRD F15) ===');

  // 1. Uji Kesetaraan Konfigurasi MODULES
  console.log('1. Memverifikasi kesetaraan MODULES (BE vs FE)...');
  assert.deepStrictEqual(Object.keys(BE_MODULES), ['seo', 'ads_report', 'ads_spy']);
  assert.deepStrictEqual(Object.keys(FE_MODULES), ['seo', 'ads_report', 'ads_spy']);

  for (const key of ['seo', 'ads_report', 'ads_spy']) {
    const beMod = BE_MODULES[key];
    const feMod = FE_MODULES[key];
    assert.strictEqual(beMod.id, feMod.id, `ID mismatch on module ${key}`);
    assert.strictEqual(beMod.name, feMod.name, `Name mismatch on module ${key}`);
    assert.strictEqual(beMod.price, feMod.price, `Price mismatch on module ${key}`);
    assert.strictEqual(beMod.monthlyCredits, feMod.monthlyCredits, `monthlyCredits mismatch on module ${key}`);
    assert.strictEqual(beMod.desc, feMod.desc, `Desc mismatch on module ${key}`);
  }

  // Cek nilai spesifik sesuai PRD F15
  assert.strictEqual(BE_MODULES.seo.price, 1990000, 'SEO price must be Rp1.990.000');
  assert.strictEqual(BE_MODULES.seo.monthlyCredits, 100, 'SEO monthly credits must be 100');

  assert.strictEqual(BE_MODULES.ads_report.price, 1990000, 'Ads Report price must be Rp1.990.000');
  assert.strictEqual(BE_MODULES.ads_report.monthlyCredits, 400, 'Ads Report monthly credits must be 400');

  assert.strictEqual(BE_MODULES.ads_spy.price, 1490000, 'Ads Spy price must be Rp1.490.000');
  assert.strictEqual(BE_MODULES.ads_spy.monthlyCredits, 100, 'Ads Spy monthly credits must be 100');
  console.log('   OK - MODULES BE dan FE setara 100%.');

  // 2. Uji Kesetaraan Konfigurasi BUNDLES
  console.log('2. Memverifikasi kesetaraan BUNDLES (BE vs FE)...');
  const beFocus3 = BE_BUNDLES.focus3;
  const feFocus3 = FE_LIFETIME_BUNDLES.focus3;
  assert.ok(beFocus3, 'BE BUNDLES.focus3 must exist');
  assert.ok(feFocus3, 'FE LIFETIME_BUNDLES.focus3 must exist');
  assert.ok(FE_BUNDLES.focus3, 'FE BUNDLES.focus3 property must exist');

  assert.strictEqual(beFocus3.price, 4490000, 'Bundle Fokus 3 price must be Rp4.490.000');
  assert.strictEqual(feFocus3.price, 4490000, 'FE Bundle Fokus 3 price must be Rp4.490.000');

  assert.strictEqual(beFocus3.savings, 980000, 'Bundle Fokus 3 savings must be Rp980.000');
  assert.strictEqual(feFocus3.savings, 980000, 'FE Bundle Fokus 3 savings must be Rp980.000');

  assert.strictEqual(beFocus3.monthlyCredits, 600, 'Bundle Fokus 3 monthly credits must be 600');
  assert.strictEqual(feFocus3.monthlyCredits, 600, 'FE Bundle Fokus 3 monthly credits must be 600');

  assert.deepStrictEqual(beFocus3.modules, ['seo', 'ads_report', 'ads_spy']);
  assert.deepStrictEqual(feFocus3.modules, ['seo', 'ads_report', 'ads_spy']);
  console.log('   OK - BUNDLES BE dan FE setara 100%.');

  // 3. Uji Kesetaraan Konfigurasi TOPUP
  console.log('3. Memverifikasi kesetaraan TOPUP (BE vs FE)...');
  assert.strictEqual(BE_TOPUP.pricePerCredit, 1000, 'Price per credit must be Rp1.000');
  assert.strictEqual(FE_TOPUP.pricePerCredit, 1000, 'FE Price per credit must be Rp1.000');

  assert.strictEqual(BE_TOPUP.min, 50, 'Minimum top-up must be 50 credits');
  assert.strictEqual(FE_TOPUP.min, 50, 'FE Minimum top-up must be 50 credits');

  assert.strictEqual(BE_TOPUP.max, 50000, 'Maximum top-up must be 50.000 credits');
  assert.strictEqual(FE_TOPUP.max, 50000, 'FE Maximum top-up must be 50.000 credits');

  assert.deepStrictEqual(BE_TOPUP.quickOptions, [100, 500, 1000, 2500]);
  assert.deepStrictEqual(FE_TOPUP.quickOptions, [100, 500, 1000, 2500]);

  assert.deepStrictEqual(BE_TOPUP.tiers, FE_TOPUP.tiers);
  console.log('   OK - TOPUP config BE dan FE setara 100%.');

  // 4. Uji Kesetaraan Fungsi quoteTopup(credits)
  console.log('4. Memverifikasi kesetaraan hasil quoteTopup(credits)...');
  const testAmounts = [
    0, 10, 49, 50, 75, 100, 250, 500, 750, 999,
    1000, 1200, 1500, 2000, 2499, 2500, 3000, 5000, 10000, 50000,
    '50', '1000', '2500', 100.5
  ];

  for (const input of testAmounts) {
    const beResult = beQuoteTopup(input);
    const feResult = feQuoteTopup(input);
    assert.deepStrictEqual(beResult, feResult, `quoteTopup output mismatch on input: ${input}`);
  }

  // Validasi nilai matematis spesifik sesuai PRD F15
  // Topup 50 credit -> Rp50.000
  const q50 = beQuoteTopup(50);
  assert.strictEqual(q50.credits, 50);
  assert.strictEqual(q50.unitPrice, 1000);
  assert.strictEqual(q50.discountPct, 0);
  assert.strictEqual(q50.amount, 50000);

  // Topup 75 credit -> Rp75.000
  const q75 = beQuoteTopup(75);
  assert.strictEqual(q75.credits, 75);
  assert.strictEqual(q75.discountPct, 0);
  assert.strictEqual(q75.amount, 75000);

  // Topup 1.000 credit -> Rp950.000 (-5%)
  const q1000 = beQuoteTopup(1000);
  assert.strictEqual(q1000.credits, 1000);
  assert.strictEqual(q1000.discountPct, 0.05);
  assert.strictEqual(q1000.amount, 950000);

  // Topup 2.500 credit -> Rp2.250.000 (-10%)
  const q2500 = beQuoteTopup(2500);
  assert.strictEqual(q2500.credits, 2500);
  assert.strictEqual(q2500.discountPct, 0.10);
  assert.strictEqual(q2500.amount, 2250000);

  console.log('   OK - quoteTopup BE dan FE terbukti akurat dan identik 100%.');

  // 5. Uji getCatalog() memuat properti modules, bundles, dan topup
  console.log('5. Memverifikasi getCatalog() memuat struktur PRD F15...');
  const cat = getCatalog();
  assert.strictEqual(cat.currency, 'IDR');
  assert.strictEqual(cat.modules.length, 3);
  assert.strictEqual(cat.bundles.length, 1);
  assert.strictEqual(cat.topup.pricePerCredit, 1000);
  assert.strictEqual(cat.topup.min, 50);
  // 6. Uji Kesetaraan Konfigurasi TRIAL_DAYS (BE vs FE, PRD F15)
  console.log('6. Memverifikasi kesetaraan TRIAL_DAYS (BE vs FE)...');
  assert.strictEqual(BE_TRIAL_DAYS, 30, 'BE TRIAL_DAYS must be 30');
  assert.strictEqual(FE_TRIAL_DAYS, 30, 'FE TRIAL_DAYS must be 30');
  assert.strictEqual(FE_TRIAL.days, 30, 'FE TRIAL.days must be 30');
  assert.strictEqual(FE_TRIAL.credits, 300, 'FE TRIAL.credits must be 300');
  assert.strictEqual(FE_TRIAL.noCardRequired, true);
  console.log('   OK - TRIAL_DAYS BE dan FE setara 30 hari.');

  console.log('✅ ALL PRICING PARITY TESTS PASSED!');
}

runPricingParityTests().catch(err => {
  console.error('❌ Test pricing parity failed:', err);
  process.exit(1);
});
