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
