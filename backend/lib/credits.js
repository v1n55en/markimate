import { db } from '../db.js';
import { DEFAULT_PRICES, DEFAULT_COST_RATES } from '../scripts/maintenance/seed-credit-prices.js';
import { TRIAL_CONFIG } from './config.js';
import { isWorkspacePlatformAdmin } from './admin.js';

let cachedPrices = null;
let cachedPricesAt = 0;
let cachedRates = null;
let cachedRatesAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

export function clearCreditCache() {
  cachedPrices = null;
  cachedPricesAt = 0;
  cachedRates = null;
  cachedRatesAt = 0;
}

export function getWibDayRange(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const ymd = formatter.format(now);
  const startIso = new Date(`${ymd}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${ymd}T23:59:59.999+07:00`).toISOString();
  return { ymd, startIso, endIso };
}

export async function getPrices() {
  const now = Date.now();
  if (cachedPrices && now - cachedPricesAt < CACHE_TTL_MS) {
    return cachedPrices;
  }
  try {
    const rows = await db.findMany('credit_prices', {});
    const map = {};
    for (const p of DEFAULT_PRICES) {
      map[p.action_key] = { ...p };
    }
    for (const r of rows || []) {
      map[r.action_key] = {
        action_key: r.action_key,
        credits: Number(r.credits),
        label: r.label,
        active: r.active !== false,
        needs_review: !!r.needs_review
      };
    }
    cachedPrices = map;
    cachedPricesAt = now;
    return map;
  } catch {
    const map = {};
    for (const p of DEFAULT_PRICES) map[p.action_key] = { ...p };
    return map;
  }
}

export async function getCostRates() {
  const now = Date.now();
  if (cachedRates && now - cachedRatesAt < CACHE_TTL_MS) {
    return cachedRates;
  }
  try {
    const rows = await db.findMany('credit_cost_rates', {});
    const map = {};
    for (const r of DEFAULT_COST_RATES) {
      map[r.rate_key] = r.idr;
    }
    for (const row of rows || []) {
      map[row.rate_key] = Number(row.idr);
    }
    cachedRates = map;
    cachedRatesAt = now;
    return map;
  } catch {
    const map = {};
    for (const r of DEFAULT_COST_RATES) map[r.rate_key] = r.idr;
    return map;
  }
}

export function invalidateCreditCaches() {
  cachedPrices = null;
  cachedRates = null;
  cachedPricesAt = 0;
  cachedRatesAt = 0;
}

export async function costOf(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const rates = await getCostRates();
  const geminiIn = Number(usage.geminiIn || 0);
  const geminiOut = Number(usage.geminiOut || 0);
  const images = Number(usage.images || 0);
  const serpCalls = Number(usage.serpCalls || 0);
  const rapidCalls = Number(usage.rapidCalls || 0);

  const inRate = rates['gemini_in_per_1k'] ?? 4.95;
  const outRate = rates['gemini_out_per_1k'] ?? 41.25;
  const imgRate = rates['image'] ?? 554.4;
  const serpRate = rates['serp_call'] ?? 247.5;
  const rapidRate = rates['rapid_call'] ?? 16.5;

  const total =
    (geminiIn / 1000) * inRate +
    (geminiOut / 1000) * outRate +
    images * imgRate +
    serpCalls * serpRate +
    rapidCalls * rapidRate;

  return Math.round(total * 100) / 100;
}

export async function getWallet(workspaceId) {
  if (!workspaceId) throw new Error('workspaceId is required.');
  let wallet = await db.findOne('credit_wallets', { workspace_id: workspaceId });
  if (!wallet) {
    wallet = await db.insert('credit_wallets', {
      workspace_id: workspaceId,
      balance_trial: 0,
      trial_expires_at: null,
      balance_sub: 0,
      sub_expires_at: null,
      balance_topup: 0,
      topup_expires_at: null,
      daily_cap: 500
    });
  }

  // Bersihkan bucket yang sudah kadaluarsa
  await expireBuckets(workspaceId);
  wallet = await db.findOne('credit_wallets', { workspace_id: workspaceId });

  const now = new Date();
  const trialValid = wallet.balance_trial > 0 && (!wallet.trial_expires_at || new Date(wallet.trial_expires_at) > now);
  const subValid = wallet.balance_sub > 0 && (!wallet.sub_expires_at || new Date(wallet.sub_expires_at) > now);
  const topupValid = wallet.balance_topup > 0 && (!wallet.topup_expires_at || new Date(wallet.topup_expires_at) > now);

  const activeTrial = trialValid ? Number(wallet.balance_trial) : 0;
  const activeSub = subValid ? Number(wallet.balance_sub) : 0;
  const activeTopup = topupValid ? Number(wallet.balance_topup) : 0;
  const totalBalance = activeTrial + activeSub + activeTopup;

  return {
    wallet,
    totalBalance,
    activeBuckets: {
      trial: activeTrial,
      sub: activeSub,
      topup: activeTopup
    }
  };
}

export async function estimate(actionKey, qty = 1, extra = {}) {
  const prices = await getPrices();
  const item = prices[actionKey];
  const unitPrice = item ? item.credits : 0;
  let totalCredits = unitPrice * Math.max(1, Number(qty || 1));

  // Jika komposit seperti artikel dengan gambar tambahan
  if (actionKey === 'seo.article' && extra && extra.images) {
    const imgPrice = prices['seo.image']?.credits ?? 5;
    totalCredits += imgPrice * Number(extra.images);
  }

  return {
    actionKey,
    qty: Number(qty || 1),
    unitPrice,
    credits: totalCredits
  };
}

export async function getDailyUsage(workspaceId, now = new Date()) {
  const { startIso, endIso } = getWibDayRange(now);
  const ledgerRows = await db.findMany('credit_ledger', { workspace_id: workspaceId });
  let dailyUsed = 0;
  for (const row of ledgerRows || []) {
    if (row.kind === 'usage' && row.delta < 0) {
      const createdAt = row.created_at || '';
      if (createdAt >= startIso && createdAt <= endIso) {
        dailyUsed += Math.abs(Number(row.delta));
      }
    }
  }
  return dailyUsed;
}

export async function assertAffordable(workspaceId, actionKey, qty = 1, extra = {}) {
  const est = await estimate(actionKey, qty, extra);
  const need = est.credits;
  const { wallet, totalBalance } = await getWallet(workspaceId);

  if (need === 0) {
    return { affordable: true, need: 0, have: totalBalance, wallet };
  }

  // Bypass untuk akun admin platform (Unlimited)
  if (await isWorkspacePlatformAdmin(workspaceId)) {
    return { affordable: true, unlimited: true, need: 0, have: totalBalance, wallet };
  }

  // Cek daily cap pemakaian hari ini WIB
  const dailyUsed = await getDailyUsage(workspaceId);
  const cap = Number(wallet.daily_cap || 500);
  if (dailyUsed + need > cap) {
    const err = new Error(`Batas harian pemakaian credit tercapai (${cap} credit/hari).`);
    err.status = 402;
    err.code = 'DAILY_CAP';
    err.need = need;
    err.have = Math.max(0, cap - dailyUsed);
    err.dailyUsed = dailyUsed;
    err.dailyCap = cap;
    err.topupUrl = '/app/billing/credits';
    throw err;
  }

  // Cek saldo aktif
  if (totalBalance < need) {
    const err = new Error('Insufficient credits.');
    err.status = 402;
    err.code = 'INSUFFICIENT_CREDITS';
    err.need = need;
    err.have = totalBalance;
    err.topupUrl = '/app/billing/credits';
    throw err;
  }

  return { affordable: true, need, have: totalBalance, wallet };
}

export async function charge(workspaceId, actionKey, qty = 1, ref = {}, usage = null) {
  if (!workspaceId) throw new Error('workspaceId is required.');
  const refType = ref?.type || null;
  const refId = ref?.id ? String(ref.id) : null;

  // 1. Cek idempoten: jika aksi dan ref ini sudah pernah dipotong dengan kind 'usage', abaikan
  if (refType && refId) {
    const existing = await db.findMany('credit_ledger', {
      workspace_id: workspaceId,
      action_key: actionKey,
      ref_type: refType,
      ref_id: refId
    });
    const usageRows = (existing || []).filter(r => r.kind === 'usage');
    if (usageRows.length > 0) {
      return {
        charged: 0,
        idempotent: true,
        ledgerRows: usageRows,
        note: 'Idempoten: sudah pernah dipotong sebelumnya.'
      };
    }
  }

  const est = await estimate(actionKey, qty, ref?.extra);
  const need = est.credits;

  if (need === 0) {
    return { charged: 0, idempotent: false, ledgerRows: [] };
  }

  let { wallet, totalBalance } = await getWallet(workspaceId);

  // 2a. Bypass pemotongan saldo untuk workspace admin platform
  if (await isWorkspacePlatformAdmin(workspaceId)) {
    const costActual = await costOf(usage);
    const est = await estimate(actionKey, qty, ref?.extra);
    const estimatedCredits = est ? est.credits : 0;
    const usageObj = typeof usage === 'object' && usage !== null ? { ...usage } : {};
    usageObj.estimated_credits = estimatedCredits;

    const row = await db.insert('credit_ledger', {
      workspace_id: workspaceId,
      delta: 0,
      bucket: 'topup',
      kind: 'admin_usage',
      action_key: actionKey,
      ref_type: refType,
      ref_id: refId,
      balance_after: totalBalance,
      usage: usageObj,
      cost_actual_idr: costActual,
      note: ref?.note || `Pemakaian internal admin (${actionKey})`
    });
    return {
      charged: 0,
      unlimited: true,
      idempotent: false,
      ledgerRows: [row],
      balanceAfter: totalBalance,
      deductions: []
    };
  }

  const now = new Date();

  // 3. Potong berurutan: trial -> sub -> topup
  let remaining = need;
  let deductTrial = 0;
  let deductSub = 0;
  let deductTopup = 0;

  if (wallet.balance_trial > 0 && (!wallet.trial_expires_at || new Date(wallet.trial_expires_at) > now)) {
    deductTrial = Math.min(Number(wallet.balance_trial), remaining);
    remaining -= deductTrial;
  }
  if (remaining > 0 && wallet.balance_sub > 0 && (!wallet.sub_expires_at || new Date(wallet.sub_expires_at) > now)) {
    deductSub = Math.min(Number(wallet.balance_sub), remaining);
    remaining -= deductSub;
  }
  if (remaining > 0 && wallet.balance_topup > 0 && (!wallet.topup_expires_at || new Date(wallet.topup_expires_at) > now)) {
    deductTopup = Math.min(Number(wallet.balance_topup), remaining);
    remaining -= deductTopup;
  }

  if (remaining > 0) {
    const err = new Error('Insufficient credits.');
    err.status = 402;
    err.code = 'INSUFFICIENT_CREDITS';
    err.need = need;
    err.have = totalBalance;
    throw err;
  }

  const newBalanceTrial = Number(wallet.balance_trial) - deductTrial;
  const newBalanceSub = Number(wallet.balance_sub) - deductSub;
  const newBalanceTopup = Number(wallet.balance_topup) - deductTopup;

  await db.update(
    'credit_wallets',
    { workspace_id: workspaceId },
    {
      balance_trial: newBalanceTrial,
      balance_sub: newBalanceSub,
      balance_topup: newBalanceTopup
    }
  );

  const costActual = await costOf(usage);
  const ledgerRows = [];
  let rollingRemainingTotal = totalBalance;

  const deductions = [
    { bucket: 'trial', amount: deductTrial },
    { bucket: 'sub', amount: deductSub },
    { bucket: 'topup', amount: deductTopup }
  ].filter(d => d.amount > 0);

  // Tulis 1 baris ledger per bucket yang terpotong
  for (let i = 0; i < deductions.length; i++) {
    const d = deductions[i];
    rollingRemainingTotal -= d.amount;
    // Cantumkan cost actual dan usage pada baris pertama pemotongan
    const isFirst = i === 0;
    const row = await db.insert('credit_ledger', {
      workspace_id: workspaceId,
      delta: -d.amount,
      bucket: d.bucket,
      kind: 'usage',
      action_key: actionKey,
      ref_type: refType,
      ref_id: refId,
      balance_after: rollingRemainingTotal,
      usage: isFirst ? usage || null : null,
      cost_actual_idr: isFirst ? costActual : 0,
      note: ref?.note || `Pemakaian ${actionKey}`
    });
    ledgerRows.push(row);
  }

  return {
    charged: need,
    idempotent: false,
    ledgerRows,
    costActualIdr: costActual,
    balanceAfter: rollingRemainingTotal
  };
}

export async function recordFailedUsage(workspaceId, actionKey, usage = null, ref = {}) {
  if (!workspaceId) return null;
  const costActual = await costOf(usage);
  const { totalBalance } = await getWallet(workspaceId);

  const row = await db.insert('credit_ledger', {
    workspace_id: workspaceId,
    delta: 0,
    bucket: 'trial',
    kind: 'usage_failed',
    action_key: actionKey,
    ref_type: ref?.type || null,
    ref_id: ref?.id ? String(ref.id) : null,
    balance_after: totalBalance,
    usage: usage || null,
    cost_actual_idr: costActual,
    note: ref?.note || 'Aksi gagal / duplicate (biaya API dicatat)'
  });
  return row;
}

export async function grant(workspaceId, bucket, amount, expiresAt, kind = 'topup', note = '', ref = {}) {
  if (!workspaceId) throw new Error('workspaceId is required.');
  const amt = Number(amount || 0);
  if (amt <= 0) throw new Error('Credit amount must be positive.');
  if (!['trial', 'sub', 'topup'].includes(bucket)) {
    throw new Error(`Invalid bucket: ${bucket}. Must be 'trial' | 'sub' | 'topup'.`);
  }

  const { wallet } = await getWallet(workspaceId);
  const patch = {};
  const expIso = expiresAt instanceof Date ? expiresAt.toISOString() : (expiresAt || null);

  if (bucket === 'trial') {
    patch.balance_trial = Number(wallet.balance_trial || 0) + amt;
    patch.trial_expires_at = expIso;
  } else if (bucket === 'sub') {
    // PRD §4.3: balance_sub = credit paket (reset, bukan tambah)
    patch.balance_sub = amt;
    patch.sub_expires_at = expIso;
  } else if (bucket === 'topup') {
    patch.balance_topup = Number(wallet.balance_topup || 0) + amt;
    patch.topup_expires_at = expIso;
  }

  await db.update('credit_wallets', { workspace_id: workspaceId }, patch);
  const { totalBalance } = await getWallet(workspaceId);

  const defaultActionKey = kind === 'grant_trial' ? 'auth.trial' : (bucket === 'sub' ? 'billing.sub' : 'billing.topup');

  const ledgerRow = await db.insert('credit_ledger', {
    workspace_id: workspaceId,
    delta: amt,
    bucket,
    kind,
    action_key: ref.actionKey || defaultActionKey,
    ref_type: ref.refType || (kind === 'grant_trial' ? 'trial' : null),
    ref_id: ref.refId || null,
    balance_after: totalBalance,
    usage: null,
    cost_actual_idr: 0,
    note: note || `Grant ${bucket} +${amt}`
  });

  return { wallet: patch, ledgerRow, totalBalance };
}

export async function expireBuckets(workspaceId = null) {
  const now = new Date();
  const wallets = workspaceId
    ? await db.findMany('credit_wallets', { workspace_id: workspaceId })
    : await db.findMany('credit_wallets', {});

  for (const w of wallets || []) {
    let changed = false;
    const patch = {};

    // Cek trial
    if (w.balance_trial > 0 && w.trial_expires_at && new Date(w.trial_expires_at) <= now) {
      const expiredAmt = Number(w.balance_trial);
      patch.balance_trial = 0;
      changed = true;
      const currentTotal = (Number(w.balance_sub) || 0) + (Number(w.balance_topup) || 0);
      await db.insert('credit_ledger', {
        workspace_id: w.workspace_id,
        delta: -expiredAmt,
        bucket: 'trial',
        kind: 'expire',
        action_key: null,
        ref_type: null,
        ref_id: null,
        balance_after: currentTotal,
        cost_actual_idr: 0,
        note: 'Trial 7 hari kadaluarsa'
      });
    }

    // Cek subscription
    if (w.balance_sub > 0 && w.sub_expires_at && new Date(w.sub_expires_at) <= now) {
      const expiredAmt = Number(w.balance_sub);
      patch.balance_sub = 0;
      changed = true;
      const currentTotal = (patch.balance_trial ?? Number(w.balance_trial) ?? 0) + (Number(w.balance_topup) || 0);
      await db.insert('credit_ledger', {
        workspace_id: w.workspace_id,
        delta: -expiredAmt,
        bucket: 'sub',
        kind: 'expire',
        action_key: null,
        ref_type: null,
        ref_id: null,
        balance_after: currentTotal,
        cost_actual_idr: 0,
        note: 'Langganan bulanan kadaluarsa'
      });
    }

    // Cek topup
    if (w.balance_topup > 0 && w.topup_expires_at && new Date(w.topup_expires_at) <= now) {
      const expiredAmt = Number(w.balance_topup);
      patch.balance_topup = 0;
      changed = true;
      const currentTotal = (patch.balance_trial ?? Number(w.balance_trial) ?? 0) + (patch.balance_sub ?? Number(w.balance_sub) ?? 0);
      await db.insert('credit_ledger', {
        workspace_id: w.workspace_id,
        delta: -expiredAmt,
        bucket: 'topup',
        kind: 'expire',
        action_key: null,
        ref_type: null,
        ref_id: null,
        balance_after: currentTotal,
        cost_actual_idr: 0,
        note: 'Topup 365 hari kadaluarsa'
      });
    }

    if (changed) {
      await db.update('credit_wallets', { workspace_id: w.workspace_id }, patch);
    }
  }
}

export async function grantTrialIfEligible(workspaceId, email, cmsDomain = null) {
  if (!email || !workspaceId) return null;
  const em = String(email).trim().toLowerCase();

  const existing = await db.findOne('credit_trials', { email: em });
  if (existing) {
    return { granted: false, reason: 'Trial sudah pernah diklaim untuk email ini.' };
  }

  const trialCredits = TRIAL_CONFIG.credits;
  const trialDays = TRIAL_CONFIG.days;
  const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  await grant(workspaceId, 'trial', trialCredits, expiresAt, 'grant_trial', `Free trial ${trialDays} hari (${trialCredits} credit)`);
  await db.insert('credit_trials', {
    email: em,
    workspace_id: workspaceId,
    granted_at: new Date().toISOString(),
    cms_domain: cmsDomain || null
  });

  return {
    granted: true,
    credits: trialCredits,
    days: trialDays,
    expiresAt
  };
}

