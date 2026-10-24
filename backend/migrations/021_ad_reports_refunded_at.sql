-- Migrasi: Tambah kolom refunded_at ke markimate.ad_reports untuk idempotensi refund atomik
alter table markimate.ad_reports add column if not exists refunded_at timestamptz;
