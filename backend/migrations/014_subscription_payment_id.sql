-- Migrasi 014: Tambah kolom payment_id ke tabel markimate.subscriptions (PRD F14 Tahap 3)
-- Skema: markimate
-- Sifat: Idempoten

alter table markimate.subscriptions add column if not exists payment_id uuid references markimate.payments(id) on delete set null;
create index if not exists subscriptions_payment_id_idx on markimate.subscriptions(payment_id);

insert into markimate.schema_migrations (version) values ('014') on conflict do nothing;
notify pgrst, 'reload schema';
