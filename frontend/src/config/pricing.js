// Konfigurasi harga, kuota, bundle, dan benchmark biaya tim marketing in-house
// Mengikuti data kalkulator Supermat v3 (Supermat-v3-Kalkulator-Paket-Biaya-Development.xlsx)

export const TRIAL = {
  days: 7,
  credits: 300,
  noCardRequired: true,
};

export const MODULE_CREDITS = {
  seo: 1500, // 1.500 credit / bulan (≈ 20 artikel bergambar)
  ads_report: 1500, // 1.500 credit / bulan
  ads_spy: 1000, // 1.000 credit / bulan
  focus3: 3200, // 3.200 credit / bulan
  all_in_one: 7875, // 7.875 credit / bulan
};

export const TOPUP_PACKS = [
  { id: 'starter', name: 'Starter Pack', price: 500000, credits: 500, bonus: 0, tag: 'Dasar' },
  { id: 'growth', name: 'Growth Pack', price: 1000000, credits: 1050, bonus: 50, popular: true, tag: 'Paling Populer' },
  { id: 'scale', name: 'Scale Pack', price: 2500000, credits: 2750, bonus: 250, tag: 'Terbaik (Bonus 10%)' },
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
    name: 'Paket Fokus 3',
    description: 'Kombinasi 3 pilar pertumbuhan utama: SEO Specialist + Ads Specialist (Report) + Ads Creative Spy (3.200 credit/bulan).',
    modules: ['seo', 'ads_report', 'ads_spy'],
    credits: 3200,
    discount: 0.2, // Diskon 20% dari total satuan (Rp 4.000.000 -> Rp 3.200.000 / bln)
    badge: 'Paling Populer',
  },
  {
    key: 'all_in_one',
    name: 'All-in-One AI Team',
    description: 'Akses penuh ke seluruh 16 role tim marketing AI Markimate (7.875 credit/bulan). Modul baru langsung aktif otomatis.',
    modules: 'all',
    credits: 7875,
    price: 7875000, // Rp 7.875.000 / bln
    preorder: true,
    badge: 'Pre-Order Eksklusif',
  },
  {
    key: 'managed',
    name: 'Managed by 3Our',
    description: 'Layanan terkelola penuh (Full-service). Tim agensi 3Our mengoperasikan platform Markimate untuk brand Anda.',
    contactSales: true,
    badge: 'Solusi Agensi',
    contactUrl: 'https://wa.me/6285179642520?text=Halo%203Our,%20saya%20tertarik%20dengan%20paket%20Managed%20by%203Our%20Markimate',
  },
];

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
    supermatMonthly: 1000000,
    deliverables: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_id: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
    deliverables_en: 'Competitor ad library tracking, winning creative curation, and hook formula analysis.',
    savingsPct: 89,
  },
];

// Format mata uang: USD ($) jika 'en', IDR (Rp) jika 'id'
export const formatCurrency = (n, lang = 'id') => {
  if (lang === 'en') {
    // Pemetaan angka bulat untuk harga paket standar
    if (n === 1500000) return '$99';
    if (n === 1000000) return '$69';
    if (n === 3200000) return '$210';
    if (n === 4000000) return '$267';
    if (n === 7875000) return '$499';
    if (n === 9000000) return '$600';
    if (n === 11000000) return '$750';
    if (n === 9375000) return '$625';
    if (n === 29375000) return '$1,975';
    if (n === 26175000) return '$1,765';
    if (n === 64375000) return '$4,290';
    // Fallback konversi 1 USD = Rp 15.000
    const usd = Math.round(Number(n || 0) / 15000);
    return '$' + usd.toLocaleString('en-US');
  }
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
};

// Alias formatIDR yang otomatis menyesuaikan mata uang berdasarkan bahasa
export const formatIDR = (n, lang = 'id') => formatCurrency(n, lang);

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
