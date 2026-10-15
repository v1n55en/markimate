/**
 * Markimate Legal Documents (Privacy Policy & Terms of Service)
 * Bilingual: Indonesian (ID) & English (EN)
 * 
 * IMPORTANT CLAUSE (PRD F3 Step 4):
 * In the event of any discrepancy or interpretation difference between the English
 * and Indonesian versions, the Indonesian language version shall prevail.
 * 
 * NOTE: English legal translations are provided for international convenience
 * and must be marked for human legal review in compliance audits.
 */

export const LEGAL_PREVAILING_NOTICE = {
  id: 'Pemberitahuan Bahasa: Dokumen resmi ini tersedia dalam Bahasa Indonesia dan Bahasa Inggris. Apabila terdapat perbedaan penafsiran atau inkonsistensi antara versi Bahasa Inggris dan Bahasa Indonesia, maka versi Bahasa Indonesia yang berlaku secara hukum.',
  en: 'Language Notice: This official legal document is provided in Indonesian and English. In the event of any discrepancy, ambiguity, or interpretation difference between the English and Indonesian versions, the Indonesian language version shall legally prevail.',
};

export const LEGAL_LABELS = {
  id: {
    noticeHeading: 'Pemberitahuan:',
    entity: 'Entitas:',
    address: 'Alamat:',
    email: 'Email:',
    whatsapp: 'WhatsApp:',
    legalDept: 'Departemen Legal & Privasi Data',
  },
  en: {
    noticeHeading: 'Notice:',
    entity: 'Entity:',
    address: 'Address:',
    email: 'Email:',
    whatsapp: 'WhatsApp:',
    legalDept: 'Legal & Privacy Office',
  },
};

export const PRIVACY_CONTENT = {
  id: {
    seoTitle: 'Kebijakan Privasi',
    seoDescription: 'Kebijakan Privasi Markimate: Komitmen perlindungan privasi, integritas, dan keamanan data pengguna.',
    title: 'Kebijakan Privasi Markimate',
    lastUpdated: 'Terakhir diperbarui: 14 Oktober 2026 · Berlaku untuk seluruh pengguna dan peninjau platform',
    companyOfficial: 'Markimate · powered by 3our',
    companyAddress: 'Jl. BSD Raya Utama, Kabupaten Tangerang, Banten, Indonesia',
    companyEmail: 'info@3ourasia.id',
    companyPhone: '+62 851-7964-2520',
    sections: [
      {
        number: '1',
        title: 'Pendahuluan & Identitas Pengelola',
        content: `Selamat datang di Markimate, platform Semua Tim Digital Marketing dalam Satu Platform yang dikembangkan dan dioperasikan oleh Markimate · powered by 3our. Kami berkomitmen penuh untuk melindungi privasi, integritas, dan keamanan data seluruh pengguna kami, termasuk data yang diakses melalui integrasi Application Programming Interface (API) platform pihak ketiga.`,
        hasCompanyBox: true,
      },
      {
        number: '2',
        title: 'Data yang Kami Kumpulkan & Akses',
        content: `Markimate menyediakan modul layanan: SEO Article Automation, Ads Performance Report, dan Ads Creative Spy. Dalam menyediakan layanan laporan performa periklanan, sistem kami mengakses data dari platform mitra (seperti Shopee Open Platform, TikTok Marketing API & TikTok Shop, Meta Marketing API, serta Google Ads API):`,
        bullets: [
          'Metrik Performa Kampanye: Total biaya iklan (spend/cost), impresi (impressions), klik (clicks), rasio klik-tayang (CTR), biaya per klik (CPC), jumlah konversi/pesanan (conversions/orders), Gross Merchandise Value (GMV), dan Return on Ad Spend (ROAS).',
          'Identitas Akun & Toko: Nama toko/akun iklan, ID toko (Shop ID), ID akun iklan (Ad Account ID / Customer ID / Advertiser ID).',
          'Metadata Kampanye & Materi Iklan: Nama kampanye, grup iklan, nama produk terkait iklan, format iklan, serta thumbnail materi kreatif untuk keperluan penyusunan laporan visual.',
          'Data Akun Pengguna Markimate: Nama brand bisnis, alamat email, serta preferensi CMS yang didaftarkan saat pembuatan akun.',
        ],
      },
      {
        number: '3',
        title: 'Tujuan Penggunaan Data & Sifat Akses Read-Only',
        alertBox: 'Akses Sepenuhnya Read-Only (Hanya Baca): Seluruh otorisasi yang diminta oleh Markimate bersifat read-only. Kami tidak pernah meminta atau menggunakan izin untuk membuat, memodifikasi, menghentikan kampanye iklan, memotong saldo keuangan, atau mengubah pengaturan toko Anda.',
        content: 'Data yang diakses digunakan semata-mata untuk tujuan:',
        bullets: [
          'Menghasilkan ringkasan dasbor performa multi-platform bulanan bagi pemilik akun.',
          'Menyusun laporan presentasi eksekutif otomatis (Google Slides) dan spreadsheet rekapitulasi data (Google Sheets) untuk keperluan review bisnis Anda.',
          'Menghasilkan analisis komparatif dan insight rekomendasi optimasi biaya berbasis AI.',
        ],
      },
      {
        number: '4',
        title: 'Jaminan Tidak Menjual atau Membagikan Data',
        content: 'Markimate · powered by 3our menegaskan bahwa kami tidak pernah dan tidak akan pernah menjual, menyewakan, menukar, atau memonetisasi data bisnis, data iklan, atau informasi pelanggan Anda kepada pihak ketiga mana pun untuk tujuan periklanan pihak ketiga, pialang data (data broker), atau tujuan lain di luar operasional layanan Markimate yang secara tegas disetujui pengguna.',
      },
      {
        number: '5',
        title: 'Penyimpanan Data & Keamanan Token OAuth',
        securityBox: 'Enkripsi Tingkat Tinggi: Kredensial otentikasi (Access Token & Refresh Token OAuth) disimpan secara terenkripsi menggunakan algoritma standar industri (AES-256) pada pangkalan data terisolasi. Token hanya didekripsi saat sistem melakukan panggilan API terjadwal untuk penyusunan laporan berkala.',
        content: 'Kami menerapkan kontrol akses berbasis peran (RBAC), transmisi data terenkripsi SSL/TLS HTTPS end-to-end, dan pemantauan keamanan berkala untuk mencegah akses tanpa hak.',
      },
      {
        number: '6',
        title: 'Hak Pengguna & Cara Mencabut Akses Otorisasi',
        content: 'Pengguna memiliki kendali penuh atas koneksi platform iklan dan marketplace yang terhubung. Anda dapat mencabut izin akses kapan saja melalui salah satu cara berikut:',
        ordered: [
          'Melalui Dasbor Markimate: Masuk ke akun Anda, buka menu Ads Report → Koneksi Platform, lalu klik tombol Putuskan pada akun yang ingin dicabut. Token akses akan segera dihapus dari sistem kami.',
          'Melalui Pengaturan Platform Masing-Masing: Shopee (Seller Centre > Pengaturan Akun > Aplikasi Terhubung), TikTok (Business Center / Seller Center > Authorized Apps), Meta (Pengaturan Bisnis Meta > Integrasi Bisnis), Google (Akun Google > Keamanan > Kelola akses pihak ketiga).',
        ],
      },
      {
        number: '7',
        title: 'Perubahan Kebijakan Privasi',
        content: 'Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu seiring dengan penambahan fitur atau penyesuaian regulasi perlindungan data. Setiap pembaruan substansial akan diumumkan melalui pemberitahuan di dasbor aplikasi atau melalui email terdaftar.',
      },
      {
        number: '8',
        title: 'Kontak Pertanyaan & Layanan Pelanggan',
        content: 'Apabila Anda memiliki pertanyaan, klarifikasi, atau permintaan penghapusan data terkait kebijakan privasi ini, silakan hubungi tim kami di:',
        hasContactCard: true,
      },
    ],
  },
  en: {
    seoTitle: 'Privacy Policy',
    seoDescription: 'Markimate Privacy Policy: Our commitment to protecting user privacy, data integrity, and enterprise security.',
    title: 'Markimate Privacy Policy',
    lastUpdated: 'Last Updated: October 14, 2026 · Applicable to all platform users and reviewers',
    companyOfficial: 'Markimate · powered by 3our',
    companyAddress: 'Jl. BSD Raya Utama, Tangerang Regency, Banten, Indonesia',
    companyEmail: 'info@3ourasia.id',
    companyPhone: '+62 851-7964-2520',
    sections: [
      {
        number: '1',
        title: 'Introduction & Operating Entity',
        content: `Welcome to Markimate, the full digital marketing team platform developed and operated by Markimate · powered by 3our. We are fully committed to protecting the privacy, confidentiality, and security of all user data, including data accessed through third-party Application Programming Interface (API) integrations.`,
        hasCompanyBox: true,
      },
      {
        number: '2',
        title: 'Data We Collect & Access',
        content: `Markimate operates autonomous AI modules including SEO Article Automation, Ads Performance Report, and Ads Creative Spy. To deliver multi-channel ad reporting, our system connects via official APIs (Shopee Open Platform, TikTok Marketing API & TikTok Shop, Meta Marketing API, and Google Ads API):`,
        bullets: [
          'Campaign Performance Metrics: Total ad spend/cost, impressions, clicks, click-through rate (CTR), cost-per-click (CPC), conversions/orders, Gross Merchandise Value (GMV), and Return on Ad Spend (ROAS).',
          'Account & Store Identity: Store/account name, Shop ID, and Ad Account ID / Customer ID / Advertiser ID.',
          'Campaign Metadata & Creative Assets: Campaign names, ad group names, advertised product titles, ad formats, and creative thumbnails required to compile visual performance decks.',
          'Markimate User Account Data: Brand name, work email address, and CMS platform preferences provided during registration.',
        ],
      },
      {
        number: '3',
        title: 'Purpose of Data Use & Read-Only Nature',
        alertBox: 'Strictly Read-Only Access: All API permissions requested by Markimate are strictly read-only. We never request or execute permissions to create, modify, pause campaigns, deduct financial balances, or modify your store configurations.',
        content: 'Accessed data is processed exclusively for:',
        bullets: [
          'Generating consolidated multi-channel monthly performance dashboard overviews for the account owner.',
          'Compiling automated executive presentation slide decks (Google Slides) and tabular summaries (Google Sheets) for your business reviews.',
          'Generating AI-driven comparative spend analysis and optimization insights.',
        ],
      },
      {
        number: '4',
        title: 'Guarantee of Zero Data Selling or Sharing',
        content: 'Markimate · powered by 3our strictly affirms that we never sell, rent, monetize, or disclose your proprietary business metrics, ad data, or customer records to any third party, data broker, or commercial advertising entity.',
      },
      {
        number: '5',
        title: 'Data Storage & OAuth Token Security',
        securityBox: 'Enterprise-Grade Encryption: Authentication credentials (OAuth Access & Refresh Tokens) are stored using AES-256 encryption within isolated databases. Decryption occurs only during scheduled automated report generation runs.',
        content: 'We enforce Role-Based Access Control (RBAC), end-to-end SSL/TLS HTTPS data transit encryption, and continuous vulnerability monitoring.',
      },
      {
        number: '6',
        title: 'User Rights & Revoking Access Permissions',
        content: 'You maintain absolute ownership and control over connected platforms. You may revoke API authorization at any time via:',
        ordered: [
          'Inside Markimate Console: Sign in, navigate to Ads Report > Platform Connections, and click "Disconnect" on the target account. Access tokens are immediately purged.',
          'Via Respective Platform Portals: Shopee (Seller Centre > Account Settings > Connected Partner Apps), TikTok (Business Center / Seller Center > Authorized Apps), Meta (Business Settings > Business Integrations), Google (Google Account > Security > Third-Party Access).',
        ],
      },
      {
        number: '7',
        title: 'Privacy Policy Updates',
        content: 'We may periodically update this Privacy Policy to reflect platform enhancements or statutory data protection requirements. Material modifications will be announced via your workspace notification drawer or registered email.',
      },
      {
        number: '8',
        title: 'Contact Information & Privacy Officer',
        content: 'If you have any questions, clarifications, or data deletion requests concerning this Privacy Policy, please contact our privacy office at:',
        hasContactCard: true,
      },
    ],
  },
};

export const TERMS_CONTENT = {
  id: {
    seoTitle: 'Syarat & Ketentuan Layanan',
    seoDescription: 'Syarat dan Ketentuan Penggunaan Layanan Markimate: Ketentuan umum, hak cipta, dan kewajiban pengguna.',
    title: 'Syarat & Ketentuan Layanan',
    lastUpdated: 'Markimate · powered by 3our · Terakhir diperbarui: 14 Oktober 2026',
    sections: [
      {
        number: '1',
        title: 'Ketentuan Umum',
        content: `Dengan mendaftar, mengakses, atau menggunakan layanan Markimate yang disediakan oleh Markimate · powered by 3our ("kami"), Anda menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini. Apabila Anda tidak menyetujui bagian mana pun dari ketentuan ini, Anda dipersilakan untuk tidak menggunakan layanan kami.`,
      },
      {
        number: '2',
        title: 'Deskripsi Layanan & Human-in-the-Loop',
        content: `Markimate menyediakan platform Semua Tim Digital Marketing dalam Satu Platform dengan 16 role AI spesialis, termasuk SEO Article Automation, Ads Performance Report, dan Ads Creative Spy. Seluruh deliverable AI wajib ditinjau dan disetujui oleh pengguna (Human-in-the-Loop) sebelum diterbitkan atau digunakan.`,
      },
      {
        number: '3',
        title: 'Kewajiban & Integritas Akun Pengguna',
        content: `Pengguna bertanggung jawab penuh atas kerahasiaan kredensial akun mereka. Pengguna menjamin bahwa akun toko, ad account, serta website CMS yang dihubungkan ke Markimate adalah milik sah pengguna atau pengguna memiliki kuasa resmi dari pemilik yang bersangkutan untuk mengelolanya.`,
      },
      {
        number: '4',
        title: 'Sistem Credit, Free Trial & Ketentuan Refund',
        content: `Setiap akun baru berhak atas free trial 7 hari dengan alokasi 300 credit tanpa kewajiban kartu kredit. Credit top-up berlaku selama 365 hari sejak tanggal pembelian. Paket langganan bulanan atau bundle yang telah diproses tidak dapat di-refund setelah kuota credit periode tersebut digunakan sebagian atau seluruhnya.`,
      },
      {
        number: '5',
        title: 'Hak Kekayaan Intelektual',
        content: `Seluruh konten, artikel, dan materi kreatif yang dihasilkan melalui akun pengguna merupakan hak milik eksklusif pengguna. Kode sumber platform, algoritma autonomous agent, dan merek dagang Markimate merupakan hak kekayaan intelektual Markimate · powered by 3our.`,
      },
      {
        number: '6',
        title: 'Hukum yang Berlaku & Yurisdiksi',
        content: `Syarat dan ketentuan ini diatur dan ditafsirkan berdasarkan hukum Negara Republik Indonesia. Segala perselisihan yang timbul akan diselesaikan secara musyawarah mufakat atau melalui yurisdiksi Pengadilan Negeri di wilayah Republik Indonesia.`,
      },
    ],
  },
  en: {
    seoTitle: 'Terms of Service',
    seoDescription: 'Markimate Terms of Service: Platform usage guidelines, intellectual property rights, and user responsibilities.',
    title: 'Terms of Service',
    lastUpdated: 'Markimate · powered by 3our · Last Updated: October 14, 2026',
    sections: [
      {
        number: '1',
        title: 'General Terms',
        content: `By registering, accessing, or utilizing the Markimate platform provided by Markimate · powered by 3our ("we", "us", or "our"), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree to any part of these terms, you must refrain from using the platform.`,
      },
      {
        number: '2',
        title: 'Service Description & Human-in-the-Loop',
        content: `Markimate provides a comprehensive digital marketing platform featuring 16 specialized AI roles, including SEO Article Automation, Ads Performance Report, and Ads Creative Spy. All AI outputs require human editorial review and explicit approval (Human-in-the-Loop) prior to publishing or live deployment.`,
      },
      {
        number: '3',
        title: 'User Account Responsibilities & Integrity',
        content: `Users maintain full responsibility for securing account credentials. You represent and warrant that connected marketplace stores, advertising accounts, and CMS websites are either directly owned by you or that you possess valid legal authorization to manage them.`,
      },
      {
        number: '4',
        title: 'Credit System, Free Trial & Refund Policy',
        content: `Every newly registered account receives a 7-day free trial containing 300 credits with zero credit card required. Top-up credit packs remain valid for 365 calendar days from the purchase date. Subscription and bundle payments are non-refundable once allocated credits have been partially or fully utilized during the billing cycle.`,
      },
      {
        number: '5',
        title: 'Intellectual Property Rights',
        content: `All content, articles, and marketing deliverables generated through your authorized workspace remain your exclusive intellectual property. The Markimate software architecture, autonomous agent algorithms, and trademarks remain the proprietary intellectual property of Markimate · powered by 3our.`,
      },
      {
        number: '6',
        title: 'Governing Law & Jurisdiction',
        content: `These Terms shall be governed by and construed in accordance with the laws of the Republic of Indonesia. Any dispute arising from or related to these Terms shall be resolved amicably or submitted to the competent courts of the Republic of Indonesia.`,
      },
    ],
  },
};
