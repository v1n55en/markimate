-- Migrasi 007: Sistem Credit & Free Trial 7 Hari
-- Skema Markimate

-- 1. Harga credit per aksi (seed dari tabel PRD §2)
create table if not exists markimate.credit_prices (
  action_key text primary key,          -- seo.article, seo.image, seo.topics_run, ...
  credits integer not null,
  label text,
  active boolean default true,
  needs_review boolean default false,
  updated_at timestamptz default now()
);

-- 2. Dompet credit per workspace (1 workspace = 1 user_id)
create table if not exists markimate.credit_wallets (
  workspace_id uuid primary key,        -- = user_id selama tabel workspaces belum ada
  balance_trial integer not null default 0,
  trial_expires_at timestamptz,
  balance_sub   integer not null default 0,
  sub_expires_at   timestamptz,
  balance_topup integer not null default 0,
  topup_expires_at timestamptz,
  daily_cap integer not null default 500,
  updated_at timestamptz default now()
);

-- 3. Buku besar mutasi credit & biaya API nyata
create table if not exists markimate.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  delta integer not null,               -- negatif = pemakaian, positif = top-up/grant, 0 = usage_failed
  bucket text not null,                 -- trial | sub | topup
  kind text not null,                   -- usage | usage_failed | grant_trial | grant_sub | topup | refund | expire | admin
  action_key text,
  ref_type text,
  ref_id text,                          -- mis. keyword / report / scan id
  balance_after integer not null,
  usage jsonb,                          -- {geminiIn, geminiOut, images, serpCalls, ...} dari n8n
  cost_actual_idr numeric default 0,    -- biaya API nyata (lihat PRD §2b)
  note text,
  created_at timestamptz default now()
);
create index if not exists credit_ledger_workspace_created_idx on markimate.credit_ledger(workspace_id, created_at desc);
create unique index if not exists credit_ledger_idempotent_idx on markimate.credit_ledger(workspace_id, action_key, ref_type, ref_id, bucket)
  where kind = 'usage' and ref_type is not null and ref_id is not null;

-- 4. Tarif biaya API nyata vendor (PRD §2b)
create table if not exists markimate.credit_cost_rates (
  rate_key text primary key,            -- gemini_in_per_1k, gemini_out_per_1k, image, serp_call, rapid_call
  idr numeric not null,
  note text,
  updated_at timestamptz default now()
);

-- 5. Catatan klaim trial (1 trial per email terverifikasi)
create table if not exists markimate.credit_trials (
  email text primary key,
  workspace_id uuid,
  granted_at timestamptz default now(),
  cms_domain text
);

-- 6. Log notifikasi & peringatan saldo credit
create table if not exists markimate.credit_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  alert_type text not null,       -- balance_low_20 | trial_h2 | trial_h0 | margin_low | cost_high
  sent_to text not null,
  period_key text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists credit_alerts_workspace_type_idx on markimate.credit_alerts(workspace_id, alert_type, period_key);

-- 7. Transaksi pesanan top-up credit (Midtrans)
create table if not exists markimate.credit_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  workspace_id uuid not null,
  package_id text not null,
  package_name text not null,
  amount numeric not null,
  credits integer not null,
  status text not null default 'pending', -- pending | paid | failed | expired
  snap_token text,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists credit_orders_workspace_idx on markimate.credit_orders(workspace_id, created_at desc);

-- 8. Penanda verifikasi email di tabel accounts
alter table markimate.accounts add column if not exists email_verified_at timestamptz;

-- 9. Izin akses service role
grant usage on schema markimate to service_role;
grant all on all tables in schema markimate to service_role;
alter default privileges in schema markimate grant all on tables to service_role;
