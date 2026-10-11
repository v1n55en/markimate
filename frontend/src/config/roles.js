// Sumber kebenaran role (16 AI Digital Marketing Team Roles)
// Digunakan oleh Homepage, Halaman Detail Role, Sidebar, dan Billing

export const ROLE_CATEGORIES = [
  { key: 'all', label: 'Semua Kategori' },
  { key: 'Ads', label: 'Periklanan (Ads)' },
  { key: 'Content', label: 'Konten & SEO' },
  { key: 'Research', label: 'Riset & Intelijen' },
  { key: 'Analytics', label: 'Analitik & Pelaporan' },
  { key: 'Engagement', label: 'Interaksi & Komunitas' },
  { key: 'Retention', label: 'Retensi & CRM' },
  { key: 'Growth', label: 'Pertumbuhan & Penjualan' },
  { key: 'Commerce', label: 'Marketplace' },
  { key: 'Strategy', label: 'Strategi' },
];

export const ROLES = [
  {
    key: 'seo',
    name: 'SEO Specialist',
    category: 'Content',
    status: 'available',
    description: 'Riset keyword, tulis artikel SEO, kirim ke WordPress/Wix setelah kamu setujui',
    longDescription:
      'Spesialis SEO berbasis AI yang memantau tren pencarian Google, memetakan kata kunci bernilai tinggi, menyusun artikel mendalam yang ramah mesin pencari, dan menerbitkan langsung ke CMS pilihan Anda setelah melewati persetujuan.',
    iconName: 'Terminal',
    path: '/app/seo/keywords',
    deliverables: 'Artikel SEO siap terbit, analisis keyword difficulty, integrasi langsung ke WordPress/Wix/Sanity/Shopify.',
    features: [
      'Riset tren pencarian otomatis via SerpAPI & Google Trends',
      'Penyusunan artikel komprehensif dengan AI mutakhir',
      'Drawer review editorial: tinjau dan edit sebelum dipublikasikan',
      'Penerbitan otomatis ke WordPress, Wix, Sanity, dan Shopify',
      'Penjadwalan harian / mingguan untuk konsistensi ranking',
    ],
    sampleOutput: 'Draf artikel 1.200+ kata lengkap dengan heading structure, meta description, dan formatting CMS.',
  },
  {
    key: 'ads_report',
    name: 'Ads Specialist — Report Semua Platform',
    category: 'Ads',
    status: 'available',
    description: 'Laporan bulanan Meta, Google, TikTok, GMV Max (TikTok Shop/Tokopedia), Shopee + insight AI',
    longDescription:
      'Spesialis pelaporan iklan multi-channel yang mengonsolidasi performa berbayar dari Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, dan Shopee Ads dalam satu dashboard terintegrasi, siap diekspor ke Google Slides & Sheets.',
    iconName: 'BarChart2',
    path: '/app/ads',
    deliverables: 'Eksekutif dashboard, ringkasan ROAS & GMV toko, slide presentasi bulanan, sheet spreadsheet lengkap.',
    features: [
      'Koneksi OAuth Read-Only ke 5 platform periklanan & marketplace',
      'Agregasi metrik: Spend, Impressions, Clicks, Conversions, GMV, dan ROAS',
      'Grafik tren 6 bulan dan pergerakan metrik harian interaktif',
      'Breakdown campaign, placement, demografi, dan top produk',
      'Insight strategis AI untuk efisiensi budget bulan berikutnya',
      'Ekspor otomatis ke Google Slides dan Google Sheets',
    ],
    sampleOutput: 'Dek presentasi performa bulanan siap meeting stakeholder dan tabel Google Sheets rapi.',
  },
  {
    key: 'ads_spy',
    name: 'Ads Creative Spy',
    category: 'Research',
    status: 'available',
    description: 'Pantau iklan kompetitor, kumpulkan creative, rangkum pola hook & penawaran',
    longDescription:
      'Spesialis intelijen kompetitor yang memantau perpustakaan iklan (Meta Ad Library & TikTok), mendeteksi materi iklan yang paling lama tayang (winning creatives), dan membedah formula hook, angle penawaran, serta visual yang efektif.',
    iconName: 'Eye',
    path: '/app/spy',
    deliverables: 'Galeri swipe file iklan kompetitor, sinyal winning ads, laporan pola penawaran mingguan.',
    features: [
      'Pemantauan otomatis Meta Ad Library & platform iklan kompetitor',
      'Deteksi iklan tayang lama (indikasi winning creatives)',
      'Bedah anatomi iklan: formula hook 3 detik, angle emosional, dan CTA',
      'Penyimpanan swipe file kolektif untuk inspirasi tim kreatif',
      'Rangkuman insight mingguan & tren penawaran di industri Anda',
    ],
    sampleOutput: 'Koleksi kartu iklan kompetitor dengan durasi tayang, transkrip copy, dan analisis hook AI.',
  },
  {
    key: 'social',
    name: 'Social Media Specialist',
    category: 'Content',
    status: 'soon',
    description: 'Kalender konten, caption, carousel dari artikel & tren',
    longDescription:
      'Spesialis media sosial yang mengubah artikel dan topik tren menjadi kalender posting bulanan, caption yang engaging, ide video pendek Reels/TikTok, serta slide carousel.',
    iconName: 'Share2',
    deliverables: 'Kalender konten bulanan, ide carousel, dan naskah caption lengkap.',
    features: [
      'Repurposing otomatis artikel blog menjadi materi media sosial',
      'Penyusunan kalender editorial terstruktur per minggu',
      'Rekomendasi hashtag dan audio tren',
    ],
  },
  {
    key: 'organic_report',
    name: 'Report & Analytics Organik',
    category: 'Analytics',
    status: 'soon',
    description: 'Laporan IG & TikTok: follower, top post, engagement',
    longDescription:
      'Spesialis analitik organik yang mengumpulkan performa akun media sosial: pertumbuhan pengikut, jangkauan konten, video viral, dan rasio interaksi audiens.',
    iconName: 'PieChart',
    deliverables: 'Laporan performa organik bulanan Instagram & TikTok.',
    features: [
      'Pelacakan pertumbuhan follower dan reach organik',
      'Identifikasi postingan dengan engagement tertinggi',
      'Analisis jam posting terbaik audiens Anda',
    ],
  },
  {
    key: 'trend',
    name: 'Trend Researcher',
    category: 'Research',
    status: 'soon',
    description: 'Tren topik, menu, produk, dan konten di niche-mu',
    longDescription:
      'Spesialis riset tren pasar yang memindai percakapan viral, kata kunci naik daun, serta inovasi produk kompetitor secara real-time di industri Anda.',
    iconName: 'TrendingUp',
    deliverables: 'Briefing tren mingguan dan rekomendasi sudut pandang konten.',
    features: [
      'Pemindaian tren Google Trends, Twitter/X, dan TikTok audio',
      'Deteksi dini pergeseran minat konsumen di kategori bisnis Anda',
      'Ide menu atau produk turunan bernilai jual tinggi',
    ],
  },
  {
    key: 'copy',
    name: 'Copywriter & Ad Creative Generator',
    category: 'Content',
    status: 'soon',
    description: 'Variasi copy & visual iklan dari brief dan hasil spy',
    longDescription:
      'Spesialis copywriting persuasif yang menghasilkan puluhan variasi judul, teks iklan, dan storyboard visual berdasarkan data swipe file iklan pemenang.',
    iconName: 'Sparkles',
    deliverables: 'Matriks copy iklan (hook, body, CTA) dan arahan visual kreatif.',
    features: [
      'Generator naskah iklan berbasis formula AIDA & PAS',
      'Variasi sudut pandang audiens untuk A/B testing',
      'Adaptasi instan dari insight Ads Creative Spy',
    ],
  },
  {
    key: 'community',
    name: 'Community Manager',
    category: 'Engagement',
    status: 'soon',
    description: 'Draf balasan komentar & DM, deteksi komplain',
    longDescription:
      'Spesialis interaksi komunitas yang menyaring komentar masuk, membuat draf balasan ramah dalam hitungan detik, serta mengidentifikasi komplain pelanggan secara dini.',
    iconName: 'MessageSquare',
    deliverables: 'Asisten draf respons komentar dan peringatan sentimen negatif.',
    features: [
      'Klasifikasi pertanyaan produk, pujian, dan komplain',
      'Pembuatan draf balasan kontekstual sesuai brand voice',
      'Eskalasi prioritas tinggi untuk kendala layanan pelanggan',
    ],
  },
  {
    key: 'kol',
    name: 'KOL / Influencer Researcher',
    category: 'Research',
    status: 'soon',
    description: 'Cari kreator sesuai niche + engagement rate',
    longDescription:
      'Spesialis kurasi influencer yang mencari kreator mikro dan makro di Instagram & TikTok dengan engagement rate tinggi dan audiens relevan.',
    iconName: 'Users',
    deliverables: 'Database kandidat influencer terverifikasi dan estimasi tarif/jangkauan.',
    features: [
      'Penyaringan kreator berdasarkan demografi audiens',
      'Kalkulasi engagement rate riil tanpa fake followers',
      'Template pesan outreach dan negosiasi kolaborasi',
    ],
  },
  {
    key: 'reviews',
    name: 'Review & Reputation Monitor',
    category: 'Engagement',
    status: 'soon',
    description: 'Pantau ulasan Google Maps & marketplace',
    longDescription:
      'Spesialis reputasi brand yang mengawasi ulasan pelanggan di Google Business Profile, Shopee, dan Tokopedia, menyusun respons apresiatif dan resolusi komplain.',
    iconName: 'Star',
    deliverables: 'Laporan sentimen ulasan dan draf tanggapan otomatis.',
    features: [
      'Notifikasi cepat saat ada ulasan bintang 1–3',
      'Analisis kata yang sering dikeluhkan pelanggan',
      'Draf tanggapan profesional untuk menjaga rating toko',
    ],
  },
  {
    key: 'optimizer',
    name: 'Media Buyer / Ads Optimizer',
    category: 'Ads',
    status: 'soon',
    description: 'Alert & rekomendasi budget, fatigue, scale/pause',
    longDescription:
      'Spesialis optimasi kampanye iklan yang memantau anomali biaya harian, memberikan sinyal ad fatigue sebelum CPA membengkak, dan merekomendasikan kenaikan budget.',
    iconName: 'Sliders',
    deliverables: 'Rekomendasi penyesuaian budget dan deteksi materi iklan jenuh.',
    features: [
      'Peringatan dini kenaikan CPA di atas ambang batas toleransi',
      'Rekomendasi peningkatan budget bertahap untuk winning campaigns',
      'Pemberitahuan materi iklan yang mengalami penurunan CTR drastis',
    ],
  },
  {
    key: 'crm',
    name: 'CRM, Email & WhatsApp Marketing',
    category: 'Retention',
    status: 'soon',
    description: 'Segmentasi & broadcast terjadwal',
    longDescription:
      'Spesialis retensi pelanggan yang mengelompokkan database pembeli berdasarkan frekuensi belanja dan merancang kampanye broadcast pesan yang tidak spammy.',
    iconName: 'Send',
    deliverables: 'Skrip pesan broadcast, segmentasi pelanggan loyal, dan jadwal drip sequence.',
    features: [
      'Segmentasi RFM (Recency, Frequency, Monetary)',
      'Template broadcast edukasi dan penawaran payday',
      'Integrasi alur follow-up pesanan terabaikan',
    ],
  },
  {
    key: 'leads',
    name: 'Lead Gen & Sales Outreach',
    category: 'Growth',
    status: 'soon',
    description: 'Cari prospek & follow-up otomatis',
    longDescription:
      'Spesialis akuisisi prospek B2B dan korporasi yang memetakan target prospek relevan di industri target serta menyiapkan urutan pesan penjangkauan dingin.',
    iconName: 'Target',
    deliverables: 'Daftar prospek terverifikasi dan urutan email penjangkauan.',
    features: [
      'Pengumpulan data kontak bisnis dari direktori publik terpercaya',
      'Kustomisasi pesan outreach personalisasi skala luas',
      'Alur pengingat follow-up terjadwal',
    ],
  },
  {
    key: 'tracking',
    name: 'Tracking & Analytics Audit',
    category: 'Analytics',
    status: 'soon',
    description: 'Audit Pixel/GTM/GA4 + alert konversi anomali',
    longDescription:
      'Spesialis teknis analitik yang memastikan pelacakan Meta Pixel, Google Tag Manager, dan Google Analytics 4 terpasang akurat tanpa duplikasi event.',
    iconName: 'Activity',
    deliverables: 'Laporan kesehatan tag pelacakan dan deteksi anomali tracking.',
    features: [
      'Audit kesesuaian event Purchase dan Lead',
      'Peringatan ketika event pelacakan berhenti mengirimkan data',
      'Verifikasi kepatuhan Conversions API (CAPI)',
    ],
  },
  {
    key: 'marketplace',
    name: 'Marketplace Specialist',
    category: 'Commerce',
    status: 'soon',
    description: 'Optimasi listing & pantau harga kompetitor',
    longDescription:
      'Spesialis marketplace yang membedah judul, gambar utama, dan deskripsi produk di Shopee & Tokopedia agar tampil di halaman pertama pencarian.',
    iconName: 'ShoppingBag',
    deliverables: 'Audit skor listing produk dan pemantauan pergerakan harga kompetitor.',
    features: [
      'Rekomendasi kata kunci relevan untuk judul produk',
      'Pemantauan fluktuasi harga dan diskon kompetitor utama',
      'Saran kelengkapan atribut listing untuk menaikkan konversi',
    ],
  },
  {
    key: 'strategist',
    name: 'AI Strategist',
    category: 'Strategy',
    status: 'soon',
    description: 'Rekomendasi bulanan lintas semua modul',
    longDescription:
      'Direktur strategi AI yang mengonsolidasikan temuan dari SEO, performa iklan, pergerakan kompetitor, dan tren pasar menjadi satu rencana aksi komprehensif bulanan.',
    iconName: 'Compass',
    deliverables: 'Rencana aksi pertumbuhan digital 30 hari lintas departemen.',
    features: [
      'Sintesis data holistik dari seluruh modul Supermat',
      'Penetapan prioritas inisiatif pemasaran dengan dampak tertinggi',
      'Evaluasi target capaian pendapatan vs realisasi bulan berjalan',
    ],
  },
];

export const AVAILABLE_ROLES = ROLES.filter((r) => r.status === 'available');
export const SOON_ROLES = ROLES.filter((r) => r.status === 'soon');

export function getRoleByKey(key) {
  return ROLES.find((r) => r.key === key) || null;
}
