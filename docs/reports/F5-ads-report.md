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
3. `feat(ads): langkah 3 oauth meta koneksi akun dan pemutusan (PRD F5)`:
   - Membuat `backend/lib/ads-oauth.js` untuk penanganan OAuth Meta Ads, state token HMAC anti-CSRF (10 menit expiry), penukaran token jangka panjang (±60 hari), enkripsi token AES-256-GCM, dan sinkronisasi akun iklan.
   - Mengimplementasikan endpoint `/api/ads/connections` (GET), `/api/ads/oauth/meta/url` (GET), `/api/ads/oauth/meta/callback` (GET), `/api/ads/connections/:id` (DELETE dengan pemanggilan revoke permission eksternal), `/api/ads/accounts` (GET), dan `/api/ads/accounts/:id/select` (PATCH).
   - Menambahkan 11 standar ERROR_CODES terkait Ads Report di backend dan frontend locales (EN & ID).
   - Membuat test suite `backend/tests/ads-oauth.test.js` dengan pengujian unit, HTTP endpoint, IDOR isolation, deteksi kedaluwarsa (< 10 hari), dan mutation checks (terbukti KILLED).

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

### 4. Hal yang Telah Dijalankan 3Our
- Migrasi SQL 020 telah berhasil dijalankan oleh 3Our di Supabase SQL Editor.

---

## Langkah 3: OAuth Meta Ads, Koneksi Akun & Pemutusan

### 1. File yang Berubah / Dibuat
- `backend/lib/ads-oauth.js`:
  - Pengecekan konfigurasi OAuth Meta: `isMetaOAuthConfigured()`.
  - Pembuat & verifikator state token HMAC anti-CSRF dengan expiry 10 menit (`generateMetaOAuthState`, `verifyMetaOAuthState`).
  - URL generator Meta Dialog OAuth (`getMetaOAuthUrl`).
  - Penukar kode otorisasi ke token jangka panjang ±60 hari (`exchangeMetaCode`).
  - Pengambil profil pengguna (`fetchMetaProfile`) dan akun iklan (`fetchMetaAdAccounts`).
  - Penyimpan koneksi dengan token terenkripsi AES-256-GCM (`saveMetaConnection`).
  - Pemutus koneksi dengan remote revoke permission ke Meta Graph API dan penghapusan token di DB (`disconnectAdConnection`).
  - Pelister koneksi aman (tanpa rahasia token) dengan deteksi banner kedaluwarsa `< 10 hari` dan kartu Google Ads `coming_soon` (`listAdConnections`).
- `backend/index.js`:
  - `GET /api/ads/connections`: daftar koneksi workspace.
  - `GET /api/ads/oauth/meta/url`: perolehan URL OAuth Meta berstatus aman.
  - `GET /api/ads/oauth/meta/callback`: pertukaran kode OAuth dan penyimpanan akun iklan.
  - `DELETE /api/ads/connections/:id`: pemutusan koneksi dengan proteksi IDOR.
  - `GET /api/ads/accounts`: daftar akun iklan di workspace.
  - `PATCH /api/ads/accounts/:id/select`: pemilihan akun iklan aktif.
- `backend/lib/error-codes.js`, `frontend/src/i18n/locales/en/errors.js`, `frontend/src/i18n/locales/id/errors.js`:
  - Penambahan 11 standar kode error Ads Report (`INVALID_OAUTH_STATE`, `ADS_CONNECTION_NOT_FOUND`, dll).
- `backend/tests/ads-oauth.test.js`:
  - Test suite komprehensif menguji HMAC state token, enkripsi AES-256-GCM, sinkronisasi akun, deteksi banner kedaluwarsa < 10 hari, pemutusan koneksi, proteksi IDOR, dan mutation check.

### 2. Cara Tes
- `cd backend && node tests/ads-oauth.test.js`
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- Backend tests: 30/30 test suites lulus 100% (termasuk `tests/ads-oauth.test.js`).
- Frontend tests: 5/5 test scripts lulus.
- i18n check: 0 errors (semua 89 kode error backend sinkron dwibahasa).
- Linter: 0 errors (clean hardcoded check).
- Build: 42 static SEO pages generated successfully.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- CRUD template laporan dan custom metrics (Langkah 4).
- Panggilan n8n async pembuatan laporan (Langkah 5 & 6).
- Halaman antarmuka frontend (Langkah 7).
