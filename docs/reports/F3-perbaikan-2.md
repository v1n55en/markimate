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

---

## Langkah 4: Konfigurasi Trial Terpusat & Sinkronisasi Public Pricing

### Ringkasan Perubahan
1. **Pemusatan `TRIAL_CONFIG` di Backend (`backend/lib/config.js`)**:
   - Mengekspor objek `TRIAL_CONFIG = { days: Number(process.env.TRIAL_DAYS || 7), credits: Number(process.env.TRIAL_CREDITS || 300) }`.
   - Mengganti angka hardcoded 7 hari dan 300 kredit di `backend/lib/credits.js` (`grantTrialIfEligible`), `backend/lib/notifications.js` (`baseAllocation`), `backend/lib/google-auth.js` (baris 248 & 355), dan `backend/index.js` (baris 349).
2. **Dinamisasi Parameter Trial di Frontend (`frontend/src/components/AuthScreen.jsx`)**:
   - Mengoper parameter `{ days: TRIAL.days, credits: TRIAL.credits }` secara konsisten pada pemanggilan `t('auth.trialRegisterNote', { days, credits })`, `t('auth.trialLoginPromptBtn', { days, credits })`, dan `t('auth.checkInboxDesc', { email })`.
   - Memperbarui placeholder di `en/auth.js` dan `id/auth.js` agar sinkron dengan template `{days}` dan `{credits}`.
3. **Penyelarasan Nilai Benchmark Harga di Landing Page (`id/public.js`)**:
   - Menyelaraskan teks harga pembanding di landing page Bahasa Indonesia (`supermatCostVal` dan `markimateCostVal`) dari "Mulai Rp 1.5jt / bulan" menjadi `"Mulai Rp 1jt / bulan"` agar konsisten dengan nilai benchmark $69 (modul ads_spy Rp1.000.000/bulan).

### File yang Berubah
- `backend/lib/config.js`
- `backend/lib/credits.js`
- `backend/lib/notifications.js`
- `backend/lib/google-auth.js`
- `backend/index.js`
- `frontend/src/config/pricing.js`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/i18n/locales/en/auth.js`
- `frontend/src/i18n/locales/id/auth.js`
- `frontend/src/i18n/locales/id/public.js`

### Cara Tes
1. Backend test: `cd backend && npm test`
2. Frontend validation: `cd frontend && npm test && npm run i18n:check && npm run build`

### Hasil Tes
- Seluruh referensi trial 7 hari dan 300 kredit kini bersumber secara dinamis dari `TRIAL_CONFIG` dan `TRIAL`.
- Paritas kamus i18n 100% konsisten (0 error).

---

## Langkah 5: Keamanan Backend (Pembersihan Fallback user_id & CMS_CRED_KEY Production Guard)

### Ringkasan Perubahan
1. **Pembersihan Ketat Fallback `user_id` di `backend/index.js`**:
   - Menghapus seluruh pola insecure fallback `req.user?.id || req.body?.user_id || req.headers['x-user-id']` yang berpotensi menjadi celah IDOR (Insecure Direct Object Reference).
   - Menegakkan `userId = req.user?.id` yang terotentikasi secara murni via JWT / sesi pada endpoint:
     - Helper `usageOf`
     - `GET /api/billing`
     - `POST /api/billing/cancel`
     - `POST /api/v1/articles/:id/publish`
     - `GET /api/v1/articles`
2. **Penegakan Wajib `CMS_CRED_KEY` di Lingkungan Production (`backend/lib/crypto.js`)**:
   - Menambahkan pengaman runtime:
     ```javascript
     if (process.env.NODE_ENV === 'production' && (!process.env.CMS_CRED_KEY || process.env.CMS_CRED_KEY.length < 32)) {
       throw new Error('CMS_CRED_KEY is mandatory in production environment.');
     }
     ```
   - Menjamin kredensial CMS tidak pernah dienkripsi dengan kunci fallback default saat berada di mode produksi.

### File yang Berubah
- `backend/index.js`
- `backend/lib/crypto.js`

### Cara Tes
1. `cd backend && npm test`
2. Pengujian `test-step6.js` (mode `NODE_ENV = 'production'`) untuk memverifikasi proteksi `CMS_CRED_KEY` dan panjang `JWT_SECRET`.

### Hasil Tes
- Penegakan `req.user.id` bekerja sempurna tanpa merusak endpoint atau test suite yang ada.
- Kredensial CMS di produksi terproteksi ketat dengan validasi kunci AES-256.

---

## Langkah 6: Pembaruan & Penyatuan Seluruh Test Suite Backend di `backend/tests/`

### Ringkasan Perubahan
1. **Perbaikan 9 File Test Lama**:
   - `test-step1-migration.js`: Menggunakan `randomUUID()` dari `crypto` untuk kolom `id` dan `owner_user_id` agar memenuhi kontrak validasi schema contract (`SCHEMA_CONTRACT_VALIDATION=true`).
   - `test-step1-billing-leak.js`: Mengupdate ekspektasi pesan error English standar (`BILLING_DISABLED`, `PAID_PLAN_REQUIRED`) dan pencatatan ledger note.
   - `test-step2.js`: Memperbarui alur register dengan `acceptTerms: true`, verifikasi admin (`/api/admin/users/:id/verify`), lalu login untuk mendapatkan access token.
   - `test-step3.js`: Menyelaraskan alur register dengan `acceptTerms: true`, verifikasi admin, dan login berotentikasi.
   - `test-step4.js`: Menyelaraskan alur register dengan `acceptTerms: true`, verifikasi admin, login, serta pemutakhiran wallet balance via `userId`.
   - `test-step4-account.js`: Memperbarui assertion respons lupa password terdaftar.
   - `test-step6.js`: Menggunakan `JWT_SECRET` minimal 32 karakter, `CMS_CRED_KEY` base64 32-byte, `acceptTerms: true`, verifikasi admin, dan dynamic import untuk memastikan isolasi database test lokal.
   - `test-step7.js`: Memperbarui import `TRANSLATIONS` dari `frontend/src/i18n/index.js` dan mendukung padanan `300 kredit` pada assertion FAQ.
   - `test-step8.js`: Menggunakan `randomUUID()` untuk `testWorkspaceId` pada pencatatan `credit_ledger` simulasi penjaga margin.
2. **Pembuatan Direktori `backend/tests/` & Runner Terpadu (`backend/tests/run-all.js`)**:
   - Membuat direktori resmi `backend/tests/` dan menyalin seluruh 23 test script suite.
   - Membuat test runner `backend/tests/run-all.js` yang mengeksekusi ke-23 file test secara berurutan dengan child process terisolasi dan menampilkan ringkasan laporan kelulusan.
   - Memperbarui script `"test"` di `backend/package.json` menjadi `"node tests/run-all.js"`.

### File yang Berubah
- `backend/package.json`
- `backend/tests/run-all.js` (baru)
- `backend/tests/seed-credit-prices.js` (baru)
- `backend/tests/*.js` (23 file test suite)
- `backend/scripts/test-step1-billing-leak.js`
- `backend/scripts/test-step1-migration.js`
- `backend/scripts/test-step2.js`
- `backend/scripts/test-step3.js`
- `backend/scripts/test-step4.js`
- `backend/scripts/test-step4-account.js`
- `backend/scripts/test-step6.js`
- `backend/scripts/test-step7.js`
- `backend/scripts/test-step8.js`

### Cara Tes
Jalankan:
```bash
cd backend && npm test
```

### Hasil Tes
```
======================================================
🧪 MENJALANKAN SELURUH TEST SUITE BACKEND (23 TESTS)
======================================================
✅ tests/test-schema-contract.js             (0.17s)
✅ tests/test-auth.js                        (3.53s)
✅ tests/test-credits.js                     (0.29s)
✅ tests/test-step-d-security.js             (0.41s)
✅ tests/test-step1-billing-leak.js          (1.05s)
✅ tests/test-step1-migration.js             (0.19s)
✅ tests/test-step2.js                       (0.98s)
✅ tests/test-step2-auth.js                  (5.60s)
✅ tests/test-step2-rename.js                (0.17s)
✅ tests/test-step3.js                       (1.19s)
✅ tests/test-step3-session.js               (1.65s)
✅ tests/test-step4.js                       (1.06s)
✅ tests/test-step4-account.js               (4.17s)
✅ tests/test-step5.js                       (1.19s)
✅ tests/test-step5-workspace.js             (2.13s)
✅ tests/test-step6.js                       (7.41s)
✅ tests/test-step6-members.js               (2.97s)
✅ tests/test-step7.js                       (0.10s)
✅ tests/test-step7-entitlements.js          (1.43s)
✅ tests/test-step8.js                       (0.34s)
✅ tests/test-step8-account-lifecycle.js     (4.17s)
✅ tests/test-step9-google-auth.js           (1.81s)
✅ tests/test-step12-locale-mailer.js        (1.90s)

Total: 23/23 lolos.
🎉 SEMUA TEST BACKEND LOLOS 100%!
```

---

## Verifikasi Gerbang Autopilot Akhir & Mobile Checklist (390px)

### 1. Eksekusi Gerbang Otomatis
- **Backend Tests**: `cd backend && npm test` → **23/23 test suite LOLOS (100%)**.
- **Frontend Tests**: `cd frontend && npm test` → **3/3 test suite LOLOS (100%)**.
- **Frontend i18n**: `cd frontend && npm run i18n:check` → **0 Error (1.983 keys matched, 65 error codes covered)**.
- **Frontend ESLint**: `cd frontend && npx eslint src --quiet` → **0 Error**.
- **Frontend Production Build**: `cd frontend && npm run build` → **SUKSES (40 static HTML SEO pages & sitemap generated)**.

### 2. Checklist Mobile Friendly (390px iPhone 14)
- [x] Tidak ada scroll horizontal (`document.documentElement.scrollWidth <= window.innerWidth`).
- [x] Tidak ada teks/tombol terpotong atau saling menimpa.
- [x] Target sentuh minimal 44x44px terpenuhi pada tombol auth, switcher bahasa, dan aksi CTA.
- [x] Form register dan login dapat diisi tanpa auto-zoom (font size >= 16px).
- [x] Parameter trial ({days} = 7, {credits} = 300) ter-render secara rapi dan dinamis baik di versi EN maupun ID.
- [x] Screenshot 390px terlampir di artifact directory:
  - Register Page EN (390px): `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/register_page_en_1792473679265.png`
  - Register Page ID (390px): `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/register_page_id_1792473835294.png`
  - Landing Page EN (390px): `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/public_page_en_1792473933961.png`
  - Landing Page ID (390px): `/Users/mm/.gemini/antigravity-ide/brain/89c9de70-e913-4338-a204-2dcd46fdf3fe/public_page_id_1792474015756.png`

### 3. Hal yang Sengaja Tidak Dikerjakan / Tidak Ada Utang
- Tidak ada modifikasi folder `automation/` (sesuai aturan).
- Tidak ada secret / file `.env` yang di-commit.
- Seluruh 6 langkah PRD F3 Perbaikan Tahap 2 telah diselesaikan 100% tuntas tanpa kendala.

