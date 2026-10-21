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

## Rencana Langkah Selanjutnya (Setelah SQL 015 & 016 Dijalankan di Supabase)
- **Langkah 3**: Fulfillment `module` + entitlement lifetime + idempotensi `granted_at`.
- **Langkah 4**: Integrasi pemanggilan `ensureMonthlyGrant` di `/api/me`, `/api/billing`, dan sebelum `charge()`.
- **Langkah 5**: Top-up custom endpoint + validasi.
- **Langkah 6**: Hapus langganan, free tier, ubah TRIAL_DAYS ke 30 dan pengaman trial.
- **Langkah 7**: UI pricing + billing + kalkulator EN/ID + screenshot asli.
- **Langkah 8**: Admin laporan liabilitas dan revenue mix.
- **Langkah 9**: Laporan final F15 dan mutation checks.
