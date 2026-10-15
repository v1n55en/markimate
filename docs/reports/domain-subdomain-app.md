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
