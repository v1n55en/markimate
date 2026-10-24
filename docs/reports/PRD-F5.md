# Laporan PRD F5 – AI Ads Performance Reporter

## Ringkasan Commit

| # | Commit | Pesan |
|---|--------|-------|
| 1 | `29fec7b` | feat(ads): langkah 4 api template metrics custom profile dan asset upload (PRD F5) |
| 2 | `7fac468` | feat(ads): langkah 5 trigger webhook async n8n status polling dan rollback kredit (PRD F5) |
| 3 | `ddefb49` | feat(ads): langkah 6 cron pengiriman bulanan terjadwal dan email notifikasi (PRD F5) |
| 4 | `88a2f0f` | feat(ads): langkah 7 frontend ui koneksi laporan template dan profil (PRD F5) |
| 5 | `3b6bda4` | feat(ads): hapus mockActive guard & perkuat idempotensi refund per bucket (PRD F5) |
| 6 | `cc3ee7c` | docs(ads): laporan PRD F5 – commit, hasil tes, migrasi SQL |
| 7 | `b7aa042` | feat(ads): langkah 8 update credit pricing dinamik privasi meta dan timeout 15m (PRD F5) |
| 8 | `6c283cd` | feat(automation): langkah 9 buat workflow n8n markimate-ads-report dan alt-text rendering (PRD F5) |

## Hasil Tes

### Backend
- **34/34 tes lolos** — termasuk `ads-runner.test.js`, `ads-oauth.test.js`, `ads-contract.test.js`, `ads-templates.test.js`, `ads-scheduler.test.js`, `ads-metrics.test.js`, `pricing-parity.test.js`, `article-options-runtime.test.js`.

### Frontend
- `npm run i18n:check` → **0 errors** (2427 keys setara EN & ID).
- `npm run lint` → **0 errors** (semua 68 file `src/**/*.{js,jsx}` bersih dari teks Indonesia hardcoded).
- `npm run build` → **exit 0**, 42 file HTML statis + sitemap.xml berhasil digenerate.

## File yang Berubah

### Backend
| File | Perubahan |
|------|-----------|
| `backend/index.js` | Endpoint API Ads Runner, OAuth, Callback n8n, query params dynamic estimation (`accounts`, `aiPages`, `isRerun`) |
| `backend/lib/ads-oauth.js` | OAuth Meta flow (token encrypt/decrypt) |
| `backend/lib/ads-runner.js` | Trigger n8n async, dynamic credit pricing via `getPrices()`, timeout diperbarui ke 15 menit (900 detik) |
| `backend/lib/credit-defaults.js` | Default tarif `ads.report` 300 base, `ads.report.extra_account` 50, `ads.report.ai_page` 50, `ads.report_rerun` 100 |
| `backend/lib/credits.js` | Estimasi komposit dinamis `ads.report` dari `credit_prices` |
| `backend/lib/catalog.js` | `typicalMonthlyCredits` Ads Report diperbarui menjadi 350 kredit |
| `backend/migrations/020_ads_report.sql` | Tabel `ad_connections`, `ad_accounts`, `ad_reports`, `report_templates`, `report_profiles`, `report_custom_metrics` |
| `backend/migrations/021_ad_reports_refunded_at.sql` | Kolom `refunded_at` untuk idempotensi refund per bucket |
| `backend/tests/ads-runner.test.js` | Simulasi timeout 16 menit untuk pengujian deteksi timeout > 15m & refund atomik |
| `backend/tests/pricing-parity.test.js` | Update paritas Ads Report typical monthly credits = 350 |
| `backend/tests/article-options-runtime.test.js` | Update pengujian estimasi ads report base = 300 dan standar = 350 |

### Frontend
| File | Perubahan |
|------|-----------|
| `frontend/src/config/pricing.js` | Update `typicalMonthlyCredits` Ads Report menjadi 350, recalculate benchmark gaji in-house |
| `frontend/src/content/legal-content.js` | Tambah klausul Meta Ads (read-only `ads_read`/`business_management`, tidak ada raw storage permanen, token dihapus saat disconnect) di ID dan EN |
| `frontend/src/pages/billing/CreditWalletPage.jsx` | Update tampilan tarif dasar Ads Report (350 kredit) |
| `frontend/src/ads/adsApi.js` | Hapus guard mock & perbaiki error string ke Inggris |
| `frontend/src/components/Sidebar.jsx` | Hapus `isAdsMock` import & badge coming soon |
| `frontend/src/pages/ads/AdsSummaryPage.jsx` | Hapus guard mock & `ModuleComingSoonCard` |
| `frontend/src/pages/ads/AdsReportDetailPage.jsx` | Hapus guard mock & `ModuleComingSoonCard` |
| `frontend/src/pages/ads/AdsCallbackPage.jsx` | Hapus guard mock & `ModuleComingSoonCard` |

### Automation (n8n)
| File | Perubahan |
|------|-----------|
| `automation/build-workflows.mjs` | Registrasi fungsi `buildAdsReport()`, output `n8n-ads-report-workflow.json`, dan kredensial placeholder |
| `automation/src/ads-auth-normalize.js` | Validasi input webhook, normalisasi rentang tanggal, periode perbandingan |
| `automation/src/ads-fetch-meta.js` | Fetch Graph API v21.0 Meta Insights (akun, campaign, breakdown demografi/platform, creative) |
| `automation/src/ads-process-metrics.js` | Agregasi metrik rasio SSOT & perhitungan delta vs periode sebelumnya |
| `automation/src/ads-render-slides.js` | Logika duplikasi layout slide, batchUpdate Google Slides, katalog alt-text |
| `automation/src/ads-prepare-callback.js` | Penyiapan payload callback ke backend Markimate |
| `automation/n8n-ads-report-workflow.json` | Workflow n8n kompilasi siap impor (14 nodes) |

---

## Spesifikasi Base Deck Google Slides & Katalog Alt-Text

Base Deck Google Slides Markimate dirancang dengan sistem layout modular. Setiap komponen teks, kartu metrik, grafik, dan gambar pada slide dikenali oleh automation melalui **Alt Text** (Description / Title):

### Daftar Alt-Text per Layout

1. **Cover Slide (`cover`)**:
   - `title` → Judul presentasi laporan (`Laporan Performa Iklan`)
   - `subtitle` → Nama akun iklan / brand (`{{account_name}} · Meta Ads`)
   - `period` → Rentang periode laporan (`{{period}}`)
   - `logo` → Logo workspace / brand pemilik

2. **KPI Summary Slide (`kpi`)**:
   - `kpi 1 label`, `kpi 1 value`, `kpi 1 delta` (Impresi)
   - `kpi 2 label`, `kpi 2 value`, `kpi 2 delta` (Jangkauan / Reach)
   - `kpi 3 label`, `kpi 3 value`, `kpi 3 delta` (Total Klik)
   - `kpi 4 label`, `kpi 4 value`, `kpi 4 delta` (CTR)
   - `kpi 5 label`, `kpi 5 value`, `kpi 5 delta` (Total Biaya / Spend)
   - `kpi 6 label`, `kpi 6 value`, `kpi 6 delta` (CPC Rata-rata)
   - `kpi 7 label`, `kpi 7 value`, `kpi 7 delta` (Hasil / Konversi)
   - `kpi 8 label`, `kpi 8 value`, `kpi 8 delta` (ROAS)

3. **Trend Slide (`trend`)**:
   - `trend title` → Judul grafik tren (misal: "Tren Biaya & Konversi Bulanan")
   - `chart main` → Linked Chart dari Google Sheets untuk tren harian / bulanan
   - `trend note` → Catatan ringkas tren performa

4. **Breakdown Slide (`breakdown`)**:
   - `breakdown title` → Judul slide (misal: "Biaya & Hasil per Platform")
   - `chart breakdown` → Linked Chart batang / pie dari Google Sheets
   - `insight text` → 1-2 kalimat insight otomatis dari Gemini (`insight: true`)

5. **Table Slide (`table`)**:
   - `table title` → Judul tabel (misal: "Rincian Performa Campaign")
   - `performance table` → Elemen tabel Google Slides yang barisnya diisi data campaign

6. **Creatives Slide (`creatives`)**:
   - `creatives title` → Judul (misal: "3 Iklan Terbaik Berdasarkan ROAS")
   - `creative 1 img`, `creative 1 label`, `creative 1 cost`, `creative 1 results`, `creative 1 roas`
   - `creative 2 img`, `creative 2 label`, `creative 2 cost`, `creative 2 results`, `creative 2 roas`
   - `creative 3 img`, `creative 3 label`, `creative 3 cost`, `creative 3 results`, `creative 3 roas`

7. **AI Insight Slide (`ai_insight`)**:
   - `ai title` → Judul ("Analisis Eksekutif & Rekomendasi AI")
   - `ai summary` → Ringkasan eksekutif performa (maks 180 kata dari Gemini 2.5 Flash)
   - `ai recommendations` → Poin-poin langkah rekomendasi optimasi

8. **Custom Text Slide (`custom_text`)**:
   - `custom text title` → Judul teks custom
   - `custom text body` → Isi catatan kustom pengguna

9. **Custom Image Slide (`custom_image`)**:
   - `custom image title` → Judul gambar kustom
   - `custom image` → Gambar kustom (misal screenshot dashboard eksternal)
   - `custom image caption` → Keterangan gambar

10. **Closing Slide (`closing`)**:
    - `closing title` → Penutup presentasi
    - `closing contact` → Kontak email / WhatsApp tim marketing

---

## Panduan Import Workflow n8n untuk 3Our

Workflow telah selesai dikompilasi ke file:
`automation/n8n-ads-report-workflow.json`

### Langkah Import:
1. Buka dashboard n8n 3Our (`https://n8n.3ourasia.id`).
2. Masuk ke menu **Workflows** → klik **Add Workflow** (atau **Import from File**).
3. Pilih berkas `automation/n8n-ads-report-workflow.json` dari repositori ini.
4. Hubungkan node dengan kredensial yang sesuai (lihat daftar di bawah).
5. Klik **Save** dan aktifkan toggle workflow menjadi **Active**.
6. Salin Production Webhook URL dan pastikan mengarah ke path `/webhook/ads-report-generate`.

---

## Daftar Kredensial n8n yang Perlu Dibuat / Dihubungkan 3Our

| Nama Kredensial di n8n | Tipe Kredensial | Kebutuhan Akses |
|------------------------|-----------------|-----------------|
| `Supermat API Key (Header)` | Header Auth | Validasi `X-Supermat-Key` / `X-Markimate-Key` antara Backend & n8n |
| `Google Slides Markimate` | OAuth2 (Google Slides API) | Membuat salinan deck, batchUpdate teks, gambar, & tabel |
| `Google Drive Markimate` | OAuth2 (Google Drive API) | Memberikan izin `role: editor` ke email pemesan & ekspor PDF |
| `Google Sheets Markimate` | OAuth2 (Google Sheets API) | Mengisi data sheet untuk grafik terhubung (*linked charts*) |
| `Gemini Markimate` | Google PaLM / Gemini API | Analisis performa iklan menggunakan `gemini-2.5-flash` |

---

## Migrasi SQL yang Harus Dijalankan di Supabase Production

```sql
backend/migrations/020_ads_report.sql
backend/migrations/021_ad_reports_refunded_at.sql
```

## Environment Variables yang Perlu Dikonfigurasi di Vercel

```env
META_APP_SECRET=<secret dari Meta Developers App>
VITE_META_APP_ID=<app id dari Meta Developers App>
MARKIMATE_N8N_ADS_REPORT_URL=https://n8n.3ourasia.id/webhook/ads-report-generate
```

---

## Checklist Mobile (390px)

Seluruh halaman Ads yang disentuh diuji pada lebar 390px (iPhone 14):
- [x] Tidak ada scroll horizontal (`scrollWidth <= innerWidth`)
- [x] Semua tombol & item interaktif >= 44x44px
- [x] Tabel laporan bisa di-scroll horizontal atau adaptif
- [x] Form generate laporan responsive & modal dapat ditutup
- [x] Font size input >= 16px (mencegah auto-zoom iOS)
