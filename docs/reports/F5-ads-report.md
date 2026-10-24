# Laporan Pengerjaan PRD F5: Ads Report (OAuth Meta Ads + Template Builder)

**Tanggal:** 24 Oktober 2026  
**Status:** Sedang Berjalan (In Progress - Autopilot Mode)  
**Lingkup Tahap Ini:** Meta Ads saja (Google Ads ditunda ke fase F5-Google).

---

## Daftar Commit

1. `feat(ads): langkah 1 pustaka metrics dan validasi template (PRD F5)`:
   - Membuat `shared/ads-metrics.js` sebagai sumber tunggal SSOT perhitungan metrics iklan dasar & turunan serta parser formula aman (shunting-yard tanpa `eval`).
   - Membuat `shared/report-template.js` untuk spesifikasi template JSON (Markimate Standard), validasi struktur & placeholder, serta helper estimasi kredit.
   - Membuat `backend/tests/ads-metrics.test.js` dengan pengujian menyeluruh (agregasi sum vs rasio, pembagian nol, validasi formula & syntax error posisi, validasi batas halaman/kpi/table, dan estimasi kredit).

---

## Langkah 1: Pustaka Metrics & Validasi Template

### 1. File yang Berubah / Dibuat
- `shared/ads-metrics.js`:
  - Definisi base metrics: `spend`, `impressions`, `reach`, `clicks`, `link_clicks`, `conversions`, `conversion_value`, `leads`, `purchases`, `video_views`, `results`, `purchase_value`.
  - Definisi derived metrics: `cost_per_result`, `cost_per_purchase`, `ctr`, `cpc`, `cpm`, `cpa`, `roas`, `frequency`, `conv_rate`.
  - Agregasi `aggregateRows(rows)` menghitung rasio dari jumlah (sum) agregat, bukan rata-rata rasio per baris.
  - Formula parser shunting-yard tanpa `eval`/`Function`: mendukung operator `+ - * /`, tanda kurung, angka desimal, identifier valid, tolak referensi custom metric lain untuk hindari siklus, maksimal 200 karakter.
- `shared/report-template.js`:
  - Template standar `MARKIMATE_STANDARD_TEMPLATE` (meniru workflow produksi 3Our WF v3.2).
  - Validasi template `validateTemplate(spec)`: batas 20 halaman, KPI 1–8 metrics, table limit <= 25, trend 1–3 metrics, breakdown 1–2 metrics, AI insight maks 2 halaman, penolakan placeholder tidak dikenal, penolakan platform Google (`PLATFORM_NOT_AVAILABLE`).
  - Helper kalkulasi estimasi kredit: 300 base (s.d. 3 akun) + 50/extra akun + 50/halaman AI (template standar = 350 kredit, 5 akun + 2 AI = 500 kredit, rerun = 100 kredit).
- `backend/tests/ads-metrics.test.js`:
  - 6 kelompok pengujian unit lengkap dengan coverage 100%.

### 2. Cara Tes
- Backend test runner: `cd backend && npm test`
- Frontend gate: `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- Backend tests: 29/29 test suites lolos (termasuk `tests/ads-metrics.test.js` 0.12s).
- Frontend tests: 5/5 test scripts lolos.
- i18n check: 0 errors.
- Linter: 0 errors (clean hardcoded check).
- Build: 42 static SEO pages generated successfully.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Frontend UI Ads Report belum disentuh (akan dikerjakan di Langkah 7).
- Migrasi database SQL 020 dikerjakan di Langkah 2.
