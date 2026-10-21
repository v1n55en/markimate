// Konfigurasi harga, kuota, bundle, dan benchmark biaya tim marketing in-house
// Mengikuti data kalkulator Supermat v3 (Supermat-v3-Kalkulator-Paket-Biaya-Development.xlsx)

export const CREDIT_PRICE_IDR = 1000;

export const TRIAL = {
  days: 7,
  credits: 300,
  noCardRequired: true,
};

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

export const LIFETIME_BUNDLES = {
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

export const MODULE_CREDITS = {
  seo: 1500, // 1.500 credit / bulan (≈ 20 artikel bergambar)
  ads_report: 1500, // 1.500 credit / bulan
  ads_spy: 1000, // 1.000 credit / bulan
  focus3: 3200, // 3.200 credit / bulan
  all_in_one: 7875, // 7.875 credit / bulan
};

export const TOPUP_PACKS = [
  { id: 'starter', name: 'Starter Pack', price: 500000, credits: 500, bonus: 0, tag: 'Basic' },
  { id: 'growth', name: 'Growth Pack', price: 1000000, credits: 1050, bonus: 50, popular: true, tag: 'Most Popular' },
  { id: 'scale', name: 'Scale Pack', price: 2500000, credits: 2750, bonus: 250, tag: 'Best Value (+10% Bonus)' },
];

export const MODULE_PRICES = {
  seo: 1500000, // Rp 1.500.000 / bulan
  ads_report: 1500000, // Rp 1.500.000 / bulan
  ads_spy: 1000000, // Rp 1.000.000 / bulan
};

export const MODULE_QUOTA = {
  seo: '1.500 credit / bulan (≈ 20 artikel SEO + gambar AI)',
  ads_report: '1.500 credit / bulan (Laporan akun iklan Meta & Google)',
  ads_spy: '1.000 credit / bulan (Scan kompetitor Ad Library mingguan)',
};

export const BUNDLES = [
  {
    key: 'focus3',
    modules: ['seo', 'ads_report', 'ads_spy'],
    credits: 3200,
    discount: 0.2,
  },
  {
    key: 'all_in_one',
    modules: 'all',
    credits: 7875,
    price: 7875000,
    preorder: true,
  },
  {
    key: 'managed',
    contactSales: true,
    contactUrl: 'https://wa.me/6285179642520?text=Halo%203Our,%20saya%20tertarik%20dengan%20paket%20Managed%20by%203Our%20Markimate',
  },
];
BUNDLES.focus3 = LIFETIME_BUNDLES.focus3;

// Benchmark biaya tim in-house vs Markimate (dari kalkulator)
export const TEAM_COST_BENCHMARK = {
  focus3: 29375000, // Rata-rata gaji 3 staf in-house (SEO Specialist, Media Buyer, Market Researcher)
  full: 64375000, // Gaji tim in-house lengkap 6-8 orang + tools berlangganan
};

export const IN_HOUSE_COMPARISON = [
  {
    role: 'SEO Specialist',
    role_id: 'SEO Specialist',
    role_en: 'SEO Specialist',
    inHouseMonthly: 9000000,
    markimateMonthly: 1500000,
    supermatMonthly: 1500000,
    deliverables: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_id: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_en: 'Keyword research, in-depth article writing, and scheduled publishing to your CMS.',
    savingsPct: 83,
  },
  {
    role: 'Ads Specialist (Reporting)',
    role_id: 'Ads Specialist (Pelaporan)',
    role_en: 'Ads Specialist (Reporting)',
    inHouseMonthly: 11000000,
    markimateMonthly: 1500000,
    supermatMonthly: 1500000,
    deliverables: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_id: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_en: 'Multi-platform performance consolidation, ROAS & GMV analytics, executive slide decks.',
    savingsPct: 86,
  },
  {
    role: 'Ads Creative Researcher (Spy)',
    role_id: 'Ads Creative Researcher (Spy)',
    role_en: 'Ads Creative Researcher (Spy)',
    inHouseMonthly: 9375000,
    markimateMonthly: 1000000,
    supermatMonthly: 1000000,
    deliverables: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_id: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_en: 'Competitor ad library tracking, winning creative curation, and hook formula analysis.',
    savingsPct: 89,
  },
];

export const getLocalizedInHouseComparison = (lang = 'id') => {
  return IN_HOUSE_COMPARISON.map((row) => ({
    ...row,
    roleName: lang.startsWith('en') ? (row.role_en || row.role) : (row.role_id || row.role),
    deliverablesText: lang.startsWith('en') ? (row.deliverables_en || row.deliverables) : (row.deliverables_id || row.deliverables),
  }));
};

// Format mata uang selalu IDR (Rp) di EN dan ID sesuai PRD F3
export const formatCurrency = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// Alias formatIDR
export const formatIDR = (n) => formatCurrency(n);

// Kalkulator harga modul modular
export function calculatePricing({
  selectedModules = [],
  billingCycle = 'monthly', // 'monthly' | 'yearly'
}) {
  const isAllFocus3 =
    selectedModules.length === 3 &&
    ['seo', 'ads_report', 'ads_spy'].every((m) => selectedModules.includes(m));

  // Hitung harga dasar bulanan
  let baseMonthly = selectedModules.reduce((acc, mKey) => {
    return acc + (MODULE_PRICES[mKey] || 0);
  }, 0);

  let discountPercent = 0;
  let appliedBundle = null;

  if (isAllFocus3) {
    const focusBundle = BUNDLES.find((b) => b.key === 'focus3');
    discountPercent = focusBundle?.discount || 0.2;
    appliedBundle = 'focus3';
  }

  const discountedMonthly = Math.round(baseMonthly * (1 - discountPercent));

  // Tahunan: Bayar 10 bulan untuk 12 bulan langganan (2 bulan gratis)
  const isYearly = billingCycle === 'yearly';
  const yearlyMultiplier = 10;
  const annualTotal = discountedMonthly * yearlyMultiplier;
  const effectiveMonthly = isYearly ? Math.round(annualTotal / 12) : discountedMonthly;

  const savingsAnnual = isYearly ? discountedMonthly * 2 : 0;

  return {
    baseMonthly,
    discountedMonthly,
    appliedBundle,
    discountPercent,
    isYearly,
    totalToPay: isYearly ? annualTotal : discountedMonthly,
    effectiveMonthly,
    savingsAnnual,
  };
}
