# Aturan kerja agent di repo Markimate

Berlaku untuk semua PRD dan semua perubahan kode di repo `v1n55en/markimate`. Simpan file ini di root repo sebagai `AGENTS.md`, dan salin juga ke `.agent/rules/markimate.md` supaya terbaca sebagai workspace rule Antigravity.

## Aturan umum
- Jangan ubah folder `automation/` kecuali PRD menyebutnya secara eksplisit.
- Jangan commit `.env` atau secret apa pun (repo publik). Variabel baru cukup ditulis namanya di `.env.example`.
- Kerjakan PRD per langkah, dalam **mode autopilot** (di bawah), kecuali PRD atau 3Our meminta mode per langkah.
- Migrasi SQL harus idempoten dan aman dijalankan ulang. Selalu pakai prefix schema `markimate.`.

## Mode autopilot (default)

Agent mengerjakan semua langkah PRD berturut-turut **tanpa menunggu konfirmasi**. Setiap langkah wajib melewati gerbang ini sebelum lanjut:

1. Jalankan `cd backend && npm test`, lalu `cd frontend && npm run i18n:check && npm run build`. **Semua harus lolos.**
2. Commit terpisah per langkah dengan format `feat|fix(area): langkah N <ringkas> (PRD Fxx)`, lalu push ke `main`.
3. Tambahkan laporan langkah ke `docs/reports/<PRD>.md`: file yang berubah, cara tes, hasil tes, screenshot 390px (EN dan ID untuk halaman yang disentuh), dan hal yang sengaja tidak dikerjakan.

**Berhenti dan tunggu 3Our hanya jika:**
- butuh **SQL / migrasi baru** yang harus dijalankan di Supabase. Tulis file migrasinya, commit, lalu berhenti. Langkah yang tidak bergantung pada migrasi itu boleh dikerjakan dulu;
- butuh **env var / secret baru** di Vercel, atau perubahan di Google Cloud, Meta, Resend, atau Cloudflare;
- ada tes atau build yang **gagal dan tidak bisa diperbaiki tanpa mengubah perilaku** yang ditetapkan PRD;
- PRD **ambigu** atau bertentangan dengan kode yang ada;
- PRD menyebut langkah itu butuh input 3Our (misalnya brief desain).

**Dilarang** mengakali pengecekan supaya lolos, misalnya mengganti pola yang dicek (`lang === 'id'` → `lang.startsWith('id')`), menonaktifkan tes, menambah pengecualian lint tanpa alasan tertulis, atau menurunkan error menjadi warning. Kalau target PRD tidak tercapai, tulis apa adanya di laporan.

Di akhir PRD, kirim satu ringkasan berisi: daftar commit, hasil tes, SQL/env yang perlu dijalankan 3Our, dan hal yang belum selesai.

## Wajib: mobile friendly (setiap perubahan frontend)

User Markimate banyak membuka app dari HP. Setiap halaman/komponen yang dibuat **atau diubah** harus lolos cek di bawah sebelum langkah dianggap selesai.

### Cara menulis style
1. **Jangan atur layout dengan inline `style={{...}}`.** Inline style tidak bisa memakai media query; inilah penyebab utama tampilan rusak di HP. Untuk layout (grid, flex direction, width, padding, posisi, ukuran font judul) pakai **className + CSS** di `index.css` / file CSS komponen. Inline style hanya untuk nilai dinamis (warna dari data, progress bar %, dsb).
2. **Mobile-first:** tulis style dasar untuk layar kecil, lalu tambah `@media (min-width: 640px)`, `(min-width: 1024px)` untuk layar lebih besar. Breakpoint resmi: **640px** (tablet kecil) dan **1024px** (desktop). Jangan menambah breakpoint baru tanpa alasan.
3. Grid kartu: `grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr))`. **Jangan** `minmax(320px, 1fr)` atau `'1fr 1fr'` tanpa fallback 1 kolom di mobile.
4. Jangan pakai `width`/`min-width` tetap di atas 320px untuk kontainer. Pakai `max-width` + `width: 100%`.
5. Tabel: di mobile bungkus dengan `overflow-x: auto` **atau** ubah jadi daftar kartu (pilih kartu untuk tabel utama: keyword, laporan, ledger credit, anggota, sesi).
6. Form: input `width: 100%`, font-size input **minimal 16px** (mencegah iOS zoom otomatis), label di atas input, tombol utama full-width di mobile.
7. Target sentuh minimal **44×44px** (tombol, ikon, checkbox, item menu). Jarak antar tombol minimal 8px.
8. Modal/drawer: di mobile jadi full-screen atau bottom sheet, tinggi maksimal `100dvh`, konten bisa di-scroll, tombol tutup selalu terlihat.
9. Sidebar app: di bawah 1024px jadi drawer (tombol hamburger), bukan menyusut menimpa konten.
10. Teks panjang (email, URL, API key, judul artikel): `overflow-wrap: anywhere` atau `text-overflow: ellipsis`; tidak boleh mendorong lebar halaman.
11. Gambar/video/iframe: `max-width: 100%; height: auto`.
12. Gunakan safe area di elemen fixed bawah: `padding-bottom: env(safe-area-inset-bottom)`.

### Checklist uji (lampirkan hasilnya di laporan setiap langkah)
Uji di Chrome DevTools device toolbar pada lebar **360px**, **390px** (iPhone 14), **768px**, dan **1280px**, untuk setiap halaman yang disentuh:
- [ ] Tidak ada scroll horizontal (cek: `document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] Tidak ada teks/tombol terpotong atau saling menimpa; tidak ada elemen keluar layar.
- [ ] Semua tombol & link bisa diketuk (≥44px) dan tidak tertutup elemen fixed.
- [ ] Form bisa diisi tanpa zoom; keyboard HP tidak menutupi tombol kirim.
- [ ] Modal, dropdown, toast, dan drawer berfungsi dan bisa ditutup di 360px.
- [ ] Mode landscape HP (667×375) tidak rusak.
- [ ] Laporan langkah menyertakan **screenshot 390px** (atau daftar halaman yang dicek + hasilnya) untuk halaman baru/berubah.

Halaman yang belum memenuhi aturan ini tetapi **tidak disentuh** oleh PRD tidak wajib diperbaiki, cukup dicatat di laporan sebagai "utang mobile".
