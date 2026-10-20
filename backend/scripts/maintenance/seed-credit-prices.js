// Seed harga credit (PRD §2) dan tarif biaya API nyata (PRD §2b) secara idempoten.
import { db, dbMode } from '../../db.js';
import { DEFAULT_PRICES, DEFAULT_COST_RATES } from '../../lib/credit-defaults.js';

export { DEFAULT_PRICES, DEFAULT_COST_RATES };

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
