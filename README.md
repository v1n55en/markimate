# Markimate — AI Digital Marketing Team Platform

Web app SaaS **Markimate Powered by 3Our Indonesia** (sebelumnya bernama Supermat):
Platform AI Digital Marketing Team modular all-in-one yang mengintegrasikan 16 peran spesialis digital marketing ke dalam satu dashboard kolaboratif multi-brand.

```
frontend (React 19, Vite, React Router v7)  →  backend (Express, Supabase)  →  n8n 3Our (webhook "Markimate API" / "Supermat API")
   ├── Multi-Workspace Context (Brand Isolation)   └── Ads Report (Shopee, TikTok, Meta, Google APIs)
   ├── SEO Automation (CMS Publish)
   ├── Ads Performance Report (Dashboard & Analytics)
   ├── Ads Creative Spy (Competitor Intelligence)
   └── 13 Role Coming Soon (Waitlist Engine)
```

---

## 16 AI Digital Marketing Roles (Modular Architecture)

Markimate dirancang dengan model modular berbasis peran spesialis:

| Kategori | Role Key | Nama Role | Status | Harga / Bulan |
|---|---|---|---|---|
| **Traffic & Organic** | `seo` | AI SEO Specialist | **Tersedia** | Rp 1.500.000 |
| | `content` | AI Content Strategist | Segera Hadir | Rp 1.250.000 |
| | `copywriter` | AI Copywriter & Storyteller | Segera Hadir | Rp 1.000.000 |
| | `social` | AI Social Media Manager | Segera Hadir | Rp 1.250.000 |
| **Paid Advertising** | `ads_report` | AI Ads Performance Reporter | **Tersedia** | Rp 1.500.000 |
| | `ads_spy` | AI Ads Creative Spy | **Tersedia** | Rp 1.000.000 |
| | `media_buyer` | AI Media Buyer Assistant | Segera Hadir | Rp 2.000.000 |
| | `ad_copy` | AI Ad Copywriter Multi-Platform | Segera Hadir | Rp 1.000.000 |
| **Conversion & Retention** | `cro` | AI Landing Page & CRO Specialist | Segera Hadir | Rp 1.500.000 |
| | `email_crm` | AI Email & CRM Strategist | Segera Hadir | Rp 1.250.000 |
| | `wa_crm` | AI WhatsApp Commerce Specialist | Segera Hadir | Rp 1.250.000 |
| | `affiliate` | AI KOL & Affiliate Scout | Segera Hadir | Rp 1.250.000 |
| **Strategy & Market Intel** | `market_research` | AI Market & Consumer Researcher | Segera Hadir | Rp 1.500.000 |
| | `pricing` | AI Pricing & Promo Strategist | Segera Hadir | Rp 1.250.000 |
| | `cmo` | AI Fractional CMO | Segera Hadir | Rp 2.500.000 |
| | `cs_intelligence` | AI Customer Insights & Review Miner | Segera Hadir | Rp 1.000.000 |

### Paket & Bundling
- **Pilih Modul Lepas**: Kombinasikan peran spesifik sesuai kebutuhan brand Anda.
- **Paket Fokus 3 (Best Value)**: Diskon otomatis 20% saat mengaktifkan 3 modul aktif sekaligus.
- **Paket All-in-One AI Team**: Akses penuh ke seluruh 16 modul saat diluncurkan (Rp 7.875.000/bln — hemat 65%).
- **Managed by 3Our**: Layanan hybrid AI + Digital Marketing Team spesialis manusia dari 3Our Indonesia (Rp 25.000.000/bln).

---

## Modul Utama yang Aktif

### 1. AI SEO Specialist (`/app/keywords`)
- Riset keyword real-time berbasis Google Trends & volume pencarian.
- Penulisan artikel SEO mendalam dengan Gemini AI + Google Search grounding.
- Integrasi langsung ke CMS: **WordPress**, **Wix Blog**, **Sanity**, dan **Shopify Blog**.
- Workflow Review Ready (Human-in-the-Loop drawer) sebelum terbit langsung ke CMS.

### 2. AI Ads Performance Reporter (`/app/ads`)
- Konsolidasi performa multi-platform: **Shopee Ads**, **TikTok Ads**, **TikTok Shop GMV Max**, **Meta Ads**, **Google Ads**.
- Visualisasi metrik kunci: Ad Spend, ROAS, GMV, CPC, CTR.
- Executive summary AI dan generator slide ekspor presentasi bulanan.

### 3. AI Ads Creative Spy (`/app/spy`)
- Pantau kompetitor secara otomatis di Meta Ads Library, TikTok Creative Center, & Google Ads Transparency.
- Deteksi iklan winning (>30 hari tayang konsisten).
- Reverse engineering kreatif iklan dengan AI: Hook, Angle, Penawaran, Target Audience, dan Visual Breakdown.
- Swipe File personal per brand dan Laporan Intelijen Kreatif mingguan.

### 4. Multi-Workspace Isolation (`WorkspaceContext`)
- Kelola multi-brand dalam satu login Markimate tanpa saling campur data.
- Switcher brand instan dengan state terisolasi (`ws-3our-official`, `ws-kopi-makmur`, `ws-hijab-store`).
- Event reactive `markimate:workspace-changed` untuk pembaruan komponen real-time.

---

## Struktur Direktori Repo

| Folder | Deskripsi |
|---|---|
| `frontend/` | React 19 + Vite. Single Page Application (SPA), Landing Page 16 Role, Detail Role, Workspace Dashboard, SEO Automation, Ads Report, Ads Creative Spy, Modular Billing, ModuleGuard. |
| `frontend/src/config/` | Konfigurasi tunggal 16 role (`roles.js`) dan kalkulasi modular pricing (`pricing.js`). |
| `frontend/src/context/` | State workspace multi-brand (`WorkspaceContext.jsx`). |
| `frontend/src/spy/` | Mock data dan API client untuk modul AI Ads Creative Spy (`spyApi.js`, `mockData.js`). |
| `frontend/src/ads/` | Mock data dan API client untuk modul Ads Performance Report (`adsApi.js`, `mockData.js`). |
| `backend/` | Express (ESM). JWT auth, Supabase (fallback `database.json` untuk dev), proxy ke n8n dengan `X-Supermat-Key`, kredensial CMS per user, kuota paket, public API `/api/v1/*`. |
| `automation/` | Sumber & hasil build workflow n8n: `build-workflows.mjs` + `src/*.js` → `n8n-main-workflow.json`, `n8n-adapter-wordpress.json`, `n8n-adapter-wix.json`, `n8n-adapter-sanity.json`, `n8n-adapter-shopify.json`. |
| `docs/` | Spesifikasi desain & PRD. |

---

## Environment Variables

### Frontend (`frontend/.env`)
| Variable | Deskripsi | Default / Contoh |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL backend API Markimate | `https://markimate-api.vercel.app` (prod) / `http://localhost:5001` (dev) |
| `VITE_ADS_MOCK` | Aktifkan mock data untuk modul Ads Report | `false` (prod: menampilkan Coming Soon card) / `true` (hanya untuk dev testing) |
| `VITE_SPY_MOCK` | Aktifkan mock data untuk modul Ads Creative Spy | `false` (prod: menampilkan Coming Soon card) / `true` (hanya untuk dev testing) |

### Backend (`backend/.env`)
| Variable | Deskripsi | Default / Catatan |
|---|---|---|
| `SUPABASE_URL` | URL project Supabase | |
| `SUPABASE_SCHEMA` | Schema database (`markimate`) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | |
| `JWT_SECRET` | Secret key penandatanganan JWT (in-memory access token) | Wajib diset di produksi |
| `ADMIN_KEY` | Kunci rahasia header `X-Admin-Key` untuk endpoint admin & reviewer | Wajib diisi di produksi |
| `BILLING_DUMMY` | Izinkan checkout simulasi/dummy tanpa payment gateway | `false` (wajib `false` di prod) |
| `MARKIMATE_API_KEY` | API Key penghubung backend ↔ n8n (fallback: `SUPERMAT_API_KEY`) | |
| `N8N_BASE_URL` | URL instance n8n | |
| `CRON_SECRET` | Bearer token untuk trigger jadwal cron | |
| `APP_URL` | Domain frontend publik untuk link email & callback OAuth | `https://app.markimate.com` (prod) / `http://localhost:5173` (dev) |
| `RESEND_API_KEY` | API Key Resend untuk pengiriman email transaksional | Opsional di dev (fallback ke Dev Logger) |
| `MAIL_FROM` | Alamat pengirim email resmi Markimate | `Markimate <noreply@mail.markimate.com>` |
| `MAIL_DEV_LOG` | Tampilkan tautan verifikasi/reset di log terminal console | `true` untuk dev lokal |
| `ACCESS_TOKEN_TTL_MIN` | Masa berlaku access token JWT di memori (menit) | `15` (default) |
| `REFRESH_TOKEN_TTL_DAYS` | Masa berlaku refresh token httpOnly cookie (hari) | `30` (default) |
| `LEGACY_JWT_ACCEPT_UNTIL`| Batas waktu transisi penerimaan JWT legacy 30 hari | ISO string |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID dari Google Cloud Console | Project `markimate` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret dari Google Cloud Console | Project `markimate` |
| `META_APP_SECRET` | App Secret Meta untuk verifikasi signed_request Data Deletion | |

---

## 🔐 Arsitektur Autentikasi & Keamanan (PRD F1 + F2)

Markimate mengadopsi standar keamanan web enterprise modern:
1. **Pencegahan XSS (In-Memory Access Token)**:
   - Token JWT access disimpan murni di memori JavaScript (bukan di `localStorage`).
   - Masa berlaku access token singkat (15 menit).
2. **First-Party httpOnly Cookie Proxying**:
   - Refresh token disimpan dalam cookie `mk_rt` bertipe `httpOnly`, `SameSite=Lax`, dan `Secure` di produksi.
   - Frontend dan Backend dihubungkan melalui first-party proxy (Vercel rewrite pada `/api/:path*` di produksi dan Vite proxy di lokal), sehingga cookie tidak terblokir oleh mekanisme perlindungan tracking browser (Safari ITP / Chrome third-party cookie restrictions).
3. **Rotasi Token & Deteksi Pencurian (Token Reuse Detection)**:
   - Setiap panggilan ke `POST /api/auth/refresh` menerbitkan refresh token baru dan membatalkan token sebelumnya.
   - Jika refresh token yang sudah dipakai dipanggil kembali (indikasi token telah dicuri), sistem otomatis mencabut **seluruh family sesi** user tersebut dan memblokir akses seketika.
4. **Verifikasi Email Wajib & Proteksi Trial**:
   - Pendaftaran akun baru mewajibkan verifikasi email melalui tautan unik bertanda tangan SHA-256 token hash (kedaluwarsa 24 jam).
   - Trial credit 300 kredit & hak akses modul 7 hari **hanya dialokasikan setelah email diverifikasi** untuk mencegah eksploitasi alamat email palsu.
5. **Google OAuth 2.0 + PKCE**:
   - Login & registrasi 1-klik melalui Google OAuth dengan protokol PKCE (`code_verifier` & `code_challenge` SHA-256).
   - Scope dibatasi hanya `openid email profile`.
   - Penautan akun otomatis dilengkapi proteksi kata sandi untuk mencegah pengambilalihan akun yang tidak sah.
6. **Siklus Akun, Hapus Akun & Kepatuhan Regulasi**:
   - Lupa & reset kata sandi, ganti kata sandi dengan opsi pencabutan sesi lain, dan ganti email dua langkah.
   - Penghapusan akun dengan masa tenggang (*grace period*) 30 hari. Akun dapat dibatalkan kapan saja sebelum 30 hari.
   - Cron harian otomatis membersihkan akun kedaluwarsa, menghapus PII pengguna, serta **menganonimkan** transaksi untuk kepatuhan pembukuan pajak.
   - Webhook callback kepatuhan Meta Platform Data Deletion (`POST /api/data-deletion/meta`) dengan verifikasi HMAC-SHA256 `signed_request` dan pelacak publik status `/data-deletion`.
7. **Isolasi Workspace & RBAC**:
   - Setiap data brand, keyword, koneksi CMS, dan kredit diisolasi penuh di tingkat database per workspace.
   - Akses lintas workspace tanpa hak akses mengembalikan `404 Not Found` (mencegah penyerang menduga ID workspace lain).
   - Peran berjenjang: `owner` (hak penuh & transfer kepemilikan), `admin` (kelola anggota & API key), dan `viewer` (hanya baca, ditolak 403 untuk operasi tulis).

---

## 🧑‍💻 Verifikasi Manual Akun & Pengujian Admin
Untuk keperluan peninjauan aplikasi atau audit platform (Meta, Google, TikTok, Shopee):
1. **Verifikasi Email Manual via Admin**:
   ```bash
   curl -X POST https://api-anda/api/admin/users/<USER_ID>/verify \
     -H "X-Admin-Key: <ADMIN_KEY>"
   ```
2. **Grant Credit Tambahan**:
   ```bash
   curl -X POST https://api-anda/api/admin/credits/grant \
     -H "X-Admin-Key: <ADMIN_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"email":"reviewer@...", "credits":500, "bucket":"sub"}'
   ```
3. **Aktivasi Paket Manual**:
   ```bash
   curl -X POST https://api-anda/api/admin/subscriptions \
     -H "X-Admin-Key: <ADMIN_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"email":"reviewer@...", "plan":"growth", "billingCycle":"monthly"}'
   ```

---

## 🧪 Menjalankan Rangkaian Pengujian (Test Suite)

Seluruh pengujian integrasi dapat dijalankan secara lokal tanpa dependensi eksternal (menggunakan engine JsonStore fallback):

```bash
# Menjalankan suite pengujian komprehensif E2E (Register → Verify → Login → Refresh → Reuse → Reset → Isolation → Viewer 403 → Purge)
node backend/scripts/test-auth.js

# Menjalankan pengujian spesifik per modul PRD:
node backend/scripts/test-step1-migration.js       # Database schema & DB methods
node backend/scripts/test-step2-auth.js            # Register, verify token & login
node backend/scripts/test-step3-session.js         # JWT, httpOnly cookie & reuse detection
node backend/scripts/test-step4-account.js         # Forgot, reset, change password & email
node backend/scripts/test-step5-workspace.js       # Workspace multi-tenancy & API keys
node backend/scripts/test-step6-members.js         # Tim, RBAC, invites & transfer owner
node backend/scripts/test-step7-entitlements.js    # Module entitlement & subscriptions
node backend/scripts/test-step8-account-lifecycle.js # Delete, 30-day purge, export, Meta callback
node backend/scripts/test-step9-google-auth.js     # Google OAuth2 PKCE & account linking
```

---

## Menjalankan Aplikasi Secara Lokal

```bash
# 1. Jalankan Backend (port 5001)
cd backend
cp .env.example .env
npm install
npm run dev

# 2. Jalankan Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Buka browser di `http://localhost:5173`.

---

## Standar Branding & Identitas
Sesuai arahan resmi:
- Entitas resmi aplikasi: **Markimate Powered by 3Our Indonesia** (sebelumnya bernama Supermat).
- Tidak menggunakan penamaan "PT" atau "PT Stambha Racana Ahita".
- Seluruh dokumen legal, footer, navbar, dan dashboard menggunakan format `Powered by 3Our Indonesia`.

