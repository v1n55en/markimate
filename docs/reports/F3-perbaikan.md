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

---

## Langkah B — Standardisasi Angka Produk & Istilah Kredit

### 1. Ringkasan Perubahan
- **Penyeragaman Istilah "kredit" di Seluruh Antarmuka Bahasa Indonesia**:
  - Mengubah seluruh kemunculan istilah "credit" di kamus ID (`frontend/src/i18n/locales/id/`) menjadi "kredit" (sesuai standar Glosarium & Gaya Bahasa Markimate di `docs/i18n-glossary.md`).
  - `billing.js`: "creditsUnit" diubah menjadi "kredit", cheatsheet tarif menjadi "Tarif Kredit", buku besar mutasi menjadi "pemotongan kredit".
  - `public.js`: FAQ q4, q5, q6, banner trial, dan kartu penawaran diselaraskan menggunakan "kredit" dan "kr". Frasa metode pembayaran "kartu kredit" tetap dipertahankan dengan benar.
  - `auth.js`: Penjelasan trial pada registrasi, login prompt, dan verifikasi email diselaraskan menggunakan "kredit".
  - `common.js`: Tombol navigasi dompet diubah menjadi "Lihat dompet kredit & top-up".
  - `app.js`: Label navigasi "Dompet Kredit", modal "Kredit Tidak Cukup", dan anti-loop protection (500 kredit/hari) diselaraskan.
- **Single Source of Truth untuk Angka Produk & Trial**:
  - `hero.ctaPrimary`: Tidak lagi memakai angka statis "300 credit", melainkan diinterpolasi dinamis dari `TRIAL.credits` dan `TRIAL.days` via `{ credits: TRIAL.credits, days: TRIAL.days }` (`"Start Free — {credits} credits, {days} days"` / `"Coba Gratis {days} Hari — {credits} kredit"`).
  - `finalCta`: Parameter `{ days: TRIAL.days, credits: TRIAL.credits }` dan `{ count: ROLES.length }` diteruskan dari config produk, dan link menggunakan `LocalizedLink` agar konsisten dengan bahasa aktif.

### 2. File yang Berubah
- `frontend/src/i18n/locales/en/public.js`
- `frontend/src/i18n/locales/id/public.js`
- `frontend/src/i18n/locales/id/auth.js`
- `frontend/src/i18n/locales/id/billing.js`
- `frontend/src/i18n/locales/id/common.js`
- `frontend/src/i18n/locales/id/app.js`
- `frontend/src/pages/public/LandingPage.jsx`

### 3. Cara Pengujian
1. Jalankan unit test backend: `cd backend && npm test`
2. Jalankan validasi parity i18n: `cd frontend && npm run i18n:check`
3. Jalankan production build frontend: `cd frontend && npm run build`
4. Cek konsistensi teks di halaman publik EN dan ID.

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes lulus)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors, perfect key parity)**
- `cd frontend && npm run build`: **LOLOS (40 HTML statis dan sitemap ter-generate)**
- **Checklist Mobile 390px (iPhone 14)**:
  - [x] CTA Hero dan Bottom CTA menampilkan angka dinamis 7 hari & 300 kredit dengan benar.
  - [x] Istilah "kredit" konsisten di seluruh ID tanpa ada "credit" yang terselip.
  - [x] Tidak ada scroll horizontal pada halaman landing page EN maupun ID.

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Pembersihan inline style layout di `AuthScreen.jsx` (dijadwalkan di Langkah C).
- Perbaikan celah keamanan dan token chain (dijadwalkan di Langkah D).

---

## Langkah C — Pembersihan Layout & Optimasi Mobile AuthScreen

### 1. Ringkasan Perubahan
- **Pembersihan 65+ Inline Style Layout di `AuthScreen.jsx`**:
  - Menghapus seluruh inline styles layout dari objek `const styles = { ... }` (436 baris kode) dan memindahkannya ke class CSS standar mobile-first di `index.css`.
  - Menggunakan class `.auth-page-container`, `.auth-card-box`, `.auth-header`, `.auth-title`, `.auth-subtitle`, `.auth-tab-container`, `.auth-tab`, `.auth-field`, `.auth-field-label`, `.auth-input`, `.auth-btn-primary`, `.auth-separator`, `.btn-google-auth`, dan `.auth-footer-links`.
- **Glow Dekoratif Responsif Layar Mobile**:
  - Glow latar `.auth-glow-cyan` dan `.auth-glow-purple` dibatasi dengan `width: min(350px, 90vw); max-width: 90vw;` sehingga tidak menyebabkan scroll horizontal pada layar kecil (360px–390px).
- **Aksesibilitas Touch Target Minimal 44×44px**:
  - Tautan lupa sandi (`.auth-forgot-link`) diberikan `min-height: 44px` dan area klik pseudo-element `::after { min-width: 44px; min-height: 44px; }`.
  - Tombol tab ("Masuk" / "Daftar Baru"), tombol ajakan trial, tombol kirim ulang verifikasi, dan tombol kembali memiliki `min-height: 44px`.
- **Layar Cek Email Terverifikasi**:
  - Layar konfirmasi email setelah registrasi direfaktor menggunakan class `.auth-verify-icon-box`, `.auth-verify-title`, `.auth-verify-desc`, `.auth-verify-resend-btn`, dan `.auth-verify-back-btn`.

### 2. File yang Berubah
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/index.css`

### 3. Cara Pengujian
1. Jalankan unit test backend: `cd backend && npm test`
2. Jalankan validasi parity i18n dan production build: `cd frontend && npm run i18n:check && npm run build`
3. Pengujian browser subagent pada viewport 390x844 (iPhone 14) untuk rute `/login` dan `/register`.

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes unit dan integrasi lulus)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors)**
- `cd frontend && npm run build`: **LOLOS (Build Vite 2.14s, 40 HTML statis dan sitemap ter-generate)**
- **Checklist Mobile 390px (iPhone 14) & 360px**:
  - [x] Tidak ada scroll horizontal (`document.documentElement.scrollWidth <= window.innerWidth`).
  - [x] Area sentuh link "Lupa kata sandi?" dan tombol tab >= 44×44px.
  - [x] Form input bersih, ukuran font 16px (mencegah auto-zoom di iOS Safari).
  - [x] Tab beralih ke "Daftar Baru" dengan animasi mulus dan form registrasi terisi rapi tanpa overflow.
- **Screenshot 390px**:
  - Login View: `login_view_390px_1792038062420.png`
  - Register View: `register_view_390px_1792038083509.png`

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Perbaikan celah keamanan dan token chain (dijadwalkan di Langkah D).
- Rapikan test backend (dijadwalkan di Langkah E).

---

## Langkah D — Keamanan Fix Pack: Isolasi Workspace CMS, requireUuidParam, dan Token Grace Chain

### 1. Ringkasan Perubahan
- **Penegakan Isolasi Workspace (Hapus Fallback `user_id`)**:
  - `GET /api/me`: Menghapus fallback query `db.findMany('cms_connections', { user_id: activeWsId })`. CMS connections kini terikat 100% pada `workspace_id`.
  - `GET /api/keywords`, `PATCH /api/keywords/:id`, `DELETE /api/keywords/:id`, `POST /api/keywords/:id/run`, `POST /api/keywords/:id/publish`: Menghapus fallback query ke `user_id`. Semua operasi kata kunci sepenuhnya terisolasi dalam workspace aktif (`workspace_id`).
  - `generateFor` dan `publishFor`: Menghapus fallback `findOne('cms_connections', { user_id: user.id, cms_type })`. Menggunakan koneksi CMS workspace yang valid.
  - `runTopicSource`, `GET /api/seo/topic-sources`, `PUT /api/seo/topic-sources`, `DELETE /api/seo/topic-sources/:id`, `POST /api/seo/topic-sources/:id/run`: Menghapus seluruh fallback pencarian berdasarkan `user_id`. Topic sources terisolasi dalam workspace.
- **Validasi Ketat UUID (`requireUuidParam('id')`)**:
  - Menambahkan middleware `requireUuidParam('id')` pada 6 endpoint sensitif:
    1. `PATCH /api/keywords/:id`
    2. `DELETE /api/keywords/:id`
    3. `POST /api/keywords/:id/run`
    4. `POST /api/keywords/:id/publish`
    5. `DELETE /api/seo/topic-sources/:id`
    6. `POST /api/seo/topic-sources/:id/run`
  - Mencegah input non-UUID (SQL injection, path traversal, atau invalid ID) sebelum query database diproses.
- **Refresh Token Grace Chain Traversal**:
  - Pada `POST /api/auth/refresh`: Jika token yang digunakan berada dalam grace window (30 detik) dan `record.replaced_by` sudah direvoke kembali akibat rotasi paralel/berantai, sistem kini menelusuri chain `successor` (hingga `max depth 5`) untuk menemukan token successor aktif yang belum direvoke.
  - Mencegah *false positive* `TOKEN_REUSE_DETECTED` saat browser meluncurkan permintaan refresh paralel secara bersamaan.

### 2. File yang Berubah
- `backend/index.js`

### 3. Cara Pengujian
1. Jalankan unit test backend: `cd backend && npm test`
2. Jalankan validasi i18n & build frontend: `cd frontend && npm run i18n:check && npm run build`
3. Verifikasi ketiadaan fallback `user_id` pada query CMS dan SEO di `backend/index.js`.

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes unit dan integrasi berhasil)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors)**
- `cd frontend && npm run build`: **LOLOS (Build Vite berhasil, 40 HTML statis & sitemap ter-generate)**

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Pembuatan test suite khusus keamanan Langkah D & E (dikerjakan di Langkah E).

---

## Langkah E — Rapikan Test Backend & Test Suite Keamanan Terisolasi

### 1. Ringkasan Perubahan
- **Isolasi Database Test Backend via `DB_JSON_PATH`**:
  - `backend/db.js`: Konstruktor `JsonStore` kini menerima parameter `filePath` opsional dan memeriksa variabel lingkungan `process.env.DB_JSON_PATH || path.join(__dirname, 'database.json')`. Ini memungkinkan suite pengujian otomatis berjalan pada database test terisolasi tanpa mencemari atau membuat konflik pada `database.json` development lokal.
- **Suite Pengujian Keamanan & Multi-tenant Otomatis (`test-step-d-security.js`)**:
  - Membuat `backend/scripts/test-step-d-security.js` yang secara komprehensif menguji:
    1. **Validasi `requireUuidParam('id')`**: Menolak format ID non-UUID (path traversal, string acak, SQL injection payload) dengan respons seragam HTTP 404 `code: 'NOT_FOUND'` pada endpoint:
       - `PATCH /api/keywords/:id`
       - `DELETE /api/keywords/:id`
       - `POST /api/keywords/:id/run`
       - `POST /api/keywords/:id/publish`
       - `DELETE /api/seo/topic-sources/:id`
       - `POST /api/seo/topic-sources/:id/run`
    2. **Isolasi Multi-Tenant Data Workspace**:
       - Menguji 2 workspace independen (Workspace A dan Workspace B) dengan akun terpisah.
       - Memastikan User B di Workspace B tidak dapat membaca kata kunci milik Workspace A (`GET /api/keywords`).
       - Memastikan User B tidak dapat memodifikasi (`PATCH`) atau menghapus (`DELETE`) kata kunci milik Workspace A (mengembalikan 404).
       - Memastikan CMS connections milik Workspace A tidak bocor ke Workspace B pada `GET /api/me`.
       - Memastikan User B tidak dapat menghapus atau menjalankan Topic Sources milik Workspace A (mengembalikan 404).
    3. **Refresh Token Grace Chain Traversal & Reuse Detection**:
       - Menguji rantai token multi-hop (Token 0 -> Token 1 -> Token 2) di mana Token 0 dan 1 telah direvoke namun masih dalam masa *grace window* 30 detik.
       - Memastikan permintaan refresh dengan Token 0 berhasil menelusuri rantai successor dan memperoleh token akses baru dari Token 2 yang aktif tanpa memicu *false positive* `TOKEN_REUSE_DETECTED`.
       - Menguji token yang direvoke di luar grace window (> 30 detik) dan memverifikasi bahwa `TOKEN_REUSE_DETECTED` (HTTP 401) terpicu serta seluruh token dalam family yang bersangkutan langsung direvoke.
       - Cleanup otomatis seluruh data uji setelah eksekusi selesai.
- **Penyelarasan Skrip `npm test` Backend**:
  - `backend/package.json`: Menyertakan `scripts/test-step-d-security.js` ke dalam pipeline `npm test`.

### 2. File yang Berubah
- `backend/db.js`
- `backend/package.json`
- `backend/scripts/test-step-d-security.js`

### 3. Cara Pengujian
1. Jalankan seluruh test suite backend: `cd backend && npm test`
2. Jalankan validasi parity i18n & build frontend: `cd frontend && npm run i18n:check && npm run build`

### 4. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (5 suite pengujian: schema-contract, full auth e2e, google-auth, locale-mailer, security & workspace-isolation)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors)**
- `cd frontend && npm run build`: **LOLOS (Vite build berhasil dalam 1.1s, 40 HTML statis & sitemap ter-generate)**

### 5. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Tidak ada (seluruh langkah PRD F3: Langkah 0, A, B, C, D, dan E telah selesai 100%).

---

## Ringkasan Akhir Autopilot PRD F3 — Markimate Bilingual & Perbaikan Review

Semua langkah PRD F3 telah dieksekusi secara berurutan dalam mode autopilot dengan standar kualitas tinggi, lulus seluruh gerbang verifikasi per langkah, dan dipush ke cabang `main`:
1. **Langkah 0** (`commit 1b90577`): Satu pill `LanguageToggle` terintegrasi, pembersihan switcher duplikat di drawer mobile/footer/auth, rute auth kanonik dengan layout auth tersentralisasi.
2. **Langkah A** (`commit ab062c8`): Eliminasi 100% ternary bahasa ke kamus i18n terstruktur, error code standar `UPPER_SNAKE` pada backend middleware dan `AuthScreen`, rule fatal `i18n:check` tanpa anti-pattern.
3. **Langkah B** (`commit 095f9de`): Standardisasi istilah "kredit" di seluruh kamus ID, single source of truth dinamis untuk angka CTA hero dan trial dari konfigurasi produk.
4. **Langkah C** (`commit 4815dc6`): Pembersihan 436 baris inline styles layout di `AuthScreen.jsx` ke CSS mobile-first di `index.css`, touch target >=44px, bebas overflow/scroll horizontal pada viewport 390px.
5. **Langkah D** (`commit 1963c19`): Penegakan isolasi workspace pada CMS connections, keywords, dan SEO topic sources (menghapus user_id fallback), penambahan `requireUuidParam('id')` pada 6 endpoint, dan refresh token grace chain traversal hingga depth 5.
6. **Langkah E** (`commit terkini`): Penambahan support `DB_JSON_PATH` pada `JsonStore` untuk isolasi database test, pembuatan suite tes keamanan `test-step-d-security.js`, dan integrasi ke dalam pipeline `npm test`.



