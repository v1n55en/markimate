-- Migrasi Fase 6: SEO Hardening
-- Skema Markimate

-- 1. Pengaturan artikel & enkripsi kredensial per koneksi CMS
alter table markimate.cms_connections
  add column if not exists article_settings jsonb not null default '{}'::jsonb,
  add column if not exists config_enc text,          -- AES-256-GCM(base64) dari config
  add column if not exists config_iv text,
  add column if not exists workspace_id uuid;

-- 2. Keyword: status & data baru (gambar, link, duplikat)
alter table markimate.keywords
  add column if not exists source text default 'manual',      -- manual | auto_trends | api
  add column if not exists duplicate_of jsonb,                -- {title, slug, url} bila status Duplicate
  add column if not exists image_prompts jsonb,               -- dari n8n generate
  add column if not exists images jsonb,                      -- hasil publish [{idx, assetId, url}]
  add column if not exists links jsonb,                       -- {internal:[], external:[]}
  add column if not exists warnings jsonb,
  add column if not exists workspace_id uuid;

-- 3. Topik otomatis (focus keyword + jadwal mingguan)
create table if not exists markimate.seo_topic_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  workspace_id uuid,
  cms_type text not null,
  seed_keywords text[] not null default '{}',
  geo text default 'ID',
  ln text default 'id',
  weekday int default 6,            -- 0=Minggu … 6=Sabtu
  hour int default 0,               -- jam lokal Asia/Jakarta
  topics_per_run int default 3,
  min_volume int default 50,
  auto_generate boolean default false,   -- true: langsung generate artikel; false: masuk "Suggested" untuk dipilih user
  active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists seo_topic_sources_next_idx on markimate.seo_topic_sources(next_run_at) where active;

alter table markimate.seo_topic_sources enable row level security;
grant usage on schema markimate to service_role;
grant all on all tables in schema markimate to service_role;
alter default privileges in schema markimate grant all on tables to service_role;
revoke all on schema markimate from anon, authenticated;
