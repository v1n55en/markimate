# Markimate Frontend (React 19 + Vite)

Frontend web application untuk platform SaaS **Markimate · powered by 3our**.
Slogan: **Your Marketing Automation Mate**.
Mendukung ekosistem AI Digital Marketing Team (16 Roles).

---

## 🛠️ Menjalankan Secara Lokal

```bash
cd frontend
npm install
npm run dev
```

Server pengembangan Vite akan berjalan di `http://localhost:5173`.

### Variabel Lingkungan (`.env`)

Lihat `.env.example`:
```env
VITE_API_BASE_URL=http://localhost:5001
VITE_ADS_MOCK=false
VITE_SPY_MOCK=false
```

- `VITE_API_BASE_URL`: URL backend Express Markimate.
- `VITE_ADS_MOCK`: Setel ke `'true'` untuk mengaktifkan mock data modul Ads Report saat pengujian lokal/development. Secara default bernilai `'false'` (menampilkan kartu "Segera Hadir di Produksi").
- `VITE_SPY_MOCK`: Setel ke `'true'` untuk mengaktifkan mock data modul Ads Creative Spy saat pengujian lokal/development. Secara default bernilai `'false'` (menampilkan kartu "Segera Hadir di Produksi").

---

## 🧭 Struktur Rute (React Router v7)

| Rute | Akses | Halaman / Deskripsi |
|---|---|---|
| `/` | Publik | Landing page AI Digital Marketing Team (16 Roles) |
| `/roles/:key` | Publik | Detail spesifikasi per role, deliverable, dan waitlist |
| `/privacy` | Publik | Kebijakan Privasi Markimate Powered by 3Our Indonesia (sebelumnya bernama Supermat) |
| `/terms` | Publik | Syarat & Ketentuan Layanan |
| `/login` | Publik | Layar masuk akun pengguna |
| `/register` | Publik | Layar pendaftaran brand baru (Trial 7 Hari — 300 credit) |
| `/app/ads` | Terproteksi | **Ringkasan Ads Report** (KPI gabungan, spend, ROAS, kartu platform) |
| `/app/ads/connections` | Terproteksi | **Koneksi Platform Iklan** (Meta, Google, TikTok, GMV Max, Shopee) |
| `/app/ads/reports` | Terproteksi | **Daftar Laporan Bulanan** (filter platform, tahun, pencarian klien) |
| `/app/ads/reports/:reportId` | Terproteksi | **Detail Laporan Lengkap** (KPI, grafik tren 6 bulan & harian, kampanye, top produk, materi kreatif, AI insights) |
| `/app/ads/connect/:platform/callback` | Terproteksi | **Callback OAuth** simulasi otorisasi platform |
| `/app/seo/keywords` | Terproteksi | Kontrol Automasi SEO |
| `/app/seo/analytics` | Terproteksi | Analitik & Insights SEO |
| `/app/seo/settings` | Terproteksi | Pengaturan CMS & API Key |
| `/app/billing` | Terproteksi | Langganan, Top-Up & Riwayat Penggunaan Credit |

---

## 🧑‍💻 Akun Reviewer Platform (Meta, Google, TikTok, Shopee)

Untuk evaluasi oleh tim review platform:
1. Tidak ada akun demo atau mode mock palsu di produksi. Seluruh pengguna baru berhak atas **Trial 7 Hari (300 credit)**.
2. Daftarkan akun reviewer nyata melalui halaman `/register` (nama brand, email, dan password).
3. Jika reviewer membutuhkan credit tambahan atau aktivasi paket khusus selama masa audit, admin dapat mengalokasikan credit via endpoint admin berotentikasi:
   - `POST /api/admin/credits/grant` dengan header `X-Admin-Key` untuk menambah credit.
   - Atau aktifkan paket manual via `POST /api/admin/subscriptions` dengan header `X-Admin-Key`.
4. Cantumkan kredensial akun reviewer yang telah dibuat pada formulir peninjauan submission masing-masing platform.

---

## 📦 Skrip Build & Lint

```bash
# Uji linting ESLint
npm run lint

# Build untuk produksi
npm run build
```
