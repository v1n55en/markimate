import { PLANS } from './plans.js';
import { TRIAL_CONFIG } from './config.js';

export const MODULES = {
  seo: {
    id: 'seo',
    name: 'SEO Specialist',
    typicalMonthlyCredits: 600,
    desc: '8 artikel + 3 gambar/artikel'
  },
  ads_report: {
    id: 'ads_report',
    name: 'Ads Report',
    typicalMonthlyCredits: 400,
    desc: '1 laporan bulanan'
  },
  ads_spy: {
    id: 'ads_spy',
    name: 'Ads Creative Spy',
    typicalMonthlyCredits: 260,
    desc: '4 scan + 2 insight'
  }
};

// PRD F16 §3.1: BUNDLES dihapus dari katalog aktif.
// Dipertahankan sebagai empty object untuk backward-compatibility import jika ada modul warisan.
export const BUNDLES = {};
Object.defineProperty(BUNDLES, 'focus3', {
  value: { id: 'focus3', name: 'Bundle Fokus 3', price: 4490000, modules: ['seo', 'ads_report', 'ads_spy'] },
  writable: false,
  enumerable: false,
  configurable: true
});

export const TOPUP = {
  pricePerCredit: 1000,
  min: 100,
  max: 50000,
  quickOptions: [100, 250, 500],
  neverExpires: true
};

export const CREDIT_PACKS = {
  pack_500:  { id: 'pack_500',  name: 'Starter', credits: 500,  discount: 0.05, price: 475000  },
  pack_1000: { id: 'pack_1000', name: 'Growth',  credits: 1000, discount: 0.10, price: 900000  },
  pack_2500: { id: 'pack_2500', name: 'Pro',     credits: 2500, discount: 0.20, price: 2000000 },
  pack_5000: { id: 'pack_5000', name: 'Agency',  credits: 5000, discount: 0.25, price: 3750000 }
};

export function quoteTopup(credits) {
  const c = Math.floor(Number(credits) || 0);
  const unitPrice = TOPUP.pricePerCredit;
  const amount = c * unitPrice;
  return {
    credits: c,
    unitPrice,
    discountPct: 0,
    amount
  };
}

export function getCatalog() {
  return {
    currency: 'IDR',
    modules: Object.values(MODULES),
    topup: TOPUP,
    packs: Object.values(CREDIT_PACKS),
    trial: {
      days: TRIAL_CONFIG.days,
      credits: TRIAL_CONFIG.credits
    }
  };
}

export { PLANS };
