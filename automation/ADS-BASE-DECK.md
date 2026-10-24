# Base deck & setup workflow Ads Report (PRD F5)

Workflow `n8n-ads-report-workflow.json` menyalin **base deck** (Google Slides milik akun Google Markimate) untuk setiap laporan. Isi deck dikenali lewat **speaker notes**, **alt text**, dan **placeholder teks**, bukan lewat posisi elemen. Desainer bebas mengatur tampilan.

## 1. Setup sekali (3Our)

1. Di Google Drive akun Markimate, buat folder **Markimate Reports**. Salin ID-nya dari URL.
2. Buat Google Slides **Markimate Base Deck** sesuai §2, lalu salin ID-nya.
3. Import `automation/n8n-ads-report-workflow.json` ke n8n.
4. Di node **Auth & Normalize (Ads)**, isi `CONFIG.baseDeckId` dan `CONFIG.reportsFolderId`.
5. Siapkan credential:
   - **Google Drive Markimate** (Google Drive OAuth2 API). Scope Drive juga dipakai untuk Slides dan Sheets. Pasang di semua node `Drive:`, `Sheets:`, dan `Slides:`.
   - **Gemini Markimate** (Google Gemini (PaLM) API). Pasang di node `Gemini: Insight`.
   - **Supermat API Key (Header)** sudah ada. Dipakai di Webhook dan kedua node callback.
6. Aktifkan workflow. Path webhook-nya `ads-report-generate`. URL production harus sama dengan `N8N_BASE_URL` di backend.

Selama `CONFIG` masih `GANTI_…`, workflow membalas **503**. Backend akan langsung mengembalikan kredit, jadi user tidak dirugikan.

## 2. Aturan base deck

### Satu slide layout per jenis halaman

Tulis di **speaker notes** slide: `layout:<type>`.

| Jenis | Notes | Wajib berisi |
|---|---|---|
| Cover | `layout:cover` | `{{title}}`, `{{subtitle}}` (opsional `{{period}}`, `{{workspace_name}}`) |
| Pemisah bab | `layout:section` | `{{title}}` |
| Ringkasan KPI | `layout:kpi` | `{{title}}`, 8 kartu |
| Grafik tren | `layout:trend` | `{{title}}`, 1 kotak grafik |
| Breakdown | `layout:breakdown` | `{{title}}`, 1 kotak grafik, `{{insight}}` |
| Tabel | `layout:table` | `{{title}}`, 1 tabel |
| Creative | `layout:creatives` | `{{title}}`, 3–9 slot |
| Insight AI | `layout:ai_insight` | `{{title}}`, `{{insight}}` |
| Teks custom | `layout:custom_text` | `{{title}}`, `{{text}}` |
| Gambar custom | `layout:custom_image` | `{{title}}`, gambar, `{{caption}}` |
| Penutup | `layout:closing` | `{{title}}` |

Semua slide asli base deck dihapus dari salinan setelah halaman laporan selesai disusun. Halaman yang jenisnya tidak punya layout dilewati dan dicatat sebagai warning `layout_missing:<type>`.

### Placeholder teks (bisa dipakai di semua layout)

- `{{title}}`, `{{subtitle}}`, `{{period}}`, `{{account_name}}`, `{{workspace_name}}`, `{{client_name}}`, `{{ads_platform}}`
- KPI (N = 1..8): `{{kpiN_label}}`, `{{kpiN_value}}`, `{{kpiN_delta}}`. Contoh delta: "▲ 12,3%".
- Creative (N = 1..9): `{{cN_name}}`, `{{cN_metrics}}`. Metrics berupa beberapa baris "Biaya: Rp…".
- `{{insight}}`, `{{text}}`, `{{caption}}`

### Alt text

Isi lewat klik kanan → *Alt text* → kolom **Description**. Tulis huruf kecil.

| Alt text | Elemen | Perilaku |
|---|---|---|
| `chart` | kotak/gambar placeholder **di level atas (tidak di-group)** | diganti *linked Sheets chart* dengan posisi dan ukuran yang sama |
| `table` | tabel: 1 baris header + ≥1 baris data, kolom ≥ 1 + jumlah metrics | baris ditambah/dihapus, kolom berlebih dihapus dari kanan |
| `kpi N` | kartu KPI ke-N (shape/group) | dihapus kalau template memakai < N metrics |
| `creative N` | bingkai/teks slot creative ke-N | dihapus kalau iklan < N |
| `creative N img` | **gambar** placeholder (harus elemen image) | diganti gambar iklan (CENTER_CROP) |
| `custom image` | **gambar** placeholder | diganti gambar upload user |

Kalau tabel kosong, isinya 1 baris "Tidak ada data pada periode ini" dengan "–" di kolom lain.

## 3. Hasil per laporan

- File baru di `Markimate Reports/<workspace_id>/`. Isinya Slides laporan dan Sheet "Data – …" (satu tab per grafik, chart dengan ID 1000+n).
- Akses: owner workspace sebagai **writer** (editor), pembuat laporan dan penerima sebagai **reader**. Google tidak mengirim email notifikasi karena `sendNotificationEmail=false`. Email "Laporan siap" dikirim oleh backend.
- Callback: `status: 'ready'`, `slidesUrl`, `slidesFileId`, `pdfPath` (tautan ekspor PDF Google), `summary`, `aiPages`, `warnings`.

## 4. Warning yang mungkin muncul

| Kode | Arti |
|---|---|
| `account_unavailable:<act>:<code>` | Akun gagal diambil (token/izin/akun nonaktif). Laporan dibuat dari akun lain. |
| `fetch_failed:<act>:<bagian>:<code>` | Salah satu bagian data gagal diambil, sehingga bagian itu kosong. |
| `fx_unavailable`, `fx_missing:<cur>` | Kurs gagal diambil (sumber: open.er-api.com), sehingga nilai tidak dikonversi. |
| `ai_unavailable` | Gemini gagal. Halaman insight diisi teks cadangan. |
| `creative_image_missing:<ad>`, `image_failed:<ref>` | Gambar iklan tidak tersedia atau gagal dipasang. |
| `layout_missing:<type>`, `unknown_placeholder:…`, `chart_without_data:…`, `table_columns_truncated:…` | Base deck belum lengkap. |
| `share_failed:<email>` | Email bukan akun Google atau akses ditolak. |

Kalau **semua** akun gagal atau ada langkah Google yang gagal, callback mengirim `status: 'error'` (`ADS_SOURCE_UNAVAILABLE` / `ADS_REPORT_FAILED`) dan kredit dikembalikan.

## 5. Keterbatasan yang diketahui

- Reach harian dan per breakdown dijumlahkan dari level campaign, jadi angkanya bisa sedikit lebih besar dari reach unik. Reach total periode diambil dari level akun.
- Gambar creative memakai `image_url` atau `thumbnail_url` creative, bukan screenshot preview feed.
- PDF berupa tautan ekspor Google (`/export/pdf`), belum diunggah ke Supabase Storage.
- Google Ads menyusul di F5-Google.
