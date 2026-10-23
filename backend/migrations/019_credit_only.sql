-- 019: model credit-only — credit top-up tidak hangus
begin;
-- payments.kind: tambah 'pack' (constraint dari 015: payments_kind_check)
alter table markimate.payments drop constraint if exists payments_kind_check;
alter table markimate.payments add constraint payments_kind_check
  check (kind in ('topup','subscription','module','pack'));
-- credit top-up yang sudah ada tidak hangus lagi
update markimate.credit_wallets
   set topup_expires_at = null
 where topup_expires_at is not null;
insert into markimate.schema_migrations (version) values ('019') on conflict do nothing;
commit;
notify pgrst, 'reload schema';
