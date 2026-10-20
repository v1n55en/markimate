# Panduan Integrasi Pembayaran DOKU Checkout & Arsitektur Provider

Dokumen teknis untuk Markimate mengenai integrasi pembayaran DOKU Checkout, konfigurasi environment, webhook, rekonsiliasi otomatis, serta panduan menambah provider baru.

---

## 1. Variabel Environment

Tambahkan variabel berikut ke environment Vercel (`markimate-api`) atau file `.env`:

```env
# Provider aktif: 'doku' (atau 'mock' untuk pengujian lokal tanpa internet)
PAYMENT_PROVIDER=doku

# Mode DOKU: 'sandbox' atau 'production'
DOKU_ENV=sandbox

# Kredensial dari DOKU Back Office
DOKU_CLIENT_ID=your-client-id-here
DOKU_SECRET_KEY=your-secret-key-here

# Masa berlaku link pembayaran dalam menit (default 60)
PAYMENT_EXPIRY_MINUTES=60

# Kunci cron rekonsiliasi pembayaran
CRON_SECRET=your-cron-secret-here
```

---

## 2. Pengaturan DOKU Back Office

1. Masuk ke **DOKU Back Office** ([Sandbox](https://bo-sandbox.doku.com) / [Production](https://bo.doku.com)).
2. Buka menu **Settings** → **Payment Channels** dan aktifkan metode pembayaran yang diinginkan:
   - **QRIS** (Gopay, OVO, Dana, LinkAja, ShopeePay, Mobile Banking)
   - **Virtual Account** (BCA, Mandiri, BRI, BNI, Permata, Danamon, CIMB)
   - **Credit / Debit Card** (Visa, Mastercard, JCB)
3. Buka menu **Settings** → **Notification URL**:
   - **URL Notifikasi Webhook:**
     ```
     https://api.markimate.com/api/webhooks/doku
     ```
     *(Untuk sandbox sebelum domain live, gunakan URL Vercel preview/api yang dapat diakses publik).*
   - **Metode Notifikasi:** `POST`
   - **Format Header:** DOKU mengirimkan `Client-Id`, `Request-Id`, `Request-Timestamp`, dan `Signature` (format HMAC-SHA256).

---

## 3. Spesifikasi Keamanan Signature Non-SNAP

Signature DOKU dihitung menggunakan Digest SHA-256 base64 dari raw request body yang diproteksi dengan `crypto.timingSafeEqual`:

```
Digest    = base64(sha256(rawJsonBody))
component = "Client-Id:{id}\nRequest-Id:{rid}\nRequest-Timestamp:{ts}\nRequest-Target:{path}\nDigest:{digest}"
Signature = "HMACSHA256=" + base64(hmacSha256(DOKU_SECRET_KEY, component))
```

Untuk request `GET` (seperti `getStatus`), Digest ditiadakan:
```
component = "Client-Id:{id}\nRequest-Id:{rid}\nRequest-Timestamp:{ts}\nRequest-Target:{path}"
```

---

## 4. Cara Uji di Sandbox

1. Pastikan `DOKU_ENV=sandbox` dan kredensial sandbox terpasang.
2. Buka halaman **Credit Wallet** (`/app/billing/credits`), klik **Beli Kredit** pada salah satu paket (Starter / Growth / Scale).
3. Anda akan diarahkan ke halaman pembayaran DOKU Sandbox.
4. Gunakan kredensial / simulator pembayaran DOKU:
   - Untuk QRIS: scan via simulator DOKU QRIS.
   - Untuk VA: lakukan simulasi bayar di menu Simulator VA DOKU.
5. Setelah pembayaran selesai, browser otomatis diarahkan ke:
   ```
   https://app.markimate.com/app/billing/return?invoice=MKM-T-YYMMDD-XXXXXX
   ```
   Halaman return akan memverifikasi status pembayaran dan mengonfirmasi penambahan kredit secara real-time.

---

## 5. Rekonsiliasi Otomatis (Cron)

Markimate menjalankan cron rekonsiliasi setiap 15 menit melalui Vercel Cron:
- **Path:** `/api/cron/payments-reconcile`
- **Jadwal:** `*/15 * * * *`
- **Header:** `Authorization: Bearer <CRON_SECRET>`

Cron ini secara otomatis:
1. Memeriksa seluruh pembayaran berstatus `pending` yang dibuat lebih dari 2 menit yang lalu.
2. Menandai pembayaran yang melewati `expires_at` sebagai `expired`.
3. Memanggil `getStatus` ke DOKU untuk pembayaran yang belum kedaluwarsa. Jika status di DOKU sudah sukses, kredit/paket diaktifkan secara idempoten.

---

## 6. Checklist Pindah ke Production

- [ ] Akun DOKU Production sudah aktif dan terverifikasi.
- [ ] Ubah env `DOKU_ENV=production`.
- [ ] Masukkan `DOKU_CLIENT_ID` dan `DOKU_SECRET_KEY` Production dari DOKU Back Office ke Vercel.
- [ ] Daftarkan URL Notifikasi Production: `https://api.markimate.com/api/webhooks/doku`.
- [ ] Jalankan transaksi uji nominal kecil di production (misal paket Starter).

---

## 7. Cara Menambah Provider Pembayaran Baru

Arsitektur gateway Markimate menggunakan adapter pattern yang terisolasi di `backend/lib/payments/`:

1. Buat file adapter baru di `backend/lib/payments/<nama_provider>.js` yang meng-extends `PaymentProvider` (`provider.js`):
   ```javascript
   import { PaymentProvider } from './provider.js';

   export class CustomPaymentProvider extends PaymentProvider {
     async createCheckout({ invoiceNumber, amount, customer, items, callbackUrl, expiryMinutes }) {
       // Panggil API provider & kembalikan { checkoutUrl, providerRef, expiresAt, raw }
     }

     verifyNotification(req) {
       // Verifikasi signature HMAC/token dari provider -> boolean
     }

     parseNotification(body) {
       // Parse body -> { invoiceNumber, status: 'paid'|'failed'|'expired'|'pending', paidAt, method, raw }
     }

     async getStatus(invoiceNumber) {
       // Query status ke provider -> { status, paidAt, method, raw }
     }
   }
   ```
2. Daftarkan provider di `backend/lib/payments/index.js`.
3. Ubah variabel environment `PAYMENT_PROVIDER=<nama_provider>`. Seluruh alur checkout, kredit, paket, webhook, dan idempotensi langsung bekerja tanpa mengubah kode bisnis!
