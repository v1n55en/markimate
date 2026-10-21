# Laporan Implementasi PRD F6b: Opsi Artikel SEO (Tone, Panjang, Gambar Kontekstual)

Tanggal: 21 Oktober 2026  
Status: In Progress (Langkah 1 Selesai)  
Pemilik Keputusan: 3Our Asia  

---

## Ringkasan Perubahan per Langkah

### Langkah 1: Config Opsi Artikel, Preset Tone (EN/ID), Action Keys Credit, & Estimator (PRD F6b)
- **Tujuan**:
  1. Menetapkan konfigurasi resmi opsi artikel SEO (`backend/lib/article-options.js` dan `frontend/src/config/article-options.js`):
     - Tone presets: `professional`, `casual`, `educational`, `persuasive`, `storytelling`, `custom`.
     - Teks preset prompt dalam bahasa artikel (ID & EN) tersimpan di config (bukan locale UI).
     - Panjang artikel:
       - `short`: 600 kata (45 cr, actionKey: `seo.article.short`, estimasi biaya API ±Rp2.100).
       - `standard`: 900 kata (60 cr, actionKey: `seo.article`, estimasi biaya API ±Rp2.600).
       - `long`: 1.500 kata (80 cr, actionKey: `seo.article.long`, estimasi biaya API ±Rp3.400).
       - `pillar`: 2.500 kata (110 cr, actionKey: `seo.article.pillar`, estimasi biaya API ±Rp4.800).
     - Mode gambar: `none` (0 gambar), `auto` (kontekstual 1-6 gambar), `manual` (titik awal auto + penyesuaian Web Approver).
     - Gambar: 5 credit per gambar (`seo.image`).
  2. Mengimplementasikan fungsi sanitasi `sanitizeCustomTone(text)`:
     - Maksimal 120 karakter, satu baris (tanpa newline `\r` atau `\n`).
     - Proteksi terhadap prompt injection dan syntax berbahaya: penolakan `{{`, `}}`, backtick, URL (`http`, `https`, `www`), "ignore previous instructions", "abaikan instruksi", "system prompt", dsb dengan error 400 `INVALID_TONE`.
  3. Mengimplementasikan fungsi `estimateArticleCredits(options)` untuk estimasi live di frontend dan backend.
  4. Mendaftarkan action keys `seo.article.short`, `seo.article.long`, `seo.article.pillar` ke `DEFAULT_PRICES` di `backend/lib/credit-defaults.js`.
  5. Mendaftarkan error code `INVALID_TONE` (400) ke `backend/lib/error-codes.js` dan kamus locale `id/errors.js` serta `en/errors.js`.
  6. Membuat suite test kesetaraan konfigurasi dan sanitasi: `backend/tests/article-options-parity.test.js`.
- **Hasil Test**:
  - `node tests/article-options-parity.test.js` lolos 100%.
  - `cd backend && npm test`: 24/24 test suite lolos 100%, MD5 `database.json` bersih tanpa terkontaminasi.
  - `cd frontend && npm run i18n:check`: 2369 keys in EN & ID, 71/71 backend error codes ter-cover, 0 forbidden hardcoded prices, 0 error.
  - `cd frontend && npm run build`: 42 static HTML & sitemap XML sukses di-generate.

---

### Langkah 2: SQL Migrasi 017 `article_options` pada Tabel `markimate.keywords` (PRD F6b)
- **Tujuan**:
  1. Menyiapkan migrasi idempoten `backend/migrations/017_article_options.sql`:
     ```sql
     alter table markimate.keywords
       add column if not exists article_options jsonb default null;

     insert into markimate.schema_migrations (version) values ('017') on conflict do nothing;
     notify pgrst, 'reload schema';
     ```
  2. Memperbarui kontrak skema pada `backend/tests/schema-contract.test.js` untuk memastikan kolom `article_options` diakui dalam skema tabel `keywords` dan struktur datanya valid.
- **Hasil Test**:
  - `backend/tests/schema-contract.test.js` lolos dan memvalidasi `keywords.article_options`.
  - `cd backend && npm test`: 24/24 test suite lolos 100%.
  - `cd frontend && npm run i18n:check && npm run build`: Lolos 100%.
- **Instruksi untuk 3Our**:
  - Jalankan script `backend/migrations/017_article_options.sql` di Supabase SQL Editor sebelum generate keyword dengan opsi custom di production.

---

## Rencana Langkah Selanjutnya
- **Langkah 3**: Backend normalisasi & validasi opsi (`normalizeArticleSettings`, `normalizeKeywordArticleOptions`), charge credit dinamis sesuai panjang artikel, dan endpoint estimasi live `GET /api/credits/estimate`.
- **Langkah 4**: Automation n8n (payload, prompt kontekstual, webhook `supermat-image`, dan build workflows).
- **Langkah 5**: Frontend UI settings workspace + form tambah keyword + estimasi live.
- **Langkah 6**: Frontend Web Approver (pindah, urutkan, hapus, dan regenerate gambar).
- **Langkah 7**: Laporan final F6b dan pengujian integrasi.
