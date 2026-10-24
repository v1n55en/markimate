-- Migrasi 020: Ads Report & Template Builder (PRD F5)
-- Skema: markimate
-- Sifat: Idempoten, aman dijalankan berulang kali di Supabase SQL Editor

-- 1. Tabel Koneksi Akun Iklan (Meta Ads & rancangan Google Ads)
create table if not exists markimate.ad_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google')),
  external_user_id text,
  display_name text,
  token_enc text,
  token_iv text,
  refresh_enc text,
  refresh_iv text,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_by uuid references markimate.accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  revoked_at timestamptz
);
create index if not exists ad_connections_workspace_idx on markimate.ad_connections(workspace_id);
create index if not exists ad_connections_status_idx on markimate.ad_connections(status);

-- 2. Tabel Akun Iklan (Ad Accounts di bawah suatu koneksi)
create table if not exists markimate.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  connection_id uuid not null references markimate.ad_connections(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google')),
  external_id text not null,
  name text not null,
  currency text default 'IDR',
  timezone text default 'Asia/Jakarta',
  is_manager boolean default false,
  login_customer_id text,
  selected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint ad_accounts_ws_plat_ext_unique unique (workspace_id, platform, external_id)
);
create index if not exists ad_accounts_workspace_idx on markimate.ad_accounts(workspace_id);
create index if not exists ad_accounts_conn_idx on markimate.ad_accounts(connection_id);

-- 3. Tabel Template Laporan
create table if not exists markimate.report_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references markimate.workspaces(id) on delete cascade,
  name text not null,
  spec jsonb not null default '{}'::jsonb,
  is_system boolean default false,
  created_by uuid references markimate.accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists report_templates_ws_idx on markimate.report_templates(workspace_id);

-- 4. Tabel Metrics Custom per Workspace (F5b)
create table if not exists markimate.ads_custom_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  name text not null,
  formula text not null,
  unit text not null default 'number' check (unit in ('currency', 'number', 'percent', 'ratio')),
  decimals integer default 2,
  created_by uuid references markimate.accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists ads_custom_metrics_ws_idx on markimate.ads_custom_metrics(workspace_id);

-- 5. Tabel Profil Laporan (Konfigurasi Laporan)
create table if not exists markimate.report_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  name text not null,
  template_id uuid references markimate.report_templates(id) on delete set null,
  account_ids uuid[] default '{}',
  date_preset text default 'last_month',
  compare boolean default true,
  conversion_event text default 'purchase',
  currency text default 'IDR',
  recipients text[] default '{}',
  schedule text default 'none' check (schedule in ('none', 'monthly')),
  next_run_at timestamptz,
  created_by uuid references markimate.accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists report_profiles_ws_idx on markimate.report_profiles(workspace_id);
create index if not exists report_profiles_sched_idx on markimate.report_profiles(schedule, next_run_at);

-- 6. Tabel Laporan Iklan (Riwayat & Hasil Generate)
create table if not exists markimate.ad_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  profile_id uuid references markimate.report_profiles(id) on delete set null,
  template_snapshot jsonb not null default '{}'::jsonb,
  period_start date,
  period_end date,
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'error')),
  request_id text unique,
  slides_url text,
  slides_file_id text,
  pdf_path text,
  summary jsonb default '{}'::jsonb,
  warnings jsonb default '[]'::jsonb,
  credits_charged integer default 0,
  error_code text,
  created_by uuid references markimate.accounts(id) on delete set null,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz default now()
);
create index if not exists ad_reports_ws_idx on markimate.ad_reports(workspace_id);
create index if not exists ad_reports_req_idx on markimate.ad_reports(request_id);
create index if not exists ad_reports_status_idx on markimate.ad_reports(status);

-- 7. Hak Akses & RLS
alter table markimate.ad_connections enable row level security;
alter table markimate.ad_accounts enable row level security;
alter table markimate.report_templates enable row level security;
alter table markimate.ads_custom_metrics enable row level security;
alter table markimate.report_profiles enable row level security;
alter table markimate.ad_reports enable row level security;

grant all on all tables in schema markimate to service_role;
grant all on all sequences in schema markimate to service_role;

-- 8. Pencatatan Migrasi
insert into markimate.schema_migrations (version, applied_at)
values ('020', now())
on conflict (version) do update set applied_at = now();

notify pgrst, 'reload schema';
