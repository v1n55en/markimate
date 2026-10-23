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
  neverExpires: true,
  quickOptions: [100, 500, 1000, 2500],
  tiers: [
    { min: 5000, disc: 0.25 },
    { min: 2500, disc: 0.20 },
    { min: 1000, disc: 0.10 }
  ]
};

export function discountFor(credits) {
  const c = Math.floor(Number(credits) || 0);
  for (const t of TOPUP.tiers) {
    if (c >= t.min) return t.disc;
  }
  return 0;
}

export function quoteTopup(credits) {
  const c = Math.floor(Number(credits) || 0);
  const unitPrice = TOPUP.pricePerCredit;
  const gross = c * unitPrice;
  const disc = discountFor(c);
  const discount = Math.round(gross * disc);
  const amount = gross - discount;

  const ascendingTiers = [...TOPUP.tiers].sort((a, b) => a.min - b.min);
  const next = ascendingTiers.find((t) => t.min > c) || null;
  const nextTier = next ? {
    min: next.min,
    disc: next.disc,
    creditsNeeded: next.min - c
  } : null;

  return {
    credits: c,
    unitPrice,
    discountPct: disc,
    discount,
    amount,
    nextTier
  };
}

// PRD F16b §3.1: Harga paket DITURUNKAN dari quoteTopup, bukan ditulis langsung
export const CREDIT_PACKS = Object.fromEntries(
  [
    ['pack_1000', 'Starter', 1000],
    ['pack_2500', 'Pro', 2500],
    ['pack_5000', 'Agency', 5000]
  ].map(([id, name, credits]) => [
    id,
    {
      id,
      name,
      credits,
      discount: discountFor(credits),
      price: quoteTopup(credits).amount
    }
  ])
);

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
