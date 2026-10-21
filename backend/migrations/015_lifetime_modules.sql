-- Migrasi 015: Lifetime Modules, Monthly Grants, dan Payment Kind 'module' (PRD F15)
-- Skema: markimate
-- Sifat: Idempoten

alter table markimate.module_entitlements drop constraint if exists module_entitlements_source_check;
alter table markimate.module_entitlements add constraint module_entitlements_source_check
  check (source in ('free','trial','subscription','admin','lifetime'));
alter table markimate.module_entitlements add column if not exists payment_id uuid references markimate.payments(id) on delete set null;

alter table markimate.payments drop constraint if exists payments_kind_check;
alter table markimate.payments add constraint payments_kind_check
  check (kind in ('topup','subscription','module'));
alter table markimate.payments add column if not exists granted_at timestamptz;

create table if not exists markimate.monthly_grants (
  workspace_id uuid not null references markimate.workspaces(id) on delete cascade,
  period text not null,               -- 'YYYY-MM' (Asia/Jakarta)
  credits integer not null,
  granted_at timestamptz default now(),
  primary key (workspace_id, period)
);

alter table markimate.monthly_grants enable row level security;
grant all on markimate.monthly_grants to service_role;

insert into markimate.schema_migrations (version) values ('015') on conflict do nothing;
notify pgrst, 'reload schema';
