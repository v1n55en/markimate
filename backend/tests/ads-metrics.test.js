// backend/tests/ads-metrics.test.js
// Unit tests untuk shared/ads-metrics.js dan shared/report-template.js (PRD F5 Langkah 1)

import assert from 'node:assert';
import {
  BASE_METRICS,
  DERIVED_METRICS,
  ALL_METRICS,
  safeDivide,
  aggregateRows,
  tokenizeFormula,
  validateFormula,
  evaluateFormula
} from '../../shared/ads-metrics.js';

import {
  MARKIMATE_STANDARD_TEMPLATE,
  validateTemplate,
  calculateCredits,
  countAiPages,
  extractPlaceholders,
  validateTextPlaceholders
} from '../../shared/report-template.js';

console.log('=== RUNNING TESTS: PRD F5 Langkah 1 (Ads Metrics & Template Validation) ===\n');

// -------------------------------------------------------------
// 1. safeDivide & Zero Division Tests
// -------------------------------------------------------------
console.log('1. Menguji safeDivide...');
assert.strictEqual(safeDivide(100, 2), 50);
assert.strictEqual(safeDivide(100, 0), null, 'Bagi 0 harus mengembalikan null');
assert.strictEqual(safeDivide(null, 5), null, 'Numerator null harus mengembalikan null');
assert.strictEqual(safeDivide(5, null), null, 'Denominator null harus mengembalikan null');
assert.strictEqual(safeDivide('abc', 2), null, 'Numerator NaN harus mengembalikan null');
console.log('   OK - safeDivide lolos.');

// -------------------------------------------------------------
// 2. Agregasi Metrics (dari jumlah, bukan rata-rata rasio)
// -------------------------------------------------------------
console.log('2. Menguji agregasi rows (CTR, CPA, ROAS dihitung dari sum)...');
const mockRows = [
  { spend: 100000, impressions: 5000, clicks: 100, conversions: 5, conversion_value: 300000, results: 10, reach: 4000 },
  { spend: 200000, impressions: 15000, clicks: 300, conversions: 15, conversion_value: 900000, results: 30, reach: 12000 }
];

const aggregated = aggregateRows(mockRows);

// Total spend = 300.000, Total impressions = 20.000, Total clicks = 400
// Total conversions = 20, Total conversion_value = 1.200.000, Total results = 40
assert.strictEqual(aggregated.spend, 300000);
assert.strictEqual(aggregated.impressions, 200000 ? 20000 : 0);
assert.strictEqual(aggregated.clicks, 400);
assert.strictEqual(aggregated.conversions, 20);
assert.strictEqual(aggregated.conversion_value, 1200000);

// CTR harus dihitung dari total clicks / total impressions = 400 / 20.000 = 0.02 (2%)
assert.strictEqual(aggregated.ctr, 400 / 20000);

// CPC = total spend / total clicks = 300.000 / 400 = 750
assert.strictEqual(aggregated.cpc, 750);

// CPA = total spend / total conversions = 300.000 / 20 = 15.000
assert.strictEqual(aggregated.cpa, 15000);

// ROAS = conversion_value / spend = 1.200.000 / 300.000 = 4.0
assert.strictEqual(aggregated.roas, 4);

// Cost per result = 300.000 / 40 = 7.500
assert.strictEqual(aggregated.cost_per_result, 7500);

// Frequency = 20.000 / 16.000 = 1.25
assert.strictEqual(aggregated.frequency, 20000 / 16000);

console.log('   OK - Agregasi dari sum lolos.');

// -------------------------------------------------------------
// 3. Metric tidak tersedia / Kosong → null
// -------------------------------------------------------------
console.log('3. Menguji metric tidak tersedia atau data kosong...');
const emptyAgg = aggregateRows([]);
assert.strictEqual(emptyAgg.spend, null);
assert.strictEqual(emptyAgg.ctr, null);
assert.strictEqual(emptyAgg.roas, null);

const zeroReachRows = [{ spend: 50000, impressions: 1000, reach: 0, clicks: 0 }];
const zeroAgg = aggregateRows(zeroReachRows);
assert.strictEqual(zeroAgg.frequency, null, 'Reach 0 harus menghasilkan frequency null');
assert.strictEqual(zeroAgg.cpc, null, 'Clicks 0 harus menghasilkan cpc null');
assert.strictEqual(zeroAgg.ctr, 0, 'Clicks 0 / impressions 1000 = 0');
console.log('   OK - Metric null & zero lolos.');

// -------------------------------------------------------------
// 4. Formula Parser & Evaluator (Shunting-Yard)
// -------------------------------------------------------------
console.log('4. Menguji formula parser & evaluator...');

// a. Rumus valid: spend / leads
const res1 = evaluateFormula('spend / leads', { spend: 1000000, leads: 50 });
assert.strictEqual(res1, 20000);

// b. Rumus kompleks: (conversion_value - spend) / spend
const res2 = evaluateFormula('(conversion_value - spend) / spend', {
  conversion_value: 3000000,
  spend: 1000000
});
assert.strictEqual(res2, 2.0);

// c. Rumus dengan konstanta angka: (spend / impressions) * 1000
const res3 = evaluateFormula('(spend / impressions) * 1000', {
  spend: 500000,
  impressions: 50000
});
assert.strictEqual(res3, 10000);

// d. Pembagian nol dalam formula menghasilkan null
const resDivZero = evaluateFormula('spend / clicks', { spend: 500000, clicks: 0 });
assert.strictEqual(resDivZero, null, 'Bagi 0 dalam formula harus menghasilkan null');

// e. Operand tidak tersedia menghasilkan null
const resMissing = evaluateFormula('spend / leads', { spend: 500000 });
assert.strictEqual(resMissing, null, 'Operand tidak tersedia harus menghasilkan null');

// f. Kurung tidak ditutup: `(a` -> harus error dengan posisi
const unclosed = validateFormula('(spend + clicks');
assert.strictEqual(unclosed.valid, false);
assert.ok(unclosed.error.toLowerCase().includes('bracket') || unclosed.error.toLowerCase().includes('parenthes'));
assert.ok(typeof unclosed.position === 'number');

// g. Karakter ilegal: `spend; drop` ditolak
const illegal = validateFormula('spend; drop');
assert.strictEqual(illegal.valid, false);
assert.ok(illegal.error.includes('Unexpected character'));

// h. Referensi ke `custom:` lain ditolak (mencegah siklus)
const customRef = validateFormula('custom_cpa + 10');
assert.strictEqual(customRef.valid, false);
assert.ok(customRef.error.includes('Custom metrics cannot reference other custom metrics'));

// i. Identifier tidak dikenal
const unknownMetric = validateFormula('foo_bar * 2');
assert.strictEqual(unknownMetric.valid, false);
assert.ok(unknownMetric.error.includes("Unknown metric 'foo_bar'"));

console.log('   OK - Formula parser & evaluator lolos.');

// -------------------------------------------------------------
// 5. Template Validation Tests
// -------------------------------------------------------------
console.log('5. Menguji validasi spesifikasi template...');

// a. Template standar harus 100% valid
const stdValidation = validateTemplate(MARKIMATE_STANDARD_TEMPLATE);
assert.strictEqual(stdValidation.valid, true, `Template standar harus valid, error: ${JSON.stringify(stdValidation.errors)}`);

// b. Template lebih dari 20 halaman -> ditolak
const tooManyPagesSpec = {
  version: 1,
  name: 'Oversized',
  pages: Array.from({ length: 21 }, () => ({ type: 'cover', title: 'Test' }))
};
const oversizedValidation = validateTemplate(tooManyPagesSpec);
assert.strictEqual(oversizedValidation.valid, false);
assert.ok(oversizedValidation.errors.some(e => e.code === 'PAGE_LIMIT_EXCEEDED'));

// c. KPI dengan 9 metrics -> ditolak (batas 8)
const kpi9MetricsSpec = {
  version: 1,
  name: 'KPI 9',
  pages: [
    {
      type: 'kpi',
      title: 'KPI 9',
      metrics: ['impressions', 'reach', 'clicks', 'ctr', 'spend', 'cpc', 'results', 'roas', 'cpa']
    }
  ]
};
const kpi9Validation = validateTemplate(kpi9MetricsSpec);
assert.strictEqual(kpi9Validation.valid, false);
assert.ok(kpi9Validation.errors.some(e => e.code === 'KPI_METRICS_LIMIT'));

// d. Placeholder tidak dikenal -> ditolak
const unknownPlaceholderSpec = {
  version: 1,
  name: 'Unknown PH',
  pages: [
    {
      type: 'cover',
      title: 'Laporan {{invalid_placeholder_xyz}}'
    }
  ]
};
const unknownPhValidation = validateTemplate(unknownPlaceholderSpec);
assert.strictEqual(unknownPhValidation.valid, false);
assert.ok(unknownPhValidation.errors.some(e => e.code === 'UNKNOWN_PLACEHOLDER'));

// e. Placeholder custom metric valid jika didaftarkan
const customPhSpec = {
  version: 1,
  name: 'Custom PH',
  pages: [
    {
      type: 'custom_text',
      title: 'Custom',
      text: 'Biaya per lead kami adalah {{metric:cost_per_lead}}'
    }
  ]
};
const customPhValidation = validateTemplate(customPhSpec, { customMetricIds: ['cost_per_lead'] });
assert.strictEqual(customPhValidation.valid, true);

// f. Platform Google ditolak sampai F5-Google
const googlePlatformSpec = {
  version: 1,
  name: 'Google Spec',
  platform: 'google',
  pages: [{ type: 'cover', title: 'Test' }]
};
const googleValidation = validateTemplate(googlePlatformSpec);
assert.strictEqual(googleValidation.valid, false);
assert.ok(googleValidation.errors.some(e => e.code === 'PLATFORM_NOT_AVAILABLE'));

// g. AI Insight maksimal 2 halaman
const ai3PagesSpec = {
  version: 1,
  name: '3 AI Pages',
  pages: [
    { type: 'ai_insight', title: 'AI 1' },
    { type: 'ai_insight', title: 'AI 2' },
    { type: 'ai_insight', title: 'AI 3' }
  ]
};
const ai3Validation = validateTemplate(ai3PagesSpec);
assert.strictEqual(ai3Validation.valid, false);
assert.ok(ai3Validation.errors.some(e => e.code === 'AI_PAGES_LIMIT'));

// h. Table limit maksimal 25 baris
const tableOverflowSpec = {
  version: 1,
  name: 'Table Overflow',
  pages: [
    {
      type: 'table',
      title: 'Campaigns',
      dimension: 'campaign',
      metrics: ['spend'],
      limit: 30
    }
  ]
};
const tableOverflowValidation = validateTemplate(tableOverflowSpec);
assert.strictEqual(tableOverflowValidation.valid, false);
assert.ok(tableOverflowValidation.errors.some(e => e.code === 'INVALID_TABLE_LIMIT'));

console.log('   OK - Template validation lolos.');

// -------------------------------------------------------------
// 6. Credit Estimation Calculation (§3.8)
// -------------------------------------------------------------
console.log('6. Menguji kalkulasi estimasi kredit...');

// Standar: 1 AI page, <= 3 akun = 300 base + 50 AI = 350
assert.strictEqual(calculateCredits({ accountsCount: 1, aiPagesCount: 1 }), 350);
assert.strictEqual(calculateCredits({ accountsCount: 3, aiPagesCount: 1 }), 350);

// 5 akun + 2 AI: 300 base + 2*50 extra accounts + 2*50 AI = 500
assert.strictEqual(calculateCredits({ accountsCount: 5, aiPagesCount: 2 }), 500);

// Rerun periode yang sama: 100 kredit
assert.strictEqual(calculateCredits({ accountsCount: 5, aiPagesCount: 2, isRerun: true }), 100);

// countAiPages
assert.strictEqual(countAiPages(MARKIMATE_STANDARD_TEMPLATE), 1);

console.log('   OK - Estimasi kredit lolos.');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST PRD F5 LANGKAH 1 LOLOS 100%!');
console.log('======================================================\n');
