-- Produksi sudah dijalankan manual 13 Okt 2026; setelah menjalankan ini, ganti Exposed schemas di Supabase Data API dari supermat ke markimate dan SUPABASE_SCHEMA=markimate.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'supermat')
     and not exists (select 1 from pg_namespace where nspname = 'markimate') then
    execute 'alter schema supermat rename to markimate';
  end if;
end $$;
notify pgrst, 'reload schema';
