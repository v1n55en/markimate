-- Migrasi 016: Stored Procedures untuk Mutasi Saldo Wallet Atomik (PRD F15 §7)
-- Skema: markimate
-- Sifat: Idempoten

-- 1. RPC: charge_wallet_atomic
create or replace function markimate.charge_wallet_atomic(
  p_workspace_id uuid,
  p_need integer,
  p_action_key text,
  p_ref_type text default null,
  p_ref_id text default null,
  p_usage jsonb default null,
  p_cost_actual_idr numeric default 0,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = markimate, public
as $$
declare
  v_wallet markimate.credit_wallets%rowtype;
  v_now timestamptz := now();
  v_trial_valid boolean;
  v_sub_valid boolean;
  v_topup_valid boolean;
  v_active_trial integer := 0;
  v_active_sub integer := 0;
  v_active_topup integer := 0;
  v_total_balance integer := 0;
  v_remaining integer := p_need;
  v_deduct_trial integer := 0;
  v_deduct_sub integer := 0;
  v_deduct_topup integer := 0;
  v_rolling_balance integer;
  v_existing_id uuid;
begin
  if p_need <= 0 then
    return jsonb_build_object('success', true, 'charged', 0, 'idempotent', false);
  end if;

  -- 1. Cek Idempotensi
  if p_ref_type is not null and p_ref_id is not null then
    select id into v_existing_id
    from markimate.credit_ledger
    where workspace_id = p_workspace_id
      and action_key = p_action_key
      and ref_type = p_ref_type
      and ref_id = p_ref_id
      and kind = 'usage'
    limit 1;

    if v_existing_id is not null then
      select * into v_wallet from markimate.credit_wallets where workspace_id = p_workspace_id;
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'charged', 0,
        'note', 'Idempoten: sudah pernah dipotong sebelumnya.'
      );
    end if;
  end if;

  -- 2. Kunci baris wallet (pessimistic lock)
  select * into v_wallet
  from markimate.credit_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    insert into markimate.credit_wallets (
      workspace_id, balance_trial, trial_expires_at,
      balance_sub, sub_expires_at, balance_topup, topup_expires_at, daily_cap
    ) values (
      p_workspace_id, 0, null, 0, null, 0, null, 500
    ) returning * into v_wallet;
  end if;

  -- 3. Hitung saldo aktif tiap bucket
  v_trial_valid := v_wallet.balance_trial > 0 and (v_wallet.trial_expires_at is null or v_wallet.trial_expires_at > v_now);
  v_sub_valid := v_wallet.balance_sub > 0 and (v_wallet.sub_expires_at is null or v_wallet.sub_expires_at > v_now);
  v_topup_valid := v_wallet.balance_topup > 0 and (v_wallet.topup_expires_at is null or v_wallet.topup_expires_at > v_now);

  if v_trial_valid then v_active_trial := v_wallet.balance_trial; end if;
  if v_sub_valid then v_active_sub := v_wallet.balance_sub; end if;
  if v_topup_valid then v_active_topup := v_wallet.balance_topup; end if;

  v_total_balance := v_active_trial + v_active_sub + v_active_topup;

  if v_total_balance < p_need then
    return jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CREDITS',
      'need', p_need,
      'have', v_total_balance
    );
  end if;

  -- 4. Alokasikan potongan: trial -> sub -> topup
  if v_trial_valid and v_remaining > 0 then
    v_deduct_trial := least(v_active_trial, v_remaining);
    v_remaining := v_remaining - v_deduct_trial;
  end if;

  if v_sub_valid and v_remaining > 0 then
    v_deduct_sub := least(v_active_sub, v_remaining);
    v_remaining := v_remaining - v_deduct_sub;
  end if;

  if v_topup_valid and v_remaining > 0 then
    v_deduct_topup := least(v_active_topup, v_remaining);
    v_remaining := v_remaining - v_deduct_topup;
  end if;

  -- 5. Update wallet
  update markimate.credit_wallets
  set balance_trial = balance_trial - v_deduct_trial,
      balance_sub = balance_sub - v_deduct_sub,
      balance_topup = balance_topup - v_deduct_topup,
      updated_at = now()
  where workspace_id = p_workspace_id;

  -- 6. Insert credit_ledger
  v_rolling_balance := v_total_balance;

  if v_deduct_trial > 0 then
    v_rolling_balance := v_rolling_balance - v_deduct_trial;
    insert into markimate.credit_ledger (
      workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
      balance_after, usage, cost_actual_idr, note
    ) values (
      p_workspace_id, -v_deduct_trial, 'trial', 'usage', p_action_key, p_ref_type, p_ref_id,
      v_rolling_balance, p_usage, p_cost_actual_idr, coalesce(p_note, 'Pemakaian ' || p_action_key)
    );
  end if;

  if v_deduct_sub > 0 then
    v_rolling_balance := v_rolling_balance - v_deduct_sub;
    insert into markimate.credit_ledger (
      workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
      balance_after, usage, cost_actual_idr, note
    ) values (
      p_workspace_id, -v_deduct_sub, 'sub', 'usage', p_action_key, p_ref_type, p_ref_id,
      v_rolling_balance, case when v_deduct_trial = 0 then p_usage else null end,
      case when v_deduct_trial = 0 then p_cost_actual_idr else 0 end,
      coalesce(p_note, 'Pemakaian ' || p_action_key)
    );
  end if;

  if v_deduct_topup > 0 then
    v_rolling_balance := v_rolling_balance - v_deduct_topup;
    insert into markimate.credit_ledger (
      workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
      balance_after, usage, cost_actual_idr, note
    ) values (
      p_workspace_id, -v_deduct_topup, 'topup', 'usage', p_action_key, p_ref_type, p_ref_id,
      v_rolling_balance, case when v_deduct_trial = 0 and v_deduct_sub = 0 then p_usage else null end,
      case when v_deduct_trial = 0 and v_deduct_sub = 0 then p_cost_actual_idr else 0 end,
      coalesce(p_note, 'Pemakaian ' || p_action_key)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'charged', p_need,
    'balance_after', v_rolling_balance,
    'deductions', jsonb_build_object('trial', v_deduct_trial, 'sub', v_deduct_sub, 'topup', v_deduct_topup)
  );
end $$;

grant execute on function markimate.charge_wallet_atomic to service_role;


-- 2. RPC: grant_wallet_atomic
create or replace function markimate.grant_wallet_atomic(
  p_workspace_id uuid,
  p_bucket text,
  p_amount integer,
  p_expires_at timestamptz,
  p_kind text,
  p_action_key text default null,
  p_ref_type text default null,
  p_ref_id text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = markimate, public
as $$
declare
  v_wallet markimate.credit_wallets%rowtype;
  v_existing_id uuid;
  v_total_after integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  if p_bucket not in ('trial', 'sub', 'topup') then
    raise exception 'Invalid bucket: %. Must be trial, sub, or topup.', p_bucket;
  end if;

  -- 1. Cek Idempotensi
  if p_ref_id is not null then
    select id into v_existing_id
    from markimate.credit_ledger
    where workspace_id = p_workspace_id
      and ref_id = p_ref_id
      and (kind = p_kind or (delta is not null and delta > 0))
    limit 1;

    if v_existing_id is not null then
      select (coalesce(balance_trial,0) + coalesce(balance_sub,0) + coalesce(balance_topup,0))
      into v_total_after from markimate.credit_wallets where workspace_id = p_workspace_id;
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'total_balance', coalesce(v_total_after, 0)
      );
    end if;
  end if;

  -- 2. Kunci baris wallet (pessimistic lock)
  select * into v_wallet
  from markimate.credit_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    insert into markimate.credit_wallets (
      workspace_id, balance_trial, trial_expires_at,
      balance_sub, sub_expires_at, balance_topup, topup_expires_at, daily_cap
    ) values (
      p_workspace_id, 0, null, 0, null, 0, null, 500
    ) returning * into v_wallet;
  end if;

  -- 3. Update saldo wallet sesuai bucket
  if p_bucket = 'trial' then
    v_wallet.balance_trial := v_wallet.balance_trial + p_amount;
    v_wallet.trial_expires_at := p_expires_at;
  elsif p_bucket = 'sub' then
    -- PRD F15: Set kuota paket bulanan (reset/overwrite, bukan akumulasi)
    v_wallet.balance_sub := p_amount;
    v_wallet.sub_expires_at := p_expires_at;
  elsif p_bucket = 'topup' then
    v_wallet.balance_topup := v_wallet.balance_topup + p_amount;
    v_wallet.topup_expires_at := p_expires_at;
  end if;

  v_total_after := v_wallet.balance_trial + v_wallet.balance_sub + v_wallet.balance_topup;

  update markimate.credit_wallets
  set balance_trial = v_wallet.balance_trial,
      trial_expires_at = v_wallet.trial_expires_at,
      balance_sub = v_wallet.balance_sub,
      sub_expires_at = v_wallet.sub_expires_at,
      balance_topup = v_wallet.balance_topup,
      topup_expires_at = v_wallet.topup_expires_at,
      updated_at = now()
  where workspace_id = p_workspace_id;

  -- 4. Catat ledger
  insert into markimate.credit_ledger (
    workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
    balance_after, usage, cost_actual_idr, note
  ) values (
    p_workspace_id, p_amount, p_bucket, p_kind,
    coalesce(p_action_key, case when p_kind = 'grant_trial' then 'auth.trial' when p_bucket = 'sub' then 'billing.sub' else 'billing.topup' end),
    p_ref_type, p_ref_id, v_total_after, null, 0,
    coalesce(p_note, 'Grant ' || p_bucket || ' +' || p_amount::text)
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'delta', p_amount,
    'total_balance', v_total_after
  );
end $$;

grant execute on function markimate.grant_wallet_atomic to service_role;


-- 3. RPC: apply_monthly_grant_atomic (PRD F15 Langkah 4 & §7)
create or replace function markimate.apply_monthly_grant_atomic(
  p_workspace_id uuid,
  p_period text,
  p_credits integer,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = markimate, public
as $$
declare
  v_wallet markimate.credit_wallets%rowtype;
  v_grant markimate.monthly_grants%rowtype;
  v_diff integer;
  v_total_after integer;
begin
  if p_credits <= 0 then
    return jsonb_build_object('success', true, 'granted', false, 'credits', 0);
  end if;

  -- 1. Kunci wallet
  select * into v_wallet
  from markimate.credit_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    insert into markimate.credit_wallets (
      workspace_id, balance_trial, trial_expires_at,
      balance_sub, sub_expires_at, balance_topup, topup_expires_at, daily_cap
    ) values (
      p_workspace_id, 0, null, 0, null, 0, null, 500
    ) returning * into v_wallet;
  end if;

  -- 2. Cek baris monthly_grants
  select * into v_grant
  from markimate.monthly_grants
  where workspace_id = p_workspace_id
    and period = p_period
  for update;

  if found then
    -- Jika sudah pernah di-grant dan kuota sekarang tidak bertambah
    if v_grant.credits >= p_credits then
      select (balance_trial + balance_sub + balance_topup) into v_total_after
      from markimate.credit_wallets where workspace_id = p_workspace_id;
      return jsonb_build_object(
        'success', true,
        'granted', false,
        'already_granted', true,
        'credits', v_grant.credits,
        'total_balance', v_total_after
      );
    end if;

    -- Upgrade kuota di tengah bulan (user baru beli modul lifetime tambahan)
    v_diff := p_credits - v_grant.credits;

    update markimate.monthly_grants
    set credits = p_credits
    where workspace_id = p_workspace_id
      and period = p_period;

    update markimate.credit_wallets
    set balance_sub = balance_sub + v_diff,
        sub_expires_at = p_expires_at,
        updated_at = now()
    where workspace_id = p_workspace_id
    returning * into v_wallet;

    v_total_after := v_wallet.balance_trial + v_wallet.balance_sub + v_wallet.balance_topup;

    insert into markimate.credit_ledger (
      workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
      balance_after, usage, cost_actual_idr, note
    ) values (
      p_workspace_id, v_diff, 'sub', 'grant_monthly', 'billing.monthly_grant',
      'monthly_grant', p_period || '_upgrade', v_total_after, null, 0,
      'Penambahan kuota modul baru periode ' || p_period || ' (+' || v_diff::text || ' credit)'
    );

    return jsonb_build_object(
      'success', true,
      'granted', true,
      'upgraded', true,
      'diff', v_diff,
      'credits', p_credits,
      'total_balance', v_total_after
    );
  else
    -- Belum pernah di-grant periode ini -> catat monthly_grants & set bucket sub
    insert into markimate.monthly_grants (
      workspace_id, period, credits, granted_at
    ) values (
      p_workspace_id, p_period, p_credits, now()
    );

    update markimate.credit_wallets
    set balance_sub = p_credits,
        sub_expires_at = p_expires_at,
        updated_at = now()
    where workspace_id = p_workspace_id
    returning * into v_wallet;

    v_total_after := v_wallet.balance_trial + v_wallet.balance_sub + v_wallet.balance_topup;

    insert into markimate.credit_ledger (
      workspace_id, delta, bucket, kind, action_key, ref_type, ref_id,
      balance_after, usage, cost_actual_idr, note
    ) values (
      p_workspace_id, p_credits, 'sub', 'grant_monthly', 'billing.monthly_grant',
      'monthly_grant', p_period, v_total_after, null, 0,
      'Kredit modul bulanan periode ' || p_period
    );

    return jsonb_build_object(
      'success', true,
      'granted', true,
      'credits', p_credits,
      'total_balance', v_total_after
    );
  end if;
end $$;

grant execute on function markimate.apply_monthly_grant_atomic to service_role;

insert into markimate.schema_migrations (version) values ('016') on conflict do nothing;
notify pgrst, 'reload schema';
