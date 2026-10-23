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
