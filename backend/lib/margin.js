import { db } from '../db.js';
import { getPrices, invalidateCreditCaches } from './credits.js';
import { sendEmail, recordAlertSent, hasAlertBeenSent } from './notifications.js';
import { SYSTEM_WORKSPACE_ID } from './config.js';

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/**
 * Menghitung rekapitulasi pemakaian & margin platform per bulan (PRD §2b & §4.4)
 */
export async function calculateUsageAndMargin(monthStr = null) {
  const currentMonth = monthStr || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const prices = await getPrices();
  const allLedger = await db.findMany('credit_ledger', {});

  // Filter baris ledger di bulan yang dipilih
  const monthRows = (allLedger || []).filter(r => r.created_at && r.created_at.startsWith(currentMonth));

  const byAction = {};

  // Inisialisasi setiap aksi dari credit_prices
  for (const [key, p] of Object.entries(prices)) {
    byAction[key] = {
      action_key: key,
      label: p.label || key,
      price_credits: p.credits,
      needs_review: !!p.needs_review,
      actions_count: 0,
      failed_count: 0,
      credits_used: 0,
      revenue_idr: 0,
      cost_actual_idr: 0,
      margin_pct: 100
    };
  }

  let totalCreditsUsed = 0;
  let totalRevenueIdr = 0;
  let totalCostActualIdr = 0;

  const internalAdminUsage = {
    label: 'Pemakaian internal 3Our',
    actions_count: 0,
    cost_actual_idr: 0,
    estimated_credits: 0,
    by_action: {}
  };

  for (const r of monthRows) {
    const actKey = r.action_key;
    if (!actKey) continue;
    const cost = Number(r.cost_actual_idr || 0);

    // Pemakaian internal admin (kind: admin_usage) dipisahkan dari margin bisnis
    if (r.kind === 'admin_usage') {
      internalAdminUsage.actions_count += 1;
      internalAdminUsage.cost_actual_idr += cost;
      const estCr = r.usage?.estimated_credits || prices[actKey]?.credits || 0;
      internalAdminUsage.estimated_credits += estCr;
      if (!internalAdminUsage.by_action[actKey]) {
        internalAdminUsage.by_action[actKey] = {
          action_key: actKey,
          label: prices[actKey]?.label || actKey,
          actions_count: 0,
          cost_actual_idr: 0,
          estimated_credits: 0
        };
      }
      internalAdminUsage.by_action[actKey].actions_count += 1;
      internalAdminUsage.by_action[actKey].cost_actual_idr += cost;
      internalAdminUsage.by_action[actKey].estimated_credits += estCr;
      continue;
    }

    if (!byAction[actKey]) {
      byAction[actKey] = {
        action_key: actKey,
        label: actKey,
        price_credits: 0,
        needs_review: false,
        actions_count: 0,
        failed_count: 0,
        credits_used: 0,
        revenue_idr: 0,
        cost_actual_idr: 0,
        margin_pct: 100
      };
    }

    const item = byAction[actKey];

    if (r.delta < 0) {
      const cr = Math.abs(r.delta);
      item.actions_count += 1;
      item.credits_used += cr;
      item.revenue_idr += cr * 1000;
      item.cost_actual_idr += cost;

      totalCreditsUsed += cr;
      totalRevenueIdr += cr * 1000;
      totalCostActualIdr += cost;
    } else if (r.kind === 'usage_failed') {
      item.failed_count += 1;
      item.cost_actual_idr += cost;
      totalCostActualIdr += cost;
    }
  }

  // Hitung persentase margin
  for (const item of Object.values(byAction)) {
    item.cost_actual_idr = Math.round(item.cost_actual_idr * 100) / 100;
    if (item.revenue_idr > 0) {
      item.margin_pct = Math.round(((item.revenue_idr - item.cost_actual_idr) / item.revenue_idr) * 100);
    } else {
      item.margin_pct = item.cost_actual_idr > 0 ? 0 : 100;
    }
  }

  internalAdminUsage.cost_actual_idr = Math.round(internalAdminUsage.cost_actual_idr * 100) / 100;
  for (const item of Object.values(internalAdminUsage.by_action)) {
    item.cost_actual_idr = Math.round(item.cost_actual_idr * 100) / 100;
  }

  totalCostActualIdr = Math.round(totalCostActualIdr * 100) / 100;
  const overallMarginPct = totalRevenueIdr > 0
    ? Math.round(((totalRevenueIdr - totalCostActualIdr) / totalRevenueIdr) * 100)
    : 100;

  let lifetimeLiability = null;
  let revenueMix = null;
  try {
    const { getLifetimeLiability, getRevenueMix } = await import('./admin-reports.js');
    [lifetimeLiability, revenueMix] = await Promise.all([
      getLifetimeLiability(currentMonth),
      getRevenueMix(currentMonth)
    ]);
  } catch (err) {
    console.error('Error calculating lifetime liability or revenue mix:', err);
  }

  return {
    month: currentMonth,
    actions: Object.values(byAction),
    totals: {
      total_credits_used: totalCreditsUsed,
      total_revenue_idr: totalRevenueIdr,
      total_cost_actual_idr: totalCostActualIdr,
      overall_margin_pct: overallMarginPct
    },
    internal_admin_usage: internalAdminUsage,
    lifetime_liability: lifetimeLiability,
    revenue_mix: revenueMix
  };
}

/**
 * Menghitung margin 7 hari terakhir per aksi untuk pengawas margin otomatis (PRD §2b item 5)
 */
export async function calculate7DayMargins() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const prices = await getPrices();
  const allLedger = await db.findMany('credit_ledger', {});

  const rows7d = (allLedger || []).filter(r => r.created_at && r.created_at >= sevenDaysAgo);
  const byAction = {};

  for (const key of Object.keys(prices)) {
    byAction[key] = {
      action_key: key,
      actions_count: 0,
      credits_used: 0,
      revenue_idr: 0,
      cost_actual_idr: 0,
      margin_pct: 100
    };
  }

  for (const r of rows7d) {
    const actKey = r.action_key;
    if (!actKey) continue;
    if (!byAction[actKey]) {
      byAction[actKey] = {
        action_key: actKey,
        actions_count: 0,
        credits_used: 0,
        revenue_idr: 0,
        cost_actual_idr: 0,
        margin_pct: 100
      };
    }
    const item = byAction[actKey];
    const cost = Number(r.cost_actual_idr || 0);

    if (r.delta < 0) {
      const cr = Math.abs(r.delta);
      item.actions_count += 1;
      item.credits_used += cr;
      item.revenue_idr += cr * 1000;
      item.cost_actual_idr += cost;
    } else if (r.kind === 'usage_failed') {
      item.cost_actual_idr += cost;
    }
  }

  for (const item of Object.values(byAction)) {
    item.cost_actual_idr = Math.round(item.cost_actual_idr * 100) / 100;
    if (item.revenue_idr > 0) {
      item.margin_pct = Math.round(((item.revenue_idr - item.cost_actual_idr) / item.revenue_idr) * 100);
    } else {
      item.margin_pct = item.cost_actual_idr > 0 ? 0 : 100;
    }
  }

  return byAction;
}

/**
 * Pengawas Margin Otomatis (PRD §2b item 5 & item 6):
 * 1. Menghitung margin 7 hari terakhir per aksi. Bila margin < 60% -> tandai needs_review=true + notifikasi admin.
 * 2. Circuit Breaker Global: Bila total biaya API nyata platform hari ini > COST_DAILY_ALERT_IDR -> notifikasi admin.
 */
export async function checkMarginSentinel() {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@3our.asia';
  const todayDate = new Date().toISOString().slice(0, 10);
  const alertsTriggered = [];

  // 1. Cek margin 7 hari per action (< 60%)
  const margins7d = await calculate7DayMargins();

  for (const [actionKey, stats] of Object.entries(margins7d)) {
    // Hanya periksa jika ada pemakaian aksi dalam 7 hari terakhir
    if (stats.actions_count >= 1 && stats.margin_pct < 60) {
      // Tandai credit_prices needs_review = true
      const existingPrice = await db.findOne('credit_prices', { action_key: actionKey });
      if (existingPrice) {
        await db.update('credit_prices', { action_key: actionKey }, {
          needs_review: true,
          updated_at: new Date().toISOString()
        });
        invalidateCreditCaches();
      }

      const periodKey = `margin_low_${actionKey}_${todayDate}`;
      const alreadySent = await hasAlertBeenSent(SYSTEM_WORKSPACE_ID, 'margin_low', periodKey);

      if (!alreadySent) {
        const subject = `[ALERT MARGIN] Aksi ${actionKey} memiliki margin < 60% (${stats.margin_pct}%)`;
        const text = `Perhatian Tim Admin 3Our,\n\nAksi '${actionKey}' dalam 7 hari terakhir menghasilkan margin ${stats.margin_pct}% (di bawah ambang batas aman 60%).\n\nDetail 7 Hari:\n- Jumlah Aksi: ${stats.actions_count}\n- Revenue Credit: Rp${stats.revenue_idr.toLocaleString('id-ID')}\n- Biaya Nyata API (COGS): Rp${stats.cost_actual_idr.toLocaleString('id-ID')}\n\nStatus 'needs_review' telah diaktifkan pada credit_prices. Silakan tinjau harga aksi atau tarif vendor di dashboard admin.\n\nSistem Penjaga Margin Markimate`;

        await sendEmail({
          to: adminEmail,
          subject,
          text,
          tag: 'margin_low',
          metadata: stats
        });

        await recordAlertSent(SYSTEM_WORKSPACE_ID, 'margin_low', adminEmail, periodKey, stats);
        alertsTriggered.push({ type: 'margin_low', actionKey, marginPct: stats.margin_pct });
      }
    }
  }

  // 2. Circuit Breaker Global: Total biaya API hari ini > COST_DAILY_ALERT_IDR
  const costLimit = Number(process.env.COST_DAILY_ALERT_IDR || 500000);
  const allLedger = await db.findMany('credit_ledger', {});
  const todayRows = (allLedger || []).filter(r => r.created_at && r.created_at.startsWith(todayDate));
  const totalCostToday = todayRows.reduce((sum, r) => sum + Number(r.cost_actual_idr || 0), 0);

  if (totalCostToday > costLimit) {
    const periodKey = `cost_high_${todayDate}`;
    const alreadySent = await hasAlertBeenSent(SYSTEM_WORKSPACE_ID, 'cost_high', periodKey);

    if (!alreadySent) {
      const subject = `[CIRCUIT BREAKER] Biaya API harian melebihi ambang batas: Rp${totalCostToday.toLocaleString('id-ID')}`;
      const text = `Perhatian Tim Admin 3Our,\n\nTotal pengeluaran biaya API nyata platform hari ini (${todayDate}) telah mencapai Rp${totalCostToday.toLocaleString('id-ID')}, melampaui batas peringatan Rp${costLimit.toLocaleString('id-ID')}.\n\nSilakan periksa aktivitas akun di dashboard admin untuk memastikan tidak ada loop retry atau aktivitas anomali.\n\nSistem Penjaga Margin Markimate`;

      await sendEmail({
        to: adminEmail,
        subject,
        text,
        tag: 'cost_high',
        metadata: { totalCostToday, costLimit }
      });

      await recordAlertSent(SYSTEM_WORKSPACE_ID, 'cost_high', adminEmail, periodKey, { totalCostToday, costLimit });
      alertsTriggered.push({ type: 'cost_high', totalCostToday, costLimit });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    alertsTriggered
  };
}
