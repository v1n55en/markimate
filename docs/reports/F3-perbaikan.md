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
