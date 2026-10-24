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
2. `feat(ads): langkah 2 migrasi sql 020 ads report (PRD F5)`:
   - Membuat file migrasi idempoten `backend/migrations/020_ads_report.sql` untuk 6 tabel: `ad_connections`, `ad_accounts`, `report_templates`, `ads_custom_metrics`, `report_profiles`, dan `ad_reports`.
   - Mengaktifkan RLS dan hak akses `service_role`.
   - Mendaftarkan tabel ke `backend/db.js` (JSON fallback & Supabase client) dan `backend/tests/run-all.js`.
   - Semua test contract dan backend 29/29 lolos 100%.

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

---

## Langkah 2: Migrasi SQL 020 Ads Report & Template Builder

### 1. File yang Berubah / Dibuat
- `backend/migrations/020_ads_report.sql`:
  - Tabel `markimate.ad_connections` (id, workspace_id, platform, external_user_id, display_name, token_enc, token_iv, refresh_enc, refresh_iv, token_expires_at, scopes, status, created_by, created_at, updated_at, revoked_at).
  - Tabel `markimate.ad_accounts` (id, workspace_id, connection_id, platform, external_id, name, currency, timezone, is_manager, login_customer_id, selected, created_at, updated_at, unique(workspace_id, platform, external_id)).
  - Tabel `markimate.report_templates` (id, workspace_id, name, spec, is_system, created_by, created_at, updated_at).
  - Tabel `markimate.ads_custom_metrics` (id, workspace_id, name, formula, unit, decimals, created_by, created_at, updated_at).
  - Tabel `markimate.report_profiles` (id, workspace_id, name, template_id, account_ids, date_preset, compare, conversion_event, currency, recipients, schedule, next_run_at, created_by, created_at, updated_at).
  - Tabel `markimate.ad_reports` (id, workspace_id, profile_id, template_snapshot, period_start, period_end, status, request_id, slides_url, slides_file_id, pdf_path, summary, warnings, credits_charged, error_code, created_by, created_at, started_at, finished_at, updated_at).
  - RLS aktif di seluruh tabel, grant all ke `service_role`, insert `schema_migrations('020')`, dan `notify pgrst`.
- `backend/db.js`:
  - Menambahkan 6 nama tabel ke `TABLES` dan `JsonStore.data`.
- `backend/tests/run-all.js`:
  - Menambahkan 6 tabel ke template DB temporary runner isolasi.

### 2. Cara Tes
- `cd backend && node tests/schema-contract.test.js`
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- `schema-contract.test.js`: 33 tabel terverifikasi lengkap, seluruh tabel baru terdaftar di db.js dan dapat di-query.
- Backend tests: 29/29 test suites lulus 100%.
- Frontend gates: lulus 100% tanpa error.

### 4. Hal yang Perlu Dijalankan 3Our
- Jalankan file migrasi `backend/migrations/020_ads_report.sql` di Supabase SQL Editor.
- Sesuai aturan PRD F5 Langkah 2 dan `AGENTS.md`, pengerjaan **berhenti** sejenak pada Langkah 2 untuk menunggu konfirmasi eksekusi SQL oleh 3Our sebelum melanjutkan ke Langkah 3 (OAuth Meta).

