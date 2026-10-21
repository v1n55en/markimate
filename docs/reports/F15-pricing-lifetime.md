# Laporan Implementasi PRD F15: Pricing Lifetime per Modul + Kredit Bulanan + Top-up Custom

Tanggal: 21 Oktober 2026  
Status: Completed (Langkah 1 s/d 9 Selesai 100%)  
Pemilik Keputusan: 3Our Asia  

---

## Ringkasan Perubahan per Langkah

### Langkah 1: Config + `quoteTopup` + Test Kesetaraan FE/BE (PRD F15)
- **Tujuan**: Menetapkan konfigurasi resmi harga modul lifetime, bundle Fokus 3, spesifikasi top-up custom, dan kalkulator diskon `quoteTopup` di backend dan frontend dengan uji kesetaraan 100%.
- **File Berubah/Dibuat**:
  - `backend/lib/catalog.js`: Ditambahkan konfigurasi `MODULES` (SEO, Ads Report, Ads Spy), `BUNDLES` (Bundle Fokus 3), `TOPUP` (Rp1.000/credit, min 50, max 50.000, diskon 5% & 10%), fungsi `quoteTopup(credits)`, dan perluasan `getCatalog()`.
  - `frontend/src/config/pricing.js`: Didefinisikan konfigurasi `MODULES`, `LIFETIME_BUNDLES`, `TOPUP`, dan `quoteTopup` yang identik dengan backend.
  - `backend/tests/pricing-parity.test.js`: Suite test baru yang memvalidasi parity 100% antara backend dan frontend (17 test suite total).
- **Hasil Test**:
  - `node tests/pricing-parity.test.js` lolos 100%.
  - Seluruh verifikasi matematis `quoteTopup`:
    - 50 credit -> Rp50.000 (0% disc)
    - 75 credit -> Rp75.000 (0% disc)
    - 1.000 credit -> Rp950.000 (5% disc)
    - 2.500 credit -> Rp2.250.000 (10% disc)

---

### Langkah 2: SQL 015 Migrasi Database Lifetime Modules & Monthly Grants (PRD F15)
- **Tujuan**: Menyiapkan file migrasi SQL idempoten `backend/migrations/015_lifetime_modules.sql` untuk mendukung status kepemilikan seumur hidup (`source: 'lifetime'`), payment jenis `'module'`, idempotensi grant (`payments.granted_at`), relasi foreign key `module_entitlements.payment_id`, serta tabel pencatat kuota bulanan `markimate.monthly_grants`.
- **File Berubah/Dibuat**:
  - `backend/migrations/015_lifetime_modules.sql`: Script SQL idempoten dengan schema prefix `markimate.`, CHECK constraint `module_entitlements_source_check` (`free`, `trial`, `subscription`, `admin`, `lifetime`), CHECK constraint `payments_kind_check` (`topup`, `subscription`, `module`), kolom `granted_at` dan `payment_id`, serta tabel `monthly_grants` ber-RLS.
  - `backend/lib/schema-contract.js`: Menambahkan parser `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` sehingga migrasi enum baru terdeteksi otomatis pada runtime contract validation.
  - `backend/db.js`: Mendaftarkan tabel `monthly_grants` ke array `TABLES` dan `JsonStore`.
  - `backend/tests/run-all.js`: Menambahkan `monthly_grants` ke temporary test database schema.
  - `backend/tests/schema-contract.test.js`: Menambahkan pengujian kontrak untuk `source: 'lifetime'`, `kind: 'module'`, dan tabel `monthly_grants`.
- **Status Autopilot**: Sesuai instruksi PRD F15 poin 4 dan aturan `AGENTS.md`, agen **berhenti** setelah commit Langkah 2 dan menyerahkan SQL kepada user untuk dijalankan di Supabase sebelum melanjutkan langkah-langkah fulfillment runtime (Langkah 3 s/d 9).

---

### Langkah §7: Stored Procedures Mutasi Saldo Wallet Atomik & Lazy Monthly Grant (PRD F15 §7)
- **Tujuan**: Mencegah race condition, double spending, dan konkurensi grant/charge melalui RPC Stored Procedures di level database PostgreSQL dengan penguncian pesimis (`SELECT ... FOR UPDATE`), serta penanganan in-memory atomik pada JsonStore fallback.
- **File Berubah/Dibuat**:
  - `backend/migrations/016_atomic_wallet_rpc.sql`:
    1. `markimate.charge_wallet_atomic`: Pemotongan saldo berurutan (trial -> sub -> topup) dengan row-lock `credit_wallets`, idempotensi per `ref_type` & `ref_id`, penolakan `INSUFFICIENT_CREDITS`, dan pencatatan audit `credit_ledger` dalam 1 transaksi atomik.
    2. `markimate.grant_wallet_atomic`: Penambahan kredit / overwrite paket bulanan atomik dengan idempotensi per `p_ref_id`.
    3. `markimate.apply_monthly_grant_atomic`: Grant kuota bulanan modul lifetime secara lazy, non-akumulasi (reset kuota di awal bulan baru), dan penambahan selisih kuota jika modul baru dibeli di tengah bulan berjalan.
  - `backend/db.js`: Mengimplementasikan RPC handler untuk ketiga fungsi di `JsonStore.rpc()`.
  - `backend/lib/credits.js`: Memperbarui `charge()` dan `grant()` untuk memanggil atomic RPC, serta menambahkan fungsi `ensureMonthlyGrant(workspaceId, now)`.
  - `backend/tests/monthly-grant-atomic.test.js`: Suite test baru (total 18 suite backend) yang memverifikasi pencegahan double spending pada dua pemotongan konkuren, idempotensi grant bersamaan, lazy grant kuota bulanan, upgrade kuota di tengah bulan, dan non-akumulasi kuota lintas bulan.
- **Status Autopilot**: Sesuai instruksi user *"Kalau butuh RPC/SQL baru, berhenti lagi dan kirim SQL-nya"*, agen **berhenti** setelah commit Langkah §7 dan menyerahkan SQL migrasi 016 ini kepada 3Our untuk dijalankan di Supabase sebelum melanjutkan langkah berikutnya.

---

### Langkah 3: Fulfillment `module` + Entitlement Lifetime + Idempotensi `granted_at` (PRD F15)
- **Tujuan**: Mengimplementasikan endpoint pemesanan modul/bundle lifetime `POST /api/billing/modules`, perhitungan harga dinamis untuk Bundle Fokus 3 dengan floor price (diskon kepemilikan sebagian modul), fulfillment otomatis saat pembayaran sukses, aktivasi entitlement seumur hidup (`source: 'lifetime'`, `ends_at: null`), pencatatan status `granted_at` pada payment record untuk idempotensi mutlak, serta pengiriman email konfirmasi aktivasi modul lifetime.
- **File Berubah/Dibuat**:
  - `backend/index.js`: Menambahkan route `POST /api/billing/modules` (membutuhkan otentikasi role `admin` workspace, menerima parameter `{ module | bundle }`).
  - `backend/lib/payments/service.js`:
    - Prefix nomor invoice modul: `MKM-M-{YYMMDD}-{RANDOM}`.
    - Validasi kepemilikan modul di `createCheckout`: menolak pembelian modul yang sudah dimiliki dengan 409 `MODULE_ALREADY_OWNED`.
    - Perhitungan harga bundle dinamis jika sebagian modul telah dimiliki: `finalPrice = Math.max(bundlePrice - ownedModulesPrice, Math.round(unownedModulesPrice * 0.8))`.
    - Fulfillment handler `kind === 'module'`: mengecek `payment.granted_at`, meng-upsert `module_entitlements` dengan `source: 'lifetime'`, `ends_at: null`, dan `payment_id`, memanggil `ensureMonthlyGrant(workspaceId)`, mencatat `granted_at`, dan mengirim email `sendModuleSuccessEmail`.
    - Menambahkan penanganan rekonsiliasi payment kind `'module'` jika `granted_at` belum terisi.
  - `backend/lib/mailer.js`: Menambahkan fungsi `sendModuleSuccessEmail` dwibahasa (EN & ID) dengan tag `module_success`.
  - `backend/lib/error-codes.js`: Menambahkan `MODULE_ALREADY_OWNED` (409), `INVALID_MODULE` (400), `INVALID_TOPUP_AMOUNT` (400), dan `PLAN_DISCONTINUED` (410).
  - `frontend/src/i18n/locales/en/errors.js` & `frontend/src/i18n/locales/id/errors.js`: Menambahkan padanan teks kamus untuk seluruh error code baru.
  - `backend/tests/run-all.js`: Menambahkan `subscriptions` dan `webhook_events` pada template database isolasi testing.
  - `backend/tests/module-billing.test.js`: Suite test baru ke-19 yang memvalidasi:
    1. Single module checkout & invoice prefix `MKM-M-`.
    2. Webhook DOKU success & fulfillment lifetime entitlement (`ends_at: null`) dan penerimaan 100 kredit bulanan.
    3. Idempotensi webhook dan direct re-fulfillment via `granted_at` tanpa penambahan kredit duplikat.
    4. Pencegahan pembelian ulang modul yang telah dimiliki (409 `MODULE_ALREADY_OWNED`).
    5. Perhitungan diskon dan floor price Bundle Fokus 3 saat modul SEO sudah dimiliki (Rp2.784.000).
    6. Fulfillment bundle Fokus 3 dan upgrade kuota bulanan menjadi 600 kredit (diff +500).
    7. Pencegahan pembelian bundle saat semua modul sudah dimiliki (409 `MODULE_ALREADY_OWNED`).
    8. Validasi input modul/bundle palsu atau kosong (400 `INVALID_MODULE`).
- **Hasil Test**:
  - `cd backend && npm test`: 19/19 test suite lolos 100%.
  - `cd frontend && npm run i18n:check`: 70/70 backend error codes ter-cover di kamus EN & ID, 0 error.
  - `cd frontend && npm run build`: Build client & generator SEO halaman statis sukses tanpa error.

---

### Langkah 4: Integrasi Lazy `ensureMonthlyGrant` di `/api/me`, `/api/billing`, dan `charge()` (PRD F15)
- **Tujuan**: Memastikan kuota bulanan modul lifetime di-grant secara lazy hanya saat user/workspace aktif (login atau pemanggilan `/api/me`, membuka menu `/api/billing`, atau sebelum eksekusi aksi di `charge()`), serta tidak membebani server/API untuk workspace yang tidak aktif. Kuota di-reset (overwrite, bukan akumulasi) tiap awal bulan WIB dan hangus di akhir bulan.
- **File Berubah/Dibuat**:
  - `backend/lib/credits.js`:
    - Mengintegrasikan pemanggilan `ensureMonthlyGrant(workspaceId)` di `getWallet(workspaceId)` dan sebelum eksekusi pemotongan kredit di `charge()`.
  - `backend/index.js`:
    - Mengimpor `ensureMonthlyGrant` dari `./lib/credits.js`.
    - Memanggil `ensureMonthlyGrant(activeWsId)` di endpoint `GET /api/me`.
    - Memanggil `ensureMonthlyGrant(req.workspace.id)` di endpoint `GET /api/billing`.
  - `backend/tests/monthly-grant-atomic.test.js`:
    - Menambahkan pengujian case ke-6: memverifikasi bahwa pemanggilan `charge()` pada workspace baru yang memiliki modul lifetime tanpa grant awal secara otomatis memicu `ensureMonthlyGrant`, mengisi saldo sub 100 kredit, dan memotong 60 kredit dengan saldo akhir 40 kredit.
- **Hasil Test**:
  - `cd backend && npm test`: 19/19 test suite lolos 100%.
  - `cd frontend && npm run i18n:check`: 70/70 error codes ter-cover di kamus EN & ID.
  - `cd frontend && npm run build`: Lolos 100%.

---

### Langkah 5: Top-up Custom Endpoint + Validasi Min/Max & Diskon Volume (PRD F15)
- **Tujuan**: Mengimplementasikan endpoint top-up fleksibel `POST /api/billing/topup` yang menerima jumlah kredit kustom `{ credits }`, memvalidasi batas minimal 50 credit dan maksimal 50.000 credit, menghitung harga di server dengan diskon volume otomatis (5% untuk >= 1.000 credit, 10% untuk >= 2.500 credit), mengabaikan nominal `amount` dari client, serta mempertahankan backward compatibility untuk payload lama.
- **File Berubah/Dibuat**:
  - `backend/index.js`: Memperbarui `app.post('/api/billing/topup')` untuk meneruskan `credits` ke `createCheckout`.
  - `backend/lib/payments/service.js`:
    - Mengimpor `TOPUP` dan `quoteTopup` dari `../catalog.js`.
    - Di `createCheckout`: mendeteksi input `credits`, memvalidasi `credits < TOPUP.min` atau `credits > TOPUP.max` dengan melempar error 400 `INVALID_TOPUP_AMOUNT`.
    - Menghitung ulang harga secara independen di sisi server menggunakan `quoteTopup(numCredits)` sehingga nominal dari client diabaikan total.
    - Menetapkan masa berlaku 365 hari pada bucket top-up.
  - `backend/tests/custom-topup.test.js`: Suite test baru ke-20 yang memverifikasi:
    1. Validasi penolakan kredit < 50 (49, 0, negatif) dengan 400 `INVALID_TOPUP_AMOUNT`.
    2. Validasi penolakan kredit > 50.000 (50.001) dengan 400 `INVALID_TOPUP_AMOUNT`.
    3. Normal top-up 75 credit seharga Rp75.000, serta verifikasi bahwa manipulasi `amount: 1000` dari client diabaikan total oleh server.
    4. Diskon otomatis tier 1: 1.000 credit dipotong 5% menjadi Rp950.000.
    5. Diskon otomatis tier 2: 2.500 credit dipotong 10% menjadi Rp2.250.000.
    6. Fulfillment webhook DOKU untuk custom top-up (penambahan saldo top-up ke wallet).
    7. Backward compatibility untuk payload lama `{ packageId: 'starter' }`.
- **Hasil Test**:
  - `cd backend && npm test`: 20/20 test suite lolos 100%.
  - `cd frontend && npm run i18n:check`: 70/70 error codes ter-cover di kamus EN & ID.
  - `cd frontend && npm run build`: Lolos 100%.

---

### Langkah 6: Hapus Langganan Lama (410 `PLAN_DISCONTINUED`), Free Tier 0, Trial 30 Hari, dan Pengaman Trial (PRD F15)
- **Tujuan**:
  1. Mengubah masa free trial menjadi 30 hari (`TRIAL_DAYS = 30`), kuota tetap 300 kredit sekali, dan semua teks trial di locale memakai `{days}` secara dinamis.
  2. Menerapkan 4 lapis pengaman trial: 1x per email terverifikasi, 1x per workspace, 1x per akun Google (`google_sub`), serta alert admin otomatis ke `credit_alerts` jika terdapat >5 pendaftaran trial dari IP yang sama dalam 24 jam.
  3. Menghapus kuota free tier 3 artikel/bulan (`FREE_MONTHLY_LIMIT = 0`, `free.monthlyArticles = 0`).
  4. Menghapus harga paket langganan lama (`PLANS.*.price`), menonaktifkan cron pengingat perpanjangan langganan, dan mengembalikan status 410 `PLAN_DISCONTINUED` pada endpoint `/api/billing/checkout` dan `/api/billing/cancel`.
- **File Berubah/Dibuat**:
  - `backend/lib/config.js`: Default `TRIAL_CONFIG.days` diubah ke 30, mengekspor `TRIAL_DAYS`.
  - `backend/lib/plans.js`: `FREE_MONTHLY_LIMIT = 0`, menghapus properti `price` dari semua paket `PLANS`, menghapus bullet 3 artikel dari free tier.
  - `backend/lib/credits.js`:
    - Mengimpor `SYSTEM_WORKSPACE_ID` serta helper alert `hasAlertBeenSent, recordAlertSent, sendEmail`.
    - Memperbarui `grantTrialIfEligible` dengan validasi: 1x per email (`credit_trials`), 1x per workspace (`credit_trials`), 1x per akun Google (`accounts.google_sub`), pencatatan audit log `trial_granted` dengan IP, dan deteksi >5 registrasi dari IP sama dalam 24 jam (alert `trial_abuse_ip`).
  - `backend/lib/google-auth.js`: Mengimpor `getClientIp` dan meneruskan `{ googleSub: sub, clientIp }` ke `grantTrialIfEligible`.
  - `backend/index.js`:
    - Meneruskan `clientIp` ke `grantTrialIfEligible` pada verifikasi email dan endpoint `/api/credits`.
    - Mengubah `/api/billing/checkout` dan `/api/billing/cancel` agar selalu mengembalikan 410 `PLAN_DISCONTINUED`.
    - Menonaktifkan eksekusi pengingat perpanjangan langganan pada cron harian `/api/cron/run-scheduled`.
  - `backend/lib/payments/service.js`: Di `createCheckout`, melempar 410 `PLAN_DISCONTINUED` bila mencoba checkout subscription.
  - `backend/lib/mailer.js`: Mengimpor `TRIAL_CONFIG` dan mengganti teks hardcoded 7 hari di email verifikasi dengan `${TRIAL_CONFIG.days}`.
  - `backend/lib/notifications.js`: Mengganti teks hardcoded 7 hari di peringatan trial dengan `${TRIAL_CONFIG.days}`.
  - `frontend/src/config/pricing.js`: Menetapkan `TRIAL_DAYS = 30` dan `TRIAL.days = TRIAL_DAYS`.
  - `frontend/src/components/PublicNavbar.jsx`: Menggunakan `t('nav.register', { days: TRIAL_DAYS })`.
  - `frontend/src/pages/admin/AdminDashboardPage.jsx`: Menggunakan `t('adminDashboard.optTrial', { days: TRIAL_DAYS })`.
  - `frontend/src/i18n/locales/en/public.js` & `id/public.js`: `nav.register` menggunakan placeholder `{days}`.
  - `frontend/src/i18n/locales/en/auth.js` & `id/auth.js`: `linkSignUp` menggunakan placeholder `{days}`.
  - `frontend/src/i18n/locales/en/app.js` & `id/app.js`: `optTrial` menggunakan placeholder `{days}`.
  - `backend/tests/entitlements.test.js`: Memperbarui assertion `TRIAL.days` ke 30.
  - `backend/tests/pricing-parity.test.js`: Menambahkan pengujian kesetaraan `TRIAL_DAYS` antara backend dan frontend (30 hari).
  - `backend/tests/trial-safeguards-discontinued.test.js`: Suite test baru ke-21 yang menguji seluruh pengaman trial (email, workspace, google_sub, IP abuse alert), penolakan 410 `PLAN_DISCONTINUED` di service dan route express, serta penonaktifan cron pengingat.
- **Hasil Test**:
  - `cd backend && npm test`: 21/21 test suite lolos 100% tanpa mengotori `database.json`.
  - `cd frontend && npm run i18n:check`: 2213 keys in EN & ID, 70/70 error codes ter-cover, 0 hardcoded prices/numbers, 0 error.
  - `cd frontend && npm run build`: Lolos 100%, 40 file statis HTML dan sitemap ter-generate.

---

### Langkah 7: Frontend UI Pricing Lifetime, Billing, & Kalkulator Top-up Custom (PRD F15)
- **Tujuan**:
  1. Merombak section pricing publik di Landing Page (`/` dan `/pricing`): menampilkan hero card Bundle Fokus 3 (Rp4.490.000 sekali bayar, hemat Rp980.000, 600 kredit/bln selamanya), 3 kartu modul lifetime mandiri (SEO Rp1.990.000, Ads Report Rp1.990.000, Ads Spy Rp1.490.000), serta kalkulator interaktif Top-up Custom publik.
  2. Menambahkan rute publik `/pricing` dan `/id/pricing` dengan dukungan static SEO generation & sitemap.
  3. Memperluas FAQ q7 s/d q10: lisensi lifetime sekali bayar, non-akumulasi kredit bulanan yang hangus di akhir bulan WIB demi keberlanjutan server, garansi refund 7 hari, dan fleksibilitas top-up custom.
  4. Merombak dashboard dompet kredit (`/app/billing/credits`): menampilkan rincian saldo bulan ini yang hangus di akhir bulan WIB, menyematkan `TopupCalculator` live yang terhubung ke `POST /api/billing/topup`, serta menampilkan daftar modul lifetime yang dimiliki workspace.
  5. Merombak halaman tagihan (`/app/billing`): menampilkan modul lifetime dan bundle Fokus 3 dengan integrasi langsung ke endpoint `POST /api/billing/modules`, deteksi modul yang sudah dimiliki, serta riwayat faktur riil dari `GET /api/billing/payments`.
  6. Mematuhi aturan `AGENTS.md`: mobile-first (360px, 390px, 768px, 1280px), target sentuh ≥44px, tanpa inline layout style, dan 0 error `i18n:check`.
- **File Berubah/Dibuat**:
  - `frontend/src/config/pricing.js`: Penyesuaian amortisasi 24 bulan perbandingan in-house vs Markimate.
  - `frontend/src/index.css`: Styling responsive untuk `.focus3-hero-card`, `.pricing-lifetime-grid`, `.topup-calculator-card`, `.topup-est-grid`, dsb.
  - `frontend/src/components/common/TopupCalculator.jsx`: Komponen kalkulator stepper, quick pills (100, 500, 1.000, 2.500 cr), live quote diskon volume (5% & 10%), serta estimasi deliverables nyata.
  - `frontend/src/pages/public/LandingPage.jsx`: Rombak section Paket & Harga (#pricing), integrasi `<TopupCalculator isPublic={true} />`, auto-scroll ke `#pricing`, dan FAQ q1-q10.
  - `frontend/src/pages/billing/CreditWalletPage.jsx`: Rombak kartu bucket kredit bulanan modul lifetime, integrasi `handleCustomTopup`, dan daftar status kepemilikan modul workspace.
  - `frontend/src/components/BillingPage.jsx`: Rombak total dari langganan bulanan ke pembelian modul lifetime via `POST /api/billing/modules` dan riwayat pembayaran riil.
  - `frontend/src/App.jsx`: Menambahkan rute `/pricing` dan `/id/pricing`.
  - `frontend/scripts/build-seo-pages.mjs`: Mendaftarkan `/pricing` ke `staticPages` (total 42 static HTML & sitemap URL).
  - `frontend/src/i18n/locales/id/public.js`, `en/public.js`, `id/billing.js`, `en/billing.js`: Penambahan kamus modul lifetime, kalkulator top-up, dan FAQ q7-q10 dengan parameter interpolasi 100% konsisten tanpa hardcoding harga.
  - `docs/reports/img/`: Update screenshot mobile 390px (landing, pricing, role-detail, verify).
- **Checklist Uji Mobile (AGENTS.md)**:
  - [x] Tidak ada scroll horizontal di 360px, 390px, 768px, 1280px (`scrollWidth <= innerWidth`).
  - [x] Tidak ada teks/tombol terpotong atau saling menimpa.
  - [x] Semua tombol & link target sentuh ≥44px.
  - [x] Form stepper & number input bisa diisi tanpa zoom iOS (font size ≥ 16px).
  - [x] Mode landscape HP tidak rusak.
  - [x] Laporan menyertakan screenshot 390px di `docs/reports/img/pricing-id-390.png` dan `docs/reports/img/pricing-en-390.png`.
- **Hasil Test**:
  - `cd backend && npm test`: 21/21 suite lolos (100%).
  - `cd frontend && npm run test`: 3/3 test scripts lolos (100%).
  - `cd frontend && npm run i18n:check`: 2304 keys in EN & ID, 70/70 backend error codes, 0 forbidden hardcoded prices, 0 error.
  - `cd frontend && npm run lint`: 0 errors.
  - `cd frontend && npm run build`: 42 static HTML files & sitemap ter-generate sukses.

---

### Langkah 8: Admin Laporan Liabilitas Kredit Bulanan & Revenue Mix (PRD F15)
- **Tujuan**:
  1. Menghitung proyeksi beban liabilitas kuota kredit gratis bulanan komitmen seumur hidup: `jumlah pemilik lifetime aktif bulan ini × kuota bulanan modul × biaya per credit nyata` (SEO Rp56/cr, Ads Report Rp4/cr, Ads Spy Rp62/cr) serta skenario buffer perencanaan Rp100/cr.
  2. Menghitung bauran pendapatan (Revenue Mix) antara lisensi lifetime sekali bayar (`kind: 'module'`), kredit top-up kustom (`kind: 'topup'`), dan langganan bulanan lama (`kind: 'subscription'`) baik untuk bulan berjalan, kumulatif sepanjang masa (all-time), maupun tren riwayat bulanan.
  3. Memisahkan workspace platform admin internal 3Our (unlimited/bypass) dari perhitungan liabilitas komersial.
  4. Menyajikan visualisasi dashboard admin responsif dengan ringkasan metrik, tabel rincian modul, progress bar bauran pendapatan rasio, dan tabel tren bulanan di `AdminDashboardPage.jsx`.
- **File Berubah/Dibuat**:
  - `backend/lib/admin-reports.js`: Modul kalkulasi `getLifetimeLiability`, `getRevenueMix`, dan agregat `getAdminLifetimeReport`.
  - `backend/index.js`: Endpoint `GET /api/admin/reports/lifetime-liability` (dengan `adminAuth`).
  - `backend/lib/margin.js`: Mengintegrasikan `lifetime_liability` dan `revenue_mix` ke dalam `calculateUsageAndMargin` di `GET /api/admin/credits/margin`.
  - `backend/tests/admin-reports.test.js`: Suite test baru ke-22 yang menguji liabilitas, revenue mix, integrasi margin, dan HTTP endpoint admin.
  - `frontend/src/pages/admin/AdminDashboardPage.jsx`: Integrasi UI laporan liabilitas dan bauran pendapatan (revenue mix).
  - `frontend/src/index.css`: Styles helper responsive `.admin-reports-grid`, `.admin-mix-container`, `.admin-mix-bar`, dsb.
  - `frontend/src/i18n/locales/id/app.js` & `en/app.js`: 26 keys baru di kamus `adminDashboard` dengan interpolasi dinamis tanpa hardcoded prices.
- **Hasil Test**:
  - `cd backend && npm test`: 22/22 test suite lolos 100% tanpa modifikasi `database.json`.
  - `cd frontend && npm run i18n:check`: 2368 keys in EN & ID, 70/70 backend error codes, 0 forbidden hardcoded prices, 0 error.
  - `cd frontend && npm run lint`: 0 error.
  - `cd frontend && npm run build`: 42 static HTML & sitemap generated successfully.

---

### Langkah 9: Laporan Final PRD F15 & Mutation Checks
- **Tujuan**:
  1. Menjalankan pengujian mutasi (Mutation Checks) pada 5 skenario logika kritis PRD F15:
     - Mutasi 1: Non-akumulasi kuota bulanan lintas bulan (memastikan saldo di-reset/overwrite, bukan diakumulasikan).
     - Mutasi 2: Idempotensi grant bulanan modul seumur hidup (memastikan request paralel tidak menimbulkan double grant).
     - Mutasi 3: Idempotensi fulfillment via `granted_at` (memastikan webhook/rekonsiliasi ganda tidak menambahkan kredit atau modul ganda).
     - Mutasi 4: Proteksi manipulasi harga di sisi client pada custom top-up (memastikan server menghitung harga independen via `quoteTopup`).
     - Mutasi 5: Penolakan checkout/cancel langganan lama dengan 410 `PLAN_DISCONTINUED`.
  2. Memverifikasi seluruh 23 suite test backend dan build frontend lolos dari clone bersih tanpa mengotori `database.json`.
  3. Menyusun ringkasan implementasi menyeluruh, daftar commit, dan instruksi deployment SQL/env untuk 3Our.
- **File Berubah/Dibuat**:
  - `backend/tests/mutation-f15.test.js`: Suite test baru ke-23 yang mensimulasikan dan membunuh 5 mutan cacat pada logika PRD F15.
  - `docs/reports/F15-pricing-lifetime.md`: Laporan komprehensif implementasi final.
- **Hasil Mutation Checks**:
  - `node tests/mutation-f15.test.js`: **5/5 Mutan Berhasil Dibunuh (100% KILLED)**.
    1. ✓ Mutasi 1 KILLED (Mutan akumulasi saldo gagal lolos assertion).
    2. ✓ Mutasi 2 KILLED (Mutan double grant gagal lolos assertion).
    3. ✓ Mutasi 3 KILLED (Fulfillment ulang dicegah secara idempoten oleh `granted_at`).
    4. ✓ Mutasi 4 KILLED (Manipulasi harga client ditolak 100%).
    5. ✓ Mutasi 5 KILLED (Subscription lama ditolak dengan 410 `PLAN_DISCONTINUED`).
- **Hasil Test Final**:
  - `cd backend && npm test`: **23/23 test suite lolos 100%**, integritas MD5 `database.json` bersih tanpa terkontaminasi.
  - `cd frontend && npm run i18n:check`: **2368 keys in EN & ID (100% parity)**, 70/70 backend error codes, 0 forbidden hardcoded prices/numbers, 0 error.
  - `cd frontend && npm run lint`: **0 errors**.
  - `cd frontend && npm run build`: **42 static HTML pages & sitemap generated successfully**.

---

## Ringkasan Commit PRD F15 (1 Langkah = 1 Commit)

1. `fae9912`: `feat(pricing): langkah 1 konfigurasi lifetime modules, bundle, custom topup, dan test kesetaraan fe be (PRD F15)`
2. `ad670af`: `feat(db): langkah 2 migrasi 015 lifetime modules, monthly grants, dan payments kind module (PRD F15)`
3. `14c1ab7`: `feat(credits): langkah 7 stored procedures mutasi saldo wallet atomik dan lazy monthly grant (PRD F15)`
4. `c7464f4`: `feat(db): update migrasi 016 atomic wallet rpc dengan lock awal dan revoke execute (PRD F15)`
5. `1fb75fd`: `feat(billing): langkah 3 fulfillment module, entitlement lifetime, dan idempotensi granted_at (PRD F15)`
6. `5f4fea6`: `feat(credits): langkah 4 integrasi lazy ensureMonthlyGrant di me, billing, dan charge (PRD F15)`
7. `7598ed0`: `feat(billing): langkah 5 top-up custom endpoint, validasi min/max, dan diskon volume (PRD F15)`
8. `47946f4`: `feat(billing): langkah 6 hapus langganan 410, trial 30 hari, dan pengaman trial (PRD F15)`
9. `b7e89e6`: `feat(ui): langkah 7 ui pricing lifetime, billing, dan kalkulator topup (PRD F15)`
10. `0606136`: `feat(admin): langkah 8 laporan liabilitas kredit bulanan dan revenue mix (PRD F15)`
11. `HEAD`: `feat(reports): langkah 9 laporan final implementasi PRD F15 dan mutation checks (PRD F15)`

---

## Petunjuk untuk 3Our Asia

### 1. SQL Migrasi yang Perlu Dijalankan di Supabase (Production)
Dua file migrasi SQL telah disiapkan secara idempoten dan aman dijalankan ulang:
1. `backend/migrations/015_lifetime_modules.sql`:
   - CHECK constraint `module_entitlements_source_check` (`lifetime`).
   - CHECK constraint `payments_kind_check` (`module`).
   - Kolom `payment_id` dan `granted_at`.
   - Tabel `markimate.monthly_grants` ber-RLS.
2. `backend/migrations/016_atomic_wallet_rpc.sql`:
   - Stored procedure `charge_wallet_atomic` (penguncian baris `credit_wallets`, idempotensi ref, potong urut trial -> sub -> topup).
   - Stored procedure `grant_wallet_atomic` (tambah saldo atomik / idempotensi per ref_id).
   - Stored procedure `apply_monthly_grant_atomic` (grant lazy kuota modul seumur hidup, non-akumulasi reset akhir bulan, upgrade kuota di tengah bulan).

### 2. Environment Variables
- **Tidak ada env var baru yang wajib disetel**.
- Seluruh struktur harga lifetime, bundle, dan top-up custom tersimpan di config modular backend (`catalog.js`) dan frontend (`pricing.js`) yang diuji dengan test kesetaraan 100%.

### 3. Kesiapan Transaksi Live & Pengujian User
- Sesuai PRD F15 §5 poin 6, agent **berhenti sebelum transaksi live**.
- 3Our dapat menguji langsung alur pembayaran di staging/production:
  1. Melakukan 1× top-up custom minimal 50 credit (Rp50.000) melalui sandbox/live DOKU VA.
  2. Memverifikasi invoice `MKM-T-` masuk dan saldo dompet bertambah 50 credit dengan masa berlaku 365 hari.
  3. Membeli 1 modul lifetime (misalnya SEO) dan memverifikasi modul aktif selamanya dengan grant 100 kredit bulan berjalan.







