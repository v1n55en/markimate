// Test Langkah 7: Verifikasi Konfigurasi Pricing, FAQ, dan i18n (PRD §5 & §7)
import assert from 'assert';
import { TRIAL, MODULE_CREDITS, TOPUP_PACKS, MODULE_PRICES } from '../../frontend/src/config/pricing.js';
import { TRANSLATIONS } from '../../frontend/src/i18n/translations.js';

async function runStep7Tests() {
  console.log('=== RUNNING TEST STEP 7 (Pricing Config, FAQ & i18n) ===');

  // 1. Verifikasi TRIAL
  assert.strictEqual(TRIAL.days, 7, 'Trial days must be 7');
  assert.strictEqual(TRIAL.credits, 300, 'Trial credits must be 300');
  assert.strictEqual(TRIAL.noCardRequired, true);
  console.log('✓ 1. Konfigurasi TRIAL valid (7 hari, 300 credit, tanpa kartu)');

  // 2. Verifikasi MODULE_CREDITS
  assert.strictEqual(MODULE_CREDITS.seo, 1500, 'SEO plan must be 1.500 credits');
  assert.strictEqual(MODULE_CREDITS.ads_report, 1500, 'Ads Report must be 1.500 credits');
  assert.strictEqual(MODULE_CREDITS.ads_spy, 1000, 'Ads Spy must be 1.000 credits');
  assert.strictEqual(MODULE_CREDITS.focus3, 3200, 'Focus 3 must be 3.200 credits');
  assert.strictEqual(MODULE_CREDITS.all_in_one, 7875, 'All-in-One must be 7.875 credits');
  console.log('✓ 2. Konfigurasi MODULE_CREDITS sesuai PRD §2 (SEO 1500, Focus3 3200, All-in-One 7875)');

  // 3. Verifikasi TOPUP_PACKS
  assert.strictEqual(TOPUP_PACKS.length, 3, 'Must have 3 topup packages');
  const starter = TOPUP_PACKS.find(p => p.id === 'starter');
  const growth = TOPUP_PACKS.find(p => p.id === 'growth');
  const scale = TOPUP_PACKS.find(p => p.id === 'scale');

  assert.strictEqual(starter.credits, 500);
  assert.strictEqual(starter.price, 500000);

  assert.strictEqual(growth.credits, 1050);
  assert.strictEqual(growth.price, 1000000);
  assert.strictEqual(growth.bonus, 50);

  assert.strictEqual(scale.credits, 2750);
  assert.strictEqual(scale.price, 2500000);
  assert.strictEqual(scale.bonus, 250);
  console.log('✓ 3. Paket TOPUP_PACKS valid (Starter 500, Growth 1050, Scale 2750)');

  // 4. Verifikasi FAQ i18n EN & ID
  assert.ok(TRANSLATIONS.en.faq.q4, 'EN FAQ must have q4');
  assert.ok(TRANSLATIONS.en.faq.q5, 'EN FAQ must have q5 (trial)');
  assert.ok(TRANSLATIONS.en.faq.q6, 'EN FAQ must have q6 (topup)');
  assert.ok(TRANSLATIONS.en.faq.a5.includes('300 free credits'), 'EN a5 must mention 300 credits');

  assert.ok(TRANSLATIONS.id.faq.q4, 'ID FAQ must have q4');
  assert.ok(TRANSLATIONS.id.faq.q5, 'ID FAQ must have q5 (trial)');
  assert.ok(TRANSLATIONS.id.faq.q6, 'ID FAQ must have q6 (topup)');
  assert.ok(TRANSLATIONS.id.faq.a5.includes('300 credit'), 'ID a5 must mention 300 credit');
  console.log('✓ 4. Terjemahan FAQ i18n ID & EN lengkap untuk credit, trial 7 hari, dan masa berlaku top-up');

  console.log('ALL STEP 7 TESTS PASSED!');
  process.exit(0);
}

runStep7Tests().catch(err => {
  console.error('Test Step 7 Failed:', err);
  process.exit(1);
});
