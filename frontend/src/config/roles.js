// Single Source of Truth for 16 AI Digital Marketing Team Roles
// Supports bilingual localization: English (Primary / Default) & Indonesian

export const ROLE_CATEGORIES = [
  { key: 'all', label: 'All Categories', label_id: 'Semua Kategori' },
  { key: 'Ads', label: 'Paid Advertising (Ads)', label_id: 'Periklanan (Ads)' },
  { key: 'Content', label: 'Content & SEO', label_id: 'Konten & SEO' },
  { key: 'Research', label: 'Research & Intelligence', label_id: 'Riset & Intelijen' },
  { key: 'Analytics', label: 'Analytics & Reporting', label_id: 'Analitik & Pelaporan' },
  { key: 'Engagement', label: 'Engagement & Community', label_id: 'Interaksi & Komunitas' },
  { key: 'Retention', label: 'Retention & CRM', label_id: 'Retensi & CRM' },
  { key: 'Growth', label: 'Growth & Acquisition', label_id: 'Pertumbuhan & Penjualan' },
  { key: 'Commerce', label: 'Marketplace & E-Commerce', label_id: 'Marketplace' },
  { key: 'Strategy', label: 'Marketing Strategy', label_id: 'Strategi' },
];

export const ROLES = [
  {
    key: 'seo',
    name: 'AI SEO Specialist',
    name_id: 'AI SEO Specialist',
    category: 'Content',
    status: 'available',
    description: 'Keyword research, rank-ready SEO writing, automated 1-click publishing to WordPress/Wix',
    description_id: 'Riset keyword, tulis artikel SEO, kirim ke WordPress/Wix setelah kamu setujui',
    longDescription:
      'Autonomous AI SEO specialist that tracks live Google search trends, identifies high-intent keyword opportunities, drafts comprehensive search-optimized articles, and pushes directly to your CMS upon editorial approval.',
    longDescription_id:
      'Spesialis SEO berbasis AI yang memantau tren pencarian Google, memetakan kata kunci bernilai tinggi, menyusun artikel mendalam yang ramah mesin pencari, dan menerbitkan langsung ke CMS pilihan Anda setelah melewati persetujuan.',
    iconName: 'Terminal',
    path: '/app/seo/keywords',
    deliverables: 'Rank-ready SEO articles, keyword difficulty audits, direct integration with WordPress, Wix, Sanity, and Shopify.',
    deliverables_id: 'Artikel SEO siap terbit, analisis keyword difficulty, integrasi langsung ke WordPress/Wix/Sanity/Shopify.',
    features: [
      'Automated search trend mining via SerpAPI & Google Trends',
      'In-depth, citation-grounded article generation with Gemini AI',
      'Editorial review drawer: polish and customize before publishing',
      'Instant 1-click dispatch to WordPress, Wix, Sanity, and Shopify',
      'Automated daily / weekly cron scheduling for compounding domain authority',
    ],
    features_id: [
      'Riset tren pencarian otomatis via SerpAPI & Google Trends',
      'Penyusunan artikel komprehensif dengan AI mutakhir',
      'Drawer review editorial: tinjau dan edit sebelum dipublikasikan',
      'Penerbitan otomatis ke WordPress, Wix, Sanity, dan Shopify',
      'Penjadwalan harian / mingguan untuk konsistensi ranking',
    ],
    sampleOutput: '1,200+ word structured article complete with semantic heading hierarchy, metadata, and CMS markdown formatting.',
    sampleOutput_id: 'Draf artikel 1.200+ kata lengkap dengan heading structure, meta description, dan formatting CMS.',
  },
  {
    key: 'ads_report',
    name: 'AI Ads Performance Reporter',
    name_id: 'Ads Specialist — Report Semua Platform',
    category: 'Ads',
    status: 'available',
    description: 'Monthly multi-channel reporting for Meta, Google, TikTok, GMV Max, and Shopee + AI insights',
    description_id: 'Laporan bulanan Meta, Google, TikTok, GMV Max (TikTok Shop/Tokopedia), Shopee + insight AI',
    longDescription:
      'Multi-channel advertising reporter that consolidates paid ad performance across Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, and Shopee Ads into a unified dashboard, ready to export to Google Slides & Google Sheets.',
    longDescription_id:
      'Spesialis pelaporan iklan multi-channel yang mengonsolidasi performa berbayar dari Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, dan Shopee Ads dalam satu dashboard terintegrasi, siap diekspor ke Google Slides & Sheets.',
    iconName: 'BarChart2',
    path: '/app/ads',
    deliverables: 'Executive dashboard, ROAS & store GMV rollups, client presentation slides, and clean tabular spreadsheets.',
    deliverables_id: 'Eksekutif dashboard, ringkasan ROAS & GMV toko, slide presentasi bulanan, sheet spreadsheet lengkap.',
    features: [
      'OAuth Read-Only connections across 5 major ad networks and marketplaces',
      'Cross-platform metric aggregation: Ad Spend, Impressions, Clicks, Conversions, GMV, and blended ROAS',
      'Interactive 6-month trend lines and daily pacing charts',
      'Granular campaign, placement, demographic, and product-level breakdowns',
      'AI executive summaries with concrete budget reallocation recommendations',
      '1-click export to Google Slides and Google Sheets',
    ],
    features_id: [
      'Koneksi OAuth Read-Only ke 5 platform periklanan & marketplace',
      'Agregasi metrik: Spend, Impressions, Clicks, Conversions, GMV, dan ROAS',
      'Grafik tren 6 bulan dan pergerakan metrik harian interaktif',
      'Breakdown campaign, placement, demografi, dan top produk',
      'Insight strategis AI untuk efisiensi budget bulan berikutnya',
      'Ekspor otomatis ke Google Slides dan Google Sheets',
    ],
    sampleOutput: 'Meeting-ready monthly executive slide deck and clean audit sheets.',
    sampleOutput_id: 'Dek presentasi performa bulanan siap meeting stakeholder dan tabel Google Sheets rapi.',
  },
  {
    key: 'ads_spy',
    name: 'AI Ads Creative Spy',
    name_id: 'AI Ads Creative Spy',
    category: 'Research',
    status: 'available',
    description: 'Track competitor ad libraries, uncover winning creative formulas, and reverse-engineer hooks',
    description_id: 'Pantau iklan kompetitor, kumpulkan creative, rangkum pola hook & penawaran',
    longDescription:
      'Competitive intelligence specialist monitoring Meta Ad Library, TikTok Creative Center, and Google Ads Transparency to pinpoint long-running winning ads (>30 days active) and dissect winning hook formulas, psychological angles, and offers.',
    longDescription_id:
      'Spesialis intelijen kompetitor yang memantau perpustakaan iklan (Meta Ad Library & TikTok), mendeteksi materi iklan yang paling lama tayang (winning creatives), dan membedah formula hook, angle penawaran, serta visual yang efektif.',
    iconName: 'Eye',
    path: '/app/spy',
    deliverables: 'Curated competitor swipe files, winning creative signals, and weekly creative intelligence briefings.',
    deliverables_id: 'Galeri swipe file iklan kompetitor, sinyal winning ads, laporan pola penawaran mingguan.',
    features: [
      'Continuous scanning of Meta Ad Library & TikTok competitor creatives',
      'High-longevity ad detection (flags ads active for 30+ consecutive days)',
      'AI ad anatomy dissection: 3-second hook breakdown, core emotional angle, and CTA architecture',
      'Private swipe file vault for your creative & media buying teams',
      'Weekly competitive intelligence reports summarizing category ad trends',
    ],
    features_id: [
      'Pemantauan otomatis Meta Ad Library & platform iklan kompetitor',
      'Deteksi iklan tayang lama (indikasi winning creatives)',
      'Bedah anatomi iklan: formula hook 3 detik, angle emosional, dan CTA',
      'Penyimpanan swipe file kolektif untuk inspirasi tim kreatif',
      'Rangkuman insight mingguan & tren penawaran di industri Anda',
    ],
    sampleOutput: 'Competitor ad dossier with run duration, copy transcript, and reverse-engineered AI hook teardown.',
    sampleOutput_id: 'Koleksi kartu iklan kompetitor dengan durasi tayang, transkrip copy, dan analisis hook AI.',
  },
  {
    key: 'social',
    name: 'AI Social Media Manager',
    name_id: 'Social Media Specialist',
    category: 'Content',
    status: 'soon',
    description: 'Monthly editorial calendars, engaging captions, and carousel storyboards repurposed from articles',
    description_id: 'Kalender konten, caption, carousel dari artikel & tren',
    longDescription:
      'Social media specialist that transforms blog articles and industry trends into monthly posting calendars, engaging captions, short-form video ideas, and multi-slide carousels.',
    longDescription_id:
      'Spesialis media sosial yang mengubah artikel dan topik tren menjadi kalender posting bulanan, caption yang engaging, ide video pendek Reels/TikTok, serta slide carousel.',
    iconName: 'Share2',
    deliverables: 'Monthly editorial content calendar, multi-slide carousel storyboards, and ready-to-post caption copy.',
    deliverables_id: 'Kalender konten bulanan, ide carousel, dan naskah caption lengkap.',
    features: [
      'Automatic content repurposing from long-form blog articles to social snippets',
      'Structured weekly editorial calendar aligned with brand positioning',
      'High-affinity hashtag clusters and trending audio recommendations',
    ],
    features_id: [
      'Repurposing otomatis artikel blog menjadi materi media sosial',
      'Penyusunan kalender editorial terstruktur per minggu',
      'Rekomendasi hashtag dan audio tren',
    ],
  },
  {
    key: 'organic_report',
    name: 'AI Organic Social Analytics',
    name_id: 'Report & Analytics Organik',
    category: 'Analytics',
    status: 'soon',
    description: 'Instagram & TikTok organic analytics: follower growth, top-performing posts, and audience engagement',
    description_id: 'Laporan IG & TikTok: follower, top post, engagement',
    longDescription:
      'Organic analytics reporter aggregating organic social media performance: follower velocity, viral reach, content fatigue, and audience retention metrics.',
    longDescription_id:
      'Spesialis analitik organik yang mengumpulkan performa akun media sosial: pertumbuhan pengikut, jangkauan konten, video viral, dan rasio interaksi audiens.',
    iconName: 'PieChart',
    deliverables: 'Monthly Instagram & TikTok organic performance report with actionable content recommendations.',
    deliverables_id: 'Laporan performa organik bulanan Instagram & TikTok.',
    features: [
      'Follower velocity and non-follower reach tracking',
      'Identification of peak-performing content formats and topics',
      'Audience active hours analysis for optimal publishing windows',
    ],
    features_id: [
      'Pelacakan pertumbuhan follower dan reach organik',
      'Identifikasi postingan dengan engagement tertinggi',
      'Analisis jam posting terbaik audiens Anda',
    ],
  },
  {
    key: 'trend',
    name: 'AI Trend & Market Researcher',
    name_id: 'Trend Researcher',
    category: 'Research',
    status: 'soon',
    description: 'Real-time trending topics, product categories, and viral conversations in your industry niche',
    description_id: 'Tren topik, menu, produk, dan konten di niche-mu',
    longDescription:
      'Market research specialist monitoring viral conversations, breakout search terms, and competitor product innovations in your vertical.',
    longDescription_id:
      'Spesialis riset tren pasar yang memindai percakapan viral, kata kunci naik daun, serta inovasi produk kompetitor secara real-time di industri Anda.',
    iconName: 'TrendingUp',
    deliverables: 'Weekly trend intelligence briefing and viral content angle recommendations.',
    deliverables_id: 'Briefing tren mingguan dan rekomendasi sudut pandang konten.',
    features: [
      'Cross-platform trend listening via Google Trends, X (Twitter), and TikTok audio indexes',
      'Early detection of consumer demand shifts before competitors catch up',
      'High-margin product and seasonal promo concept suggestions',
    ],
    features_id: [
      'Pemindaian tren Google Trends, Twitter/X, dan TikTok audio',
      'Deteksi dini pergeseran minat konsumen di kategori bisnis Anda',
      'Ide menu atau produk turunan bernilai jual tinggi',
    ],
  },
  {
    key: 'copy',
    name: 'AI Ad Copywriter & Creative Generator',
    name_id: 'Copywriter & Ad Creative Generator',
    category: 'Content',
    status: 'soon',
    description: 'High-converting ad copy variations, headlines, and visual briefs adapted from winning spy data',
    description_id: 'Variasi copy & visual iklan dari brief dan hasil spy',
    longDescription:
      'Direct-response copywriting specialist producing dozens of headline variations, primary text angles, and visual storyboards synthesized from winning spy intelligence.',
    longDescription_id:
      'Spesialis copywriting persuasif yang menghasilkan puluhan variasi judul, teks iklan, dan storyboard visual berdasarkan data swipe file iklan pemenang.',
    iconName: 'Sparkles',
    deliverables: 'Ad copy matrix (Hook, Body, CTA) and creative briefs for video editors and designers.',
    deliverables_id: 'Matriks copy iklan (hook, body, CTA) dan arahan visual kreatif.',
    features: [
      'Proven direct-response frameworks (AIDA, PAS, Problem-Agitate-Solve)',
      'Multi-angle variations for split testing (Urgency, Social Proof, Authority)',
      'Seamless adaptation of winning insights from Ads Creative Spy',
    ],
    features_id: [
      'Generator naskah iklan berbasis formula AIDA & PAS',
      'Variasi sudut pandang audiens untuk A/B testing',
      'Adaptasi instan dari insight Ads Creative Spy',
    ],
  },
  {
    key: 'community',
    name: 'AI Community & Social Care Specialist',
    name_id: 'Community Manager',
    category: 'Engagement',
    status: 'soon',
    description: 'Draft contextual comment & DM replies, flag customer complaints, and nurture brand advocacy',
    description_id: 'Draf balasan komentar & DM, deteksi komplain',
    longDescription:
      'Community engagement assistant that filters incoming comments and DMs, drafts on-brand replies within seconds, and proactively identifies potential customer escalations.',
    longDescription_id:
      'Spesialis interaksi komunitas yang menyaring komentar masuk, membuat draf balasan ramah dalam hitungan detik, serta mengidentifikasi komplain pelanggan secara dini.',
    iconName: 'MessageSquare',
    deliverables: 'Contextual comment response assistant and real-time sentiment escalation alerts.',
    deliverables_id: 'Asisten draf respons komentar dan peringatan sentimen negatif.',
    features: [
      'Automated intent tagging: Product inquiries, praise, and complaints',
      'Brand-aligned response drafting matching tone guidelines',
      'Priority routing for sensitive customer service incidents',
    ],
    features_id: [
      'Klasifikasi pertanyaan produk, pujian, dan komplain',
      'Pembuatan draf balasan kontekstual sesuai brand voice',
      'Eskalasi prioritas tinggi untuk kendala layanan pelanggan',
    ],
  },
  {
    key: 'kol',
    name: 'AI KOL & Influencer Scout',
    name_id: 'KOL / Influencer Researcher',
    category: 'Research',
    status: 'soon',
    description: 'Discover creators matching your niche with verified engagement rates and audience demographics',
    description_id: 'Cari kreator sesuai niche + engagement rate',
    longDescription:
      'Influencer curator scouring Instagram and TikTok for high-affinity micro and macro creators with authentic engagement and relevant demographics.',
    longDescription_id:
      'Spesialis kurasi influencer yang mencari kreator mikro dan makro di Instagram & TikTok dengan engagement rate tinggi dan audiens relevan.',
    iconName: 'Users',
    deliverables: 'Verified creator shortlists, fee benchmarks, and outreach collaboration scripts.',
    deliverables_id: 'Database kandidat influencer terverifikasi dan estimasi tarif/jangkauan.',
    features: [
      'Audience demographic and location affinity matching',
      'Real engagement rate calculation filtering out bot followings',
      'Customized collaboration pitch and negotiation templates',
    ],
    features_id: [
      'Penyaringan kreator berdasarkan demografi audiens',
      'Kalkulasi engagement rate riil tanpa fake followers',
      'Template pesan outreach dan negosiasi kolaborasi',
    ],
  },
  {
    key: 'reviews',
    name: 'AI Reputation & Review Monitor',
    name_id: 'Review & Reputation Monitor',
    category: 'Engagement',
    status: 'soon',
    description: 'Monitor Google Business Profile & marketplace reviews with automated empathetic reply drafting',
    description_id: 'Pantau ulasan Google Maps & marketplace',
    longDescription:
      'Reputation manager keeping watch over Google Maps, Shopee, and Tokopedia reviews, analyzing recurring customer friction points, and drafting empathetic, brand-saving responses.',
    longDescription_id:
      'Spesialis reputasi brand yang mengawasi ulasan pelanggan di Google Business Profile, Shopee, dan Tokopedia, menyusun respons apresiatif dan resolusi komplain.',
    iconName: 'Star',
    deliverables: 'Customer sentiment tracking reports and automated review response suggestions.',
    deliverables_id: 'Laporan sentimen ulasan dan draf tanggapan otomatis.',
    features: [
      'Real-time alerts for 1-star to 3-star negative reviews',
      'NLP extraction of recurring product complaints and delivery issues',
      'Professional dispute de-escalation reply drafts',
    ],
    features_id: [
      'Notifikasi cepat saat ada ulasan bintang 1–3',
      'Analisis kata yang sering dikeluhkan pelanggan',
      'Draf tanggapan profesional untuk menjaga rating toko',
    ],
  },
  {
    key: 'optimizer',
    name: 'AI Media Buyer & Budget Optimizer',
    name_id: 'Media Buyer / Ads Optimizer',
    category: 'Ads',
    status: 'soon',
    description: 'Real-time pacing alerts, creative fatigue signals, and automated budget scaling recommendations',
    description_id: 'Alert & rekomendasi budget, fatigue, scale/pause',
    longDescription:
      'Algorithmic media buying assistant monitoring daily cost spikes, creative fatigue indicators, and recommending safe horizontal and vertical budget scaling.',
    longDescription_id:
      'Spesialis optimasi kampanye iklan yang memantau anomali biaya harian, memberikan sinyal ad fatigue sebelum CPA membengkak, dan merekomendasikan kenaikan budget.',
    iconName: 'Sliders',
    deliverables: 'Daily budget reallocation alerts and creative exhaustion warnings.',
    deliverables_id: 'Rekomendasi penyesuaian budget dan deteksi materi iklan jenuh.',
    features: [
      'CPA threshold breach alerts before budget burns out',
      'Step-wise 20% budget scaling roadmap for winning ad sets',
      'Early warning notifications when creative CTR degrades by over 30%',
    ],
    features_id: [
      'Peringatan dini kenaikan CPA di atas ambang batas toleransi',
      'Rekomendasi peningkatan budget bertahap untuk winning campaigns',
      'Pemberitahuan materi iklan yang mengalami penurunan CTR drastis',
    ],
  },
  {
    key: 'crm',
    name: 'AI CRM, Email & WhatsApp Strategist',
    name_id: 'CRM, Email & WhatsApp Marketing',
    category: 'Retention',
    status: 'soon',
    description: 'RFM customer segmentation, automated re-engagement broadcast scripts, and cart recovery workflows',
    description_id: 'Segmentasi & broadcast terjadwal',
    longDescription:
      'Customer retention strategist segmenting shopper databases by purchase frequency and drafting high-converting, non-spammy WhatsApp and email drip campaigns.',
    longDescription_id:
      'Spesialis retensi pelanggan yang mengelompokkan database pembeli berdasarkan frekuensi belanja dan merancang kampanye broadcast pesan yang tidak spammy.',
    iconName: 'Send',
    deliverables: 'Broadcast copy scripts, RFM customer tiers, and automated abandoned cart recovery sequences.',
    deliverables_id: 'Skrip pesan broadcast, segmentasi pelanggan loyal, dan jadwal drip sequence.',
    features: [
      'RFM (Recency, Frequency, Monetary) segmentation model',
      'High-converting educational broadcast templates and payday promotions',
      'Automated re-order trigger workflows for consumable products',
    ],
    features_id: [
      'Segmentasi RFM (Recency, Frequency, Monetary)',
      'Template broadcast edukasi dan penawaran payday',
      'Integrasi alur follow-up pesanan terabaikan',
    ],
  },
  {
    key: 'leads',
    name: 'AI Lead Generation & Outbound Scout',
    name_id: 'Lead Gen & Sales Outreach',
    category: 'Growth',
    status: 'soon',
    description: 'Prospect list building, contact enrichment, and personalized multi-step cold outreach sequences',
    description_id: 'Cari prospek & follow-up otomatis',
    longDescription:
      'B2B customer acquisition specialist discovering qualified decision-maker prospects and writing personalized cold outreach email cadences.',
    longDescription_id:
      'Spesialis akuisisi prospek B2B dan korporasi yang memetakan target prospek relevan di industri target serta menyiapkan urutan pesan penjangkauan dingin.',
    iconName: 'Target',
    deliverables: 'Verified prospect lead sheets and high-reply outbound cold email sequences.',
    deliverables_id: 'Daftar prospek terverifikasi dan urutan email penjangkauan.',
    features: [
      'Public directory decision-maker prospecting',
      'Hyper-personalized dynamic outreach personalization tags',
      'Multi-touch automated follow-up cadences',
    ],
    features_id: [
      'Pengumpulan data kontak bisnis dari direktori publik terpercaya',
      'Kustomisasi pesan outreach personalisasi skala luas',
      'Alur pengingat follow-up terjadwal',
    ],
  },
  {
    key: 'tracking',
    name: 'AI Tracking & Analytics Auditor',
    name_id: 'Tracking & Analytics Audit',
    category: 'Analytics',
    status: 'soon',
    description: 'Meta Pixel, GTM, and GA4 tag health audits with discrepancy detection and event verification',
    description_id: 'Audit Pixel/GTM/GA4 + alert konversi anomali',
    longDescription:
      'Technical analytics auditor verifying that tracking pixels, GTM data layers, and Conversions API (CAPI) send clean, deduplicated events without data loss.',
    longDescription_id:
      'Spesialis teknis analitik yang memastikan pelacakan Meta Pixel, Google Tag Manager, dan Google Analytics 4 terpasang akurat tanpa duplikasi event.',
    iconName: 'Activity',
    deliverables: 'Tracking health diagnostic scorecards and broken tag alerts.',
    deliverables_id: 'Laporan kesehatan tag pelacakan dan deteksi anomali tracking.',
    features: [
      'Purchase, Lead, and AddToCart event match quality validation',
      'Real-time alerts when tracking scripts break or drop event fires',
      'Meta Conversions API (CAPI) deduplication auditing',
    ],
    features_id: [
      'Audit kesesuaian event Purchase dan Lead',
      'Peringatan ketika event pelacakan berhenti mengirimkan data',
      'Verifikasi kepatuhan Conversions API (CAPI)',
    ],
  },
  {
    key: 'marketplace',
    name: 'AI Marketplace Optimization Specialist',
    name_id: 'Marketplace Specialist',
    category: 'Commerce',
    status: 'soon',
    description: 'Shopee & Tokopedia SEO title optimization, listing health audits, and competitor price tracking',
    description_id: 'Optimasi listing & pantau harga kompetitor',
    longDescription:
      'E-commerce marketplace specialist auditing product titles, hero imagery, and descriptions on Shopee and Tokopedia to win search algorithm visibility.',
    longDescription_id:
      'Spesialis marketplace yang membedah judul, gambar utama, dan deskripsi produk di Shopee & Tokopedia agar tampil di halaman pertama pencarian.',
    iconName: 'ShoppingBag',
    deliverables: 'Product listing optimization scorecards and competitor price movement alerts.',
    deliverables_id: 'Audit skor listing produk dan pemantauan pergerakan harga kompetitor.',
    features: [
      'High-conversion keyword optimization for Shopee & Tokopedia search algorithms',
      'Competitor discount and flash sale monitoring',
      'Listing completeness checklist to improve search impression rank',
    ],
    features_id: [
      'Rekomendasi kata kunci relevan untuk judul produk',
      'Pemantauan fluktuasi harga dan diskon kompetitor utama',
      'Saran kelengkapan atribut listing untuk menaikkan konversi',
    ],
  },
  {
    key: 'strategist',
    name: 'AI Fractional CMO & Growth Strategist',
    name_id: 'AI Strategist',
    category: 'Strategy',
    status: 'soon',
    description: 'Holistic monthly growth roadmap synthesizing insights across SEO, paid ads, competitors, and CRM',
    description_id: 'Rekomendasi bulanan lintas semua modul',
    longDescription:
      'Executive-level AI strategist consolidating findings from SEO rankings, advertising ROAS, competitor moves, and retention data into a prioritized monthly execution roadmap.',
    longDescription_id:
      'Direktur strategi AI yang mengonsolidasikan temuan dari SEO, performa iklan, pergerakan kompetitor, dan tren pasar menjadi satu rencana aksi komprehensif bulanan.',
    iconName: 'Compass',
    deliverables: 'Unified 30-day cross-functional digital marketing growth blueprint.',
    deliverables_id: 'Rencana aksi pertumbuhan digital 30 hari lintas departemen.',
    features: [
      'Holistic data synthesis across all active Markimate modules',
      'High-impact growth opportunity prioritization matrix (ICE framework)',
      'Monthly revenue target vs actual pacing analysis and corrective roadmap',
    ],
    features_id: [
      'Sintesis data holistik dari seluruh modul Markimate',
      'Penetapan prioritas inisiatif pemasaran dengan dampak tertinggi',
      'Evaluasi target capaian pendapatan vs realisasi bulan berjalan',
    ],
  },
];

export const AVAILABLE_ROLES = ROLES.filter((r) => r.status === 'available');
export const SOON_ROLES = ROLES.filter((r) => r.status === 'soon');

/**
 * Returns a localized role object based on current language ('en' | 'id')
 */
export function getLocalizedRole(roleOrKey, lang = 'en') {
  const role = typeof roleOrKey === 'string' ? ROLES.find((r) => r.key === roleOrKey) : roleOrKey;
  if (!role) return null;

  if (lang === 'id') {
    return {
      ...role,
      name: role.name_id || role.name,
      description: role.description_id || role.description,
      longDescription: role.longDescription_id || role.longDescription,
      deliverables: role.deliverables_id || role.deliverables,
      features: role.features_id || role.features,
      sampleOutput: role.sampleOutput_id || role.sampleOutput,
    };
  }

  return role;
}

/**
 * Returns all roles localized for a specific language
 */
export function getLocalizedRoles(lang = 'en') {
  return ROLES.map((r) => getLocalizedRole(r, lang));
}

/**
 * Returns categories localized for a specific language
 */
export function getLocalizedCategories(lang = 'en') {
  return ROLE_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: lang === 'id' && cat.label_id ? cat.label_id : cat.label,
  }));
}

export function getRoleByKey(key, lang = 'en') {
  const found = ROLES.find((r) => r.key === key);
  return found ? getLocalizedRole(found, lang) : null;
}
