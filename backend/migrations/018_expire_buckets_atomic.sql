-- Migrasi 018: Stored Procedure untuk Kedaluwarsa Saldo Wallet Atomik (PRD F15-Fix Poin 10)
-- Skema: markimate
-- Sifat: Idempoten

create or replace function markimate.expire_buckets_atomic(
  p_workspace_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = markimate, public
as $$
declare
  v_wallet markimate.credit_wallets%rowtype;
  v_now timestamptz := now();
  v_expired_trial integer := 0;
  v_expired_sub integer := 0;
  v_expired_topup integer := 0;
  v_total_after integer;
  v_total_expired integer := 0;
  v_wallets_affected integer := 0;
begin
  for v_wallet in
    select * from markimate.credit_wallets
    where (p_workspace_id is null or workspace_id = p_workspace_id)
      and (
        (balance_trial > 0 and trial_expires_at is not null and trial_expires_at <= v_now)
        or (balance_sub > 0 and sub_expires_at is not null and sub_expires_at <= v_now)
        or (balance_topup > 0 and topup_expires_at is not null and topup_expires_at <= v_now)
      )
    for update
  loop
    v_expired_trial := 0;
    v_expired_sub := 0;
    v_expired_topup := 0;

    -- 1. Cek Trial
    if v_wallet.balance_trial > 0 and v_wallet.trial_expires_at is not null and v_wallet.trial_expires_at <= v_now then
      v_expired_trial := v_wallet.balance_trial;
      v_wallet.balance_trial := 0;
    end if;

    -- 2. Cek Subscription
    if v_wallet.balance_sub > 0 and v_wallet.sub_expires_at is not null and v_wallet.sub_expires_at <= v_now then
      v_expired_sub := v_wallet.balance_sub;
      v_wallet.balance_sub := 0;
    end if;

    -- 3. Cek Topup
    if v_wallet.balance_topup > 0 and v_wallet.topup_expires_at is not null and v_wallet.topup_expires_at <= v_now then
      v_expired_topup := v_wallet.balance_topup;
      v_wallet.balance_topup := 0;
    end if;

    if v_expired_trial > 0 or v_expired_sub > 0 or v_expired_topup > 0 then
      v_total_after := v_wallet.balance_trial + v_wallet.balance_sub + v_wallet.balance_topup;

      update markimate.credit_wallets
      set balance_trial = v_wallet.balance_trial,
          balance_sub = v_wallet.balance_sub,
          balance_topup = v_wallet.balance_topup,
          updated_at = v_now
      where id = v_wallet.id;

      if v_expired_trial > 0 then
        insert into markimate.credit_ledger (
          workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
          balance_after, usage, cost_actual_idr, note
        ) values (
          v_wallet.workspace_id, -v_expired_trial, 'trial', 'expire', null, null, null,
          v_total_after + v_expired_sub + v_expired_topup, null, 0, 'Trial 30 hari kadaluarsa'
        );
      end if;

      if v_expired_sub > 0 then
        insert into markimate.credit_ledger (
          workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
          balance_after, usage, cost_actual_idr, note
        ) values (
          v_wallet.workspace_id, -v_expired_sub, 'sub', 'expire', null, null, null,
          v_total_after + v_expired_topup, null, 0, 'Langganan bulanan kadaluarsa'
        );
      end if;

      if v_expired_topup > 0 then
        insert into markimate.credit_ledger (
          workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
          balance_after, usage, cost_actual_idr, note
        ) values (
          v_wallet.workspace_id, -v_expired_topup, 'topup', 'expire', null, null, null,
          v_total_after, null, 0, 'Topup 365 hari kadaluarsa'
        );
      end if;

      v_total_expired := v_total_expired + v_expired_trial + v_expired_sub + v_expired_topup;
      v_wallets_affected := v_wallets_affected + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'wallets_affected', v_wallets_affected,
    'total_expired', v_total_expired
  );
end $$;

grant execute on function markimate.expire_buckets_atomic to service_role;
