export const FREE_MONTHLY_LIMIT = 0;

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    credits: 0,
    modules: ['seo'],
    monthlyArticles: 0,
    images: false,
    autoTopics: false,
    webApprover: false,
    features: ['Riset keyword dasar', 'Draf langsung ke CMS']
  },
  seo: {
    id: 'seo',
    name: 'SEO Specialist',
    credits: 1500,
    modules: ['seo'],
    monthlyArticles: 20,
    images: true,
    autoTopics: true,
    webApprover: true,
    features: ['1.500 credit / bulan (≈20 artikel bergambar)', 'Gambar AI (Hero + Inline)', 'Topik Otomatis (Google Trends)', 'Web Approver: review & edit', 'Semua platform CMS']
  },
  premium: {
    id: 'premium',
    name: 'Pro (SEO)',
    credits: 1500,
    modules: ['seo'],
    monthlyArticles: 20,
    images: true,
    autoTopics: true,
    webApprover: true,
    features: ['1.500 credit / bulan (≈20 artikel bergambar)', 'Gambar AI (Hero + Inline)', 'Topik Otomatis (Google Trends)', 'Web Approver: review & edit', 'Semua platform CMS']
  },
  ads_report: {
    id: 'ads_report',
    name: 'Ads Specialist Report',
    credits: 1500,
    modules: ['ads_report'],
    monthlyArticles: 0,
    images: false,
    autoTopics: false,
    webApprover: false,
    features: ['1.500 credit / bulan', 'Laporan bulanan akun iklan Meta & Google Ads', 'Analisis performa & rekomendasi ROAS AI']
  },
  ads_spy: {
    id: 'ads_spy',
    name: 'Ads Creative Spy',
    credits: 1000,
    modules: ['ads_spy'],
    monthlyArticles: 0,
    images: false,
    autoTopics: false,
    webApprover: false,
    features: ['1.000 credit / bulan', 'Scan materi iklan kompetitor Meta Ad Library', 'Analisis hook & format konten visual']
  },
  focus3: {
    id: 'focus3',
    name: 'Paket Fokus 3',
    credits: 3200,
    modules: ['seo', 'ads_report', 'ads_spy'],
    monthlyArticles: 20,
    images: true,
    autoTopics: true,
    webApprover: true,
    features: ['3.200 credit / bulan', '20 artikel SEO bergambar', 'Ads Specialist Report', 'Ads Creative Spy']
  },
  all_in_one: {
    id: 'all_in_one',
    name: 'All-in-One AI Team',
    credits: 7875,
    modules: ['seo', 'ads_report', 'ads_spy'],
    monthlyArticles: 60,
    images: true,
    autoTopics: true,
    webApprover: true,
    features: ['7.875 credit / bulan', '60 artikel SEO bergambar', 'Akses penuh seluruh 16 modul AI', 'Prioritas tertinggi 3Our']
  }
};
