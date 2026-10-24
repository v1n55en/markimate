# Laporan PRD F5 – AI Ads Performance Reporter

## Ringkasan Commit

| # | Commit | Pesan |
|---|--------|-------|
| 1 | `29fec7b` | feat(ads): langkah 4 api template metrics custom profile dan asset upload (PRD F5) |
| 2 | `7fac468` | feat(ads): langkah 5 trigger webhook async n8n status polling dan rollback kredit (PRD F5) |
| 3 | `ddefb49` | feat(ads): langkah 6 cron pengiriman bulanan terjadwal dan email notifikasi (PRD F5) |
| 4 | `88a2f0f` | feat(ads): langkah 7 frontend ui koneksi laporan template dan profil (PRD F5) |
| 5 | `3b6bda4` | feat(ads): hapus mockActive guard & perkuat idempotensi refund per bucket (PRD F5) |

## Hasil Tes

### Backend
- **34/34 tes lolos** — termasuk `ads-runner.test.js`, `ads-oauth.test.js`, `ads-contract.test.js`, `ads-templates.test.js`, `ads-scheduler.test.js`, `ads-metrics.test.js`.

### Frontend
- `npm run i18n:check` → **0 errors**
- `npm run lint` → **0 errors** (67 warnings pra-eksisting, bukan akibat PRD ini)
- `npm run build` → **exit 0**, 42 file HTML statis + sitemap.xml berhasil digenerate

## File yang Berubah

### Backend
| File | Perubahan |
|------|-----------|
| `backend/index.js` | Endpoint API Ads Runner, OAuth, Callback n8n |
| `backend/lib/ads-oauth.js` | OAuth Meta flow (token encrypt/decrypt) |
| `backend/lib/ads-runner.js` | Trigger n8n async, rollback atomik, refund per bucket, timeout 10 mnt |
| `backend/migrations/020_ads_report.sql` | Tabel ad_connections, ad_accounts, ad_reports, report_templates, report_profiles, report_custom_metrics |
| `backend/migrations/021_ad_reports_refunded_at.sql` | Kolom refunded_at untuk idempotensi refund |
| `backend/tests/ads-contract.test.js` | (baru) Kontrak schema tabel ads |
| `backend/tests/ads-runner.test.js` | Fix insert workspace, ad_connection & ad_account untuk test refund per bucket |
| `backend/tests/ads-oauth.test.js` | Fix insert workspace (owner_user_id) |

### Frontend
| File | Perubahan |
|------|-----------|
| `frontend/src/ads/adsApi.js` | Hapus isAdsMock() dari getOAuthUrl & finishConnect; ganti error string Indonesia ke Inggris |
| `frontend/src/components/Sidebar.jsx` | Hapus isAdsMock import & adsSoon badge |
| `frontend/src/pages/ads/AdsSummaryPage.jsx` | Hapus mockActive guard & ModuleComingSoonCard |
| `frontend/src/pages/ads/AdsReportDetailPage.jsx` | Hapus mockActive guard & ModuleComingSoonCard |
| `frontend/src/pages/ads/AdsCallbackPage.jsx` | Hapus mockActive guard & ModuleComingSoonCard |

## SQL / Migrasi yang Perlu Dijalankan di Supabase

```
020_ads_report.sql
021_ad_reports_refunded_at.sql
```

Kedua migrasi harus dijalankan di Supabase sebelum fitur Ads aktif di production. File idempoten, aman dijalankan ulang.

## Cara Tes Manual

1. Buka /app/ads -> halaman ringkasan langsung muncul (bukan "Coming Soon")
2. Klik Connect Meta -> OAuth redirect ke Meta
3. Setelah callback, akun iklan terdaftar di /app/ads/connections
4. Generate laporan di /app/ads/reports -> kredit dipotong, status running
5. Webhook n8n callback ke /api/ads/reports/:id/callback -> status ready
6. Jika webhook gagal -> kredit dikembalikan per bucket (trial / paid) secara atomik

## Checklist Mobile (390px)

Seluruh halaman Ads yang disentuh diuji di Chrome DevTools 390px:
- [x] Tidak ada scroll horizontal
- [x] Semua tombol >= 44px dan bisa diklik
- [x] Tabel laporan bisa di-scroll horizontal
- [x] Modal generate laporan bisa ditutup
- [x] Form input font-size >= 16px

## Hal yang Belum Dikerjakan

- Screenshot 390px otomatis halaman Ads (akan ditambahkan dengan capture-f5-screenshots.mjs)
- Integrasi penuh dengan Meta Ads API production (bergantung VITE_META_APP_ID & META_APP_SECRET di Vercel)
