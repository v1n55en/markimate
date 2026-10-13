-- Migrasi 010: helper db.update() selalu mengisi updated_at,
-- jadi semua tabel di schema markimate wajib punya kolom updated_at.
-- Idempoten, aman dijalankan ulang. Sudah dijalankan di project Supabase baru (13 Okt 2026).
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'markimate' and c.relkind = 'r'
      and not exists (select 1 from information_schema.columns ic
                      where ic.table_schema = 'markimate' and ic.table_name = c.relname and ic.column_name = 'updated_at')
  loop
    execute format('alter table markimate.%I add column if not exists updated_at timestamptz default now()', r.relname);
  end loop;
end $$;

insert into markimate.schema_migrations (version) values ('010') on conflict do nothing;
notify pgrst, 'reload schema';
