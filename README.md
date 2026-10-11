# Supermat — AI Digital Marketing Team Platform

Web app SaaS **Supermat Powered by 3Our Indonesia**:
Platform AI Digital Marketing Team modular all-in-one yang mengintegrasikan 16 peran spesialis digital marketing ke dalam satu dashboard kolaboratif multi-brand.

```
frontend (React 19, Vite, React Router v7)  →  backend (Express, Supabase)  →  n8n 3Our (webhook "Supermat API")
   ├── Multi-Workspace Context (Brand Isolation)   └── Ads Report (Shopee, TikTok, Meta, Google APIs)
   ├── SEO Automation (CMS Publish)
   ├── Ads Performance Report (Dashboard & Analytics)
   ├── Ads Creative Spy (Competitor Intelligence)
   └── 13 Role Coming Soon (Waitlist Engine)
```

---

## 16 AI Digital Marketing Roles (Modular Architecture)

Supermat dirancang dengan model modular berbasis peran spesialis:

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
- Kelola multi-brand dalam satu login Supermat tanpa saling campur data.
- Switcher brand instan dengan state terisolasi (`ws-3our-official`, `ws-kopi-makmur`, `ws-hijab-store`).
- Event reactive `supermat:workspace-changed` untuk pembaruan komponen real-time.

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
| `VITE_ADS_MOCK` | Aktifkan mock data untuk modul Ads Report | `true` (jika tidak terhubung API iklan live) |
| `VITE_SPY_MOCK` | Aktifkan mock data untuk modul Ads Creative Spy | `true` (default dev & demo mode) |

### Backend (`backend/.env`)
| Variable | Deskripsi |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SCHEMA` | Schema database (`supermat`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `JWT_SECRET` | Secret key untuk penandatanganan JWT |
| `SUPERMAT_API_KEY` | API Key penghubung backend ↔ n8n |
| `N8N_BASE_URL` | URL instance n8n |
| `CRON_SECRET` | Bearer token untuk trigger jadwal Vercel cron |

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
VITE_API_BASE_URL=http://localhost:5001 VITE_ADS_MOCK=true VITE_SPY_MOCK=true npm run dev
```

Buka browser di `http://localhost:5173`.

---

## Standar Branding & Identitas
Sesuai arahan resmi:
- Entitas resmi aplikasi: **Supermat Powered by 3Our Indonesia**.
- Tidak menggunakan penamaan "PT" atau "PT Stambha Racana Ahita".
- Seluruh dokumen legal, footer, navbar, dan dashboard menggunakan format `Powered by 3Our Indonesia`.
