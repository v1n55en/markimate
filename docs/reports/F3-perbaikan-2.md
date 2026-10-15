# Laporan Pengerjaan F3 Perbaikan Tahap 2

Dokumen ini mencatat implementasi dan hasil pengujian untuk perbaikan PRD F3 (Tahap 2) sesuai aturan autopilot di `AGENTS.md`.

---

## Langkah 1: Perbaiki Logika Bahasa (`frontend/src/context/LanguageContext.jsx`)

### Ringkasan Perubahan
1. **Urutan Penentuan Bahasa (Sesuai Keputusan 3Our)**:
   - Prefix URL `/id/*` → `id` (prioritas 1).
   - `accounts.locale` setelah login (`me.user.locale`) (prioritas 2).
   - Cookie `mk_lang` (prioritas 3).
   - `localStorage` (`markimate_lang`) (prioritas 4).
   - Default: `en` (tanpa deteksi bahasa browser `navigator.language`).
   - Logika dipisahkan ke modul murni `frontend/src/lib/resolve-language.js` dan diekspor melalui `LanguageContext.jsx`.
2. **Penghapusan Efek Pemaksaan Bahasa & Sinkronisasi State**:
   - Menghapus efek `useEffect` yang sebelumnya memaksa `en` pada semua halaman publik tanpa prefix `/id` (yang sebelumnya menimpa pilihan user saat navigasi internal).
   - Menghapus `useEffect` yang menulis ke cookie/localStorage di setiap perubahan state. Penyimpanan bahasa sekarang **hanya dilakukan di dalam `setLang`** (saat user menekan toggle atau saat login memuat `accounts.locale`).
3. **Navigasi Halaman Publik Tanpa Prefix**:
   - Jika preferensi tersimpan adalah `id`, aplikasi otomatis me-redirect (`replace: true`) ke padanan `/id/...`.
   - Jika belum ada preferensi tersimpan (kunjungan pertama), disajikan `en` tanpa menyimpan apa pun ke storage/cookie.
4. **Halaman `/id/*`**:
   - Menampilkan bahasa Indonesia tanpa menimpa cookie atau storage, kecuali user menekan toggle.
5. **Pembersihan Dead Code & Auth Protection**:
   - Menghapus pembacaan `markimate_user.locale` (dead code).
   - `setLang` hanya memanggil `PATCH /api/me` jika pengguna telah memiliki token autentikasi (`getToken()`), mencegah 401 dan logout prematur saat unauthenticated.
   - Sinkronisasi `me.user.locale` saat login di `App.jsx` menggunakan opsi `{ syncBackend: false }` agar tidak memicu panggilan PATCH duplikat.
   - Menghapus rute redirect redundant `/id/login` dan `/id/register`. Halaman auth menggunakan path kanonik tanpa prefix.
6. **Aksesibilitas & Tampilan Mobile**:
   - `LanguageToggle` diperbarui dengan `aria-label` dwibahasa: `"Switch to Bahasa Indonesia"` / `"Ganti ke English"`.
   - Pada viewport mobile (<640px), `.lang-toggle` diatur dengan tinggi 26px dan pseudo-elemen `::after` dengan `min-width: 44px; min-height: 44px` sehingga area sentuh memenuhi standar aksesibilitas $\ge 44\text{px}$.
   - Halaman `GoogleCallbackPage` dibungkus dengan `<AuthLayout>`.
7. **Pengujian Otomatis**:
   - Dibuat script unit test `frontend/scripts/test-language-resolution.mjs` untuk menguji semua permutasi prioritas resolusi bahasa. Lulus 100%.

### File yang Berubah
- `frontend/src/lib/resolve-language.js` (baru)
- `frontend/src/context/LanguageContext.jsx`
- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `frontend/scripts/test-language-resolution.mjs` (baru)

### Cara Tes
1. Unit test: `node frontend/scripts/test-language-resolution.mjs`
2. Backend test suite: `cd backend && npm test`
3. Frontend i18n & build: `cd frontend && npm run i18n:check && npm run build`
4. Browser test mobile 390px:
   - Kunjungi `/` tanpa storage/cookie → menampilkan versi English (EN).
   - Klik toggle bahasa → berpindah ke `/id` dalam Bahasa Indonesia.
   - Klik logo Markimate → tetap berada di rute `/id`.
   - Navigasi ke `/login` → formulir auth tampil dalam Bahasa Indonesia ("Masuk ke Akun Anda").

### Hasil Tes
- Backend tests: **100% lolos** (semua suite lulus).
- Frontend `i18n:check`: **100% lolos** (0 error).
- Frontend `build`: **100% lolos** (build dan sitemap generasi sukses).
- `test-language-resolution.mjs`: **100% lolos** (5/5 kategori prioritas lulus).
- Browser DevTools 390px: **Lolos** tanpa scroll horizontal, touch target toggle $\ge 44\text{px}$, navigasi `/id` dan persistensi auth terbukti mulus.

### Screenshot (390px)
- English page default: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/english_page_1792058117849.png`
- Indonesian page setelah toggle: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/indonesian_page_1792058134287.png`
- Halaman Login dalam Bahasa Indonesia: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/login_page_id_1792058212649.png`

---

## Langkah 2: Error Diterjemahkan Secara Terpusat

### Ringkasan Perubahan
1. **Penerjemahan Terpusat di `frontend/src/api.js`**:
   - `ApiError` dikonstruksi secara terpusat untuk menghasilkan pesan error terjemahan: `message = t('errors.' + code)`.
   - Menggunakan fallback `errors.UNKNOWN` ditambah kode kecil bila kode belum ada dalam kamus (`${t('errors.UNKNOWN')} (${code})`).
   - Tidak pernah lagi membocorkan `data.error` mentah dari backend ke pengguna.
2. **Helper `t()` Mandiri Tanpa Hook**:
   - Mengimplementasikan helper `t()` dan objek `i18n` di `frontend/src/i18n/index.js` yang dapat dipanggil langsung dari modul murni JavaScript (seperti `api.js`) tanpa ketergantungan pada React hook `useLanguage()`.
   - Helper mendeteksi bahasa aktif dari `document.documentElement.lang`, path URL `/id/*`, cookie `mk_lang`, atau `localStorage` dengan default `en`.
3. **Penyederhanaan Penanganan Error di Komponen**:
   - `AuthScreen.jsx` dan seluruh halaman pemanggil API kini langsung menampilkan `err.message` tanpa perlu melakukan resolusi manual `t('errors.' + err.code)`.
4. **Sinkronisasi Kode Error Baru**:
   - Menambahkan error code `FORBIDDEN` dan `BAD_REQUEST` ke `backend/lib/error-codes.js`, `frontend/src/i18n/locales/en/errors.js`, dan `frontend/src/i18n/locales/id/errors.js`.
   - Menambahkan pengujian otomatis di `frontend/scripts/i18n-check.mjs` (Langkah 2b) yang memverifikasi bahwa 100% kode di `backend/lib/error-codes.js` (65 kode error) memiliki padanan terjemahan di kamus EN dan ID.
5. **Standarisasi Pesan Error Backend ke Bahasa Inggris + Error Code**:
   - Memperbarui ~15 pesan error backend yang sebelumnya masih berbahasa Indonesia di `backend/index.js` dan `backend/lib/credits.js` menjadi Bahasa Inggris standar serta menyertakan error code (seperti `WORKSPACE_NOT_FOUND`, `USER_NOT_FOUND`, `PARAMS_REQUIRED`, `BAD_REQUEST`, `EMAIL_REQUIRED`, `UPGRADE_REQUIRED`, `CMS_NOT_CONFIGURED`, `KEYWORD_REQUIRED`, `NOT_FOUND`).

### File yang Berubah
- `backend/lib/error-codes.js`
- `backend/index.js`
- `backend/lib/credits.js`
- `frontend/src/i18n/index.js`
- `frontend/src/api.js`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/i18n/locales/en/errors.js`
- `frontend/src/i18n/locales/id/errors.js`
- `frontend/scripts/i18n-check.mjs`
- `frontend/scripts/test-api-error.mjs` (baru)

### Cara Tes
1. Unit test ApiError i18n: `node frontend/scripts/test-api-error.mjs`
2. Backend test suite: `cd backend && npm test`
3. Frontend i18n & build: `cd frontend && npm run i18n:check && npm run build`

### Hasil Tes
- `test-api-error.mjs`: **100% lolos** (EN, ID, fallback unknown code, FORBIDDEN & BAD_REQUEST terverifikasi).
- Backend tests: **100% lolos** (semua 5 file test lulus).
- Frontend `i18n:check`: **100% lolos** (seluruh 65 backend ERROR_CODES tercover di EN & ID).
- Frontend `build`: **100% lolos**.

---

## Langkah 3: Bersihkan Seluruh Literal String Frontend & Validasi ESLint i18next

### Ringkasan Perubahan
1. **Konfigurasi ESLint & Integrasi `eslint-plugin-i18next`**:
   - Memasang `eslint-plugin-i18next` di `frontend/package.json`.
   - Mengaktifkan aturan `i18next/no-literal-string` pada file antarmuka (`src/pages/**`, `src/components/**`).
   - Mengonfigurasi `words.exclude` untuk simbol (seperti `•`, `–`, `—`, `✓`, `⚠️`, `©`, `⚡`, `👑`, `🎯`), angka (`\d+`), dan nama teknis/platform resmi (seperti `Meta Ads`, `Google Ads & PMax`, `WordPress REST API`).
2. **Pembersihan String Hardcoded di Seluruh Komponen & Halaman**:
   - Mengganti seluruh literal strings menjadi kunci terjemahan dwibahasa di 30+ file frontend.
   - Mengisi kamus dwibahasa di `frontend/src/i18n/locales/en/` dan `id/` (`ads.js`, `app.js`, `auth.js`, `billing.js`, `common.js`, `public.js`, `seo.js`, `settings.js`, `spy.js`).
   - Menyediakan komponen dwibahasa penuh untuk:
     - `AdsReportDetailPage.jsx` (evaluasi materi kreatif, metrik CTR/ROAS/Hasil, insight AI & rekomendasi strategis).
     - `AdsReportsPage.jsx` & `TrendChart.jsx` (pilihan platform iklan, header grafik, label metrik, tooltip tren).
     - `ModuleActivatePage.jsx` (bundle hints, status modul, waitlist).
     - `CreditWalletPage.jsx` & `BillingPage.jsx` (kredit unit, filter modul, bonus badge, paket SEO).
     - `MembersSettingsPage.jsx` (header tim, notice undangan, modal transfer kepemilikan workspace).
     - `SecuritySettingsPage.jsx` & `AccountSettingsPage.jsx` (log IP, format tanggal, preferensi bahasa).
     - `SpyCompetitorsPage.jsx`, `SpyLibraryPage.jsx`, `SpyInsightsPage.jsx` (opsi negara, format ads, CTA badge, landing page URL).
     - `TermsPage.jsx`, `PrivacyPage.jsx`, `PublicFooter.jsx` (label legal, copyright dinamis, kontak support).
     - `AuthScreen.jsx` & `WorkspaceSelector.jsx` (niche options, catatan keamanan footer, format workspace).
     - `KeywordManager.jsx` & `AutoTopicsPage.jsx` (badge gambar terunggah, regenerate AI title, save draft, WIB hour).
3. **Verifikasi Paritas & Validasi Menyeluruh**:
   - `scripts/i18n-check.mjs`: Memvalidasi paritas 1.895 kunci kamus EN dan ID (100% cocok tanpa ada kunci yang hilang).
   - Memastikan tidak ada ternary forbidden atau akses manual `[lang]` di luar whitelist.
   - Memastikan build frontend dan sitemap generator berjalan sempurna.

### File yang Berubah
- `frontend/eslint.config.js`
- `frontend/package.json` & `frontend/package-lock.json`
- `frontend/src/i18n/locales/en/*.js` (semua domain)
- `frontend/src/i18n/locales/id/*.js` (semua domain)
- `frontend/src/components/ads/TrendChart.jsx`
- `frontend/src/components/common/InsufficientCreditsModal.jsx`
- `frontend/src/components/common/WorkspaceSelector.jsx`
- `frontend/src/components/AnalyticsDashboard.jsx`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/components/BillingPage.jsx`
- `frontend/src/components/CmsSettings.jsx`
- `frontend/src/components/KeywordManager.jsx`
- `frontend/src/components/PublicFooter.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/content/legal-content.js`
- `frontend/src/pages/ads/AdsReportDetailPage.jsx`
- `frontend/src/pages/ads/AdsReportsPage.jsx`
- `frontend/src/pages/app/AccountSettingsPage.jsx`
- `frontend/src/pages/app/MembersSettingsPage.jsx`
- `frontend/src/pages/app/ModuleActivatePage.jsx`
- `frontend/src/pages/app/SecuritySettingsPage.jsx`
- `frontend/src/pages/app/WorkspaceDashboardPage.jsx`
- `frontend/src/pages/billing/CreditWalletPage.jsx`
- `frontend/src/pages/public/LandingPage.jsx`
- `frontend/src/pages/public/PrivacyPage.jsx`
- `frontend/src/pages/public/RoleDetailPage.jsx`
- `frontend/src/pages/public/TermsPage.jsx`
- `frontend/src/pages/seo/AutoTopicsPage.jsx`
- `frontend/src/pages/spy/SpyCompetitorsPage.jsx`
- `frontend/src/pages/spy/SpyInsightsPage.jsx`
- `frontend/src/pages/spy/SpyLibraryPage.jsx`

### Cara Tes
1. ESLint check: `cd frontend && npx eslint src`
2. Paritas dan validasi kamus: `cd frontend && npm run i18n:check`
3. Frontend production build: `cd frontend && npm run build`
4. Backend test suite: `cd backend && npm test`
5. Pengujian tampilan mobile 390px (iPhone 14) pada browser subagent:
   - English landing page (`/`)
   - Indonesian landing page (`/id`)
   - Halaman Login (`/login`)
   - Cek horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`

### Hasil Tes
- ESLint (`npx eslint src`): **0 Error** (seluruh 359 error `i18next/no-literal-string` berhasil diselesaikan).
- `i18n:check`: **100% lolos** (1.895 keys perfectly matched antara EN & ID, 0 error).
- Frontend `build`: **100% lolos** (0 error, static sitemap & HTML files ter-generate).
- Backend `npm test`: **100% lolos** (seluruh suite lulus).
- DevTools 390px: **Lolos** tanpa scroll horizontal, teks dwibahasa tampil bersih tanpa bocor literal string.

### Screenshot (390px)
- English Landing Page: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/english_landing_page_1792069136855.png`
- Indonesian Landing Page: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/indonesian_landing_page_1792069148321.png`
- Login Page: `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/login_page_1792069160333.png`
