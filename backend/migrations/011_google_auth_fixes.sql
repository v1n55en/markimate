-- Migrasi 011: Google Auth Fixes & Pending OAuth Links (PRD F1+F2 Fix Pack Langkah 1)
-- Skema: markimate
-- Sifat: Idempoten

-- 1. Izinkan password_hash bernilai null untuk akun Google-only
alter table markimate.accounts alter column password_hash drop not null;

-- 2. Tabel untuk menyimpan pending token penautan akun (sekali pakai, masa berlaku 10 menit)
create table if not exists markimate.oauth_pending_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references markimate.accounts(id) on delete cascade,
  email text not null,
  google_sub text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table markimate.oauth_pending_links add column if not exists updated_at timestamptz default now();

create index if not exists oauth_pending_links_token_hash_idx on markimate.oauth_pending_links(token_hash);
create index if not exists oauth_pending_links_user_idx on markimate.oauth_pending_links(user_id);

alter table markimate.oauth_pending_links enable row level security;
grant all on markimate.oauth_pending_links to service_role;

-- 3. Catat migrasi
insert into markimate.schema_migrations (version) values ('011') on conflict do nothing;
notify pgrst, 'reload schema';
