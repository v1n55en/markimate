# Laporan Hasil Kerja: PRD F14 Fix Tahap 3

Laporan perbaikan lanjutan payment gateway DOKU Checkout, atomisitas langganan, pengujian mutasi, dan visual polish mobile 390px pada repositori `v1n55en/markimate`.

---

## 1. Ringkasan Perubahan per Poin

### Poin 1: Error DOKU Tidak Terlihat (Checkout Gateway)
- **Problem**: Transaksi checkout live gagal dengan 400 Bad Request, namun user hanya melihat pesan generik "Permintaan tidak valid atau parameter kurang", dan body respons DOKU tidak tersimpan di database.
- **Perbaikan**:
  1. Di `backend/lib/payments/service.js:createCheckout` catch block:
     - Menyimpan `err.dokuResponse` langsung ke field `payments.raw` di database.
     - Mencatat log error ke konsol dengan format: `[DOKU Error] invoice={invoice} status={status} code={code} message={message}` tanpa membocorkan secret atau signature headers.
     - Error HTTP 4xx dari DOKU kini dilempar ke client sebagai `status: 502` dengan kode `PAYMENT_GATEWAY_REJECTED` (bukan BAD_REQUEST).
  2. Menambahkan kode `PAYMENT_GATEWAY_REJECTED` (status 502) ke `backend/lib/error-codes.js`.
  3. Menambahkan kamus terjemahan di `frontend/src/i18n/locales/id/errors.js` ("Payment gateway menolak permintaan. Coba lagi atau hubungi kami.") dan `frontend/src/i18n/locales/en/errors.js` ("Payment gateway rejected the request. Please try again or contact support.").
  4. Di `backend/lib/payments/doku.js` dan `service.js`:
     - Field `customer.phone` hanya dikirim jika tidak kosong (key `phone` dihapus jika nilainya string kosong `''`).
     - Field `customer.name` dipotong dan dibatasi maksimal 64 karakter (`.trim().slice(0, 64)`) sesuai spesifikasi DOKU Checkout.
  5. Unit test di `backend/tests/payments-doku.test.js`: Mocking DOKU 400 Bad Request memverifikasi client menerima status 502 dengan code `PAYMENT_GATEWAY_REJECTED`, dan record di tabel `payments.raw` memuat persis body error DOKU.

### Poin 2: Langganan: Retry Tidak Memberi Masa Aktif Dobel
- **Problem**: Pembuatan baris langganan di `service.js` sebelumnya meng-insert baris baru pada setiap percobaan fulfillment tanpa mengunci ke payment, dan grant menggunakan `refId: sub.id`. Jika terjadi kegagalan setelah insert (misalnya jaringan), retry membuat langganan kedua dan memperpanjang `ends_at` dari langganan pertama (memberikan masa aktif dobel).
- **Perbaikan**:
  1. Langganan dikunci per `payment.id` (dengan fallback `invoice_no`): `db.findOne('subscriptions', { payment_id: payment.id })`. Jika sudah ada, jangan pernah meng-insert baris kedua; gunakan baris yang sudah ada.
  2. Semua `refId` grant sekarang seragam memakai `payment.id` (`refType: 'payment', refId: payment.id`), baik untuk top-up maupun langganan.
  3. Loop rekonsiliasi pembayaran berstatus `paid` di `reconcile()` kini menangani `subscription` di samping `topup`: jika langganan belum terbuat atau credit paket belum tercatat di ledger, reconcile memulihkannya secara idempoten.
  4. Menulis file migrasi SQL: `backend/migrations/014_subscription_payment_id.sql` untuk menambahkan kolom `payment_id uuid references markimate.payments(id)` pada tabel `markimate.subscriptions`.
  5. Unit test di `backend/tests/payments-doku.test.js:5c`: Simulasi kegagalan aktivasi langganan setelah insert subscription -> webhook retry -> terbukti tepat 1 baris subscription di DB, `payment_id` tersimpan, dan masa aktif `ends_at` tetap 1 periode (tidak berlipat ganda).

### Poin 3: Rollback yang Aman & Urutan Ledger Dulu
- **Problem**: Di `credits.js`, rollback wallet sebelumnya menelan error dan menuliskan kembali saldo absolut lama (berisiko menimpa mutasi bersamaan). Di `service.js`, rollback klaim payment tidak dibungkus `try/catch`.
- **Perbaikan**:
  1. Di `backend/lib/credits.js:grant`: Mengubah urutan operasi menjadi **catat mutasi di `credit_ledger` DULU** dengan `ref_id` unik. Baru setelah itu meng-update saldo `credit_wallets`. Jika update wallet gagal, baris ledger di-rollback via `db.remove('credit_ledger', { id: ledgerRow.id })`. Jika penghapusan gagal, error tetap di-throw (tidak ditelan diam-diam). Pola penulisan saldo absolut lama telah dihapus sepenuhnya.
  2. Di `backend/lib/payments/service.js`: Rollback claim payment dibungkus dalam blok `try/catch`. Jika rollback gagal karena database error, dicatat log `[CRITICAL]` dan dibiarkan untuk dipulihkan oleh reconcile loop.

### Poin 4: Bukti Pengujian Nyata (Mutation Checks)
Tiga unit test baru ditambahkan dan diverifikasi dengan mematikan baris kodenya (mutation check) untuk memastikan test benar-benar menguji dan menggagalkan eksekusi jika logika dinonaktifkan:

1. **Idempotensi `grant()` di `backend/lib/credits.js:411-426`**:
   - *Test*: `backend/tests/credits.test.js` memanggil `grant()` 2x dengan `refId` yang sama.
   - *Baris yang dimatikan*: Blok pengecekan idempotensi di `credits.js:411-426`.
   - *Bukti Test Gagal saat dimatikan*:
     ```
     ❌ Credits Test Failed: AssertionError [ERR_ASSERTION]: Second grant call with same refId must return idempotent: true
     + actual: undefined
     - expected: true
     ```
2. **Loop Reconcile `paidPayments` di `backend/lib/payments/service.js:498-545`**:
   - *Test*: `backend/tests/payments-doku.test.js:7b` menyisipkan payment berstatus `paid` tanpa entri di `credit_ledger`, lalu menjalankan cron rekonsiliasi.
   - *Baris yang dimatikan*: Loop `paidPayments` di `service.js:498-545`.
   - *Bukti Test Gagal saat dimatikan*:
     ```
     ❌ DOKU Payments Test Failed: AssertionError [ERR_ASSERTION]: Reconcile harus memulihkan kredit 500 untuk payment paid tanpa ledger
     2550 !== 3050
     ```
3. **Guard Empty Secret DOKU di `backend/lib/payments/doku.js:196-198`**:
   - *Test*: `backend/tests/payments-doku.test.js:6b` mengirim signature notifikasi yang dihitung sengaja dengan secret key kosong `""` saat adapter di-set dengan secret kosong.
   - *Baris yang dimatikan*: Guard `if (!this.clientId || !this.secretKey) return false;` di `doku.js:196-198`.
   - *Bukti Test Gagal saat dimatikan*:
     ```
     ❌ DOKU Payments Test Failed: AssertionError [ERR_ASSERTION]: Request HTTP ke /api/webhooks/doku dengan signature ber-key kosong wajib ditolak 401 oleh guard
     200 !== 401
     ```

### Poin 5: Laporan Jujur & Perbaikan Visual
1. **Perbaikan Layout Hero Landing EN**:
   - Pill card `trialHighlightCard` di `LandingPage.jsx` kini memiliki `marginBottom: '1.75rem'` dan `lineHeight: 1.4` dengan `whiteSpace: 'nowrap'` pada link "Claim Now →".
   - Kontainer `heroProof` memiliki `marginTop: '0.5rem'`.
   - Terbukti pada viewport mobile 390px: pill trial dan "3 Active Roles Ready to Deploy" tidak lagi menimpa satu sama lain, melainkan tersusun rapi dengan jarak vertikal yang nyaman.
2. **Screenshot Verify Tanpa 502**:
   - `frontend/vite.config.js` ditambahkan konfigurasi `preview.proxy` ke `http://localhost:5001`.
   - `frontend/scripts/take-clean-screenshots.mjs` secara otomatis menyalakan backend lokal di port 5001 sebelum mengambil screenshot.
   - Halaman `/verify?token=demo` kini menampilkan pesan validasi token bersih ("Verification Link Invalid or Expired" / "Tautan verifikasi tidak valid atau sudah kadaluarsa") dan form kirim ulang, tanpa 502.
3. **Koreksi Faktual**:
   - File `backend/.vercelignore` **hanya** mengecualikan `supabase.sql`, bukan `*.sql`. File migrasi `migrations/` dikecualikan sebagai folder utuh.
   - AST script `frontend/scripts/i18n-check.mjs` hanya menggunakan `@babel/parser` dengan fungsi traversal rekursif sendiri (`traverseAst`), **tidak pernah** mengimpor atau menggunakan paket `@babel/traverse`.

### Poin 6: Perbaikan Kecil
1. `backend/db.js`: `SupabaseStore.remove` menggunakan `.delete({ count: 'exact' })` dan mengembalikan nilai `count ?? 0` (bukan `count ?? 1`). Diuji di `backend/tests/db-adapter.test.js`.
2. `frontend/scripts/i18n-check.mjs`: Blok `catch` saat parsing AST file tidak lagi menelan error, melainkan menampilkan pesan gagal yang jelas ke konsol dan meningkatkan `errorCount++`.

---

## 2. Tabel Assert Seluruh Test Suite (Hasil Script Riil)

Dihitung langsung dari seluruh 16 file test di `backend/tests/` menggunakan script:
`for f in backend/tests/*.test.js; do echo "$f: $(grep -c "assert" "$f")"; done`

| No | File Test Suite | Jumlah Panggilan Assert |
|---|---|---|
| 1 | `backend/tests/account-lifecycle.test.js` | 39 |
| 2 | `backend/tests/admin-margin.test.js` | 26 |
| 3 | `backend/tests/admin-platform.test.js` | 41 |
| 4 | `backend/tests/auth.test.js` | 45 |
| 5 | `backend/tests/credits.test.js` | 35 |
| 6 | `backend/tests/db-adapter.test.js` | 26 |
| 7 | `backend/tests/deploy-bundle.test.js` | 6 |
| 8 | `backend/tests/entitlements.test.js` | 46 |
| 9 | `backend/tests/google-auth.test.js` | 58 |
| 10 | `backend/tests/locale-mailer.test.js` | 37 |
| 11 | `backend/tests/members.test.js` | 35 |
| 12 | `backend/tests/payments-doku.test.js` | 82 |
| 13 | `backend/tests/schema-contract.test.js` | 43 |
| 14 | `backend/tests/security.test.js` | 17 |
| 15 | `backend/tests/session.test.js` | 42 |
| 16 | `backend/tests/workspace.test.js` | 32 |
| **Total** | **16 Test Suites** | **610 Asserts** |

Hasil eksekusi: **16/16 test suites lolos 100% tanpa mengotori database!**

---

## 3. Daftar File Screenshot 390px (Output Nyata `ls -l` & `ls -lh`)

Output perintah `ls -lh docs/reports/img/`:
```
total 944
-rw-r--r--@ 1 mm  staff    59K Oct 21 09:02 landing-en-390.png
-rw-r--r--@ 1 mm  staff    63K Oct 21 09:02 landing-id-390.png
-rw-r--r--@ 1 mm  staff    58K Oct 21 09:02 pricing-en-390.png
-rw-r--r--@ 1 mm  staff    59K Oct 21 09:02 pricing-id-390.png
-rw-r--r--@ 1 mm  staff    65K Oct 21 09:02 role-detail-en-390.png
-rw-r--r--@ 1 mm  staff    63K Oct 21 09:02 role-detail-id-390.png
-rw-r--r--@ 1 mm  staff    35K Oct 21 09:02 verify-en-390.png
-rw-r--r--@ 1 mm  staff    59K Oct 21 09:02 verify-id-390.png
```

Output perintah `ls -l docs/reports/img/`:
```
total 944
-rw-r--r--@ 1 mm  staff  60016 Oct 21 09:02 landing-en-390.png
-rw-r--r--@ 1 mm  staff  64273 Oct 21 09:02 landing-id-390.png
-rw-r--r--@ 1 mm  staff  59013 Oct 21 09:02 pricing-en-390.png
-rw-r--r--@ 1 mm  staff  60016 Oct 21 09:02 pricing-id-390.png
-rw-r--r--@ 1 mm  staff  66646 Oct 21 09:02 role-detail-en-390.png
-rw-r--r--@ 1 mm  staff  64955 Oct 21 09:02 role-detail-id-390.png
-rw-r--r--@ 1 mm  staff  36142 Oct 21 09:02 verify-en-390.png
-rw-r--r--@ 1 mm  staff  60016 Oct 21 09:02 verify-id-390.png
```

---

## 4. SQL Migrasi yang Wajib Dijalankan di Supabase

File migrasi baru telah dibuat di `backend/migrations/014_subscription_payment_id.sql`:

```sql
-- Migrasi 014: Tambah kolom payment_id ke tabel markimate.subscriptions (PRD F14 Tahap 3)
-- Skema: markimate
-- Sifat: Idempoten

alter table markimate.subscriptions add column if not exists payment_id uuid references markimate.payments(id) on delete set null;
create index if not exists subscriptions_payment_id_idx on markimate.subscriptions(payment_id);

insert into markimate.schema_migrations (version) values ('014') on conflict do nothing;
notify pgrst, 'reload schema';
```

---

## 5. Daftar Commit

1. `71def2f`: `fix(payments): langkah 1 perbaiki penanganan error doku 502, dokuResponse di raw, dan batas nama customer (PRD F14)`
2. `17f355c`: `fix(db): langkah 6 hitung exact delete supabase store dan gagalkan parse ast pada i18n-check (PRD F14)`
3. `2da399a`: `fix(credits): langkah 3 dan 4 urutan ledger dulu, pengujian idempotensi grant, reconcile missing grant, dan empty secret guard (PRD F14)`
4. `ad23512`: `fix(subscriptions): langkah 2 kunci subscription per payment id dan migrasi 014 (PRD F14)`
5. `...`: `docs(reports): langkah 5 perbarui screenshot verify, layout landing en, dan laporan f14-fix-3 jujur (PRD F14)`
