# Laporan Pengerjaan PRD F16: Model Credit-Only

Tanggal: 23 Oktober 2026  
Status: In Progress (Autopilot Mode)

---

## Langkah 1: Catalog + Config + Trial 400 (§3.1, §3.3)

### 1. File yang Berubah
- `backend/lib/catalog.js`:
  - `MODULES`: tanpa field `price` dan `monthlyCredits`, menyertakan `typicalMonthlyCredits` dan `desc`.
  - `TOPUP`: `pricePerCredit: 1000`, `min: 100`, `max: 50000`, `quickOptions: [100, 250, 500]`, `neverExpires: true`.
  - `CREDIT_PACKS`: Starter (500 cr / Rp475.000 / 5%), Growth (1.000 cr / Rp900.000 / 10%), Pro (2.500 cr / Rp2.000.000 / 20%), Agency (5.000 cr / Rp3.750.000 / 25%).
  - `quoteTopup`: tanpa diskon tier (`discountPct: 0`, `amount = credits * 1000`).
  - `getCatalog()`: mengembalikan `{ currency, modules, topup, packs, trial: { days, credits: 400 } }` tanpa bundles dan tanpa harga modul.
- `backend/lib/config.js`:
  - `TRIAL_CONFIG.credits`: default 400 (30 hari).
- `frontend/src/config/pricing.js`:
  - Sinkronisasi penuh dengan backend: `TRIAL.credits: 400`, `MODULES`, `TOPUP`, `CREDIT_PACKS`, `quoteTopup`, dan komparasi in-house berbasis rata-rata Rp900/credit.
- `backend/tests/pricing-parity.test.js`:
  - Test komprehensif memvalidasi paritas BE/FE dan rumus matematis harga paket `round(credits * 1000 * (1 - discount), -3)`.
- Penyesuaian test suite backend terkait trial 400 & topup min 100:
  - `backend/tests/custom-topup.test.js`, `backend/tests/trial-safeguards-discontinued.test.js`, `backend/tests/auth.test.js`, `backend/tests/google-auth.test.js`, `backend/tests/entitlements.test.js`, `backend/tests/payments-doku.test.js`, `backend/tests/module-billing.test.js`.

### 2. Cara Tes
```bash
cd backend && node tests/pricing-parity.test.js
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
```

### 3. Hasil Tes
- `pricing-parity.test.js`: Lolos 100% (verifikasi rumus harga paket dan ketiadaan bundles/harga modul).
- `npm test` backend: 26/26 file test lolos.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2432 keys.
- `npm run build` frontend: exit 0.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Penghapusan penuh gating module dan plan di frontend/backend (dijadwalkan Langkah 2).
- Penghapusan cron/alert grant bulanan (dijadwalkan Langkah 3).
- Migrasi SQL 019 dan checkout pack (dijadwalkan Langkah 4 & 5).

---

## Langkah 2: Akses Modul Gratis + Hapus Gating Entitlement & Plan (§3.4)

### 1. File yang Berubah
- `backend/lib/entitlements.js`:
  - `getModules(workspaceId)`: Selalu mengembalikan `['seo', 'ads_report', 'ads_spy']` aktif untuk setiap workspace yang valid dengan `source: 'free'`. Admin tetap `source: 'admin'`. Hapus fallback free tier dan `isSeoFree` (diset `false`).
  - `hasActiveModuleEntitlement(workspaceId, moduleName)`: Selalu lolos (`true`) untuk semua modul rilis (`VALID_MODULES`), mengembalikan `false` untuk modul yang belum rilis ("coming soon").
  - `requireModule(moduleName)`: Lolos untuk modul rilis; menolak modul belum rilis dengan status 404 `{ code: 'MODULE_NOT_AVAILABLE', module }`.
- `backend/lib/error-codes.js`:
  - Menambahkan definisi `MODULE_NOT_AVAILABLE` (status 404).
- `frontend/src/i18n/locales/en/errors.js` & `frontend/src/i18n/locales/id/errors.js`:
  - Menambahkan terjemahan `MODULE_NOT_AVAILABLE` untuk kepatuhan i18n dan error coverage check.
- `backend/index.js`:
  - Menghapus gating entitlement modul pada pembuatan gambar AI SEO di pengaturan CMS (`cms_connections`), penjadwalan keyword (`schedule !== 'immediate'`), dan eksekusi artikel (`generateFor`).
  - AI Images SEO (`makeImages`) kini aktif murni berdasarkan opsi keyword dan dibatasi oleh saldo kredit via `assertAffordable(wsId, 'seo.image', count)`.
  - Hapus pembatasan `plan.monthlyArticles` lama.
- `frontend/src/pages/app/ModuleActivatePage.jsx`:
  - Dirombak dari alur "beli modul lifetime" menjadi "Aktifkan & Mulai".
  - Menampilkan deskripsi modul, perkiraan pemakaian bulanan (`modInfo.typicalMonthlyCredits` kredit/bulan), saldo kredit workspace saat ini (dari `GET /api/credits`), dan tombol dinamis: "Buka Modul & Mulai" jika saldo cukup, atau "Top-up Kredit" jika saldo 0.
  - Menghapus badge lifetime, harga modul, dan hint bundle Fokus 3.
- `frontend/src/i18n/locales/en/app.js` & `frontend/src/i18n/locales/id/app.js`:
  - Menambahkan keys terjemahan untuk halaman aktivasi credit-only: `typicalUsageTitle`, `currentBalanceTitle`, `freeModuleBadge`, `payPerUse`, `topupCredits`, `openModuleAndStart`, `zeroBalanceNotice`, `sufficientBalanceNotice`.
- `backend/tests/entitlements.test.js`:
  - Ditulis ulang untuk menguji model modul gratis F16: workspace baru tanpa baris entitlement di DB langsung aktif untuk ketiga modul, penolakan modul coming soon dengan 404 `MODULE_NOT_AVAILABLE`, akses ke seluruh endpoint modul, serta verifikasi pemotongan kredit & pembatasan 402 `INSUFFICIENT_CREDITS`.
  - Menyertakan **Mutation Checks** yang membuktikan bahwa mutasi pengecekan database entitlement digagalkan (KILLED).

### 2. Catatan Kompatibilitas `plans.js`
- File `backend/lib/plans.js` masih diimpor oleh `notifications.js` dan `trial-safeguards-discontinued.test.js` sebagai referensi fallback paket legacy. Seluruh gating logika runtime di `index.js` dan `entitlements.js` yang sebelumnya membatasi fitur berdasarkan `planOf(user)` telah dicabut sepenuhnya.

### 3. Cara Tes
```bash
cd backend && node tests/entitlements.test.js
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
```

### 4. Hasil Tes
- `node tests/entitlements.test.js`: Lolos 100%, mutasi KILLED.
- `npm test` backend: 26/26 file test lolos tanpa error.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2449 keys.
- `npm run build` frontend: exit 0.

### 5. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Migrasi SQL 019 dan checkout pack (dijadwalkan Langkah 4 & 5).

---

## Langkah 3: Hapus Grant Bulanan (PRD F16 §3.5)

### 1. File yang Berubah
- `backend/lib/credits.js`:
  - Menghapus pemanggilan `ensureMonthlyGrant` di dalam `getWallet` dan `charge`.
  - Menghapus fungsi `ensureMonthlyGrant` beserta logic alert `monthly_grant_failure`.
- `backend/lib/payments/service.js`:
  - Menghapus import `ensureMonthlyGrant` dan pemanggilannya saat fulfillment payment modul lama.
- `backend/index.js`:
  - Menghapus import `ensureMonthlyGrant` dan pemanggilan pada endpoint `GET /api/me` serta `GET /api/billing`.
- `backend/tests/credits.test.js`:
  - Menghapus import `ensureMonthlyGrant` dan blok Uji B11 (alert failure simulation).
- `backend/tests/monthly-grant-atomic.test.js` &rarr; `backend/tests/atomic-wallet.test.js`:
  - Mengisolasi pengujian atomik wallet (`charge_wallet_atomic` dan `grant_wallet_atomic`) murni tanpa ketergantungan grant bulanan (`ensureMonthlyGrant` / `apply_monthly_grant_atomic`).
- `backend/tests/module-billing.test.js`:
  - Menyesuaikan ekspektasi saldo sub menjadi 0 setelah fulfillment modul/bundle karena grant bulanan telah dihapus.
- `docs/reports/F16-credit-only.md`: Dokumentasi laporan langkah 3.

### 2. Verifikasi Grep Test Guardrail (§7)
- `git grep -i "ensureMonthlyGrant" backend/tests/`: 0 matches (lolos).
- `git grep -i "apply_monthly_grant_atomic" backend/tests/`: 0 matches (lolos).

### 3. Cara Tes
```bash
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
```

### 4. Hasil Tes
- `npm test` backend: 26/26 file test lolos tanpa error.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2449 keys.
- `npm run build` frontend: exit 0.

### 5. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Migrasi SQL 019 dan penghapusan expiry top-up (dijadwalkan Langkah 4).
- Checkout pack dan 410 untuk module checkout (dijadwalkan Langkah 5).

---

## Langkah 4: Top-up Tanpa Expiry & Migrasi SQL 019 (PRD F16 §3.6, §5)

### 1. File yang Berubah
- `backend/migrations/019_credit_only.sql`:
  - Menambahkan file migrasi idempoten untuk Supabase: update `payments_kind_check` constraint dengan menambahkan `'pack'`, mengosongkan `topup_expires_at = null` pada seluruh dompet, dan mencatat migrasi `019`.
- `backend/lib/payments/service.js`:
  - `fulfillPayment`: Memanggil `grant(..., 'topup', credits, null, ...)` dengan `expires_at = null` untuk topup dan pack.
  - `reconcile`: Memanggil `grant(..., 'topup', credits, null, ...)` dengan `expires_at = null` untuk topup dan pack.
- `backend/tests/schema-contract.test.js`:
  - Menambahkan verifikasi bahwa `payments_kind_check` memuat `'pack'` dan baris pembayaran jenis `'pack'` lolos validasi kontrak.
- `backend/tests/custom-topup.test.js`:
  - Menambahkan verifikasi `wallet.topup_expires_at === null` setelah fulfillment top-up.
  - Menguji `expireBuckets(workspaceId)` bahwa saldo topup 100 tetap utuh (tidak hangus).
  - Menambahkan mutation check yang membuktikan jika topup_expires_at dihidupkan dengan tanggal kedaluwarsa 365 hari lampau, saldo hangus menjadi 0 (KILLED).
- `frontend/src/i18n/locales/id/billing.js` & `frontend/src/i18n/locales/en/billing.js`:
  - Menambahkan key `neverExpires` ("Tidak hangus" / "Never expires") dan `topupNeverExpires` ("Credit top-up tidak hangus" / "Top-up credits never expire").
- `frontend/src/pages/billing/CreditWalletPage.jsx`:
  - Mengubah badge mini tag top-up dari `365 hari` menjadi `Tidak hangus` (`billing.neverExpires`), dan deskripsi fallback dari `valid365` menjadi `Credit top-up tidak hangus` (`billing.topupNeverExpires`).
- `docs/reports/F16-credit-only.md`: Dokumentasi laporan langkah 4.

### 2. Cara Tes
```bash
cd backend && node tests/custom-topup.test.js
cd backend && node tests/schema-contract.test.js
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
```

### 3. Hasil Tes
- `tests/custom-topup.test.js`: Lolos 100%, mutasi KILLED.
- `tests/schema-contract.test.js`: Lolos 100%, constraint pack terverifikasi.
- `npm test` backend: 26/26 file test lolos.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2451 keys.
- `npm run build` frontend: exit 0.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Menjalankan file SQL 019 ke Supabase live (Sesuai aturan kerja `AGENTS.md`, agen berhenti di Langkah 4 dan menunggu 3Our menjalankan migrasi SQL ke Supabase). File migrasi telah dieksekusi oleh 3Our di Supabase sebelum melanjutkan ke Langkah 5.

---

## Langkah 5: Checkout Pack, 410 Module Discontinued & Reconcile Data Lama (PRD F16 §3.7)

### 1. File yang Berubah
- `backend/lib/payments/service.js`:
  - `generateInvoiceNumber`: Prefix `T` untuk topup, `P` untuk pack.
  - `createCheckout`:
    - Mendukung `kind === 'pack'`: Validasi `itemId` ada di `CREDIT_PACKS`, nominal harga dan kredit dihitung server dari config, `periodDays = null`.
    - Penolakan `kind === 'module'`: Melempar error status 410 `MODULE_PURCHASE_DISCONTINUED`.
    - Penolakan `kind === 'subscription'`: Melempar error status 410 `PLAN_DISCONTINUED`.
  - `fulfillPayment`: Note grant untuk pack disesuaikan menjadi `"Paket Growth (1.000 credit)"` (atau sesuai nama paket).
- `backend/index.js`:
  - Menambahkan endpoint `POST /api/billing/pack` untuk pemesanan paket credit.
  - Memastikan `POST /api/billing/modules` menolak semua checkout modul dengan 410 `MODULE_PURCHASE_DISCONTINUED`.
- `backend/lib/error-codes.js`, `frontend/src/i18n/locales/en/errors.js`, `frontend/src/i18n/locales/id/errors.js`:
  - Mendaftarkan error code `MODULE_PURCHASE_DISCONTINUED` dan `INVALID_PACK`.
- `backend/tests/pack-checkout.test.js`:
  - File test baru untuk memvalidasi:
    1. Checkout `pack_2500` menghasilkan amount Rp2.000.000, 2.500 credits, invoice prefix `MKM-P-`, dan manipulasi amount client diabaikan.
    2. `itemId` tidak dikenal menghasilkan 400 `INVALID_PACK`.
    3. Webhook pack 2x hanya menambah credit 1x (idempoten) dan `topup_expires_at` null.
    4. Checkout module via HTTP dan SDK menghasilkan 410 `MODULE_PURCHASE_DISCONTINUED`.
    5. Jalur rekonsiliasi data modul lama tetap memproses pemberian entitlement jika ada transaksi modul lama.
- `backend/tests/module-billing.test.js`:
  - Menyesuaikan tes checkout modul menjadi verifikasi 410, dan menguji webhook/reconcile data modul lama secara backward compatible.
- `docs/reports/F16-credit-only.md`: Dokumentasi laporan langkah 5.

### 2. Status Transaksi Modul Lama
- Pemeriksaan data pembayaran modul lama yang masih `pending` atau `paid` tanpa `granted_at`: **0 baris ditemukan** (database bersih, tidak ada transaksi menggantung).

### 3. Cara Tes
```bash
cd backend && node tests/pack-checkout.test.js
cd backend && node tests/module-billing.test.js
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
```

### 4. Hasil Tes
- `tests/pack-checkout.test.js`: Lolos 100%.
- `tests/module-billing.test.js`: Lolos 100%.
- `npm test` backend: 27/27 file test lolos tanpa error.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2453 keys.
- `npm run build` frontend: exit 0.

### 5. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Perombakan UI pricing, landing page, role detail, wallet custom calculator, dan FAQ (dijadwalkan Langkah 6).
- Terms & Ketentuan EN/ID (§4) serta template email mailer (§3.9) (dijadwalkan Langkah 7).

---

## Langkah 6: UI Pricing, Landing Page, Role Detail, Wallet & Admin Revenue Mix (PRD F16 §3.8, §6.6)

### 1. File yang Berubah
- `frontend/src/config/pricing.js`:
  - Menghapus objek `LIFETIME_BUNDLES`, `BUNDLES`, dan `MODULE_CREDITS`.
  - Memastikan hanya ada `MODULES`, `TOPUP`, `CREDIT_PACKS`, `TRIAL` (400 kredit/30 hari), dan fungsi utilitas harga.
- `frontend/src/pages/app/WorkspaceDashboardPage.jsx`:
  - Menghapus harga modul, badge lifetime, dan kuota bulanan gratis pada locked branch fallback.
  - Menambahkan tag "Semua Modul Gratis" dan perkiraan pemakaian bulanan (`typicalMonthlyCredits`).
- `frontend/src/pages/public/RoleDetailPage.jsx`:
  - Menghapus harga modul, badge lifetime, dan link beli modul lifetime.
  - Menampilkan header "Semua Modul Aktif Gratis", tag "Bayar Sesuai Pemakaian", perkiraan pemakaian bulanan, tombol CTA Coba Gratis 30 Hari (400 kredit), serta tautan ke paket credit.
- `frontend/src/pages/billing/CreditWalletPage.jsx`:
  - Menghapus `LIFETIME_MODULE_KEYS` dan seluruh seksi "Modul Lifetime Saya".
  - Menambahkan kartu 4 paket kredit `CREDIT_PACKS` dengan handler `handleBuyPack` yang memanggil `POST /api/billing/pack`.
  - Mengisolasi bucket `sub` (subscription) agar hanya tampil jika workspace memiliki sisa saldo lampau > 0, tanpa kata "lifetime".
- `frontend/src/components/BillingPage.jsx`:
  - Menghapus penawaran Bundle Fokus 3 dan modul lifetime.
  - Menambahkan banner informatif bahwa seluruh modul aktif gratis, grid 4 paket kredit `CREDIT_PACKS`, tombol checkout instan `handleBuyPack`, dan tautan ke dompet credit.
- `frontend/src/pages/public/LandingPage.jsx`:
  - Merombak seksi `#pricing` menjadi modul gratis, banner trial 400 credit, kartu contoh biaya per aksi (75 cr ≈ Rp75.000, 400 cr ≈ Rp400.000, 65 cr ≈ Rp65.000), grid 4 paket kredit `CREDIT_PACKS`, kalkulator top-up kustom tanpa tanggal kedaluwarsa, dan link ke terms.
- `backend/lib/admin-reports.js` & `backend/tests/admin-reports.test.js`:
  - Menambahkan agregasi jenis transaksi `'pack'` ke dalam `getRevenueMix` (bulan ini, all-time, dan riwayat bulanan).
  - Test suite backend admin reports lolos 100%.
- `frontend/src/pages/admin/AdminDashboardPage.jsx`:
  - Menambahkan kolom dan bar segmen untuk `pack` pada revenue mix bulanan, kumulatif sepanjang masa, serta tabel riwayat breakdown bulanan.
  - Mengubah fallback teks `optTopup` menjadi `'topup (never expires)'`.
- `frontend/src/i18n/locales/id/billing.js` & `frontend/src/i18n/locales/en/billing.js`:
  - Menambahkan keys `creditPacksTitle`, `creditPacksSubtitle`, `allModulesActiveTitle`, `allModulesActiveDesc`, `openWalletBtn`, `packsTitle`, `packsSubtitle`, `savePctBadge`, `packRateInfo`, `allModulesFree`, `btnBuyPack`, `bucketSubscription`.
  - Membersihkan penyebutan string "365" dan "lifetime".
- `frontend/src/i18n/locales/id/public.js` & `frontend/src/i18n/locales/en/public.js`:
  - Menambahkan keys `bundles` baru (`pricingTitle`, `pricingSubtitle`, `actionCostTitle`, `actionSeoArticle`, `actionAdsReport`, `actionAdsSpy`, `refundGuarantee`).
  - Menambahkan keys `roleDetail` baru (`freeModuleHeader`, `zeroPrice`, `payPerUseTag`, `typicalUsageNote`, `ctaViewPricing`) dan memperbarui bottom CTA.
  - Memperbarui FAQ q4, a4, q6, a6, q7, a7, q8, a8, q9, a9, q10, a10 agar konsisten dengan model credit-only tanpa kedaluwarsa.
  - Memperbarui teks `topupSectionSubtitle`, `termsLink`, dan `amortizationNote`.
- `frontend/src/i18n/locales/id/app.js` & `frontend/src/i18n/locales/en/app.js`:
  - Menambahkan `freeModuleTag`, `typicalMonthlyCredits` di `app.dashboard`.
  - Menambahkan `revPack`, `revModuleLegacy`, `thPackRev` di `adminDashboard`.
  - Memperbarui `tipText`, `moduleActivate.bundleHint`, `bundleCta`, dan `optTopup`.
- `docs/reports/F16-credit-only.md`: Dokumentasi laporan langkah 6.

### 2. Cara Tes
```bash
cd backend && npm test
cd frontend && npm run i18n:check && npm run build
grep -o -E ".{0,30}(1990000|1490000|4490000).{0,30}" frontend/dist/assets/*.js
```

### 3. Hasil Tes
- `npm test` backend: 27/27 file test lolos tanpa error.
- `npm run i18n:check` frontend: 0 error, dictionary parity 2499 keys.
- `npm run build` frontend: exit 0.
- Guardrail grep: Nol kemunculan harga modul lama `1990000`, `1490000`, maupun `4490000` di bundle frontend.

### 4. Hal yang Sengaja Tidak Dikerjakan pada Langkah Ini
- Pembaruan Syarat & Ketentuan hukum (§4) serta template email mailer (§3.9) (dijadwalkan Langkah 7).
- Screenshot visual 390px/1280px dan verifikasi akhir (dijadwalkan Langkah 8).


