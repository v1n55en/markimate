// Konfigurasi harga, kuota, bundle, dan benchmark biaya tim marketing in-house
// Mengikuti data kalkulator Supermat v3 (Supermat-v3-Kalkulator-Paket-Biaya-Development.xlsx)

export const CREDIT_PRICE_IDR = 1000;

export const TRIAL_DAYS = 30;

export const TRIAL = {
  days: TRIAL_DAYS,
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

export const MODULE_CREDITS = {
  seo: 100, // 100 credit / bulan
  ads_report: 400, // 400 credit / bulan
  ads_spy: 100, // 100 credit / bulan
  focus3: 600, // 600 credit / bulan
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

export const TEAM_COST_BENCHMARK = {
  focus3: 29375000, // Rata-rata gaji 3 staf in-house (SEO Specialist, Media Buyer, Market Researcher)
  focus3Markimate: 287083, // Amortisasi 24 bulan Bundle Fokus 3 (Rp4.490.000 / 24 = Rp187.083) + estimasi top-up Rp100.000
  focus3Savings: 29087917, // Penghematan riil per bulan
  full: 64375000, // Gaji tim in-house lengkap 6-8 orang + tools berlangganan
};

export const IN_HOUSE_COMPARISON = [
  {
    role: 'SEO Specialist',
    role_id: 'SEO Specialist',
    role_en: 'SEO Specialist',
    inHouseMonthly: 9000000,
    markimateMonthly: 182917,
    supermatMonthly: 182917,
    deliverables: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_id: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_en: 'Keyword research, in-depth article writing, and scheduled publishing to your CMS.',
    savingsPct: 98,
  },
  {
    role: 'Ads Specialist (Reporting)',
    role_id: 'Ads Specialist (Pelaporan)',
    role_en: 'Ads Specialist (Reporting)',
    inHouseMonthly: 11000000,
    markimateMonthly: 82917,
    supermatMonthly: 82917,
    deliverables: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_id: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_en: 'Multi-platform performance consolidation, ROAS & GMV analytics, executive slide decks.',
    savingsPct: 99,
  },
  {
    role: 'Ads Creative Researcher (Spy)',
    role_id: 'Ads Creative Researcher (Spy)',
    role_en: 'Ads Creative Researcher (Spy)',
    inHouseMonthly: 9375000,
    markimateMonthly: 112083,
    supermatMonthly: 112083,
    deliverables: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_id: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_en: 'Competitor ad library tracking, winning creative curation, and hook formula analysis.',
    savingsPct: 99,
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

