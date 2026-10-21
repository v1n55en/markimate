-- Migrasi 017: Opsi Artikel SEO (Tone, Panjang, Gambar Kontekstual) per Keyword (PRD F6b)
-- Skema: markimate
-- Sifat: Idempoten

alter table markimate.keywords
  add column if not exists article_options jsonb default null;

insert into markimate.schema_migrations (version) values ('017') on conflict do nothing;
notify pgrst, 'reload schema';
