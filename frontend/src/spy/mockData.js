// Data Mock untuk Modul Ads Creative Spy (Meta Ad Library & AI Intelligence)

export const INITIAL_COMPETITORS = [
  {
    id: 'comp-1',
    name: 'Kopi Kenangan Official',
    handle: '@kopikenangan.id',
    platform: 'meta',
    platformLabel: 'Meta Ad Library',
    pageUrl: 'https://facebook.com/kopikenangan.id',
    country: 'ID',
    schedule: 'weekly',
    activeAdsCount: 18,
    newAdsThisWeek: 6,
    winningAdsCount: 4,
    lastScannedAt: '2026-10-10T09:30:00Z',
    status: 'active',
  },
  {
    id: 'comp-2',
    name: 'Fore Coffee ID',
    handle: '@fore.coffee',
    platform: 'meta',
    platformLabel: 'Meta Ad Library',
    pageUrl: 'https://facebook.com/fore.coffee',
    country: 'ID',
    schedule: 'weekly',
    activeAdsCount: 12,
    newAdsThisWeek: 3,
    winningAdsCount: 3,
    lastScannedAt: '2026-10-09T14:15:00Z',
    status: 'active',
  },
  {
    id: 'comp-3',
    name: 'Janji Jiwa & Jiwa Toast',
    handle: '@kopijanjijiwa',
    platform: 'meta',
    platformLabel: 'Meta Ad Library',
    pageUrl: 'https://facebook.com/kopijanjijiwa',
    country: 'ID',
    schedule: 'weekly',
    activeAdsCount: 14,
    newAdsThisWeek: 5,
    winningAdsCount: 2,
    lastScannedAt: '2026-10-10T11:00:00Z',
    status: 'active',
  },
];

export const INITIAL_CREATIVES = [
  {
    id: 'cr-spy-1',
    competitorId: 'comp-1',
    competitorName: 'Kopi Kenangan Official',
    format: 'video',
    formatLabel: 'Vertical Video (9:16)',
    headline: 'Menu Baru Butterscotch Aren! Beli 2 Cuma Rp 35rb',
    bodyText:
      'Promo gajian datang lebih awal! Cobain perpaduan butterscotch creamy dengan gula aren asli nusantara. Dapatkan diskon 40% khusus pemesanan hari ini via aplikasi resmi.',
    cta: 'Pesan Sekarang',
    landingPageUrl: 'https://kopikenangan.com/app/promo-butterscotch',
    startedDate: '2026-08-25',
    daysRunning: 47,
    isWinning: true, // tayang > 30 hari = winning
    isNew: false,
    isSavedToSwipe: true,
    thumbnailUrl:
      'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
    mediaUrl:
      'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&auto=format&fit=crop&q=80',
    aiAnalysis: {
      hook: 'Tampilan swirl sirup butterscotch yang mengalir di dinding cup dalam 2 detik pertama (Visual Sensory Hook).',
      angle: 'Indulgence & Reward Diri — "Self reward kopi enak tanpa kantong bolong di akhir bulan".',
      offer: 'Paket Bundling Beli 2 Rp 35.000 (Diskon ~40%) + Gratis Ongkir via App.',
      audience: 'Pekerja kantoran usia 22-35 tahun di kota tier 1 & 2, pecinta kopi susu manis.',
      whyWinning:
        'Iklan telah tayang selama 47 hari nonstop tanpa jeda budget. Video format vertikal dengan pacing cepat dan price anchor yang jelas terbukti mempertahankan ROAS tinggi.',
    },
  },
  {
    id: 'cr-spy-2',
    competitorId: 'comp-2',
    competitorName: 'Fore Coffee ID',
    format: 'video',
    formatLabel: 'Vertical Video (9:16)',
    headline: 'Jangan Bayar Rp 40rb untuk Kopi Berkualitas Arabika',
    bodyText:
      'Bosan kopi yang kemanisan dan rasa sirup buatan? Fore Coffee menggunakan 100% biji kopi Arabika nusantara dengan mesin espresso presisi. Download app dan dapatkan cup pertama cuma Rp 10.000!',
    cta: 'Instal Sekarang',
    landingPageUrl: 'https://fore.coffee/download-app',
    startedDate: '2026-09-01',
    daysRunning: 40,
    isWinning: true,
    isNew: false,
    isSavedToSwipe: false,
    thumbnailUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=80',
    mediaUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80',
    aiAnalysis: {
      hook: 'Pertanyaan provokatif di detik 1: "Kenapa masih bayar mahal kalau ada biji arabika asli?" (Contrarian Hook).',
      angle: 'Premium Quality with No-Brainer Trial — memposisikan diri sebagai alternatif kopi mewah yang lebih higienis dan pintar.',
      offer: 'Cup Pertama Rp 10.000 untuk pengguna baru aplikasi.',
      audience: 'Urban profesional usia 24-38 tahun, peduli kualitas beans dan praktis take-away.',
      whyWinning:
        'Penawaran akuisisi pengguna baru (First Cup Rp 10k) sangat agresif dengan friction rendah, menghasilkan install rate tinggi.',
    },
  },
  {
    id: 'cr-spy-3',
    competitorId: 'comp-3',
    competitorName: 'Janji Jiwa & Jiwa Toast',
    format: 'carousel',
    formatLabel: 'Carousel Multi-Item (1:1)',
    headline: 'Kombinasi Sarapan Sempurna: Kopi + Toast Hangat Cuma 28rb',
    bodyText:
      'Gak sempat sarapan sebelum berangkat kerja? Ambil paket combo Kopi Susu Jiwa + Egg and Cheese Toast di outlet terdekat atau order via ShopeeFood/GrabFood.',
    cta: 'Beli Sekarang',
    landingPageUrl: 'https://jiwagroup.com/order-online',
    startedDate: '2026-10-06',
    daysRunning: 5,
    isWinning: false,
    isNew: true,
    isSavedToSwipe: true,
    thumbnailUrl:
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80',
    mediaUrl:
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
    aiAnalysis: {
      hook: 'Close-up keju meleleh di atas roti panggang renyah (Food Porn Hook).',
      angle: 'Solusi Waktu Pagi Terburu-buru — sarapan cepat dan kenyang dengan harga terjangkau.',
      offer: 'Kombo Sarapan Rp 28.000 (Kopi + Toast).',
      audience: 'Mahasiswa dan karyawan pagi hari usia 18-30 tahun.',
      whyWinning:
        'Iklan baru tayang 5 hari, namun menunjukkan engagement CTR tinggi karena menargetkan jam lapar pagi (07:00-10:00).',
    },
  },
  {
    id: 'cr-spy-4',
    competitorId: 'comp-1',
    competitorName: 'Kopi Kenangan Official',
    format: 'image',
    formatLabel: 'Single Image (4:5)',
    headline: 'Promo Gajian 50% Cashback QRIS Mandiri & BCA',
    bodyText:
      'Khusus pengguna QRIS perbankan terpilih! Nikmati cashback langsung 50% setiap pembelian varian minuman signature tanpa minimal transaksi.',
    cta: 'Dapatkan Penawaran',
    landingPageUrl: 'https://kopikenangan.com/promo-qris',
    startedDate: '2026-09-25',
    daysRunning: 16,
    isWinning: false,
    isNew: true,
    isSavedToSwipe: false,
    thumbnailUrl:
      'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=80',
    mediaUrl:
      'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80',
    aiAnalysis: {
      hook: 'Badge warna cerah bertuliskan "CASHBACK 50%" di tengah visual cup kopi.',
      angle: 'Kemitraan Perbankan (Co-marketing) — memanfaatkan trust bank nasional.',
      offer: 'Cashback 50% max Rp 15.000.',
      audience: 'Nasabah perbankan digital aktif usia 20-45 tahun.',
      whyWinning: 'Menurunkan resistensi beli dengan subsidi pihak ketiga.',
    },
  },
  {
    id: 'cr-spy-5',
    competitorId: 'comp-2',
    competitorName: 'Fore Coffee ID',
    format: 'carousel',
    formatLabel: 'Carousel Multi-Item (1:1)',
    headline: 'Varian Plant-Based Oatmilk: Rendah Kalori, Rasa Maksimal',
    bodyText:
      'Untuk kamu yang lactose-intolerant atau menjaga diet sehat. Coba varian Iced Oat Latte kami dengan creamy oat milk bebas gula pasir berlebih.',
    cta: 'Pesan Sekarang',
    landingPageUrl: 'https://fore.coffee/menu/plant-based',
    startedDate: '2026-08-10',
    daysRunning: 62,
    isWinning: true,
    isNew: false,
    isSavedToSwipe: true,
    thumbnailUrl:
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    mediaUrl:
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    aiAnalysis: {
      hook: 'Fokus teks: "Lactose Intolerant tapi Pengen Ngopi?" (Empathy Pain Point Hook).',
      angle: 'Health & Wellness Positioning — Kopi bersih untuk gaya hidup modern tanpa rasa begah.',
      offer: 'Free Upgrade ke Oat Milk setiap hari Rabu.',
      audience: 'Komunitas fitness, vegetarian, dan konsumen peduli kesehatan usia 22-38 tahun.',
      whyWinning:
        'Iklan evergreen yang telah tayang lebih dari 60 hari. Menargetkan niche pasar yang sangat loyal dengan churn rendah.',
    },
  },
];

export const INITIAL_SPY_INSIGHTS = {
  week: '2026-W41',
  periodLabel: 'Minggu ke-41 (6 - 12 Oktober 2026)',
  summary: {
    totalAdsMonitored: 44,
    newAdsThisWeek: 14,
    winningAdsIdentified: 9,
    dominantFormat: 'Vertical Video (9:16)',
    dominantAngle: 'Promo Bundling & Trial Pengguna Baru',
  },
  formatBreakdown: [
    { format: 'Vertical Video (9:16)', percentage: 58, count: 26 },
    { format: 'Carousel Multi-Item', percentage: 27, count: 12 },
    { format: 'Single Static Image', percentage: 15, count: 6 },
  ],
  dominantThemes: [
    {
      title: 'Hook Visual "Sensory Pours"',
      description:
        '64% dari video yang tayang lebih dari 30 hari menggunakan close-up pouring sirup atau espresso di 2 detik awal tanpa teks berlebihan.',
      trend: '+28% dibanding bulan lalu',
    },
    {
      title: 'Strategi Penawaran Bundling Makanan & Minuman',
      description:
        'Kompetitor mulai agresif menggabungkan kopi dengan bakery/toast untuk mendongkrak Average Order Value (AOV) di atas Rp 40.000.',
      trend: '+35% kemunculan di library',
    },
    {
      title: 'Diskon Bersyarat Aplikasi (App-Exclusives)',
      description:
        'Mayoritas call-to-action (72%) mengarahkan pengguna untuk mengunduh aplikasi proprietary demi mengumpulkan data first-party.',
      trend: 'Dominan di semua brand',
    },
  ],
  actionRecommendations: [
    {
      id: 'rec-1',
      title: 'Create Texture-Focused Video Hook (Sensory Pour)',
      action:
        'Produce 3 variations of 15s vertical videos with a 2-second close-up showcasing product texture.',
      impact: 'Potential increase in 3-second hook rate up to +32%.',
    },
    {
      id: 'rec-2',
      title: 'Test Package Offers Between Rp 35k - Rp 45k',
      action:
        'Combine 2 top-selling items in a special offer to compete with rival flash promotions.',
      impact: 'Increases conversion rate and contribution margin.',
    },
    {
      id: 'rec-3',
      title: 'Leverage Contrast Headline / Quality Education',
      action:
        'Use the angle "Why pay more for X when you can get premium Y?" to educate on ingredient superiority.',
      impact: 'Highly effective at capturing audiences fatigued by generic discount ads.',
    },
  ],
};
