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
  if (c >= 2500) {
    discountPct = 0.10;
  } else if (c >= 1000) {
    discountPct = 0.05;
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

export const TOPUP_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    price: 500000,
    credits: 500,
    bonus: 0,
    periodDays: 365,
    desc: 'Cukup untuk ±8 artikel lengkap dengan 3 gambar AI.'
  },
  growth: {
    id: 'growth',
    name: 'Growth Pack',
    price: 1000000,
    credits: 1050,
    bonus: 50,
    periodDays: 365,
    desc: 'Bonus +50 credit. Cukup untuk ±14 artikel bergambar & riset topik.'
  },
  scale: {
    id: 'scale',
    name: 'Scale Pack',
    price: 2500000,
    credits: 2750,
    bonus: 250,
    periodDays: 365,
    desc: 'Bonus +250 credit. Skala besar untuk tim agency & brand aktif.'
  }
};

export function getCatalog() {
  return {
    currency: 'IDR',
    modules: Object.values(MODULES),
    bundles: Object.values(BUNDLES),
    topup: TOPUP,
    topupPackages: Object.values(TOPUP_PACKAGES),
    plans: Object.values(PLANS).filter(p => p.id !== 'free' && p.price > 0)
  };
}

export { PLANS };

