import { db } from '../db.js';
import { DEFAULT_PRICES, DEFAULT_COST_RATES } from './credit-defaults.js';
import { TRIAL_CONFIG, SYSTEM_WORKSPACE_ID } from './config.js';
import { isWorkspacePlatformAdmin } from './admin.js';
import { hasAlertBeenSent, recordAlertSent, sendEmail } from './notifications.js';

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

  // PRD F15: Lazy grant kuota bulanan modul lifetime
  try {
    await ensureMonthlyGrant(workspaceId);
  } catch (_) {}

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

  // Jika extra.length diberikan, sesuaikan actionKey artikel SEO (PRD F6b §3.2)
  let resolvedActionKey = actionKey || 'seo.article';
  if (extra && extra.length) {
    const { ARTICLE_LENGTHS } = await import('./article-options.js');
    if (ARTICLE_LENGTHS[extra.length]) {
      resolvedActionKey = ARTICLE_LENGTHS[extra.length].actionKey;
    }
  }

  const item = prices[resolvedActionKey] || prices[actionKey];
  const unitPrice = item ? item.credits : 0;
  let totalCredits = unitPrice * Math.max(1, Number(qty || 1));

  // Jika komposit seperti artikel dengan gambar tambahan (PRD §4.2 & PRD F6b §3.2)
  if (resolvedActionKey.startsWith('seo.article') && extra && extra.images !== undefined) {
    const imgPrice = prices['seo.image']?.credits ?? 5;
    const imgCount = Math.max(0, Number(extra.images || 0));
    totalCredits += imgPrice * imgCount;
  }

  return {
    actionKey: resolvedActionKey,
    qty: Number(qty || 1),
    unitPrice,
    credits: totalCredits,
    ...(extra && extra.length ? { length: extra.length } : {}),
    ...(extra && extra.images !== undefined ? { images: Number(extra.images || 0) } : {})
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

  // PRD F15: Pastikan kredit bulanan modul lifetime sudah ter-grant sebelum pemotongan
  try {
    await ensureMonthlyGrant(workspaceId);
  } catch (_) {}

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

  const costActual = await costOf(usage);

  const res = await db.rpc('charge_wallet_atomic', {
    p_workspace_id: workspaceId,
    p_need: need,
    p_action_key: actionKey,
    p_ref_type: refType,
    p_ref_id: refId,
    p_usage: usage || null,
    p_cost_actual_idr: costActual,
    p_note: ref?.note || `Pemakaian ${actionKey}`
  });

  if (!res.success) {
    if (res.error === 'INSUFFICIENT_CREDITS') {
      const err = new Error('Insufficient credits.');
      err.status = 402;
      err.code = 'INSUFFICIENT_CREDITS';
      err.need = res.need || need;
      err.have = res.have ?? totalBalance;
      err.topupUrl = '/app/billing/credits';
      throw err;
    }
    throw new Error(res.error || 'Gagal memotong credit.');
  }

  if (res.idempotent) {
    return {
      charged: 0,
      idempotent: true,
      ledgerRows: res.ledgerRows || [],
      note: res.note || 'Idempoten: sudah pernah dipotong sebelumnya.'
    };
  }

  return {
    charged: need,
    idempotent: false,
    ledgerRows: res.ledgerRows || [],
    costActualIdr: costActual,
    balanceAfter: res.balance_after
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

  const expIso = expiresAt instanceof Date ? expiresAt.toISOString() : (expiresAt || null);
  const defaultActionKey = kind === 'grant_trial' ? 'auth.trial' : (bucket === 'sub' ? 'billing.sub' : 'billing.topup');

  const res = await db.rpc('grant_wallet_atomic', {
    p_workspace_id: workspaceId,
    p_bucket: bucket,
    p_amount: amt,
    p_expires_at: expIso,
    p_kind: kind,
    p_action_key: ref?.actionKey || defaultActionKey,
    p_ref_type: ref?.refType || (kind === 'grant_trial' ? 'trial' : null),
    p_ref_id: ref?.refId ? String(ref.refId) : null,
    p_note: note || `Grant ${bucket} +${amt}`
  });

  if (res.idempotent) {
    const { wallet, totalBalance } = await getWallet(workspaceId);
    return {
      wallet,
      ledgerRow: res.ledgerRow,
      totalBalance: res.total_balance || totalBalance,
      idempotent: true
    };
  }

  return {
    wallet: res.wallet,
    ledgerRow: res.ledgerRow,
    totalBalance: res.total_balance
  };
}

export async function ensureMonthlyGrant(workspaceId, now = new Date()) {
  if (!workspaceId) return { granted: false, credits: 0 };

  // 1. Cek apakah admin platform (unlimited, tidak perlu grant bulanan)
  if (await isWorkspacePlatformAdmin(workspaceId)) {
    return { granted: false, admin: true, credits: 0 };
  }

  // 2. Tentukan periode YYYY-MM WIB dan akhir bulan WIB
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const ymd = formatter.format(now); // 'YYYY-MM-DD'
  const period = ymd.slice(0, 7); // 'YYYY-MM'

  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const expiresAt = new Date(`${period}-${String(lastDay).padStart(2, '0')}T23:59:59.999+07:00`).toISOString();

  // 3. Hitung total kuota bulanan dari modul lifetime yang dimiliki
  const entitlements = await db.findMany('module_entitlements', { workspace_id: workspaceId });
  const activeModules = (entitlements || []).filter(e => e.source === 'lifetime');

  const { MODULES } = await import('./catalog.js');
  let totalCredits = 0;
  for (const ent of activeModules) {
    const modConfig = MODULES[ent.module];
    if (modConfig && modConfig.monthlyCredits) {
      totalCredits += Number(modConfig.monthlyCredits);
    }
  }

  if (totalCredits <= 0) {
    return { granted: false, credits: 0, period };
  }

  // 4. Panggil RPC apply_monthly_grant_atomic
  const res = await db.rpc('apply_monthly_grant_atomic', {
    p_workspace_id: workspaceId,
    p_period: period,
    p_credits: totalCredits,
    p_expires_at: expiresAt
  });

  return {
    granted: !!res.granted,
    alreadyGranted: !!res.already_granted,
    upgraded: !!res.upgraded,
    diff: res.diff,
    credits: res.credits || totalCredits,
    period,
    expiresAt
  };
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

export async function grantTrialIfEligible(workspaceId, email, cmsDomain = null, { googleSub = null, clientIp = null } = {}) {
  if (!email || !workspaceId) return null;
  const em = String(email).trim().toLowerCase();

  // 1. Pengaman: 1x per email terverifikasi (PRD F15 §1)
  const existingEmail = await db.findOne('credit_trials', { email: em });
  if (existingEmail) {
    return { granted: false, reason: 'Trial sudah pernah diklaim untuk email ini.' };
  }

  // 2. Pengaman: 1x per workspace (PRD F15 §1)
  const existingWs = await db.findOne('credit_trials', { workspace_id: workspaceId });
  if (existingWs) {
    return { granted: false, reason: 'Trial sudah pernah diklaim untuk workspace ini.' };
  }

  // 3. Pengaman: 1x per akun Google (PRD F15 §1)
  const account = await db.findOne('accounts', { email: em });
  const targetSub = googleSub || account?.google_sub;
  if (targetSub) {
    const sameGoogleAccounts = await db.findMany('accounts', { google_sub: targetSub });
    for (const acc of (sameGoogleAccounts || [])) {
      if (acc.email && acc.email.toLowerCase() !== em) {
        const trialByOtherAcc = await db.findOne('credit_trials', { email: acc.email.toLowerCase() });
        if (trialByOtherAcc) {
          return { granted: false, reason: 'Trial sudah pernah diklaim untuk akun Google ini.' };
        }
      }
      if (acc.id && acc.id !== workspaceId) {
        const trialByOtherWs = await db.findOne('credit_trials', { workspace_id: acc.id });
        if (trialByOtherWs) {
          return { granted: false, reason: 'Trial sudah pernah diklaim untuk akun Google ini.' };
        }
      }
    }
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

  // 4. Catat audit log dan alert admin kalau ada >5 pendaftaran trial dari IP yang sama dalam 24 jam (PRD F15 §1)
  if (clientIp) {
    try {
      await db.insert('audit_logs', {
        user_id: account?.id || null,
        workspace_id: workspaceId,
        action: 'trial_granted',
        ip: clientIp,
        meta: { email: em, days: trialDays, credits: trialCredits },
        created_at: new Date().toISOString()
      });

      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const ipLogs = await db.findMany('audit_logs', { action: 'trial_granted', ip: clientIp });
      const recentFromIp = (ipLogs || []).filter(l => l.created_at >= since24h);
      if (recentFromIp.length > 5) {
        const dateKey = new Date().toISOString().slice(0, 10);
        const alertPeriodKey = `${clientIp}_${dateKey}`;
        const alreadyAlerted = await hasAlertBeenSent(SYSTEM_WORKSPACE_ID, 'trial_abuse_ip', alertPeriodKey);
        if (!alreadyAlerted) {
          const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@markimate.com';
          await recordAlertSent(SYSTEM_WORKSPACE_ID, 'trial_abuse_ip', adminEmail, alertPeriodKey, {
            ip: clientIp,
            count: recentFromIp.length
          });
          try {
            await sendEmail({
              to: adminEmail,
              subject: `[Markimate Alert] Terdeteksi >5 Pendaftaran Trial dari IP ${clientIp}`,
              text: `Peringatan Keamanan:\n\nTerdeteksi ${recentFromIp.length} pendaftaran trial dari IP ${clientIp} dalam 24 jam terakhir.\n\nHarap periksa kemungkinan penyalahgunaan (trial abuse / multi-account).`,
              tag: 'trial_abuse_ip'
            });
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[Trial Security] Error checking IP abuse:', err.message);
    }
  }

  return {
    granted: true,
    credits: trialCredits,
    days: trialDays,
    expiresAt
  };
}

