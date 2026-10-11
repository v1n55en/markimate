# Agentia Frontend (React 19 + Vite)

Frontend web application untuk platform SaaS **Agentia · powered by 3our**.
Slogan: **digital marketing agentic in one platform**.
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
VITE_ADS_MOCK=true
```

- `VITE_API_BASE_URL`: URL backend Express Supermat.
- `VITE_ADS_MOCK`: Setel ke `'true'` (default) untuk menjalankan modul Ads Report dalam **Mode Demo / Mock Offline** dengan data contoh lengkap dan alur simulasi OAuth tanpa ketergantungan backend. Setel ke `'false'` ketika backend telah mengimplementasikan endpoint Ads Report.

---

## 🧭 Struktur Rute (React Router v7)

| Rute | Akses | Halaman / Deskripsi |
|---|---|---|
| `/` | Publik | Landing page AI Digital Marketing Team (16 Roles) |
| `/roles/:key` | Publik | Detail spesifikasi per role, deliverable, dan waitlist |
| `/privacy` | Publik | Kebijakan Privasi Supermat Powered by 3Our Indonesia |
| `/terms` | Publik | Syarat & Ketentuan Layanan |
| `/login` | Publik | Layar masuk akun pengguna & tombol jalan pintas akun Demo Reviewer |
| `/register` | Publik | Layar pendaftaran brand baru |
| `/app/ads` | Terproteksi | **Ringkasan Ads Report** (KPI gabungan, spend, ROAS, kartu platform) |
| `/app/ads/connections` | Terproteksi | **Koneksi Platform Iklan** (Meta, Google, TikTok, GMV Max, Shopee) |
| `/app/ads/reports` | Terproteksi | **Daftar Laporan Bulanan** (filter platform, tahun, pencarian klien) |
| `/app/ads/reports/:reportId` | Terproteksi | **Detail Laporan Lengkap** (KPI, grafik tren 6 bulan & harian, kampanye, top produk, materi kreatif, AI insights) |
| `/app/ads/connect/:platform/callback` | Terproteksi | **Callback OAuth** simulasi otorisasi platform |
| `/app/seo/keywords` | Terproteksi | Kontrol Automasi SEO |
| `/app/seo/analytics` | Terproteksi | Analitik & Insights SEO |
| `/app/seo/settings` | Terproteksi | Pengaturan CMS & API Key |
| `/app/billing` | Terproteksi | Langganan & Kuota Artikel |

---

## 🧑‍💻 Akun Demo Reviewer (Shopee & TikTok)

Untuk kemudahan evaluasi oleh tim review platform (Shopee Open Platform & TikTok Marketing API):
1. Buka `/login` atau klik **Masuk sebagai Akun Demo (Reviewer)**.
2. Reviewer langsung login dengan status admin demo (`isDemo: true`).
3. Pada halaman **Koneksi Platform**, status Shopee dapat diuji dengan menekan tombol **Hubungkan Shopee** → diarahkan ke halaman callback → status berubah menjadi **Terhubung**.
4. Buka **Laporan Iklan** → pilih **Laporan Shopee Ads & TikTok Shop GMV Max** untuk melihat detail KPI, produk terlaris, dan insight AI.

---

## 📦 Skrip Build & Lint

```bash
# Uji linting ESLint
npm run lint

# Build untuk produksi
npm run build
```
