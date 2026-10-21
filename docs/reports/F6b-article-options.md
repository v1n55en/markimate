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

### Langkah 3: Backend Normalisasi, Validasi Opsi, Estimasi Endpoint, & Charge Dinamis (PRD F6b)
- **Tujuan**:
  1. Menambahkan fungsi `normalizeKeywordArticleOptions(raw)` dan `resolveEffectiveArticleOptions(keywordOptions, workspaceArtSet)` pada `backend/lib/article-options.js` dan `frontend/src/config/article-options.js`.
  2. Memperbarui `DEFAULT_ARTICLE_SETTINGS` dan `normalizeArticleSettings(input)` di `backend/index.js` untuk mendukung tone preset/custom tersanitasi, pilihan panjang artikel (`short`, `standard`, `long`, `pillar`), serta mode gambar (`none`, `auto`, `manual`) dan jumlah gambar (0-6).
  3. Memperbarui endpoint `GET /api/credits/estimate` dan `estimate()` di `backend/lib/credits.js` agar menerima parameter `length` dan `images` untuk estimasi live yang presisi (misal: long 1500 kata + 4 gambar = 100 credit).
  4. Menghubungkan penyimpanan opsi artikel per-keyword di `POST /api/keywords` dan `PATCH /api/keywords/:id`, serta mengekspos `articleOptions` melalui `kwPublic`.
  5. Menyesuaikan pemotongan kredit dinamis di `generateFor` sesuai panjang artikel (`seo.article.short`, `seo.article`, `seo.article.long`, `seo.article.pillar`), serta menjamin proteksi gambar gagal tidak dipotong di `publishFor` (hanya gambar berhasil dibuat yang dipotong 5 credit).
  6. Menyiapkan endpoint baru `POST /api/keywords/:id/images/:idx/regenerate` di balik feature flag `SEO_IMAGE_REGEN_ENABLED` untuk Web Approver dengan pemotongan 5 credit idempoten per `requestId`.
  7. Mendaftarkan kode error baru `SEO_IMAGE_REGEN_DISABLED` dan `INVALID_IMAGE_INDEX` (400) ke kamus error backend dan locale i18n (EN & ID).
  8. Membuat test suite runtime baru `backend/tests/article-options-runtime.test.js` dengan isolasi database temporer untuk memverifikasi lifecycle lengkap.
- **Hasil Test**:
  - `node tests/article-options-runtime.test.js`: lolos 100%.
  - `cd backend && npm test`: 25/25 test suite lolos 100%, 0 polusi di `database.json`.
  - `cd frontend && npm run i18n:check`: 2371 keys parity in EN & ID, 73/73 error codes covered, 0 forbidden hardcoded numbers.
  - `cd frontend && npm run build`: 42 static HTML & sitemap generated, build sukses.

---

### Langkah 4: Automation n8n (`automation/`) & Panduan Import Workflow (PRD F6b)
- **Tujuan**:
  1. `automation/src/main-auth-generate.js`:
     - Memperluas clamp `wordCount` dari 400 s/d 2.500 kata (mendukung format artikel pillar).
     - Memperluas clamp `imageCount` dari 0 s/d 6 gambar.
     - Menerima dan menormalisasi parameter `imageMode` (`none`, `auto`, `manual`) dan `imageHero` (boolean).
  2. `automation/src/main-siapkan-prompt-link.js`:
     - Mengubah aturan penempatan gambar dari posisi statis/kaku menjadi pemilihan kontekstual (§3.3).
     - Mengekstrak daftar H2 lengkap dengan ringkasan 2 kalimat pertama dari markdown artikel, lalu menyertakannya di prompt Gemini "editor SEO".
     - Meminta AI memilih N bagian H2 yang paling layak diilustrasikan (proses, langkah, perbandingan, objek konkret; hindari FAQ dan kesimpulan) dengan placement `h2:<index>`, sectionTitle, serta prompt bahasa Inggris konkret berbasis isi bagian tersebut.
  3. `automation/src/main-terapkan-link.js`:
     - Menerapkan placement dinamis `h2:<index>` (atau `after_h2:<index>`).
     - Menyediakan mekanisme validasi & auto-repair: jika nomor H2 duplikat atau di luar jangkauan, otomatis dipindahkan ke H2 kosong terdekat dan dicatat di `warnings`.
     - Fallback intro: jika jumlah H2 lebih sedikit dari target gambar, sisa gambar ditempatkan setelah paragraf ke-2 intro dengan warning tanpa crash.
     - Jika mode `none`, tidak menyisipkan placeholder gambar apa pun di markdown.
     - Mengatur aspect ratio: hero 16:9, inline 4:3.
  4. Prompt penulis di `automation/build-workflows.mjs`:
     - Teks tone dibungkus sebagai data (`resolveTonePrompt` dari backend) dan disuntikkan ke prompt n8n tanpa risiko instruksi prompt injection.
     - Menambahkan instruksi khusus untuk `pillar` (wordCount >= 2000): wajib menyertakan daftar isi (Table of Contents) di awal body dan minimal 6 sub-bab H2 komprehensif.
  5. Webhook baru `supermat-image` (§3.4 & §4.10):
     - Dibuat node baru `automation/src/image-regenerate-siapkan.js` dan `automation/src/image-regenerate-hasil.js`.
     - Menghasilkan file workflow `automation/n8n-image-workflow.json` (6 nodes, webhook path: `supermat-image`, kredensial Gemini image yang sama).
  6. Mengompilasi seluruh workflow n8n via `node automation/build-workflows.mjs`.
  7. Membuat unit test `backend/tests/n8n-placement.test.js` untuk memverifikasi logika pemilihan kontekstual, fallback intro, pengalihan duplikat, dan mode `none`.
- **Hasil Test**:
  - `node automation/build-workflows.mjs`: sukses menghasilkan 6 file workflow n8n JSON.
  - `node tests/n8n-placement.test.js`: lolos 100%.
  - `cd backend && npm test`: 26/26 test suite lolos 100%, database bersih tanpa polusi.
  - `cd frontend && npm run i18n:check`: 2371 keys parity in EN & ID, 73/73 error codes covered, 0 forbidden hardcoded numbers.
  - `cd frontend && npm run build`: 42 static HTML & sitemap generated, build sukses.
- **Instruksi untuk 3Our (Import Workflow ke `n8n.3ourasia.id`)**:
  1. Buka dashboard n8n di `https://n8n.3ourasia.id`.
  2. **Workflow Utama (Generate & Publish)**:
     - Buka workflow `Supermat Main` (ID: `9cXOiWyr2L2qdWrv`).
     - Import / replace dari file lokal: [`automation/n8n-main-workflow.json`](file:///Users/mm/Supermat/automation/n8n-main-workflow.json).
     - Simpan dan pastikan status workflow **Active**.
  3. **Workflow Baru: Regenerate Image**:
     - Buat workflow baru (atau import workflow baru) dari file: [`automation/n8n-image-workflow.json`](file:///Users/mm/Supermat/automation/n8n-image-workflow.json).
     - Nama: `Supermat Webhook: Regenerate Image`.
     - Pastikan kredensial `Supermat API Key (Header)` dan `Gemini imagen` terpilih.
     - Simpan dan aktifkan workflow (**Active**).
  4. Jalankan pengujian 1 keyword (misal: "tips produktivitas kerja") dengan opsi `long` atau `pillar` untuk menguji alur artikel contextual images end-to-end.

---

## Rencana Langkah Selanjutnya
- **Langkah 5**: Frontend UI settings workspace (tone, panjang, mode gambar 0-6, hero) + form modal tambah keyword per-keyword override + estimasi live credit.
- **Langkah 6**: Frontend Web Approver (pindah urutan, hapus gambar, dan regenerasi/penambahan gambar di bagian tertentu).
- **Langkah 7**: Laporan final F6b dan pengujian integrasi.
