# Laporan Pengerjaan: Domain markimate.com + Subdomain app

Sesuai panduan `AGENTS.md` (mode autopilot) untuk instruksi domain resmi Markimate dan pemisahan subdomain app.

---

## Langkah 1 — Ganti Semua Sisa Domain Lama

### 1. Ringkasan Perubahan
- **Email Pengirim & Resend (`mail.markimate.com`)**:
  - `backend/.env.example`: Mengubah `MAIL_FROM` ke `Markimate <noreply@mail.markimate.com>`.
  - `backend/lib/mailer.js`: Nilai fallback `mailFrom` diperbarui ke `Markimate <noreply@mail.markimate.com>`.
  - `README.md`: Memperbarui tabel env var untuk `MAIL_FROM` dan `APP_URL`.
- **Helper Konfigurasi Terpusat `getAppUrl()`**:
  - Membuat `backend/lib/config.js` dengan fungsi `getAppUrl()` yang mengembalikan `process.env.APP_URL || 'https://app.markimate.com'`.
  - Menggantikan hardcoded fallback `'https://markimate-three.vercel.app'` dengan `getAppUrl()` di:
    - `backend/lib/google-auth.js`
    - `backend/lib/account-lifecycle.js`
    - `backend/lib/mailer.js` (email verifikasi, reset sandi, verifikasi ganti email)
    - `backend/index.js` (undangan workspace)
- **Situs Marketing Kanonik (`https://markimate.com`)**:
  - `frontend/src/components/common/SeoHead.jsx`: Mengganti default `rawSiteUrl` ke `https://markimate.com`.
  - `frontend/scripts/build-seo-pages.mjs`: Mengganti default `SITE_URL` ke `https://markimate.com`.
  - Pembuatan `robots.txt` dipindahkan ke generator dinamis di `build-seo-pages.mjs` dengan direktif `Sitemap: https://markimate.com/sitemap.xml`, dan file statis `frontend/public/robots.txt` telah dihapus.
- **Pembersihan Email Uji Coba**:
  - `backend/scripts/test-step12-locale-mailer.js`: Email test diubah menjadi domain dummy standar `@example.com` (`locale.en.{ts}@example.com` & `locale.def.{ts}@example.com`).
  - `backend/database.json`: Telah dipastikan di-ignore di `.gitignore` dan tidak di-track dalam git history.
- **Variabel Lingkungan Frontend**:
  - `frontend/.env.example`: Menambahkan `VITE_SITE_URL=http://localhost:5173` dan `VITE_APP_URL=http://localhost:5173`.

### 2. File yang Berubah
- `backend/.env.example`
- `backend/lib/config.js` (baru)
- `backend/lib/google-auth.js`
- `backend/lib/account-lifecycle.js`
- `backend/lib/mailer.js`
- `backend/index.js`
- `backend/scripts/test-step12-locale-mailer.js`
- `frontend/.env.example`
- `frontend/public/robots.txt` (dihapus)
- `frontend/scripts/build-seo-pages.mjs`
- `frontend/src/components/common/SeoHead.jsx`
- `README.md`

### 3. Hasil Pengujian
- `cd backend && npm test`: **LOLOS 100% (Semua tes unit dan integrasi berhasil)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors)**
- `cd frontend && npm run build`: **LOLOS (40 HTML statis, sitemap.xml, dan robots.txt ter-generate dengan https://markimate.com)**

### 4. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Konfigurasi rewrite/redirect vercel.json untuk pemisahan host `markimate.com` vs `app.markimate.com` (dikerjakan di Langkah 2).

---

## Langkah 2 — Pemisahan Host Marketing vs App & Cookie Lintas Subdomain

### 1. Ringkasan Perubahan
- **Konfigurasi Server `frontend/vercel.json`**:
  - Menambahkan aturan `redirects` (308, mempertahankan query string) berbasis kondisi `has: [{ "type": "host", "value": "..." }]`:
    - `markimate.com`: me-redirect semua rute auth (`/login`, `/register`, `/forgot`, `/reset`, `/verify`, `/invite`, `/auth/:path*`) dan rute dashboard (`/app/:path*`) ke `https://app.markimate.com/<path>`.
    - `app.markimate.com`: me-redirect rute root `/` ke `/app` (tetap di app host; SPA mengarahkan ke `/login` jika belum ada sesi).
    - `app.markimate.com`: me-redirect rute publik (`/id`, `/id/:path*`, `/roles/:path*`, `/privacy`, `/terms`, `/data-deletion`) ke `https://markimate.com/<path>`.
  - Menambahkan `headers` keamanan & indexing:
    - Host `app.markimate.com`: menyertakan header `X-Robots-Tag: noindex, nofollow` untuk seluruh path `/(.*)`.
  - Urutan di `vercel.json` sesuai instruksi: `redirects` → `headers` → `rewrites` (proxy API `/api/:path*` mendahului catch-all SPA `/(.*)`).
  - Host `localhost` dan `markimate-three.vercel.app` tidak terkena aturan host redirect, sehingga bebas dipakai untuk seluruh halaman pada preview dan lokal.
- **Helper Frontend `frontend/src/lib/hosts.js`**:
  - `isProdDomain(hostname)`: mendeteksi apakah host berada di bawah `markimate.com` atau subdomainnya.
  - `appUrl(path)`: mengembalikan link absolut ke `https://app.markimate.com/<path>` jika di domain produksi, atau path relatif jika di localhost / preview vercel.
  - `siteUrl(path)`: mengembalikan link absolut ke `https://markimate.com/<path>` jika di domain produksi, atau path relatif jika di localhost / preview vercel.
  - Komponen `AppLink` & `SiteLink`: pembungkus berbasis `React.createElement` yang secara transparan memilih `<a>` untuk navigasi antar host di produksi, atau `<Link>` untuk preview/SPA internal.
  - Dibuat unit test mandiri di `frontend/scripts/test-hosts.mjs`.
- **Bahasa Lintas Subdomain di `frontend/src/context/LanguageContext.jsx`**:
  - Menulis pilihan bahasa ke cookie `mk_lang=en|id; Domain=.markimate.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure` saat berada di domain `markimate.com`.
  - Urutan deteksi bahasa: Prefix URL (`/id`) → `accounts.locale` (dari data user login) → Cookie `mk_lang` → LocalStorage `markimate_lang` → Bahasa browser `navigator.language` → Default `en`.
  - `setLang()` menulis secara simultan ke cookie `mk_lang`, localStorage, dan `PATCH /api/me`.
- **Pembaruan Navigasi Komponen**:
  - `PublicNavbar.jsx`: tombol "Masuk" dan "Daftar" / "Coba Gratis" menggunakan `AppLink`.
  - `LandingPage.jsx`: semua tombol CTA hero, trial card, pricing bundles, dan bottom CTA banner menggunakan `AppLink` ke `/register`.
  - `PublicFooter.jsx`: link "Client Portal Login" menggunakan `AppLink to="/login"`.
  - `RoleDetailPage.jsx`: CTA coba gratis & berlangganan menggunakan `AppLink to="/register"`.
  - `DataDeletionPage.jsx`: tombol "Kembali ke Login" menggunakan `AppLink to="/login"`.
  - `AuthScreen.jsx`, `Sidebar.jsx`, `VerifyPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `InvitePage.jsx`: logo header dan link legalitas (Terms, Privacy, Data Deletion) menggunakan `SiteLink to="/"`.

### 2. File yang Berubah
- `frontend/vercel.json`
- `frontend/src/lib/hosts.js` (baru)
- `frontend/scripts/test-hosts.mjs` (baru)
- `frontend/src/context/LanguageContext.jsx`
- `frontend/src/components/PublicNavbar.jsx`
- `frontend/src/pages/public/LandingPage.jsx`
- `frontend/src/components/PublicFooter.jsx`
- `frontend/src/pages/public/RoleDetailPage.jsx`
- `frontend/src/pages/public/DataDeletionPage.jsx`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/pages/public/VerifyPage.jsx`
- `frontend/src/pages/public/ForgotPasswordPage.jsx`
- `frontend/src/pages/public/ResetPasswordPage.jsx`
- `frontend/src/pages/public/InvitePage.jsx`

### 3. Hasil Pengujian
- `node frontend/scripts/test-hosts.mjs`: **LOLOS 100% (Verifikasi isProdDomain, path relatif di preview/localhost, dan URL absolut di produksi)**
- `cd backend && npm test`: **LOLOS 100% (Semua tes backend hijau)**
- `cd frontend && npm run i18n:check`: **LOLOS (1612 keys, 0 errors)**
- `cd frontend && npm run build`: **LOLOS (Build Vite, 40 HTML statis, sitemap.xml, dan robots.txt berhasil)**

### 4. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Pengujian interaksi browser dan verifikasi live deployment (dikerjakan di Langkah 3).

---

## Langkah 3 — Pengujian & Verifikasi Alur Lintas Subdomain

### 1. Ringkasan Pengujian
- **Verifikasi Unit Test**:
  - `node frontend/scripts/test-hosts.mjs`: Menguji perilaku `isProdDomain`, `appUrl`, dan `siteUrl` pada host produksi (`markimate.com`, `app.markimate.com`), preview Vercel (`markimate-three.vercel.app`), dan environment development lokal (`localhost`). Hasil: **Lolos 100%**.
- **Verifikasi Header HTTP & Redirect Server Produksi**:
  - `curl -I https://markimate.com/login`:
    - Respons: `HTTP/2 308`
    - Header Location: `https://app.markimate.com/login` (Terverifikasi me-redirect auth ke subdomain app).
  - `curl -I https://app.markimate.com/privacy`:
    - Respons: `HTTP/2 308`
    - Header Location: `https://markimate.com/privacy` (Terverifikasi me-redirect halaman marketing ke situs kanonik).
  - `curl -I https://app.markimate.com/app`:
    - Respons: `HTTP/2 200`
    - Header `x-robots-tag: noindex, nofollow` (Terverifikasi aktif memblokir web crawler dari dashboard aplikasi).
  - `curl -I https://markimate.com/`:
    - Respons: `HTTP/2 200`
    - Tidak ada `x-robots-tag` (Terverifikasi dapat diindeks penuh oleh search engine).
  - `curl -I https://www.markimate.com`:
    - Respons: `HTTP/2 308`
    - Header Location: `https://markimate.com/` (Terverifikasi redirect kanonik WWW ke non-WWW).
- **Pengujian Browser Mobile 390px (iPhone 14 DevTools Toolbar)**:
  - Dilakukan pengujian otomatis menggunakan browser agent pada resolusi 390×844:
    - [x] Tidak ada scroll horizontal pada seluruh halaman (`document.documentElement.scrollWidth <= window.innerWidth`).
    - [x] `markimate.com`: Navbar, toggle bahasa, hero CTA, card pricing, dan footer tertata rapi.
    - [x] `app.markimate.com/login`: Form login tampil proporsional, font input minimal 16px (mencegah auto-zoom iOS), touch target tombol $\ge 44\text{px}$.
    - [x] `app.markimate.com/register`: Form registrasi, pilihan kategori bisnis, checkbox syarat & ketentuan, tombol submit berukuran penuh.
    - [x] `app.markimate.com/forgot`: Form permintaan tautan pemulihan kata sandi dapat diisi dan dikirim dengan mudah.
    - [x] Mode landscape & portrait stabil.
  - Artefak screenshot 390px tersimpan di artifact directory:
    - Homepage 390px: `markimate_home_390_1792045154112.png`
    - Login Screen 390px: `login_page_390_1792045168695.png`
    - Register Screen 390px: `register_page_390_1792045183733.png` & `register_page_bottom_390_1792045192093.png`
    - Forgot Password 390px: `forgot_page_390_1792045202910.png`
    - Rekaman video alur: `domain_app_verification_1792045134051.webp`

### 2. Status Gerbang Kualitas
1. Backend Tests (`cd backend && npm test`): **LOLOS 100% (Semua suite lolos)**
2. Frontend i18n & Build (`cd frontend && npm run i18n:check && npm run build`): **LOLOS 100% (0 error, parity lengkap, 40 file HTML statis + sitemap.xml + robots.txt ter-generate)**
3. Integrasi Vercel: **Semua aturan host-based redirect dan noindex headers aktif di produksi.**

### 3. Hal yang Sengaja Tidak Dikerjakan di Langkah Ini
- Tidak ada SQL baru pada PRD ini. Seluruh database schema tetap utuh tanpa modifikasi.


