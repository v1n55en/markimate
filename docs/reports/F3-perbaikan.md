# Laporan Perbaikan PRD Markimate F3 (Bilingual Review)

Dokumen ini mencatat setiap langkah perbaikan hasil review commit `2b4c9b9`–`a164132`.
Mode eksekusi: **Autopilot**.

---

## Langkah 0 — Satu LanguageToggle per Layar & Routing Terlokalisasi

### 1. Ringkasan Perubahan
- **Komponen `.lang-toggle`**: Membuat komponen pill ramping dengan class `.lang-toggle` (height 28px, mobile 26px, globe icon 13px, font 0.75rem, radius 6px) dengan area sentuh pseudo-element `::after { inset: -8px; min-width: 44px; min-height: 44px; }` sehingga memenuhi standar aksesibilitas touch target minimal 44px tanpa merusak estetika antarmuka.
- **Pembersihan Switcher Ganda**:
  - `PublicNavbar.jsx`: Satu toggle di header (desktop di CTA group, mobile di sebelah hamburger menu). Hapus toggle duplikat di dalam drawer mobile.
  - `PublicFooter.jsx`: Hapus switcher dari footer agar tidak ada 2 toggle di halaman publik.
  - `Sidebar.jsx`: Gunakan satu `.lang-toggle` di bagian bawah sidebar.
  - Halaman Auth (`AuthScreen.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `VerifyPage.jsx`, `InvitePage.jsx`): Hapus semua switcher yang disematkan di dalam kartu.
- **Layout Terpusat Auth (`AuthLayout.jsx`)**: Membungkus seluruh rute otentikasi dengan wrapper yang menempatkan satu `.lang-toggle` di pojok kanan atas (`top: max(1rem, env(safe-area-inset-top)); right: max(1rem, env(safe-area-inset-right))`).
- **Koreksi Routing & PUBLIC_PAGES**:
  - Halaman auth (`/login`, `/register`, `/forgot`, `/reset`, `/verify`, `/invite`) dikeluarkan dari `PUBLIC_PAGES` di `localized-router.jsx`. Rute auth tidak memakai prefix `/id/*`.
  - Akses ke rute lama `/id/login`, `/id/register`, `/id/forgot`, `/id/reset`, `/id/verify`, `/id/invite` dialihkan secara otomatis (redirect) ke rute kanonik.
  - Memperbaiki `LanguageContext.jsx` agar user yang memilih bahasa Indonesia tidak dipaksa kembali ke bahasa Inggris saat berpindah antar halaman publik atau auth.
  - Sinkronisasi otomatis ke profil user `PATCH /api/me { locale }` saat user mengubah bahasa.

### 2. File yang Berubah
- `frontend/src/context/LanguageContext.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/localized-router.jsx`
- `frontend/src/components/common/AuthLayout.jsx` (baru)
- `frontend/src/App.jsx`
- `frontend/src/components/PublicNavbar.jsx`
- `frontend/src/components/PublicFooter.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/pages/public/ForgotPasswordPage.jsx`
- `frontend/src/pages/public/ResetPasswordPage.jsx`
- `frontend/src/pages/public/VerifyPage.jsx`
- `frontend/src/pages/public/InvitePage.jsx`

### 3. Cara Pengujian
1. Jalankan unit test backend: `cd backend && npm test`
2. Jalankan validasi i18n dan build frontend: `cd frontend && npm run i18n:check && npm run build`
3. Pengujian browser responsif di Chrome DevTools device toolbar lebar 360px, 390px (iPhone 14), 768px, dan 1280px.
4. Verifikasi klik toggle mengubah bahasa dan URL (`/` <-> `/id`), serta halaman auth mempertahankan bahasa yang dipilih.

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes lulus)**
- `cd frontend && npm run i18n:check && npm run build`: **LOLOS (0 errors, 40 halaman HTML statis dan sitemap ter-generate)**
- **Checklist Mobile 390px (iPhone 14) & 360px**:
  - [x] Tepat 1 `.lang-toggle` di setiap layar (Landing page, Footer, Drawer, dan Login).
  - [x] Tidak ada scroll horizontal (`document.documentElement.scrollWidth <= window.innerWidth`).
  - [x] Touch target `.lang-toggle` memenuhi >= 44x44px melalui `::after`.
  - [x] Switch dari EN ke ID langsung memperbarui URL ke `/id` dan teks ke bahasa Indonesia.
  - [x] Halaman `/login` menampilkan toggle di pojok kanan atas, kartu login bersih tanpa tombol bahasa ganda di dalamnya.
- **Screenshot 390px**:
  - Landing Page (EN): `landing_page_390_1792026026517.png`
  - Landing Page (ID): `landing_page_id_390_1792026036711.png`
  - Login Page (Auth): `login_page_390_1792026045867.png`

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Pembersihan 194 ternary `lang.startsWith(...)` di komponen internal (dijadwalkan di Langkah A).
- Standardisasi angka produk dan istilah "kredit" (dijadwalkan di Langkah B).

---

## Langkah A — Bahasa Benar-Benar Konsisten & Bersihkan Ternary

### 1. Ringkasan Perubahan
- **Migrasi 100% Ternary ke Kamus i18n Terstruktur**:
  - Menghapus semua ternary inline `lang.startsWith('id')` dan varian anti-pattern di seluruh komponen frontend.
  - `Sidebar.jsx`, `ModuleComingSoonCard.jsx`, `BillingPage.jsx`: Menggunakan `getLocalizedRole(role, lang)` terpusat dan namespace `billing.*` untuk deskripsi modul, kuota, dan notice status langganan.
  - `SeoHead.jsx`: Default page title dan description dialihkan ke `t('meta.defaultTitle')` dan `t('meta.defaultDescription')`.
  - Halaman & Komponen Iklan (`AdsSummaryPage.jsx`, `AdsReportsPage.jsx`, `AdsReportDetailPage.jsx`, `PlatformCard.jsx`, `AdsCallbackPage.jsx`): Memindahkan 30+ string dinamis ke namespace `ads.detail.*` dan `ads.connections.*`.
  - `AutoTopicsPage.jsx`: Memindahkan 47 ekspresi ternary ke namespace `seo.autoTopics.*` dan `common.weekdays.*`.
  - `SpyCompetitorsPage.jsx` & `SpyLibraryPage.jsx`: Memindahkan 34 ekspresi ternary ke namespace `spy.competitors.*` dan `spy.library.*`.
  - `AnalyticsDashboard.jsx`: Memindahkan 16 ekspresi ternary ke namespace `seo.analytics.*`.
  - `KeywordManager.jsx`: Memindahkan 14 ekspresi ternary ke namespace `seo.keywords.*`.
  - `CmsSettings.jsx`: Menghapus ternary dan melokalisasi pengaturan profil, web approver, dan API 3Our ke namespace `seo.cms.*`.
  - `AccountSettingsPage.jsx`: Mengganti check `lang.startsWith` ke strict equality `lang === 'id'` dan `lang === 'en'` khusus pada visual selector bahasa.
- **Standardisasi Error Handling Backend & Frontend**:
  - `backend/index.js`: Middleware `wrap()` menambahkan default error code (`INTERNAL_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`) bila `e.code` belum disediakan, sehingga respons error selalu memiliki atribut `code` yang stabil.
  - `AuthScreen.jsx`: Mengintegrasikan penerjemahan error melalui `t('errors.' + err.code)` dengan fallback ke `err.message`.
- **Penguatan Script Validasi `scripts/i18n-check.mjs`**:
  - Memperluas deteksi anti-pattern ke pola `lang.startsWith('id'|'en')`, `lang ===/!== 'id'|'en'`, dan `[lang]` bracket indexing.
  - Ditetapkan whitelist terisolasi yang diizinkan untuk formatting angka/tanggal, router, dan teks legal (`LanguageContext.jsx`, `lib/format.js`, `ads/format.js`, `config/roles.js`, `config/pricing.js`, `components/common/SeoHead.jsx`, `pages/public/PrivacyPage.jsx`, `pages/public/TermsPage.jsx`, `pages/app/AccountSettingsPage.jsx`).
  - Hasil: Lolos dengan 0 forbidden ternaries dan 1612 keys memiliki key parity 1:1 sempurna.

### 2. File yang Berubah
- `backend/index.js`
- `frontend/scripts/i18n-check.mjs`
- `frontend/src/components/AnalyticsDashboard.jsx`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/components/BillingPage.jsx`
- `frontend/src/components/CmsSettings.jsx`
- `frontend/src/components/KeywordManager.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/ads/PlatformCard.jsx`
- `frontend/src/components/common/ModuleComingSoonCard.jsx`
- `frontend/src/components/common/SeoHead.jsx`
- `frontend/src/i18n/locales/en/ads.js`
- `frontend/src/i18n/locales/en/billing.js`
- `frontend/src/i18n/locales/en/common.js`
- `frontend/src/i18n/locales/en/public.js`
- `frontend/src/i18n/locales/en/seo.js`
- `frontend/src/i18n/locales/en/spy.js`
- `frontend/src/i18n/locales/id/ads.js`
- `frontend/src/i18n/locales/id/billing.js`
- `frontend/src/i18n/locales/id/common.js`
- `frontend/src/i18n/locales/id/public.js`
- `frontend/src/i18n/locales/id/seo.js`
- `frontend/src/i18n/locales/id/spy.js`
- `frontend/src/pages/ads/AdsCallbackPage.jsx`
- `frontend/src/pages/ads/AdsReportDetailPage.jsx`
- `frontend/src/pages/ads/AdsReportsPage.jsx`
- `frontend/src/pages/ads/AdsSummaryPage.jsx`
- `frontend/src/pages/app/AccountSettingsPage.jsx`
- `frontend/src/pages/seo/AutoTopicsPage.jsx`
- `frontend/src/pages/spy/SpyCompetitorsPage.jsx`
- `frontend/src/pages/spy/SpyLibraryPage.jsx`

### 3. Cara Pengujian
1. Jalankan unit test backend: `cd backend && npm test`
2. Jalankan validasi parity i18n & anti-pattern check: `cd frontend && npm run i18n:check`
3. Jalankan production build frontend: `cd frontend && npm run build`
4. Cek DevTools mobile viewport 360px & 390px pada halaman-halaman yang disentuh.

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes lulus, termasuk test suite 12)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors, perfect key parity, 0 forbidden ternaries)**
- `cd frontend && npm run build`: **LOLOS (Build Vite selesai 760ms, 40 HTML statis dan sitemap ter-generate)**
- **Checklist Mobile 390px (iPhone 14) & 360px**:
  - [x] Tidak ada scroll horizontal pada tabel dan formulir (`scrollWidth <= innerWidth`).
  - [x] Tabel di KeywordManager, AutoTopicsPage, SpyCompetitorsPage membungkus overflow secara responsif.
  - [x] Form input di CmsSettings dan AutoTopicsPage full width dengan font >= 16px.
  - [x] Tombol tindakan & touch target >= 44x44px.

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Standardisasi angka produk dan penyeragaman istilah "kredit" (dijadwalkan di Langkah B).
- Optimasi touch target dan drawer mobile di AuthScreen (dijadwalkan di Langkah C).

