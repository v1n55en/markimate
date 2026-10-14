-- Migrasi 012: Preferensi Bahasa Pengguna (Locale Akun EN/ID) (PRD F3 Langkah 2)
-- Skema: markimate
-- Sifat: Idempoten

-- 1. Tambah kolom locale di tabel accounts (default 'id', hanya 'id' atau 'en')
alter table markimate.accounts add column if not exists locale text not null default 'id' check (locale in ('id', 'en'));

-- 2. Pastikan akun lama memiliki nilai default 'id'
update markimate.accounts set locale = 'id' where locale is null;

-- 3. Catat migrasi ke schema_migrations dan segarkan skema PostgREST
insert into markimate.schema_migrations (version) values ('012') on conflict do nothing;
notify pgrst, 'reload schema';
