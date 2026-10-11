# Supermat — AI Digital Marketing Team Platform

Web app SaaS **Supermat Powered by 3Our Indonesia**:
1. **SEO Article Automation**: Pengguna mendaftar, menghubungkan **WordPress**, **Wix**, **Sanity**, atau **Shopify Blog** miliknya, memasukkan keyword → 3Our (lewat n8n) meriset tren & volume, menulis artikel SEO dengan AI, lalu artikel direview dan diterbitkan ke CMS user.
2. **Ads Performance Report**: Konsolidasi performa iklan bulanan multi-platform (**Shopee Ads**, **TikTok Ads**, **TikTok Shop GMV Max**, **Meta Ads**, **Google Ads**), visualisasi metrik (Spend, ROAS, GMV), insight AI, dan integrasi siap ekspor ke Google Slides & Google Sheets. Termasuk mode demo untuk review Shopee Open Platform & TikTok Marketing API.

```
frontend (React 19, Vite, React Router v7)  →  backend (Express, Supabase)  →  n8n 3Our (webhook "Supermat API")
   ├── SEO Automation (CMS Publish)         └── Ads Report (Shopee, TikTok, Meta, Google APIs)
   └── Ads Report (Dashboard & Review)
```

## Struktur repo

| Folder | Isi |
|---|---|
| `frontend/` | React 19 + Vite. Login/daftar, Kontrol Automasi (keyword, run, review drawer), Pengaturan CMS & API (WordPress/Wix/Sanity/Shopify + tes koneksi, API key 3Our), Langganan (dummy checkout), Analitik. |
| `backend/` | Express (ESM). JWT auth, Supabase (fallback `database.json` untuk dev), proxy ke n8n dengan `X-Supermat-Key`, kredensial CMS per user, kuota paket, public API `/api/v1/*`, cron jadwal. |
| `automation/` | Sumber & hasil build workflow n8n: `build-workflows.mjs` + `src/*.js` → `n8n-main-workflow.json`, `n8n-adapter-wordpress.json`, `n8n-adapter-wix.json`, `n8n-adapter-sanity.json`, `n8n-adapter-shopify.json` (import ke n8n). |
| `docs/` | Spesifikasi desain. |

## Alur produk

1. **Daftar/Masuk** → backend membuat akun (plan `free`, API key `spm_live_…`).
2. **Pengaturan CMS** → simpan kredensial WordPress (URL, user, Application Password) atau Wix (Site ID, API key) atau Sanity (Project ID, dataset, token Editor, opsional URL Studio / document type / field isi / pola URL publik) → backend langsung **tes koneksi** (`/wp-json/wp/v2/users/me`, `blog/v3/posts`, query + dry-run mutation Sanity, atau GraphQL shop/blog/scope Shopify) dan menandai *verified*.
3. **Kontrol Automasi** → tambah keyword → backend `POST n8n /webhook/supermat-trigger` → n8n: Google Trends + Autocomplete (SerpAPI) → Ahrefs (RapidAPI) → pilih target keyword → Gemini (+ tool Google Search) → artikel JSON.
   - **Free**: artikel langsung dikirim sebagai **draf** ke CMS (`action: draft`).
   - **Pro + Web Approver**: status `Review Ready` → user edit di drawer → **Simpan draf** / **Publikasikan** → backend `POST n8n /webhook/supermat-publish` dengan kredensial CMS user (diambil dari server, bukan dari browser).
4. **Jadwal** (Pro): keyword `daily`/`weekly` dijalankan oleh Vercel Cron → `GET /api/cron/run-scheduled` (header `Authorization: Bearer CRON_SECRET`).
5. **Langganan**: halaman dummy (QRIS/VA/kartu) → `POST /api/billing/checkout` mengaktifkan plan `premium` 30 hari. Tidak ada transaksi nyata.
6. **3Our API** (per user, header `X-API-Key`): `POST /api/v1/articles/generate`, `POST /api/v1/articles/:id/publish`, `GET /api/v1/articles`.

## Deploy

### n8n (3Our)
Workflow sudah terpasang & aktif di `n8n.3ourasia.id`:
- `Supermat API: Generate & Publish (3Our)` — id `9cXOiWyr2L2qdWrv` (webhook `supermat-trigger`, `supermat-publish`)
- `Supermat Adapter: WordPress` — id `XokXcBPuDOlIexss`
- `Supermat Adapter: Wix Blog` — id `54QOd6HkD0duCqGq`
- `Supermat Adapter: Sanity` — id `yRYqxg0wtw0Q0C9t` (draf `drafts.<id>` via Mutations API; terbit via Mutations/Actions API; isi = Portable Text)
- `Supermat Adapter: Shopify Blog` — id `mPOJqWf1KKYoK1Bp` (GraphQL `articleCreate`/`articleUpdate`; auth: token `shpat_` atau Client ID + Secret app Dev Dashboard → client_credentials, token 24 jam; scope `write_content`)

API key 3Our ↔ n8n: kedua webhook memakai **Header Auth** dengan credential n8n **"Supermat API Key (Header)"** (header `X-Supermat-Key`). Nilainya hanya disimpan di credential itu dan di env Vercel `SUPERMAT_API_KEY` — keduanya harus sama. **Jangan tulis key di repo (repo ini publik).** Ganti key: edit credential di n8n → edit env di Vercel → Redeploy.

Mengubah workflow: edit `automation/src/*.js` / `build-workflows.mjs`, jalankan `node automation/build-workflows.mjs`, lalu import JSON ke n8n (Import from file) dan salin ke workflow dengan id di atas (atau update node-nya langsung).

### Backend (Vercel project `supermat-api`, root `backend/`)
1. Database: schema `supermat` di project Supabase "Debounce WA 3Our" (`jgavqcrsolndrltadlxq`) — sudah dibuat dari `backend/supabase.sql` dan di-expose di Data API. (Free plan Supabase maksimal 2 project, jadi Supermat menumpang dengan schema terpisah.)
2. Env config (sudah diisi): `SUPABASE_URL`, `SUPABASE_SCHEMA=supermat`, `N8N_BASE_URL`, `FRONTEND_ORIGIN`, `FREE_MONTHLY_LIMIT`.
3. Env rahasia (isi sendiri, tipe Secret): `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `SUPERMAT_API_KEY`, `CRON_SECRET`.
4. Entry function `api/index.js` (maxDuration 60 detik, karena generate artikel ±20–30 detik); `vercel.json` berisi cron harian `0 1 * * *` (08.00 WIB) → `/api/cron/run-scheduled`.
5. Env lama v1 (`N8N_URL_RUN`, `N8N_URL_PUBLISH`, `FONNTE_TOKEN`, `SUPABASE_KEY`) tidak dipakai lagi dan boleh dihapus.

### Frontend (Vercel project `supermat` → supermat-three.vercel.app, root `frontend/`)
Env: `VITE_API_BASE_URL=https://supermat-api.vercel.app` (sudah ada).

## Dev lokal
```bash
cd backend && cp .env.example .env && npm i && npm run dev      # tanpa Supabase → database.json
cd frontend && npm i && VITE_API_BASE_URL=http://localhost:5001 npm run dev
```

## Catatan keamanan
- Kredensial CMS disimpan apa adanya di tabel `cms_connections.config` (jsonb). Backend memakai service-role key, jadi tabel tidak terbuka ke klien. Enkripsi kolom bisa ditambah kemudian.
- Key 3Our (SerpAPI/RapidAPI/Gemini) hanya ada di credential n8n; tidak ada lagi key yang di-hardcode di workflow.
