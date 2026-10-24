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
4. `feat(ads): langkah 4 api template metrics custom profile dan asset upload (PRD F5)`:
   - Membuat `backend/lib/ads-templates.js` untuk seed template bawaan 'Markimate Standard' idempoten, CRUD template laporan dengan validasi spesifikasi mendalam, duplikasi template, dan pencegahan hapus bila sedang dipakai profil laporan (`TEMPLATE_IN_USE`).
   - Mengimplementasikan Metrics Custom (F5b): evaluasi rumus, pencegahan hapus bila sedang dipakai template (`CUSTOM_METRIC_IN_USE`), dan endpoint uji coba rumus `/api/ads/metrics/test`.
   - Mengimplementasikan CRUD profil laporan (`report_profiles`) dengan proteksi kepemilikan akun iklan multi-workspace (IDOR check).
   - Mengimplementasikan endpoint upload aset gambar custom `/api/ads/assets/upload` (PNG/JPG/WEBP maks 2 MB) dengan dukungan Supabase Storage / fallback data URI.
   - Menyediakan `backend/shared/` untuk mendukung isolasi bundling deployment Vercel yang mandiri (`deploy-bundle.test.js`).
   - Membuat test suite `backend/tests/ads-templates.test.js` (31/31 test backend lulus 100%).
5. `feat(ads): langkah 5 trigger webhook async n8n status polling dan rollback kredit (PRD F5)`:
   - Membuat `backend/lib/ads-runner.js` untuk integrasi webhook async ke n8n (`workflow_ads_report`), pemotongan kredit atomik sebelum trigger, rollback kredit otomatis bila trigger network n8n gagal, penanganan callback webhook selesai (`ready`) maupun gagal (`error` dengan refund kredit atomik), serta deteksi timeout 10 menit dengan auto-refund.
   - Mendukung perhitungan biaya rerun dalam 7 hari (diskon 100 kredit).
   - Mengimplementasikan endpoint `POST /api/ads/reports/generate`, `GET /api/ads/reports/:id`, dan `POST /api/ads/reports/callback`.
   - Membuat test suite `backend/tests/ads-runner.test.js` (32/32 test backend lulus 100%).
6. `feat(ads): langkah 6 cron pengiriman bulanan terjadwal dan email notifikasi (PRD F5)`:
   - Membuat `backend/lib/ads-scheduler.js` untuk eksekusi profil laporan bulanan terjadwal (`schedule = 'monthly'`), kalkulasi rentang tanggal bulan sebelumnya secara presisi, dan pemajuan jadwal eksekusi ke tanggal 1 bulan berikutnya.
   - Mengintegrasikan pengiriman email notifikasi via Resend dengan KPI summary, link presentasi Google Slides, dan attachment PDF jika ukuran <= 10 MB (atau tautan unduh jika > 10 MB).
   - Memasukkan pemrosesan laporan bulanan ke dalam cron utama backend `GET /api/cron/run-scheduled`.
   - Menghubungkan dispatch email otomatis ke pemangku kepentingan klien saat laporan berstatus `ready`.
   - Membuat test suite `backend/tests/ads-scheduler.test.js` (33/33 test backend lulus 100%).

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

---

## Langkah 4: API Template Laporan, Metrics Custom (F5b), Profil & Upload Aset

### 1. File yang Berubah / Dibuat
- `backend/lib/ads-templates.js`:
  - Pustaka logika seed template bawaan 'Markimate Standard' (`ensureDefaultReportTemplate`).
  - CRUD Template Laporan (`listTemplates`, `getTemplateById`, `createTemplate`, `updateTemplate`, `deleteTemplate`).
  - Proteksi: template sistem dilarang diubah/dihapus; template yang sedang dipakai profil laporan ditolak penghapusannya dengan kode `TEMPLATE_IN_USE`.
  - Pustaka Metrics Custom (`listAllAvailableMetrics`, `createCustomMetric`, `deleteCustomMetric`): rumus divalidasi shunting-yard; penghapusan ditolak jika sedang dipakai template (`CUSTOM_METRIC_IN_USE`).
  - Pustaka Profil Laporan (`listReportProfiles`, `createReportProfile`, `updateReportProfile`, `deleteReportProfile`): validasi kepemilikan akun iklan antar workspace (IDOR protection).
- `backend/shared/ads-metrics.js` & `backend/shared/report-template.js`:
  - Modul SSOT metrics & template yang mandiri di dalam folder `backend/` untuk menjaga kompatibilitas deployment bundle Vercel tanpa dependensi eksternal.
- `backend/index.js`:
  - Endpoint Templates: `GET /api/ads/templates`, `GET /api/ads/templates/:id`, `POST /api/ads/templates`, `PUT /api/ads/templates/:id`, `DELETE /api/ads/templates/:id`.
  - Endpoint Metrics: `GET /api/ads/metrics`, `POST /api/ads/metrics`, `POST /api/ads/metrics/test`, `DELETE /api/ads/metrics/:id`.
  - Endpoint Profil: `GET /api/ads/profiles`, `GET /api/ads/profiles/:id`, `POST /api/ads/profiles`, `PUT /api/ads/profiles/:id`, `DELETE /api/ads/profiles/:id`.
  - Endpoint Upload Aset: `POST /api/ads/assets/upload` (gambar PNG/JPG/WEBP maks 2 MB ke Supabase Storage / fallback data URI).
- `backend/tests/ads-templates.test.js`:
  - Test suite lengkap menguji template sistem read-only, duplikasi template, validasi spec, custom metrics F5b, proteksi hapus in-use, profile IDOR protection, upload custom asset, dan mutation checks.

### 2. Cara Tes
- `cd backend && node tests/ads-templates.test.js`
- `cd backend && node tests/deploy-bundle.test.js`
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- Backend tests: 31/31 test suites lulus 100% (termasuk `deploy-bundle.test.js` dan `ads-templates.test.js`).
- Frontend tests: 5/5 test scripts lulus.
- i18n check: 0 errors.
- Linter: 0 errors (clean hardcoded check).
- Build: 42 static SEO pages generated successfully.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Integrasi n8n generation & async polling status laporan (Langkah 5 & 6).
- Halaman UI Ads Report di frontend (Langkah 7).

---

## Langkah 5: Trigger Webhook Async n8n, Polling Status & Rollback Kredit Atomik

### 1. File yang Berubah / Dibuat
- `backend/lib/ads-runner.js`:
  - `triggerAdsReportGenerate`:
    - Validasi profil, template, akun iklan (IDOR), dan masa aktif token koneksi (`ADS_RECONNECT_REQUIRED`).
    - Pengecekan riwayat rerun dalam 7 hari (`isRerun`, biaya 100 kredit).
    - Pemotongan kredit atomik via `charge(workspaceId, ...)` sebelum mengirim webhook ke n8n.
    - Pengiriman payload lengkap ke endpoint n8n (`process.env.MARKIMATE_N8N_ADS_REPORT_URL` atau `${N8N_BASE_URL}/webhook/ads-report-generate`).
    - **Rollback kredit atomik**: jika koneksi ke webhook n8n gagal, saldo kredit langsung dikembalikan utuh ke wallet pemanggil via `grant(..., 'refund')` dan laporan ditandai `error` dengan kode `ADS_SOURCE_UNAVAILABLE`.
  - `handleAdsReportCallback`:
    - Menangani callback status `ready` dari n8n untuk menyimpan link Google Slides, PDF, ringkasan, dan status selesai.
    - Menangani callback status `error` dari n8n: otomatis melakukan **refund kredit 100%** ke wallet pengguna secara atomik.
    - Idempoten: mengabaikan callback ganda jika laporan telah berstatus `ready` atau `error`.
  - `getReportStatus`:
    - Mengambil status laporan dengan isolasi workspace (IDOR protection).
    - **Deteksi timeout 10 menit**: jika laporan berstatus `running` lebih dari 10 menit tanpa kabar dari n8n, otomatis status diubah menjadi `error` (`ADS_REPORT_TIMEOUT`) dan kredit di-refund secara atomik.
- `backend/lib/credits.js`:
  - Mendukung `extra.credits` eksplisit pada fungsi `estimate(...)` untuk memastikan perhitungan harga komposit dinamis Ads Report terakomodasi sempurna dalam engine wallet.
- `backend/index.js`:
  - `POST /api/ads/reports/generate`: trigger pembuatan laporan (role admin, 202 Accepted).
  - `GET /api/ads/reports/:id`: polling status laporan (role viewer).
  - `POST /api/ads/reports/callback`: webhook penerima hasil generasi dari n8n dengan proteksi API Key.
- `backend/tests/ads-runner.test.js`:
  - 10 kelompok pengujian unit & integrasi lengkap: saldo tidak cukup (402), token kedaluwarsa (409), rollback kredit saat trigger network gagal, trigger sukses & potongan saldo, polling status, webhook ready, webhook error & auto refund, timeout 10 menit & auto refund, diskon rerun 100 kredit, dan mutation checks.

### 2. Cara Tes
- `cd backend && node tests/ads-runner.test.js`
- `cd backend && node tests/deploy-bundle.test.js`
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- Backend tests: 32/32 test suites lulus 100% (termasuk `ads-runner.test.js` dan `deploy-bundle.test.js`).
- Frontend tests: 5/5 test scripts lulus.
- i18n check: 0 errors.
- Linter: 0 errors (clean hardcoded check).
- Build: 42 static SEO pages generated successfully.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Cron pengiriman terjadwal bulanan (Langkah 6).
- Halaman UI Ads Report di frontend (Langkah 7).

---

## Langkah 6: Cron Pengiriman Terjadwal Bulanan & Email Notifikasi

### 1. File yang Berubah / Dibuat
- `backend/lib/ads-scheduler.js`:
  - `getPreviousMonthRange(now)`: Helper kalkulasi tanggal bulan sebelumnya (tanggal 1 s.d. tanggal terakhir bulan lalu).
  - `getNextMonthlyRunDate(now)`: Helper penentu jadwal eksekusi berikutnya pada tanggal 1 bulan depan pukul 07:00 WIB (00:00 UTC).
  - `sendAdsReportEmail`: Template email transaksional dwibahasa (ID & EN) memuat ringkasan performa iklan, tautan langsung ke deck Google Slides, serta attachment PDF (jika ukuran <= 10 MB) atau tautan unduh jika melebihi 10 MB.
  - `dispatchReportEmails`: Mengirim notifikasi email otomatis ke seluruh email pemangku kepentingan klien (`profile.recipients`) saat webhook laporan selesai (`ready`).
  - `processScheduledAdsReports`: Mengidentifikasi profil laporan dengan `schedule = 'monthly'` dan jatuh tempo (`next_run_at <= now`), memverifikasi hak modul workspace, memicu pembuatan laporan secara otomatis, dan memajukan jadwal ke tanggal 1 bulan berikutnya.
- `backend/lib/mailer.js`:
  - Menambahkan dukungan lampiran berkas (`attachments`) pada fungsi `sendMail` untuk integrasi Resend REST API dan pencatatan dev log.
- `backend/lib/ads-runner.js`:
  - Menghubungkan pemanggilan `dispatchReportEmails` otomatis saat callback dari n8n berhasil mengubah status laporan menjadi `ready`.
- `backend/index.js`:
  - Memasukkan eksekusi `processScheduledAdsReports` ke dalam endpoint cron utama `GET /api/cron/run-scheduled` (Langkah 3 di cron harian).
- `backend/tests/ads-scheduler.test.js`:
  - 6 kelompok pengujian unit & integrasi lengkap: kalkulasi rentang tanggal, formatting email & batas ukuran lampiran PDF, dispatch email otomatis saat callback selesai, eksekusi cron bulanan, integrasi HTTP GET /api/cron/run-scheduled, dan mutation checks (terbukti KILLED).

### 2. Cara Tes
- `cd backend && node tests/ads-scheduler.test.js`
- `cd backend && node tests/deploy-bundle.test.js`
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`

### 3. Hasil Tes
- Backend tests: 33/33 test suites lulus 100% (termasuk `ads-scheduler.test.js` dan `deploy-bundle.test.js`).
- Frontend tests: 5/5 test scripts lulus.
- i18n check: 0 errors.
- Linter: 0 errors (clean hardcoded check).
- Build: 42 static SEO pages generated successfully.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Halaman UI Ads Report di frontend (Langkah 7).

---

## Langkah 7: Frontend UI untuk Ads Connections, Reports, Templates, Metrics, dan Profiles

### 1. File yang Berubah / Dibuat
- `frontend/src/ads/adsApi.js`:
  - Kumpulan helper API klien untuk komunikasi dengan endpoint backend Ads Report: `getAuthUrl`, `listConnections`, `disconnectAccount`, `getAdAccounts`, `toggleAccountSelected`, `getTemplates`, `saveTemplate`, `removeTemplate`, `getCustomMetrics`, `saveCustomMetric`, `testFormula`, `removeCustomMetric`, `getProfiles`, `saveProfile`, `removeProfile`, `listReports`, `getReportStatus`, `generateAdsReport`, dan `downloadPdfReport`.
- `frontend/src/pages/ads/AdsConnectionsPage.jsx`:
  - Halaman manajemen integrasi akun periklanan Meta Ads.
  - Alur OAuth popup / redirect terintegrasi dengan penanganan state HMAC anti-CSRF.
  - Kartu koneksi platform aktif dengan info akun, badge status, dan tanggal kedaluwarsa token.
  - Banner peringatan token kedaluwarsa otomatis muncul jika sisa masa aktif token kurang dari 10 hari.
  - Banner jaminan keamanan & privasi read-only (`ads_read` only, tanpa izin mengubah kampanye atau membelanjakan budget).
  - Daftar akun iklan terhubung dengan switch toggle pilih/abaikan untuk pelaporan.
  - Dialog konfirmasi pemutusan koneksi yang aman.
- `frontend/src/pages/ads/AdsReportsPage.jsx`:
  - Halaman riwayat dan pelaporan performa iklan.
  - Tampilan daftar laporan responsif: kartu vertikal pada layar mobile (< 640px) dan tabel tabular pada desktop (>= 640px).
  - Indikator status real-time (`ready`, `running`, `queued`, `error` dengan info pengembalian saldo kredit otomatis).
  - Tautan langsung pembukaan Google Slides interaktif dan pengunduhan berkas PDF.
  - Modal Generator Laporan Baru (`handleOpenModal`):
    - Pilihan mode profil tersimpan atau konfigurasi manual.
    - Pemilihan template dan akun iklan multi-select via checkbox responsif.
    - Pemilihan rentang tanggal (tanggal awal & akhir).
    - Kalkulasi live preview estimasi kredit dinamis sesuai komposisi akun dan halaman AI analitik.
    - Polling otomatis berkala tiap 4 detik selama ada laporan berstatus running/queued.
- `frontend/src/pages/ads/AdsTemplatesPage.jsx`:
  - Halaman Template Builder, Metrics Custom (F5b), dan Profil Laporan terpadu dalam 3 tab:
    - **Tab 1: Template Builder**: Daftar template bawaan & kustom, duplikasi template bawaan sistem, reorder urutan slide pages (naik/turun), tambah tipe halaman baru (`+ KPI`, `+ Trend`, `+ Table`, `+ Breakdown`, `+ Creatives`, `+ AI Insight`), hapus halaman slide, dan kartu edukasi rumus kredit.
    - **Tab 2: Custom Metrics (F5b)**: Form pembuatan metric kustom baru (nama, rumus, satuan: angka/mata uang/persentase/rasio, dan presisi desimal), pengujian formula interaktif secara langsung (`testFormula`) dengan indikator validasi real-time, serta direktori daftar metric bawaan platform & kustom.
    - **Tab 3: Profil Laporan & Jadwal**: Form registrasi profil pelaporan (nama profil, pemilihan template dasar, jadwal eksekusi manual atau bulanan otomatis tiap tanggal 1 pukul 07:00 WIB, serta daftar email penerima laporan), dan kartu manajemen profil tersimpan.
- `frontend/src/App.jsx`:
  - Pendaftaran rute aplikasi terproteksi: `/app/ads/connections`, `/app/ads/reports`, dan `/app/ads/templates`.
  - Dilindungi oleh gerbang `ModuleGuard moduleKey="ads_report"` dengan navigasi aktivasi modul jika belum aktif.
- `frontend/src/components/Sidebar.jsx`:
  - Menu navigasi kelompok Ads Report dengan submenu Laporan, Template & Metrics, dan Koneksi Akun.
- `frontend/src/index.css`:
  - Sistem style CSS modular untuk halaman Ads (`.ads-container`, `.ads-grid`, `.ads-card`, `.ads-badge`, `.ads-btn`, `.ads-tab-btn`, `.ads-form-group`, `.ads-modal`, responsive break-points mobile-first).
- `frontend/src/i18n/locales/id/ads.js` & `frontend/src/i18n/locales/en/ads.js`:
  - Kamus lokalisasi komprehensif untuk modul periklanan: koneksi, akun, template, kustom metric, profil, generator laporan, dan notifikasi status.
- `frontend/src/i18n/locales/id/app.js` & `frontend/src/i18n/locales/en/app.js`:
  - Penambahan label navigasi menu sidebar Ads Report.

### 2. Cara Tes
- `cd backend && npm test`
- `cd frontend && npm test && npm run i18n:check && npm run lint && npm run build`
- `node scratch/capture-f5-screenshots.mjs`

### 3. Hasil Tes
- Backend tests: 33/33 test suites lulus 100% tanpa regresi.
- Frontend tests: 5/5 test scripts lulus.
- i18n check: 0 errors (paritas sempurna 2.427 keys antara EN dan ID).
- Hardcoded string audit: Lulus 100% (68 file di `src/` bebas dari string statis hardcoded bahasa Indonesia).
- Linter ESLint: 0 errors.
- Build Produksi: 42 static HTML SEO pages & sitemap generated successfully.
- Tangkapan layar Google Chrome Headless CDP (10 berkas beresolusi 390px dan 1280px dengan hash MD5 100% unik dan lulus uji horizontal scroll).

### 4. Rekap Tangkapan Layar & Uji Mobile Responsif (Langkah 7)

| File Tangkapan Layar | Resolusi & Bahasa | MD5 Hash | Ukuran | Cek Overflow Horizontal |
|---|---|---|---|---|
| `docs/reports/img/f5-connections-390-id.png` | 390×844 (Mobile ID) | `20f6c2058fe3e418b521f023b753f68b` | 169.312 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-connections-1280-id.png` | 1280×900 (Desktop ID) | `0315094630b27f31f421bb76b98cced5` | 288.160 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-connections-390-en.png` | 390×844 (Mobile EN) | `e959a6e8103d7b1a172b97c9a9062c51` | 167.972 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-reports-390-id.png` | 390×844 (Mobile ID) | `2c90d0289696609133a966c445d4fbaa` | 88.339 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-reports-1280-id.png` | 1280×900 (Desktop ID) | `8cd8f28474ce1760d645c9bfe32f4db7` | 208.052 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-reports-390-en.png` | 390×844 (Mobile EN) | `888dc0104f1e1bccffead017f5b8cfd7` | 89.368 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-reports-modal-390-id.png` | 390×844 (Modal ID) | `2110864931e5617677ba901339e0dfca` | 145.510 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-templates-390-id.png` | 390×844 (Mobile ID) | `6206d0adda0621ac689cb37ae72c18e8` | 86.715 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-templates-1280-id.png` | 1280×900 (Desktop ID) | `1e7848d5c1b61cf8e090b1de1a84b1e9` | 210.040 B | PASSED (no horizontal scroll) |
| `docs/reports/img/f5-templates-390-en.png` | 390×844 (Mobile EN) | `ba5454b6a6748b897d1210d0c74e55ac` | 88.924 B | PASSED (no horizontal scroll) |

### 5. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Integrasi Google Ads OAuth (fase berikutnya: PRD F5-Google).
- Live preview canvas interaktif Google Slides slide-by-slide di browser (menggunakan direct embed / edit link ke Google Slides resmi).




