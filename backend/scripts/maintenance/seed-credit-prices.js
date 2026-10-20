// Seed harga credit (PRD §2) dan tarif biaya API nyata (PRD §2b) secara idempoten.
import { db, dbMode } from '../../db.js';

export const DEFAULT_PRICES = [
  { action_key: 'seo.article', credits: 60, label: 'Generate artikel SEO (Review Ready)' },
  { action_key: 'seo.image', credits: 5, label: 'Upload gambar artikel (per gambar)' },
  { action_key: 'seo.topics_run', credits: 10, label: 'Riset topik otomatis' },
  { action_key: 'seo.relink', credits: 5, label: 'Regenerate link/prompt' },
  { action_key: 'ads.report', credits: 400, label: 'Laporan bulanan akun iklan' },
  { action_key: 'ads.report_rerun', credits: 100, label: 'Laporan iklan ulang / custom' },
  { action_key: 'spy.scan', credits: 40, label: 'Scan kompetitor iklan' },
  { action_key: 'spy.insight', credits: 50, label: 'Insight AI kompetitor' },
  { action_key: 'spy.export', credits: 0, label: 'Export data kompetitor' },
];

export const DEFAULT_COST_RATES = [
  { rate_key: 'gemini_in_per_1k', idr: 4.95, note: 'Gemini 2.5 Flash input token ($0.30/1M)' },
  { rate_key: 'gemini_out_per_1k', idr: 41.25, note: 'Gemini 2.5 Flash output token ($2.50/1M incl. thinking)' },
  { rate_key: 'image', idr: 554.4, note: 'Nano Banana 2 Lite / gemini image ($0.0336/gambar)' },
  { rate_key: 'serp_call', idr: 247.5, note: 'SerpAPI Developer ($75/5.000 search = $0.015/call)' },
  { rate_key: 'rapid_call', idr: 16.5, note: 'RapidAPI Ahrefs Pro ($4.99/5.000 = $0.001/call)' },
];

export async function seedCreditPricesAndRates() {
  console.log(`[Seed] Menyemai credit_prices & credit_cost_rates (mode: ${dbMode})...`);

  for (const item of DEFAULT_PRICES) {
    const existing = await db.findOne('credit_prices', { action_key: item.action_key });
    if (!existing) {
      await db.insert('credit_prices', {
        action_key: item.action_key,
        credits: item.credits,
        label: item.label,
        active: true,
        needs_review: false,
        updated_at: new Date().toISOString()
      });
      console.log(`  + credit_prices: ${item.action_key} (${item.credits} credit)`);
    } else {
      console.log(`  = credit_prices: ${item.action_key} sudah ada (${existing.credits} credit)`);
    }
  }

  for (const rate of DEFAULT_COST_RATES) {
    const existing = await db.findOne('credit_cost_rates', { rate_key: rate.rate_key });
    if (!existing) {
      await db.insert('credit_cost_rates', {
        rate_key: rate.rate_key,
        idr: rate.idr,
        note: rate.note,
        updated_at: new Date().toISOString()
      });
      console.log(`  + credit_cost_rates: ${rate.rate_key} (Rp${rate.idr})`);
    } else {
      console.log(`  = credit_cost_rates: ${rate.rate_key} sudah ada (Rp${existing.idr})`);
    }
  }

  console.log('[Seed] Selesai menyemai harga credit & cost rates.');
}

if (process.argv[1]?.endsWith('seed-credit-prices.js')) {
  seedCreditPricesAndRates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
