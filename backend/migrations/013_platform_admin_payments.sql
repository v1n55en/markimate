-- Migrasi 013: Platform Admin Flag & Unified Payments Table (PRD F14)
-- Skema: markimate
-- Sifat: Idempoten

-- 1. Tambah kolom is_platform_admin ke tabel accounts
alter table markimate.accounts add column if not exists is_platform_admin boolean not null default false;

-- 2. Buat tabel markimate.payments untuk transaksi top-up dan langganan generik
create table if not exists markimate.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  user_id uuid references markimate.accounts(id) on delete set null,
  kind text not null check (kind in ('topup','subscription')),
  item_id text not null,
  item_name text not null,
  amount integer not null,
  currency text not null default 'IDR',
  credits integer,
  period_days integer,
  provider text not null,
  invoice_number text not null unique,
  provider_ref text,
  checkout_url text,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded','cancelled')),
  provider_status text,
  method text,
  paid_at timestamptz,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payments_ws_idx on markimate.payments(workspace_id, created_at desc);
create index if not exists payments_pending_idx on markimate.payments(status, created_at) where status = 'pending';

alter table markimate.payments enable row level security;
grant all on markimate.payments to service_role;

insert into markimate.schema_migrations (version) values ('013') on conflict do nothing;
notify pgrst, 'reload schema';
