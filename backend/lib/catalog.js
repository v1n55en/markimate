import { PLANS } from './plans.js';

export const MODULES = {
  seo: {
    id: 'seo',
    name: 'SEO Specialist',
    price: 1990000,
    monthlyCredits: 100,
    desc: '±1 artikel bergambar + riset topik'
  },
  ads_report: {
    id: 'ads_report',
    name: 'Ads Report',
    price: 1990000,
    monthlyCredits: 400,
    desc: '1 laporan bulanan akun iklan'
  },
  ads_spy: {
    id: 'ads_spy',
    name: 'Ads Creative Spy',
    price: 1490000,
    monthlyCredits: 100,
    desc: '1 scan kompetitor + insight AI'
  }
};

export const BUNDLES = {
  focus3: {
    id: 'focus3',
    key: 'focus3',
    name: 'Bundle Fokus 3',
    modules: ['seo', 'ads_report', 'ads_spy'],
    price: 4490000,
    savings: 980000,
    monthlyCredits: 600,
    desc: 'Ketiga modul (SEO, Ads Report, Ads Creative Spy)'
  }
};

export const TOPUP = {
  pricePerCredit: 1000,
  min: 50,
  max: 50000,
  quickOptions: [100, 500, 1000, 2500],
  validityDays: 365,
  tiers: [
    { min: 2500, disc: 0.10 },
    { min: 1000, disc: 0.05 }
  ]
};

export function quoteTopup(credits) {
  const c = Math.floor(Number(credits) || 0);
  let discountPct = 0;
  if (Array.isArray(TOPUP.tiers)) {
    const sorted = [...TOPUP.tiers].sort((a, b) => b.min - a.min);
    for (const tier of sorted) {
      if (c >= tier.min) {
        discountPct = tier.disc;
        break;
      }
    }
  }
  const unitPrice = TOPUP.pricePerCredit;
  const gross = c * unitPrice;
  const discount = Math.round(gross * discountPct);
  const amount = gross - discount;
  return {
    credits: c,
    unitPrice,
    discountPct,
    amount
  };
}

export function getCatalog() {
  return {
    currency: 'IDR',
    modules: Object.values(MODULES),
    bundles: Object.values(BUNDLES),
    topup: TOPUP
  };
}

export { PLANS };

