-- Migrasi 009: Auth, Siklus Akun, Workspace & Module Entitlement (PRD F1 + F2 Langkah 1)
-- Skema: markimate
-- Sifat: Idempoten, aman dijalankan berulang kali di Supabase SQL Editor

-- 0. Tabel pencatat migrasi
create table if not exists markimate.schema_migrations (
  version text primary key,
  applied_at timestamptz default now()
);

-- Pastikan extension pgcrypto aktif untuk fungsi digest()
create extension if not exists pgcrypto with schema extensions;

-- 1. Penambahan kolom baru di tabel accounts
alter table markimate.accounts add column if not exists name text;
alter table markimate.accounts add column if not exists status text not null default 'active';
alter table markimate.accounts add column if not exists email_verified_at timestamptz;
alter table markimate.accounts add column if not exists password_changed_at timestamptz;
alter table markimate.accounts add column if not exists failed_login_count integer default 0;
alter table markimate.accounts add column if not exists locked_until timestamptz;
alter table markimate.accounts add column if not exists deleted_requested_at timestamptz;
alter table markimate.accounts add column if not exists google_sub text;
alter table markimate.accounts add column if not exists last_login_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_google_sub_unique' and conrelid = 'markimate.accounts'::regclass
  ) then
    alter table markimate.accounts add constraint accounts_google_sub_unique unique (google_sub);
  end if;
end $$;

-- 2. Tabel-tabel baru untuk Autentikasi, Token & Rate Limiting
create table if not exists markimate.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  new_email text null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz default now()
);
create index if not exists email_verifications_user_idx on markimate.email_verifications(user_id);

create table if not exists markimate.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  ip text,
  created_at timestamptz default now()
);
create index if not exists password_resets_user_idx on markimate.password_resets(user_id);

create table if not exists markimate.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  token_hash text not null unique,
  family_id uuid not null,
  user_agent text,
  ip text,
  created_at timestamptz default now(),
  last_used_at timestamptz default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid
);
create index if not exists refresh_tokens_user_idx on markimate.refresh_tokens(user_id);
create index if not exists refresh_tokens_family_idx on markimate.refresh_tokens(family_id);

create table if not exists markimate.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 1
);

create or replace function markimate.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean language plpgsql as $$
declare
  r markimate.rate_limits;
begin
  insert into markimate.rate_limits(key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when markimate.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else markimate.rate_limits.count + 1
    end,
    window_start = case
      when markimate.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else markimate.rate_limits.window_start
    end
  returning * into r;

  return r.count <= p_max;  -- true = diizinkan, false = rate limited
end $$;

-- 3. Tabel-tabel baru untuk Workspace, Members & Invites
create table if not exists markimate.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  niche text,
  owner_user_id uuid not null references markimate.accounts(id) on delete cascade,
  timezone text default 'Asia/Jakarta',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists markimate.workspace_members (
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  role text not null check (role in ('owner','admin','viewer')),
  invited_by uuid references markimate.accounts(id),
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on markimate.workspace_members(user_id);

create table if not exists markimate.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','viewer')),
  token_hash text not null unique,
  invited_by uuid references markimate.accounts(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists workspace_invites_email_idx on markimate.workspace_invites(email);

create table if not exists markimate.module_entitlements (
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  module text not null check (module in ('seo','ads_report','ads_spy')),
  active boolean not null default true,
  source text not null check (source in ('free','trial','subscription','admin')),
  starts_at timestamptz default now(),
  ends_at timestamptz,
  primary key (workspace_id, module)
);

create table if not exists markimate.workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  key_hash text not null unique,
  prefix text not null,
  label text,
  created_by uuid references markimate.accounts(id),
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists workspace_api_keys_ws_idx on markimate.workspace_api_keys(workspace_id);

create table if not exists markimate.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  action text not null,
  target text,
  ip text,
  user_agent text,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_logs_workspace_created_idx on markimate.audit_logs(workspace_id, created_at desc);

create table if not exists markimate.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_id text not null,
  signature_ok boolean default false,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz default now(),
  unique(source, event_id)
);

-- 4. Kolom workspace_id di tabel-tabel data
alter table markimate.subscriptions add column if not exists workspace_id uuid;
alter table markimate.cms_connections add column if not exists workspace_id uuid;
alter table markimate.keywords add column if not exists workspace_id uuid;
alter table markimate.seo_topic_sources add column if not exists workspace_id uuid;

-- 5. Backfill Data (Idempoten)
-- 5.1. Setiap accounts yang belum punya workspace dibuatkan workspace dengan id = accounts.id
insert into markimate.workspaces (id, name, niche, owner_user_id, created_at)
select
  a.id,
  coalesce(nullif(a.brand_name, ''), split_part(a.email, '@', 1), 'Workspace Utama'),
  a.niche,
  a.id,
  coalesce(a.created_at, now())
from markimate.accounts a
where not exists (select 1 from markimate.workspace_members wm where wm.user_id = a.id)
on conflict (id) do nothing;

-- 5.2. Owner dimasukkan sebagai member workspace_members
insert into markimate.workspace_members (workspace_id, user_id, role, joined_at)
select w.id, w.owner_user_id, 'owner', coalesce(w.created_at, now())
from markimate.workspaces w
where not exists (
  select 1 from markimate.workspace_members wm
  where wm.workspace_id = w.id and wm.user_id = w.owner_user_id
)
on conflict (workspace_id, user_id) do nothing;

-- 5.3. Akun lama otomatis status 'active' dan email_verified_at terisi jika kosong
update markimate.accounts
set status = 'active',
    email_verified_at = coalesce(email_verified_at, created_at, now())
where email_verified_at is null and status = 'active';

-- 5.4. Isi workspace_id dari user_id jika masih null
update markimate.cms_connections set workspace_id = user_id where workspace_id is null;
update markimate.keywords set workspace_id = user_id where workspace_id is null;
update markimate.seo_topic_sources set workspace_id = user_id where workspace_id is null;
update markimate.subscriptions set workspace_id = user_id where workspace_id is null;

-- 5.5. Migrasikan accounts.api_key lama ke workspace_api_keys (hash SHA-256 dan simpan prefix 12 karakter)
insert into markimate.workspace_api_keys (workspace_id, key_hash, prefix, label, created_by, created_at)
select
  a.id,
  encode(extensions.digest(a.api_key, 'sha256'), 'hex'),
  substring(a.api_key from 1 for 12),
  'API Key Utama (Legacy)',
  a.id,
  coalesce(a.created_at, now())
from markimate.accounts a
where a.api_key is not null and a.api_key <> ''
  and not exists (
    select 1 from markimate.workspace_api_keys wak
    where wak.key_hash = encode(extensions.digest(a.api_key, 'sha256'), 'hex')
  )
on conflict (key_hash) do nothing;

-- 5.6. Module Entitlements dari accounts.plan
insert into markimate.module_entitlements (workspace_id, module, active, source, starts_at)
select
  w.id,
  m.module,
  true,
  case when a.plan = 'free' then 'free' else 'subscription' end,
  coalesce(w.created_at, now())
from markimate.workspaces w
join markimate.accounts a on a.id = w.owner_user_id
cross join lateral (
  select 'seo' as module where a.plan in ('free', 'seo', 'premium', 'focus3', 'all_in_one')
  union all
  select 'ads_report' as module where a.plan in ('ads_report', 'focus3', 'all_in_one')
  union all
  select 'ads_spy' as module where a.plan in ('ads_spy', 'focus3', 'all_in_one')
) m
on conflict (workspace_id, module) do nothing;

-- Override jika ada trial aktif di credit_wallets
insert into markimate.module_entitlements (workspace_id, module, active, source, starts_at, ends_at)
select cw.workspace_id, m.module, true, 'trial', now(), cw.trial_expires_at
from markimate.credit_wallets cw
cross join (
  values ('seo'), ('ads_report'), ('ads_spy')
) as m(module)
where cw.trial_expires_at is not null and cw.trial_expires_at > now()
on conflict (workspace_id, module) do nothing;

-- 6. Hak Akses & RLS
alter table markimate.schema_migrations enable row level security;
alter table markimate.email_verifications enable row level security;
alter table markimate.password_resets enable row level security;
alter table markimate.refresh_tokens enable row level security;
alter table markimate.rate_limits enable row level security;
alter table markimate.workspaces enable row level security;
alter table markimate.workspace_members enable row level security;
alter table markimate.workspace_invites enable row level security;
alter table markimate.module_entitlements enable row level security;
alter table markimate.workspace_api_keys enable row level security;
alter table markimate.audit_logs enable row level security;
alter table markimate.webhook_events enable row level security;

grant all on all tables in schema markimate to service_role;
grant all on all routines in schema markimate to service_role;
grant all on all sequences in schema markimate to service_role;

notify pgrst, 'reload schema';

insert into markimate.schema_migrations (version, applied_at)
values ('009', now())
on conflict (version) do update set applied_at = now();
