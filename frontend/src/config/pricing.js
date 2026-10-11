// Konfigurasi harga, kuota, bundle, dan benchmark biaya tim marketing in-house
// Mengikuti data kalkulator Supermat v3 (Supermat-v3-Kalkulator-Paket-Biaya-Development.xlsx)

export const MODULE_PRICES = {
  seo: 1500000, // Rp 1.500.000 / bulan
  ads_report: 1500000, // Rp 1.500.000 / bulan
  ads_spy: 1000000, // Rp 1.000.000 / bulan
};

export const MODULE_QUOTA = {
  seo: '20 artikel SEO / bulan + verifikasi CMS',
  ads_report: '3 akun iklan / toko marketplace terhubung',
  ads_spy: '5 kompetitor dipantau, pemindaian otomatis mingguan',
};

export const BUNDLES = [
  {
    key: 'focus3',
    name: 'Paket Fokus 3',
    description: 'Kombinasi 3 pilar pertumbuhan utama: SEO Specialist + Ads Specialist (Report) + Ads Creative Spy.',
    modules: ['seo', 'ads_report', 'ads_spy'],
    discount: 0.2, // Diskon 20% dari total satuan (Rp 4.000.000 -> Rp 3.200.000 / bln)
    badge: 'Paling Populer',
  },
  {
    key: 'all_in_one',
    name: 'All-in-One AI Team',
    description: 'Akses penuh ke seluruh 16 role tim marketing AI Supermat. Modul baru langsung aktif otomatis saat diluncurkan.',
    modules: 'all',
    price: 7875000, // Rp 7.875.000 / bln
    preorder: true,
    badge: 'Pre-Order Eksklusif',
  },
  {
    key: 'managed',
    name: 'Managed by 3Our',
    description: 'Layanan terkelola penuh (Full-service). Tim agensi 3Our mengoperasikan platform Supermat untuk brand Anda.',
    contactSales: true,
    badge: 'Solusi Agensi',
    contactUrl: 'https://wa.me/6281234567890?text=Halo%203Our,%20saya%20tertarik%20dengan%20paket%20Managed%20by%203Our%20Supermat',
  },
];

// Benchmark biaya tim in-house vs Supermat (dari kalkulator)
export const TEAM_COST_BENCHMARK = {
  focus3: 29375000, // Rata-rata gaji 3 staf in-house (SEO Specialist, Media Buyer, Market Researcher)
  full: 64375000, // Gaji tim in-house lengkap 6-8 orang + tools berlangganan
};

export const IN_HOUSE_COMPARISON = [
  {
    role: 'SEO Specialist',
    inHouseMonthly: 9000000,
    supermatMonthly: 1500000,
    deliverables: 'Riset keyword, penulisan artikel mendalam, dan penerbitan berkala ke CMS.',
  },
  {
    role: 'Ads Specialist (Reporting)',
    inHouseMonthly: 11000000,
    supermatMonthly: 1500000,
    deliverables: 'Konsolidasi performa multi-platform, analitik ROAS & GMV, slide presentasi.',
  },
  {
    role: 'Ads Creative Researcher (Spy)',
    inHouseMonthly: 9375000,
    supermatMonthly: 1000000,
    deliverables: 'Pemantauan iklan kompetitor, kurasi winning ads, analisis formula hook.',
  },
];

// Format Rupiah standar
export const formatIDR = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

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
