-- Skema Supabase untuk Markimate backend v2 (jalankan di SQL Editor)
-- Semua tabel ada di schema terpisah "markimate" supaya bisa menumpang di project Supabase yang sudah ada.
-- Setelah menjalankan ini: Project Settings → Data API → Exposed schemas → tambahkan "markimate".
create extension if not exists pgcrypto;
create schema if not exists markimate;

create table if not exists markimate.accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  brand_name text,
  niche text,
  plan text not null default 'free',
  api_key text unique,
  web_approver boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists markimate.cms_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  workspace_id uuid,
  cms_type text not null,
  config jsonb not null default '{}'::jsonb,
  config_enc text,
  config_iv text,
  article_settings jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, cms_type)
);

create table if not exists markimate.keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  workspace_id uuid,
  keyword text not null,
  geo text default 'ID',
  ln text default 'id',
  cms_type text default 'wordpress',
  status text default 'Pending',
  schedule text default 'immediate',
  source text default 'manual',
  duplicate_of jsonb,
  image_prompts jsonb,
  images jsonb,
  links jsonb,
  warnings jsonb,
  volume integer,
  difficulty numeric,
  article jsonb,
  post_id text,
  post_status text,
  draft_url text,
  public_url text,
  error text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists keywords_user_idx on markimate.keywords(user_id, created_at desc);
create index if not exists keywords_next_run_idx on markimate.keywords(next_run_at) where schedule in ('daily','weekly');

create table if not exists markimate.seo_topic_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  workspace_id uuid,
  cms_type text not null,
  seed_keywords text[] not null default '{}',
  geo text default 'ID',
  ln text default 'id',
  weekday int default 6,
  hour int default 0,
  topics_per_run int default 3,
  min_volume int default 50,
  auto_generate boolean default false,
  active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists seo_topic_sources_next_idx on markimate.seo_topic_sources(next_run_at) where active;

create table if not exists markimate.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  plan text not null,
  status text not null default 'active',
  method text,
  amount integer,
  invoice_no text,
  dummy boolean default true,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Hanya backend (service_role) yang boleh mengakses; anon/authenticated ditutup lewat RLS tanpa policy.
alter table markimate.accounts enable row level security;
alter table markimate.cms_connections enable row level security;
alter table markimate.keywords enable row level security;
alter table markimate.seo_topic_sources enable row level security;
alter table markimate.subscriptions enable row level security;
grant usage on schema markimate to service_role;
grant all on all tables in schema markimate to service_role;
alter default privileges in schema markimate grant all on tables to service_role;
revoke all on schema markimate from anon, authenticated;

