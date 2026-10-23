// Konfigurasi harga, kuota, paket credit, dan benchmark biaya tim marketing in-house
// Mengikuti PRD F16 (Model Credit-Only: Modul Gratis, Top-up & Paket Credit Tanpa Kedaluwarsa)

export const CREDIT_PRICE_IDR = 1000;

export const TRIAL_DAYS = 30;

export const TRIAL = {
  days: TRIAL_DAYS,
  credits: 400,
  noCardRequired: true,
};

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
    ['pack_500', 'Starter', 500],
    ['pack_1000', 'Growth', 1000],
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

export const ACTION_COST_EXAMPLES = {
  seoArticle: {
    credits: 75,
    price: 75000,
  },
  adsReport: {
    credits: 400,
    price: 400000,
  },
  adsSpy: {
    credits: 90,
    price: 90000,
  },
};

// Rata-rata harga per credit dari paket untuk estimasi biaya bulanan Markimate
export const AVERAGE_PRICE_PER_CREDIT = 900;

const seoMonthly = MODULES.seo.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 600 * 900 = 540.000
const adsReportMonthly = MODULES.ads_report.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 400 * 900 = 360.000
const adsSpyMonthly = MODULES.ads_spy.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 260 * 900 = 234.000
export const TOTAL_TYPICAL_MONTHLY_CREDITS = MODULES.seo.typicalMonthlyCredits + MODULES.ads_report.typicalMonthlyCredits + MODULES.ads_spy.typicalMonthlyCredits; // 1.260
const focus3Monthly = TOTAL_TYPICAL_MONTHLY_CREDITS * AVERAGE_PRICE_PER_CREDIT; // 1.260 * 900 = 1.134.000

export const TEAM_COST_BENCHMARK = {
  focus3: 29375000, // Rata-rata gaji 3 staf in-house
  focus3Markimate: focus3Monthly, // 1.260 credit * Rp900 = Rp1.134.000
  focus3Savings: 29375000 - focus3Monthly, // Penghematan riil per bulan
  full: 64375000, // Gaji tim in-house lengkap 6-8 orang + tools berbayar
};

export const IN_HOUSE_COMPARISON = [
  {
    role: 'SEO Specialist',
    role_id: 'SEO Specialist',
    role_en: 'SEO Specialist',
    typicalCredits: MODULES.seo.typicalMonthlyCredits,
    inHouseMonthly: 9000000,
    markimateMonthly: seoMonthly,
    supermatMonthly: seoMonthly,
    deliverables: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_id: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
    deliverables_en: 'Keyword research, in-depth article writing, and scheduled publishing to your CMS.',
    savingsPct: Math.round(((9000000 - seoMonthly) / 9000000) * 100),
  },
  {
    role: 'Ads Specialist (Reporting)',
    role_id: 'Ads Specialist (Pelaporan)',
    role_en: 'Ads Specialist (Reporting)',
    typicalCredits: MODULES.ads_report.typicalMonthlyCredits,
    inHouseMonthly: 11000000,
    markimateMonthly: adsReportMonthly,
    supermatMonthly: adsReportMonthly,
    deliverables: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_id: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
    deliverables_en: 'Multi-platform performance consolidation, ROAS & GMV analytics, executive slide decks.',
    savingsPct: Math.round(((11000000 - adsReportMonthly) / 11000000) * 100),
  },
  {
    role: 'Ads Creative Researcher (Spy)',
    role_id: 'Ads Creative Researcher (Spy)',
    role_en: 'Ads Creative Researcher (Spy)',
    typicalCredits: MODULES.ads_spy.typicalMonthlyCredits,
    inHouseMonthly: 9375000,
    markimateMonthly: adsSpyMonthly,
    supermatMonthly: adsSpyMonthly,
    deliverables: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_id: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_en: 'Competitor ad library tracking, winning creative curation, and hook formula analysis.',
    savingsPct: Math.round(((9375000 - adsSpyMonthly) / 9375000) * 100),
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
