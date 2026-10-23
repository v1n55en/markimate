import { db } from '../db.js';
import { MODULES } from './catalog.js';
import { isWorkspacePlatformAdmin } from './admin.js';

/**
 * Biaya API vendor nyata per credit (PRD F15 §2):
 * - SEO Specialist: Rp56 / credit (Artikel SEO + 3 gambar: 75 credit = Rp4.221)
 * - Ads Report: Rp4 / credit (Laporan bulanan: 400 credit = Rp1.584)
 * - Ads Creative Spy: Rp62 / credit (Scan kompetitor: 40 credit = Rp2.475)
 */
export const MODULE_REAL_COGS = {
  seo: 56,
  ads_report: 4,
  ads_spy: 62
};

/**
 * Buffer biaya perencanaan PRD §2 (buffer ×1,6 kenaikan vendor/retry): Rp100/credit
 */
export const BUFFER_COGS_PER_CREDIT = 100;

function getWibPeriod(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const ymd = formatter.format(date);
  return ymd.slice(0, 7);
}

/**
 * Menghitung liabilitas kredit bulanan modul lifetime (PRD F15 §3.2 & Langkah 8)
 * Rumus: Jumlah pemilik lifetime aktif bulan ini × kuota × biaya per credit nyata
 */
export async function getLifetimeLiability(monthStr = null) {
  const period = monthStr || getWibPeriod();

  // 1. Ambil seluruh entitlement lifetime
  const allEntitlements = await db.findMany('module_entitlements', {});
  const lifetimeEntitlements = (allEntitlements || []).filter(
    (e) => e.source === 'lifetime' && e.active !== false
  );

  // 2. Ambil data grant bulanan pada periode ini
  const allMonthlyGrants = await db.findMany('monthly_grants', {});
  const monthGrants = (allMonthlyGrants || []).filter((g) => g.period === period);
  const grantedWsSet = new Set(monthGrants.map((g) => g.workspace_id));
  const grantedCreditsMap = new Map(monthGrants.map((g) => [g.workspace_id, g.credits]));

  // 3. Ambil data aktivitas ledger bulan ini
  const allLedger = await db.findMany('credit_ledger', {});
  const monthLedger = (allLedger || []).filter(
    (r) => r.created_at && r.created_at.startsWith(period)
  );
  const activeLedgerWsSet = new Set(monthLedger.map((r) => r.workspace_id));

  // Workspace dianggap aktif jika ada grant bulan ini atau mutasi ledger bulan ini
  const activeWsSet = new Set([...grantedWsSet, ...activeLedgerWsSet]);

  // Pisahkan workspace admin platform (unlimited/internal 3Our, zero liability komersial)
  const nonAdminLifetimeEntitlements = [];
  const adminLifetimeEntitlements = [];

  for (const ent of lifetimeEntitlements) {
    const isAdmin = await isWorkspacePlatformAdmin(ent.workspace_id);
    if (isAdmin) {
      adminLifetimeEntitlements.push(ent);
    } else {
      nonAdminLifetimeEntitlements.push(ent);
    }
  }

  // 4. Hitung rincian per modul
  const byModule = {};
  const totalActiveWsOwners = new Set();
  const totalWsOwners = new Set();

  for (const [modKey, modConfig] of Object.entries(MODULES)) {
    const modEnts = nonAdminLifetimeEntitlements.filter((e) => e.module === modKey);
    const modWsOwners = Array.from(new Set(modEnts.map((e) => e.workspace_id)));
    const activeModWsOwners = modWsOwners.filter((wsId) => activeWsSet.has(wsId));

    modWsOwners.forEach((id) => totalWsOwners.add(id));
    activeModWsOwners.forEach((id) => totalActiveWsOwners.add(id));

    const quotaPerOwner = Number(modConfig.monthlyCredits ?? (modKey === 'ads_report' ? 400 : 100));
    const cogsReal = MODULE_REAL_COGS[modKey] || 50;
    const cogsBuffer = BUFFER_COGS_PER_CREDIT;

    const activeCommittedCredits = activeModWsOwners.length * quotaPerOwner;
    const totalCommittedCredits = modWsOwners.length * quotaPerOwner;

    byModule[modKey] = {
      module: modKey,
      name: modConfig.name,
      total_owners: modWsOwners.length,
      active_owners: activeModWsOwners.length,
      monthly_credits_per_owner: quotaPerOwner,
      cogs_per_credit_real: cogsReal,
      cogs_per_credit_buffer: cogsBuffer,
      active_committed_credits: activeCommittedCredits,
      total_committed_credits: totalCommittedCredits,
      liability_real_idr: activeCommittedCredits * cogsReal,
      liability_buffer_idr: activeCommittedCredits * cogsBuffer,
      max_liability_real_idr: totalCommittedCredits * cogsReal,
      max_liability_buffer_idr: totalCommittedCredits * cogsBuffer
    };
  }

  // 5. Total agregat
  let totalActiveCommittedCredits = 0;
  let totalMaxCommittedCredits = 0;
  let totalLiabilityRealIdr = 0;
  let totalLiabilityBufferIdr = 0;
  let totalMaxLiabilityRealIdr = 0;
  let totalMaxLiabilityBufferIdr = 0;

  for (const item of Object.values(byModule)) {
    totalActiveCommittedCredits += item.active_committed_credits;
    totalMaxCommittedCredits += item.total_committed_credits;
    totalLiabilityRealIdr += item.liability_real_idr;
    totalLiabilityBufferIdr += item.liability_buffer_idr;
    totalMaxLiabilityRealIdr += item.max_liability_real_idr;
    totalMaxLiabilityBufferIdr += item.max_liability_buffer_idr;
  }

  let actualGrantedCreditsThisMonth = 0;
  for (const g of monthGrants) {
    actualGrantedCreditsThisMonth += Number(g.credits || 0);
  }

  return {
    period,
    summary: {
      total_lifetime_owners: totalWsOwners.size,
      active_lifetime_owners: totalActiveWsOwners.size,
      total_active_committed_credits: totalActiveCommittedCredits,
      total_max_committed_credits: totalMaxCommittedCredits,
      total_liability_real_idr: totalLiabilityRealIdr,
      total_liability_buffer_idr: totalLiabilityBufferIdr,
      total_max_liability_real_idr: totalMaxLiabilityRealIdr,
      total_max_liability_buffer_idr: totalMaxLiabilityBufferIdr,
      actual_granted_credits_this_month: actualGrantedCreditsThisMonth,
      internal_admin_workspaces: new Set(adminLifetimeEntitlements.map((e) => e.workspace_id)).size
    },
    by_module: byModule
  };
}

/**
 * Menghitung bauran pendapatan (Revenue Mix) antara lisensi lifetime vs top-up (PRD F15 §3.2 & Langkah 8)
 */
export async function getRevenueMix(monthStr = null) {
  const period = monthStr || getWibPeriod();

  const allPayments = await db.findMany('payments', {});
  const paidPayments = (allPayments || []).filter((p) => p.status === 'paid');

  function aggregate(paymentsList) {
    let moduleRevenue = 0;
    let moduleCount = 0;
    let topupRevenue = 0;
    let topupCount = 0;
    let subRevenue = 0;
    let subCount = 0;

    for (const p of paymentsList) {
      const amt = Number(p.amount || 0);
      if (p.kind === 'module') {
        moduleRevenue += amt;
        moduleCount += 1;
      } else if (p.kind === 'topup') {
        topupRevenue += amt;
        topupCount += 1;
      } else if (p.kind === 'subscription') {
        subRevenue += amt;
        subCount += 1;
      }
    }

    const totalRevenue = moduleRevenue + topupRevenue + subRevenue;
    const totalCount = moduleCount + topupCount + subCount;

    const roundPct = (num) =>
      totalRevenue > 0 ? Math.round((num / totalRevenue) * 1000) / 10 : 0;

    return {
      total_revenue_idr: totalRevenue,
      total_count: totalCount,
      module: {
        revenue_idr: moduleRevenue,
        count: moduleCount,
        pct: roundPct(moduleRevenue)
      },
      topup: {
        revenue_idr: topupRevenue,
        count: topupCount,
        pct: roundPct(topupRevenue)
      },
      subscription: {
        revenue_idr: subRevenue,
        count: subCount,
        pct: roundPct(subRevenue)
      }
    };
  }

  // Bulan berjalan
  const monthPayments = paidPayments.filter((p) => {
    const dateStr = p.paid_at || p.created_at;
    return dateStr && dateStr.startsWith(period);
  });

  const thisMonthData = aggregate(monthPayments);
  const allTimeData = aggregate(paidPayments);

  // Grouping bulanan historis
  const monthMap = new Map();
  for (const p of paidPayments) {
    const dateStr = p.paid_at || p.created_at;
    if (!dateStr) continue;
    const m = dateStr.slice(0, 7);
    if (!monthMap.has(m)) monthMap.set(m, []);
    monthMap.get(m).push(p);
  }

  // Pastikan period berjalan selalu ada dalam list
  if (!monthMap.has(period)) {
    monthMap.set(period, []);
  }

  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
  const monthlyHistory = sortedMonths.map((m) => {
    const data = aggregate(monthMap.get(m));
    return {
      period: m,
      ...data
    };
  });

  return {
    period,
    this_month: thisMonthData,
    all_time: allTimeData,
    monthly_history: monthlyHistory
  };
}

/**
 * Endpoint agregat untuk admin laporan lengkap PRD F15
 */
export async function getAdminLifetimeReport(monthStr = null) {
  const period = monthStr || getWibPeriod();
  const [liability, revenueMix] = await Promise.all([
    getLifetimeLiability(period),
    getRevenueMix(period)
  ]);
  return {
    period,
    liability,
    revenue_mix: revenueMix
  };
}
