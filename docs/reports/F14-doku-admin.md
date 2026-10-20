# Laporan Pengerjaan PRD F14: Pembayaran DOKU + Akun Admin Unlimited

Dokumen ini mencatat implementasi lengkap PRD F14 di repositori `markimate` sesuai aturan `AGENTS.md`.

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

---

## Langkah 2 - 7: Arsitektur Provider, Adapter DOKU, Checkout, Webhooks, Idempotensi & Penghapusan Midtrans

### Ringkasan Perubahan
1. **Katalog Terpusat (`backend/lib/catalog.js`):**
   - Single source of truth untuk paket top-up (`TOPUP_PACKAGES`) dan langganan (`PLANS`) dalam mata uang **IDR**.
   - Menyediakan endpoint `GET /api/billing/catalog`.
2. **Lapisan Payment Provider Abstraction (`backend/lib/payments/`):**
   - `provider.js`: Base contract class dengan antarmuka `createCheckout`, `verifyNotification`, `parseNotification`, dan `getStatus`.
   - `doku.js`: Adapter DOKU Checkout (Non-SNAP). Mengimplementasikan Digest SHA-256 base64, Signature HMAC-SHA256 dengan `crypto.timingSafeEqual`, timeout 15 detik, dan auto-retry 1x untuk network error.
   - `mock.js`: Mock adapter untuk pengujian unit, testing CI, dan lingkungan lokal tanpa kredensial live.
   - `index.js`: Factory `getProvider()` dinamis berbasis env `PAYMENT_PROVIDER` (default `'doku'`).
   - `service.js`: Lapisan bisnis checkout (`createCheckout`), pemenuhan idempoten (`fulfillPayment`), penanganan webhook (`handleNotification`), dan rekonsiliasi berkala (`reconcile`).
   - Format Invoice unik: `MKM-{T|S}-{YYMMDD}-{6 karakter acak}`.
3. **Top-Up & Beli Paket via DOKU Checkout:**
   - `POST /api/billing/topup { packageId }`: Membuat record di `markimate.payments`, menghasilkan URL DOKU Checkout, dan mengembalikan invoice.
   - `POST /api/billing/checkout { plan }`: Menggantikan sistem checkout lama yang disabled. Mengaktifkan paket langganan 30 hari dan modul paket secara otomatis saat pembayaran terkonfirmasi.
   - Pemenuhan idempoten: Pengecekan `fulfilled_at` menjamin kredit dan entitlement hanya diberikan tepat satu kali walaupun notifikasi webhook diterima berulang kali.
4. **Email Transaksional Billing (`backend/lib/mailer.js`):**
   - `sendTopupSuccessEmail`: Notifikasi pembayaran top-up berhasil beserta rincian kredit dan invoice (EN/ID).
   - `sendSubscriptionSuccessEmail`: Notifikasi paket langganan aktif beserta periode masa berlaku (EN/ID).
   - `sendSubscriptionRenewalReminderEmail`: Pengingat perpanjangan langganan (H-7 dan H-1) tanpa auto-debit (EN/ID).
5. **Webhook & Rekonsiliasi Otomatis:**
   - `POST /api/webhooks/:provider`: Memvalidasi signature raw body secara ketat dan mencatat event ke `webhook_events` untuk mencegah duplicate delivery.
   - `GET /api/cron/payments-reconcile`: Dilindungi `CRON_SECRET`, didaftarkan di `backend/vercel.json` dengan jadwal `*/15 * * * *`. Mengecek pembayaran `pending` yang tertunda dan menandai yang kedaluwarsa menjadi `expired`.
6. **Frontend UX & Responsivitas Mobile:**
   - `CreditWalletPage.jsx`: Integrasi tombol Beli Kredit langsung ke DOKU Checkout, mengambil paket dari katalog API, dan menampilkan Riwayat Pembayaran (tabel di desktop, kartu di mobile).
   - `BillingPage.jsx`: Integrasi tombol aktivasi paket langganan langsung ke DOKU Checkout.
   - `ReturnPaymentPage.jsx` (`/app/billing/return?invoice=...`): Halaman konfirmasi pembayaran dengan polling status setiap 3 detik (maksimal 2 menit), menampilkan status Menunggu / Berhasil / Gagal / Kedaluwarsa secara visual dengan dukungan penuh EN/ID.
7. **Penghapusan Total Midtrans:**
   - Menghapus `backend/lib/midtrans.js` dan route `POST /api/webhooks/midtrans`.
   - Menghapus seluruh skrip dan referensi Snap di frontend.
   - Menghapus env `MIDTRANS_*` di `.env.example`.
   - Mengganti `backend/tests/billing-midtrans.test.js` dengan suite baru `backend/tests/payments-doku.test.js`.
8. **Dokumentasi Teknis:**
   - Menyusun panduan lengkap `docs/payments-doku.md` yang memuat konfigurasi env, pengaturan DOKU Back Office, testing sandbox, checklist produksi, dan panduan menambah adapter baru.

### File yang Berubah / Dibuat
- `backend/lib/catalog.js` (baru)
- `backend/lib/payments/provider.js` (baru)
- `backend/lib/payments/doku.js` (baru)
- `backend/lib/payments/mock.js` (baru)
- `backend/lib/payments/index.js` (baru)
- `backend/lib/payments/service.js` (baru)
- `backend/lib/mailer.js`
- `backend/index.js`
- `backend/vercel.json`
- `backend/.env.example`
- `backend/lib/midtrans.js` (dihapus)
- `backend/tests/billing-midtrans.test.js` (dihapus)
- `backend/tests/payments-doku.test.js` (baru)
- `frontend/src/App.jsx`
- `frontend/src/components/BillingPage.jsx`
- `frontend/src/pages/billing/CreditWalletPage.jsx`
- `frontend/src/pages/billing/ReturnPaymentPage.jsx` (baru)
- `frontend/src/index.css`
- `frontend/src/i18n/locales/en/billing.js`
- `frontend/src/i18n/locales/id/billing.js`
- `docs/payments-doku.md` (baru)

---

## Hasil Verifikasi & Uji

1. **Frontend i18n & Build Check:**
   ```bash
   cd frontend && npm run i18n:check && npm run lint && npm run build
   ```
2. **Backend Automated Tests:**
   ```bash
   cd backend && npm test
   ```
   *Hasil:* 14/14 test suite lolos (termasuk `tests/payments-doku.test.js` yang menguji signature vectors, katalog IDR, checkout top-up, checkout langganan, webhook signature validation, webhook idempotency, dan rekonsiliasi cron).

### Checklist Mobile (360px & 390px)
- [x] Tidak ada scroll horizontal pada halaman `/app/billing`, `/app/billing/credits`, dan `/app/billing/return`.
- [x] Riwayat pembayaran bertransformasi dari tabel ke kartu mandiri di mobile (`repeat(auto-fit, minmax(min(280px, 100%), 1fr))`).
- [x] Target sentuh tombol aksi memenuhi standar minimal 44x44px.
- [x] Input dan font-size formulir aman dari zoom otomatis di iOS (≥16px).
- [x] Tampilan status return page (Menunggu / Berhasil / Gagal / Kedaluwarsa) terpusat rapi dan responsif di 360px & 390px.
