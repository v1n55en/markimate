# Laporan Pengerjaan PRD F14: Pembayaran DOKU + Akun Admin Unlimited

Dokumen ini mencatat kemajuan pengerjaan PRD F14 di repositori `markimate` sesuai aturan `AGENTS.md`.

---

## Langkah 1: Akun Admin Platform Unlimited

### Ringkasan Perubahan
1. **Migrasi `013_platform_admin_payments.sql` (Bagian 1 & 2):**
   - Menambahkan kolom `accounts.is_platform_admin boolean not null default false`.
   - Menambahkan tabel `markimate.payments` untuk menampung transaksi pembayaran terpusat DOKU.
2. **Revert Hardcode & Config:**
   - Menghapus email hardcoded dan `UNLIMITED_EMAILS` di `backend/lib/config.js`.
   - Menghapus pemberian saldo 999.999 dan `source: 'unlimited'` pada `backend/lib/credits.js` dan `backend/lib/entitlements.js`.
   - Membuat `backend/lib/admin.js` dengan fungsi helper `isPlatformAdminEmail`, `isPlatformAdmin`, `isWorkspacePlatformAdmin`, dan `ensurePlatformAdmin`.
3. **Bypass Saldo & Margin Internal:**
   - `assertAffordable` membypass admin platform dengan `{ affordable: true, unlimited: true }`.
   - `charge` mencatat transaksi pemakaian admin dengan `kind: 'admin_usage'`, `delta: 0`, dan biaya estimasi/API riil di metadata.
   - `backend/lib/margin.js` memisahkan pemakaian `admin_usage` ke kelompok "Pemakaian internal 3Our" agar tidak mengotori margin pelanggan.
4. **Keamanan Endpoint Admin (`/api/admin/*`):**
   - Mendukung sesi user dengan `is_platform_admin = true` atau header `X-Admin-Key`.
   - Menghapus fallback `'default-admin-secret-key'`. Jika `ADMIN_KEY` kosong, jalur header dinonaktifkan.
   - Di production, jika `ADMIN_KEY` diset namun kurang dari 32 karakter, server menolak start.
5. **Frontend UI:**
   - Sidebar: Badge "Admin · Unlimited", saldo "∞ Unlimited", dan menu "Admin Console" (`/app/admin`) khusus admin platform.
   - Credit Wallet: Badge "Admin · Unlimited", saldo "∞ Unlimited", dan pesan bypass limit harian.
   - Halaman Admin Dashboard (`AdminDashboardPage.jsx`): Menampilkan ringkasan metrik bulanan, pemakaian internal 3Our, tabel margin per aksi, form pemberian kredit manual, dan aktivasi paket langganan manual.
   - i18n EN & ID untuk seluruh string baru.

### File yang Berubah
- `backend/migrations/013_platform_admin_payments.sql` (baru)
- `backend/db.js`
- `backend/lib/admin.js` (baru)
- `backend/lib/config.js`
- `backend/lib/credits.js`
- `backend/lib/entitlements.js`
- `backend/lib/google-auth.js`
- `backend/lib/margin.js`
- `backend/lib/session.js`
- `backend/index.js`
- `backend/tests/admin-platform.test.js` (baru)
- `frontend/src/App.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/pages/billing/CreditWalletPage.jsx`
- `frontend/src/pages/admin/AdminDashboardPage.jsx` (baru)
- `frontend/src/i18n/locales/en/app.js`
- `frontend/src/i18n/locales/id/app.js`
- `frontend/src/i18n/locales/en/billing.js`
- `frontend/src/i18n/locales/id/billing.js`

### Cara Tes & Hasil
1. **Frontend i18n & Build:**
   ```bash
   cd frontend && npm run i18n:check && npm run lint && npm run build
   ```
   *Hasil:* 0 error i18n (2170 keys parity EN/ID), 0 error lint, build Vite berhasil.
2. **Backend Unit & Regression Tests:**
   ```bash
   cd backend && npm test
   ```
   *Hasil:* 14/14 test suite lolos (termasuk `tests/admin-platform.test.js` yang menguji bypass kredit, pencatatan ledger admin_usage, entitlement admin, penolakan akses admin tanpa auth, dan proteksi email belum terverifikasi).

### Checklist Mobile (360px & 390px)
- [x] Tidak ada scroll horizontal di `/app/admin` dan `/app/credits`.
- [x] Tampilan kartu responsif di mobile (`repeat(auto-fit, minmax(min(280px, 100%), 1fr))`).
- [x] Semua tombol dan input form memenuhi target sentuh ≥44px.
- [x] Badge admin dan teks status terlihat rapi di 360px & 390px.

---
