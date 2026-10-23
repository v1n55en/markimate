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

// Rata-rata harga per credit dari paket untuk estimasi biaya bulanan Markimate
export const AVERAGE_PRICE_PER_CREDIT = 900;

const seoMonthly = MODULES.seo.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 600 * 900 = 540.000
const adsReportMonthly = MODULES.ads_report.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 400 * 900 = 360.000
const adsSpyMonthly = MODULES.ads_spy.typicalMonthlyCredits * AVERAGE_PRICE_PER_CREDIT; // 260 * 900 = 234.000
const focus3Monthly = (MODULES.seo.typicalMonthlyCredits + MODULES.ads_report.typicalMonthlyCredits + MODULES.ads_spy.typicalMonthlyCredits) * AVERAGE_PRICE_PER_CREDIT; // 1.260 * 900 = 1.134.000

export const TEAM_COST_BENCHMARK = {
  focus3: 29375000, // Rata-rata gaji 3 staf in-house
  focus3Markimate: focus3Monthly, // 1.260 credit * Rp900 = Rp1.134.000
  focus3Savings: 29375000 - focus3Monthly, // Penghematan riil per bulan
  full: 64375000, // Gaji tim in-house lengkap 6-8 orang + tools berlangganan
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
