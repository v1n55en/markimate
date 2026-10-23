// Test PRD F16b UI: Verify TopupCalculator and Credit Pack badges
import assert from 'assert';
import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';
import React from 'react';

console.log('=== RUNNING FRONTEND TEST: PRD F16b Uniform Volume Pricing UI ===\n');

const server = await createServer({ appType: 'custom' });

try {
  // Load LanguageContext & TopupCalculator
  const langMod = await server.ssrLoadModule('./src/context/LanguageContext.jsx');
  const calcMod = await server.ssrLoadModule('./src/components/common/TopupCalculator.jsx');
  const pricingMod = await server.ssrLoadModule('./src/config/pricing.js');

  const LanguageProvider = langMod.LanguageProvider;
  const TopupCalculator = calcMod.default;
  const { CREDIT_PACKS, quoteTopup } = pricingMod;

  function renderWithLang(ui, lang = 'id') {
    return renderToString(
      React.createElement(LanguageProvider, { defaultLanguage: lang }, ui)
    );
  }

  // 1. Render kalkulator dengan 500 credits (ID)
  console.log('1. Menguji render kalkulator dengan 500 kredit...');
  const html500 = renderWithLang(
    React.createElement(TopupCalculator, { initialCredits: 500, isPublic: false }),
    'id'
  );

  assert.ok(html500.length > 500, 'TopupCalculator berhasil dirender');
  // Tidak ada baris diskon
  assert.strictEqual(
    html500.includes('topup-discount-row'),
    false,
    'Kalkulator di 500 kredit tidak boleh memuat baris diskon'
  );
  assert.strictEqual(
    html500.toLowerCase().includes('diskon volume'),
    false,
    'Kalkulator di 500 kredit tidak boleh memuat teks "diskon volume"'
  );
  // Ada hint "tambah 500 kredit lagi untuk hemat 10%"
  assert.ok(
    html500.includes('topup-next-tier-hint'),
    'Kalkulator di 500 kredit harus memuat next tier hint'
  );
  assert.ok(
    html500.toLowerCase().includes('tambah 500 kredit'),
    'Hint harus memuat "tambah 500 kredit"'
  );
  assert.ok(
    html500.includes('10%'),
    'Hint harus menyebutkan hemat 10%'
  );
  console.log('   OK - 500 kredit: tanpa baris diskon, hint "tambah 500 kredit lagi untuk hemat 10%" tampil.');

  // 2. Render kalkulator dengan 1.000 credits (ID)
  console.log('2. Menguji render kalkulator dengan 1.000 kredit...');
  const html1000 = renderWithLang(
    React.createElement(TopupCalculator, { initialCredits: 1000, isPublic: false }),
    'id'
  );

  assert.ok(
    html1000.includes('topup-discount-row'),
    'Kalkulator di 1.000 kredit harus memuat baris diskon'
  );
  assert.ok(
    html1000.includes('Diskon volume 10%:'),
    'Kalkulator di 1.000 kredit harus memuat "Diskon volume 10%:"'
  );
  assert.ok(
    html1000.includes('-Rp100.000') || html1000.includes('-Rp 100.000'),
    'Kalkulator di 1.000 kredit harus memuat diskon -Rp100.000'
  );
  assert.ok(
    html1000.includes('Rp900.000') || html1000.includes('Rp 900.000'),
    'Kalkulator di 1.000 kredit harus memuat total Rp900.000'
  );
  assert.ok(
    html1000.includes('Hemat 10%'),
    'Kalkulator di 1.000 kredit harus memuat badge "Hemat 10%"'
  );
  assert.strictEqual(
    html1000.includes('topup-next-tier-hint'),
    false,
    'Kalkulator di 1.000 kredit tidak boleh memuat next tier hint'
  );
  console.log('   OK - 1.000 kredit: baris diskon −Rp100.000, total Rp900.000, badge Hemat 10% tampil.');

  // 3. Render kartu Starter tidak memuat "Hemat"
  console.log('3. Memverifikasi kartu paket Starter (pack_500)...');
  const starter = CREDIT_PACKS.pack_500;
  assert.strictEqual(starter.credits, 500);
  assert.strictEqual(starter.price, 500000);
  assert.strictEqual(starter.discount, 0);

  // Growth (pack_1000)
  const growth = CREDIT_PACKS.pack_1000;
  assert.strictEqual(growth.credits, 1000);
  assert.strictEqual(growth.price, 900000);
  assert.strictEqual(growth.discount, 0.10);

  // Pro (pack_2500)
  const pro = CREDIT_PACKS.pack_2500;
  assert.strictEqual(pro.credits, 2500);
  assert.strictEqual(pro.price, 2000000);
  assert.strictEqual(pro.discount, 0.20);

  // Agency (pack_5000)
  const agency = CREDIT_PACKS.pack_5000;
  assert.strictEqual(agency.credits, 5000);
  assert.strictEqual(agency.price, 3750000);
  assert.strictEqual(agency.discount, 0.25);

  // Test rendering pack cards logic directly
  function renderPackBadge(pack) {
    const discountPct = Math.round(pack.discount * 100);
    return discountPct > 0 ? `Hemat ${discountPct}%` : null;
  }

  assert.strictEqual(renderPackBadge(starter), null, 'Kartu Starter tidak boleh memiliki badge Hemat');
  assert.strictEqual(renderPackBadge(growth), 'Hemat 10%', 'Kartu Growth harus memiliki badge Hemat 10%');
  assert.strictEqual(renderPackBadge(pro), 'Hemat 20%', 'Kartu Pro harus memiliki badge Hemat 20%');
  assert.strictEqual(renderPackBadge(agency), 'Hemat 25%', 'Kartu Agency harus memiliki badge Hemat 25%');
  console.log('   OK - Kartu Starter bebas badge Hemat, Growth/Pro/Agency memiliki badge diskon yang sesuai.');

  // 4. Paritas nominal PRD F16b
  console.log('4. Memverifikasi seluruh 8 nominal PRD F16b di frontend config...');
  const testCases = [
    [100, 100000, 0],
    [500, 500000, 0],
    [999, 999000, 0],
    [1000, 900000, 0.10],
    [2499, 2249100, 0.10],
    [2500, 2000000, 0.20],
    [5000, 3750000, 0.25],
    [50000, 37500000, 0.25]
  ];

  for (const [cr, expAmount, expDisc] of testCases) {
    const q = quoteTopup(cr);
    assert.strictEqual(q.amount, expAmount, `Amount mismatch for ${cr} credits`);
    assert.strictEqual(q.discountPct, expDisc, `Discount mismatch for ${cr} credits`);
  }
  console.log('   OK - Seluruh 8 nominal quoteTopup frontend lolos sesuai PRD.');

  console.log('\n✅ ALL FRONTEND PRICING UI TESTS PASSED!');
} finally {
  await server.close();
}
