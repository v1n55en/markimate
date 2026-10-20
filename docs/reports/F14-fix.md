# Laporan Perbaikan Keamanan & Keandalan Sistem Pembayaran DOKU (PRD F14 Fix)

Dokumen ini mencatat seluruh implementasi, mitigasi celah keamanan, dan verifikasi otomatis untuk perbaikan PRD F14 (setelah commit `d230857`) sesuai aturan autopilot `AGENTS.md`.

---

## Ringkasan Commit Per Langkah

1. **Commit `1e73a5d`** — `fix(security): langkah 1 tutup celah mock webhook di produksi dan perbaiki jadwal cron vercel (PRD F14)`
   - Menonaktifkan provider `mock` di environment `NODE_ENV === 'production'` (menghasilkan 404 jika diakses di production).
   - Route `POST /api/webhooks/:provider` dibatasi hanya untuk active provider (`PAYMENT_PROVIDER`). Provider yang tidak cocok otomatis dibalas 404.
   - Mengubah jadwal cron `payments-reconcile` di `backend/vercel.json` dari `*/15 * * * *` menjadi harian (`0 2 * * *`) agar mematuhi batasan Vercel Hobby.
   - Menambahkan catatan bahwa webhook DOKU real-time adalah jalur utama pengiriman notifikasi, sedangkan cron rekonsiliasi harian adalah jalur pengaman (safety net).

2. **Commit `fd1738d`** — `fix(payments): langkah 2 fulfillment atomik, verifikasi signature doku anti-pemalsuan, dan pencocokan nominal (PRD F14)`
   - **Fulfillment Atomik**: Mengubah `fulfillPayment` agar melakukan conditional update (`where id = ? and fulfilled_at is null`) di baris awal sebelum mutasi saldo. Jika baris sudah pernah diklaim (misal oleh webhook atau cron yang berjalan bersamaan), proses berhenti dan saldo tidak bertambah ganda.
   - **Anti-Pemalsuan Signature**: `DokuPaymentProvider.verifyNotification` membandingkan header `Client-Id` secara ketat dengan `process.env.DOKU_CLIENT_ID`. Jika tidak cocok atau secret kosong, langsung ditolak 401 (tidak pernah fallback ke header pengirim).
   - **Hardcoded Webhook Target**: Request-Target signature notifikasi webhook di-hardcode ke `/api/webhooks/doku` sesuai endpoint resmi.
   - **Pencocokan Nominal**: `parseNotification` mengekstrak `order.amount` dan memverifikasi kecocokannya dengan `payment.amount` di database. Jika terdapat selisih nominal, notifikasi dicatat sebagai `amount_mismatch`, pembayaran tetap berstatus `pending`, dan kredit tidak di-fulfill.
   - **Status FAILED Bukan Final**: Pada DOKU Checkout, status `FAILED` diabaikan dan tetap berstatus `pending` agar pengguna dapat mencoba kembali sebelum waktu checkout kedaluwarsa (`expires_at`). Status final hanya `SUCCESS` (paid), `EXPIRED`, dan `REFUNDED`.
   - **Rekonsiliasi Aman (Check First)**: Sebelum menandai transaksi yang melewati batas waktu sebagai `expired`, cron rekonsiliasi terlebih dahulu memverifikasi status ke gateway DOKU (`getStatus`). Jika di gateway tercatat `SUCCESS`, pembayaran langsung di-fulfill.
   - **Pencatatan Webhook Event**: Pencatatan ke tabel `webhook_events` dipindahkan setelah proses fulfillment berhasil. Jika fulfillment gagal (misal koneksi DB error), Express membalas status 500 sehingga gateway DOKU melakukan retry otomatis.
   - **Penanganan Kegagalan Checkout**: Jika panggilan `createCheckout` gagal, record ditandai `status: 'failed'` dan `expires_at: now` agar cron rekonsiliasi tidak melakukan polling selamanya.

3. **Commit `1825db7`** — `fix(billing): langkah 3 timingSafeEqual admin auth, proteksi cron, pengingat langganan, dan estimated_credits (PRD F14)`
   - **Proteksi Admin Header**: Header `X-Admin-Key` dibandingkan menggunakan `crypto.timingSafeEqual` untuk mencegah serangan timing attack.
   - **Proteksi Cron Reconcile**: Endpoint `GET /api/cron/payments-reconcile` kini mewajibkan `CRON_SECRET` valid. Jika secret tidak diset atau salah, akses ditolak 401 `UNAUTHORIZED`.
   - **Callback URL Terkendali**: Menghapus input `callbackUrl` dari body request client. URL pengalihan return payment selalu di-generate oleh server mengacu pada `${APP_URL}/app/billing/return?invoice=...`.
   - **Default APP_URL**: Standarisasi fallback `APP_URL` ke `https://app.markimate.com`.
   - **Pengingat Langganan H-7 dan H-1**: Menambahkan modul `processSubscriptionRenewalReminders()` pada cron harian `GET /api/cron/run-scheduled` yang memanggil `sendSubscriptionRenewalReminderEmail` secara idempoten via pencatatan log di tabel `credit_alerts`.
   - **Estimasi Kredit Admin**: Pemakaian internal admin (`admin_usage`) kini menyimpan `usage.estimated_credits` pada baris ledger dan direkap pada laporan margin bulanan.
   - **Placeholder ADMIN_KEY**: Memperbarui contoh `ADMIN_KEY` di `backend/.env.example` agar memiliki panjang $\ge 32$ karakter.

4. **Commit `397e1a4`** — `test(payments): langkah 4 uji signature doku via http, penolakan mock prod, amount mismatch, dan atomisitas (PRD F14)`
   - Memperbarui suite pengujian `backend/tests/payments-doku.test.js` untuk menguji adapter DOKU nyata melalui HTTP Express server:
     1. Test vector signature resmi HMAC-SHA256 DOKU dan penolakan 503 jika secret belum dikonfigurasi.
     2. Katalog paket harga dalam mata uang IDR.
     3. Pembuatan order top-up dan checkout invoice `MKM-T-*`.
     4. Pengiriman webhook HTTP nyata ke `POST /api/webhooks/doku`:
        - Penolakan 401 untuk signature palsu.
        - Penolakan 401 untuk Client-Id palsu / beda.
        - Penolakan fulfillment jika nominal `order.amount` tidak cocok dengan database (`amount_mismatch`).
        - Penerimaan webhook dengan signature valid resmi -> 200, status `paid`, dan saldo top-up bertambah.
        - Uji idempotensi notifikasi berulang -> 200 `already_processed`, saldo tidak bertambah ganda.
     5. Pengujian konkurensi fulfillment: 2 eksekusi `fulfillPayment` bersamaan menghasilkan tepat 1 keberhasilan (atomik).
     6. Uji proteksi production: `POST /api/webhooks/mock` saat `NODE_ENV === 'production'` mengembalikan 404 dan tidak menambah saldo.
     7. Uji proteksi cron reconcile: tolak 401 jika tanpa secret atau secret salah, dan sukses 200 dengan Bearer token yang benar.
     8. Uji pengingat langganan: mendeteksi berakhirnya paket H-7 dan mencatat riwayat pengingat secara idempoten.

---

## Hasil Pengujian Otomatis

### 1. Backend Test Suite (`npm test`)
```text
======================================================
📊 RINGKASAN HASIL TEST BACKEND
======================================================
✅ tests/account-lifecycle.test.js           (3.41s)
✅ tests/admin-margin.test.js                (0.24s)
✅ tests/admin-platform.test.js              (1.37s)
✅ tests/auth.test.js                        (4.69s)
✅ tests/credits.test.js                     (0.84s)
✅ tests/entitlements.test.js                (0.82s)
✅ tests/google-auth.test.js                 (1.56s)
✅ tests/locale-mailer.test.js               (0.97s)
✅ tests/members.test.js                     (2.23s)
✅ tests/payments-doku.test.js               (0.82s)
✅ tests/schema-contract.test.js             (0.11s)
✅ tests/security.test.js                    (0.25s)
✅ tests/session.test.js                     (1.45s)
✅ tests/workspace.test.js                   (1.40s)

Total: 14/14 lolos (100%).
🔒 Verifikasi Integritas DB: database.json tidak tersentuh (MD5: ee9699674c675f30feb203304f5d3b8d).
🎉 SEMUA TEST BACKEND LOLOS 100% TANPA MENGOTORI DATABASE!
```

### 2. Frontend Checks (`npm run i18n:check`, `check-hardcoded-id`, `npm run build`)
- **Hardcoded Text Check**: `check-hardcoded-id.mjs` memindai seluruh 68 file di `src/**/*.{js,jsx}` dengan hasil 0 teks Indonesia hardcoded.
- **i18n Parity Check**: 2.208 key kamus sinkron antara EN dan ID, 0 error placeholder, dan 0 parameter hilang pada pemanggilan `t()`.
- **Production Build**: Berhasil membuat bundle client Vite dan menghasilkan 40 halaman static HTML SEO + `sitemap.xml`.

---

## Hal yang Perlu Diperhatikan / Belum Dikerjakan

1. **Jalur Utama Webhook vs Cron Reconcile**:
   - Vercel Hobby membatasi cron job menjadi maksimal 1x per hari (`0 2 * * *`).
   - Oleh karena itu, pengaktifan kredit instan mengandalkan webhook HTTP langsung dari DOKU (`POST /api/webhooks/doku`).
   - Cron harian bertindak sebagai fallback rekonsiliasi jika terjadi gangguan jaringan sesaat antara server DOKU dan Vercel. Jika nanti beralih ke paket Vercel Pro, jadwal cron dapat dipercepat kembali ke interval 15 menit (`*/15 * * * *`).

2. **DOKU IP Whitelisting**:
   - Spesifikasi saat ini mengandalkan HMAC-SHA256 signature verification yang matematis dan kebal pemalsuan. Jika DOKU di lingkungan production menyediakan IP range statis untuk notifikasi, IP whitelisting dapat ditambahkan sebagai lapisan pertahanan kedua.

---

## Daftar Environment Variables yang Perlu Diset di Vercel / Server Produksi

Agar sistem pembayaran DOKU dan keamanan cron berjalan optimal di lingkungan produksi, pengguna wajib mengatur nilai variabel lingkungan berikut:

| Nama Variabel | Wajib / Opsional | Contoh / Nilai Rekomendasi | Keterangan |
|---|---|---|---|
| `PAYMENT_PROVIDER` | Wajib | `doku` | Menentukan gateway aktif. Di produksi, nilai `mock` dilarang dan otomatis ditolak. |
| `DOKU_ENV` | Wajib | `sandbox` (saat uji coba) atau `production` | Menentukan URL endpoint DOKU (`api-sandbox.doku.com` vs `api.doku.com`). |
| `DOKU_CLIENT_ID` | Wajib | `MALLID-XXXX` | Client ID / Mall ID yang didapat dari DOKU Back Office. |
| `DOKU_SECRET_KEY` | Wajib | `SK-XXXX...` | Shared Secret Key dari DOKU Back Office untuk perhitungan HMAC-SHA256. |
| `CRON_SECRET` | Wajib | `string-acak-panjang-min-32-karakter` | Kunci rahasia untuk otentikasi Vercel Cron (`GET /api/cron/run-scheduled` & `GET /api/cron/payments-reconcile`). |
| `ADMIN_KEY` | Wajib | `string-acak-panjang-min-32-karakter` | Kunci otentikasi header `X-Admin-Key` untuk akses dashboard admin internal dan audit margin. |
| `APP_URL` | Wajib | `https://app.markimate.com` | Base URL aplikasi web untuk callback pengalihan setelah pembayaran selesai. |
| `CMS_CRED_KEY` | Wajib | `string-base64-32-byte` | Kunci enkripsi kredensial CMS pengguna (AES-256-GCM). |
| `JWT_SECRET` | Wajib | `string-acak-panjang-min-32-karakter` | Kunci rahasia untuk penerbitan access token sesi login. |

*Catatan: Tidak ada migrasi SQL baru yang perlu dijalankan di Supabase untuk perbaikan ini.*
