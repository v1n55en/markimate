# Laporan Implementasi PRD F15: Pricing Lifetime per Modul + Kredit Bulanan + Top-up Custom

Tanggal: 21 Oktober 2026  
Status: In Progress (Langkah 1 Selesai)  
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

## Rencana Langkah Selanjutnya
- **Langkah 7**: UI pricing + billing + kalkulator EN/ID + screenshot 390px dan 1280px asli.
- **Langkah 8**: Admin laporan liabilitas dan revenue mix.
- **Langkah 9**: Laporan final F15 dan mutation checks.




