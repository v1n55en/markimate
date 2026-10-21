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

## Rencana Langkah Selanjutnya
- **Langkah 2**: SQL 015 `015_lifetime_modules.sql` (modifikasi constraint module entitlements, payments, dan tabel `monthly_grants`), update schema contract test, commit, dan berhenti untuk dijalankan user di Supabase.
- **Langkah 3**: Fulfillment `module` + entitlement lifetime + idempotensi `granted_at`.
- **Langkah 4**: `ensureMonthlyGrant` lazy dengan overwrite dan hangus akhir bulan.
- **Langkah 5**: Top-up custom endpoint + validasi.
- **Langkah 6**: Hapus langganan, free tier, ubah TRIAL_DAYS ke 30 dan pengaman trial.
- **Langkah 7**: UI pricing + billing + kalkulator EN/ID + screenshot asli.
- **Langkah 8**: Admin laporan liabilitas dan revenue mix.
- **Langkah 9**: Laporan final F15 dan mutation checks.
