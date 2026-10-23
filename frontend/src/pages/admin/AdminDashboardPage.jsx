import { useState, useEffect } from 'react';
import {
  Shield,
  TrendingUp,
  DollarSign,
  Coins,
  Cpu,
  UserCheck,

  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  PieChart
} from 'lucide-react';
import { api, formatIDR } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber } from '../../lib/format';
import { TRIAL_DAYS } from '../../config/pricing';

export default function AdminDashboardPage({ user }) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [marginData, setMarginData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  // Form State: Manual Grant
  const [grantWsId, setGrantWsId] = useState('');
  const [grantBucket, setGrantBucket] = useState('topup');
  const [grantAmount, setGrantAmount] = useState('500');
  const [grantReason, setGrantReason] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState(null);



  const fetchMarginData = async (month = null) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const url = month ? `/api/admin/credits/margin?month=${month}` : '/api/admin/credits/margin';
      const res = await api(url);
      setMarginData(res);
      if (res?.month) setSelectedMonth(res.month);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load admin margin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarginData();
  }, []);

  const handleMonthChange = (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    fetchMarginData(val);
  };

  const handleGrantSubmit = async (e) => {
    e.preventDefault();
    if (!grantWsId.trim() || !grantAmount) return;
    try {
      setGrantLoading(true);
      setGrantSuccess(null);
      setErrorMsg(null);
      await api('/api/admin/credits/grant', {
        method: 'POST',
        body: {
          workspaceId: grantWsId.trim(),
          bucket: grantBucket,
          credits: Number(grantAmount),
          reason: grantReason.trim() || 'Manual admin grant'
        }
      });
      setGrantSuccess(t('adminDashboard.successGrant', 'Credits granted successfully!'));
      setGrantAmount('500');
      setGrantReason('');
      fetchMarginData(selectedMonth);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to grant credits');
    } finally {
      setGrantLoading(false);
    }
  };



  if (!user?.isPlatformAdmin) {
    return (
      <div style={styles.forbiddenContainer} className="card">
        <AlertCircle size={40} color="var(--accent-red)" />
        <h2>{t('adminDashboard.accessRestricted', 'Access Restricted')}</h2>
        <p>{t('adminDashboard.accessRestrictedDesc', 'This console is only accessible by platform administrators.')}</p>
      </div>
    );
  }

  const totals = marginData?.totals || {};
  const internalAdmin = marginData?.internal_admin_usage || {};
  const actions = marginData?.actions || [];
  const liabilitySection = marginData?.lifetime_liability || null;
  const revenueMix = marginData?.revenue_mix || null;

  return (
    <div style={styles.container}>
      {/* 1. Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.adminBadge}>
              <Shield size={13} color="var(--accent-cyan)" />
              {t('adminDashboard.badge', 'Admin Access')}
            </span>
          </div>
          <h1 style={styles.title}>{t('adminDashboard.title', 'Platform Admin Console')}</h1>
          <p style={styles.subtitle}>
            {t('adminDashboard.subtitle', 'Overview of system-wide AI usage, platform margin, and operational cost controls.')}
          </p>
        </div>

        {/* Month Selector */}
        <div style={styles.monthSelectorBox}>
          <Calendar size={15} color="var(--text-muted)" />
          <input
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            style={styles.monthInput}
            aria-label={t('adminDashboard.monthSelector', 'Select Month')}
          />
        </div>
      </div>

      {errorMsg && (
        <div style={styles.errorAlert}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingBox}>
          <span style={styles.loadingText}>{t('adminDashboard.loadingMetrics', 'Loading admin metrics...')}</span>
        </div>
      ) : (
        <>
          {/* 2. Ringkasan Metrik Utama */}
          <div style={styles.metricsGrid}>
            <div style={styles.metricCard} className="card">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>{t('adminDashboard.totalCreditsUsed', 'Total Credits Used')}</span>
                <Coins size={16} color="var(--accent-cyan)" />
              </div>
              <span style={styles.metricVal}>{formatNumber(totals.total_credits_used || 0, lang)}</span>
            </div>

            <div style={styles.metricCard} className="card">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>{t('adminDashboard.totalRevenue', 'Total Revenue (IDR)')}</span>
                <DollarSign size={16} color="var(--accent-green)" />
              </div>
              <span style={{ ...styles.metricVal, color: 'var(--accent-green)' }}>
                {formatIDR(totals.total_revenue_idr || 0)}
              </span>
            </div>

            <div style={styles.metricCard} className="card">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>{t('adminDashboard.totalCost', 'Vendor API Cost (IDR)')}</span>
                <Cpu size={16} color="var(--accent-red)" />
              </div>
              <span style={{ ...styles.metricVal, color: 'var(--accent-yellow)' }}>
                {formatIDR(totals.total_cost_actual_idr || 0)}
              </span>
            </div>

            <div style={styles.metricCard} className="card">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>{t('adminDashboard.overallMargin', 'Overall Platform Margin')}</span>
                <TrendingUp size={16} color="var(--accent-cyan)" />
              </div>
              <span style={{ ...styles.metricVal, color: totals.overall_margin_pct >= 60 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                {totals.overall_margin_pct ?? 100}%
              </span>
            </div>
          </div>

          {/* 3. Baris Pemakaian Internal 3Our (Bypass) */}
          <div style={styles.internalUsageCard} className="card">
            <div style={styles.internalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="var(--accent-cyan)" />
                <h3 style={styles.cardHeading}>{t('adminDashboard.internalUsageTitle', 'Pemakaian Internal 3Our (Bypass Gratis)')}</h3>
              </div>
              <span style={styles.badgeBypass}>{t('adminDashboard.badgeBypass', 'Zero Revenue · Real Cost Tracked')}</span>
            </div>
            <div style={styles.internalGrid}>
              <div style={styles.internalItem}>
                <span style={styles.internalLabel}>{t('adminDashboard.internalActions', 'Actions Executed')}</span>
                <span style={styles.internalVal}>{formatNumber(internalAdmin.actions_count || 0, lang)}</span>
              </div>
              <div style={styles.internalItem}>
                <span style={styles.internalLabel}>{t('adminDashboard.internalApiCost', 'Absorbed Vendor API Cost')}</span>
                <span style={{ ...styles.internalVal, color: 'var(--accent-yellow)' }}>{formatIDR(internalAdmin.cost_actual_idr || 0)}</span>
              </div>
              <div style={styles.internalItem}>
                <span style={styles.internalLabel}>{t('adminDashboard.internalEstCredits', 'Credits Equivalent')}</span>
                <span style={styles.internalVal}>{formatNumber(internalAdmin.estimated_credits || 0, lang)} cr</span>
              </div>
            </div>
          </div>

          {/* 4. Tabel Rincian Aksi & Margin */}
          <div style={styles.tableCard} className="card">
            <h3 style={styles.cardHeading}>{t('adminDashboard.breakdownTitle', 'Monthly Action Breakdown')}</h3>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>{t('adminDashboard.thAction', 'Action Type')}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thCount', 'Action Count')}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thCredits', 'Credits')}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thRevenue', 'Revenue')}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thCost', 'API Cost')}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thMargin', 'Margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((act) => (
                    <tr key={act.action_key} style={styles.tr}>
                      <td style={styles.tdBold}>{act.label || act.action_key}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(act.actions_count, lang)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{formatNumber(act.credits_used, lang)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--accent-green)' }}>{formatIDR(act.revenue_idr)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>{formatIDR(act.cost_actual_idr)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: act.margin_pct >= 60 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                        {act.margin_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4b. Laporan Liabilitas Kredit Bulanan (Modul Lifetime) (PRD F15 Langkah 8) */}
          {liabilitySection && (
            <div style={styles.reportSectionCard} className="card">
              <div style={styles.sectionHeader}>
                <div style={styles.headerTitleRow}>
                  <Layers size={18} color="var(--accent-cyan)" />
                  <h3 style={styles.cardHeading}>{t('adminDashboard.liabilityTitle')}</h3>
                </div>
                <p style={styles.sectionSubtitle}>{t('adminDashboard.liabilitySubtitle')}</p>
              </div>

              {/* 4 Cards Metrik Liabilitas */}
              <div className="admin-reports-grid">
                <div style={styles.subMetricCard}>
                  <span style={styles.subMetricLabel}>{t('adminDashboard.totalActiveLifetimeOwners')}</span>
                  <span style={styles.subMetricVal}>
                    {t('adminDashboard.ratioSlash', {
                      active: formatNumber(liabilitySection.summary?.active_lifetime_owners || 0, lang),
                      total: formatNumber(liabilitySection.summary?.total_lifetime_owners || 0, lang)
                    })}
                  </span>
                </div>

                <div style={styles.subMetricCard}>
                  <span style={styles.subMetricLabel}>{t('adminDashboard.totalCommittedCredits')}</span>
                  <span style={{ ...styles.subMetricVal, color: 'var(--accent-cyan)' }}>
                    {t('adminDashboard.creditsVal', {
                      amount: formatNumber(liabilitySection.summary?.total_active_committed_credits || 0, lang)
                    })}
                  </span>
                </div>

                <div style={styles.subMetricCard}>
                  <span style={styles.subMetricLabel}>{t('adminDashboard.estLiabilityReal')}</span>
                  <span style={{ ...styles.subMetricVal, color: 'var(--accent-yellow)' }}>
                    {formatIDR(liabilitySection.summary?.total_liability_real_idr || 0)}
                  </span>
                </div>

                <div style={styles.subMetricCard}>
                  <span style={styles.subMetricLabel}>{t('adminDashboard.estLiabilityBuffer', { rate: formatIDR(100) })}</span>
                  <span style={{ ...styles.subMetricVal, color: 'var(--text-muted)' }}>
                    {formatIDR(liabilitySection.summary?.total_liability_buffer_idr || 0)}
                  </span>
                </div>
              </div>

              {/* Tabel Rincian per Modul Lifetime */}
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>{t('adminDashboard.thModule')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thOwners')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thQuotaPerOwner')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thTotalCredits')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thCogsPerCredit')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thLiabilityReal')}</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thLiabilityBuffer', { rate: formatIDR(100) })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(liabilitySection.by_module || {}).map((mod) => (
                      <tr key={mod.module} style={styles.tr}>
                        <td style={styles.tdBold}>{mod.name}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {t('adminDashboard.ratioSlash', {
                            active: formatNumber(mod.active_owners, lang),
                            total: formatNumber(mod.total_owners, lang)
                          })}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {t('adminDashboard.creditsVal', {
                            amount: formatNumber(mod.monthly_credits_per_owner, lang)
                          })}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', color: 'var(--accent-cyan)' }}>
                          {t('adminDashboard.creditsVal', {
                            amount: formatNumber(mod.active_committed_credits, lang)
                          })}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{formatIDR(mod.cogs_per_credit_real)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: 'var(--accent-yellow)' }}>
                          {formatIDR(mod.liability_real_idr)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatIDR(mod.liability_buffer_idr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.safetyBox}>
                <AlertCircle size={15} color="var(--accent-cyan)" />
                <span style={styles.safetyText}>{t('adminDashboard.liabilitySafetyNotice')}</span>
              </div>
            </div>
          )}

          {/* 4c. Laporan Bauran Pendapatan (Revenue Mix: Lifetime vs Top-up) (PRD F15 Langkah 8) */}
          {revenueMix && (
            <div style={styles.reportSectionCard} className="card">
              <div style={styles.sectionHeader}>
                <div style={styles.headerTitleRow}>
                  <PieChart size={18} color="var(--accent-green)" />
                  <h3 style={styles.cardHeading}>{t('adminDashboard.revenueMixTitle')}</h3>
                </div>
                <p style={styles.sectionSubtitle}>{t('adminDashboard.revenueMixSubtitle')}</p>
              </div>

              {/* 2 Kartu Komparasi Bauran: Bulan Ini vs All-Time */}
              <div className="admin-mix-container">
                {/* Kartu Bulan Ini */}
                <div style={styles.mixCard} className="card">
                  <div style={styles.mixCardHeader}>
                    <span style={styles.mixPeriodBadge}>{t('adminDashboard.revMonthMix', { month: revenueMix.period })}</span>
                    <span style={styles.mixTotalAmount}>{formatIDR(revenueMix.this_month?.total_revenue_idr || 0)}</span>
                  </div>

                  <div className="admin-mix-bar">
                    <div
                      className="admin-mix-segment-pack"
                      style={{ width: `${revenueMix.this_month?.pack?.pct || 0}%`, backgroundColor: 'var(--accent-cyan)' }}
                    />
                    <div
                      className="admin-mix-segment-topup"
                      style={{ width: `${revenueMix.this_month?.topup?.pct || 0}%`, backgroundColor: 'var(--accent-green)' }}
                    />
                    {Boolean(revenueMix.this_month?.module?.revenue_idr) && (
                      <div
                        className="admin-mix-segment-module"
                        style={{ width: `${revenueMix.this_month?.module?.pct || 0}%`, backgroundColor: 'var(--text-muted)' }}
                      />
                    )}
                    {Boolean(revenueMix.this_month?.subscription?.revenue_idr) && (
                      <div
                        className="admin-mix-segment-sub"
                        style={{ width: `${revenueMix.this_month?.subscription?.pct || 0}%`, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      />
                    )}
                  </div>

                  <div className="admin-mix-legend">
                    <div className="admin-mix-legend-item">
                      <div>
                        <span className="admin-mix-dot" style={{ backgroundColor: 'var(--accent-cyan)' }} />
                        <span>{t('adminDashboard.revPack', 'Paket Credit')}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{formatIDR(revenueMix.this_month?.pack?.revenue_idr || 0)}</strong>
                        <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.this_month?.pack?.pct || 0 })}</span>
                      </div>
                    </div>

                    <div className="admin-mix-legend-item">
                      <div>
                        <span className="admin-mix-dot" style={{ backgroundColor: 'var(--accent-green)' }} />
                        <span>{t('adminDashboard.revTopup')}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{formatIDR(revenueMix.this_month?.topup?.revenue_idr || 0)}</strong>
                        <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.this_month?.topup?.pct || 0 })}</span>
                      </div>
                    </div>

                    {Boolean(revenueMix.this_month?.module?.revenue_idr) && (
                      <div className="admin-mix-legend-item">
                        <div>
                          <span className="admin-mix-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
                          <span>{t('adminDashboard.revModuleLegacy', 'Modul (Legacy)')}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatIDR(revenueMix.this_month?.module?.revenue_idr || 0)}</strong>
                          <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.this_month?.module?.pct || 0 })}</span>
                        </div>
                      </div>
                    )}

                    {Boolean(revenueMix.this_month?.subscription?.revenue_idr) && (
                      <div className="admin-mix-legend-item">
                        <div>
                          <span className="admin-mix-dot" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
                          <span>{t('adminDashboard.revSubscription')}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatIDR(revenueMix.this_month?.subscription?.revenue_idr || 0)}</strong>
                          <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.this_month?.subscription?.pct || 0 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kartu Sepanjang Masa (All-Time) */}
                <div style={styles.mixCard} className="card">
                  <div style={styles.mixCardHeader}>
                    <span style={styles.mixPeriodBadge}>{t('adminDashboard.revAllTimeMix')}</span>
                    <span style={styles.mixTotalAmount}>{formatIDR(revenueMix.all_time?.total_revenue_idr || 0)}</span>
                  </div>

                  <div className="admin-mix-bar">
                    <div
                      className="admin-mix-segment-pack"
                      style={{ width: `${revenueMix.all_time?.pack?.pct || 0}%`, backgroundColor: 'var(--accent-cyan)' }}
                    />
                    <div
                      className="admin-mix-segment-topup"
                      style={{ width: `${revenueMix.all_time?.topup?.pct || 0}%`, backgroundColor: 'var(--accent-green)' }}
                    />
                    {Boolean(revenueMix.all_time?.module?.revenue_idr) && (
                      <div
                        className="admin-mix-segment-module"
                        style={{ width: `${revenueMix.all_time?.module?.pct || 0}%`, backgroundColor: 'var(--text-muted)' }}
                      />
                    )}
                    {Boolean(revenueMix.all_time?.subscription?.revenue_idr) && (
                      <div
                        className="admin-mix-segment-sub"
                        style={{ width: `${revenueMix.all_time?.subscription?.pct || 0}%`, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      />
                    )}
                  </div>

                  <div className="admin-mix-legend">
                    <div className="admin-mix-legend-item">
                      <div>
                        <span className="admin-mix-dot" style={{ backgroundColor: 'var(--accent-cyan)' }} />
                        <span>{t('adminDashboard.revPack', 'Paket Credit')}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{formatIDR(revenueMix.all_time?.pack?.revenue_idr || 0)}</strong>
                        <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.all_time?.pack?.pct || 0 })}</span>
                      </div>
                    </div>

                    <div className="admin-mix-legend-item">
                      <div>
                        <span className="admin-mix-dot" style={{ backgroundColor: 'var(--accent-green)' }} />
                        <span>{t('adminDashboard.revTopup')}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{formatIDR(revenueMix.all_time?.topup?.revenue_idr || 0)}</strong>
                        <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.all_time?.topup?.pct || 0 })}</span>
                      </div>
                    </div>

                    {Boolean(revenueMix.all_time?.module?.revenue_idr) && (
                      <div className="admin-mix-legend-item">
                        <div>
                          <span className="admin-mix-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
                          <span>{t('adminDashboard.revModuleLegacy', 'Modul (Legacy)')}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatIDR(revenueMix.all_time?.module?.revenue_idr || 0)}</strong>
                          <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.all_time?.module?.pct || 0 })}</span>
                        </div>
                      </div>
                    )}

                    {Boolean(revenueMix.all_time?.subscription?.revenue_idr) && (
                      <div className="admin-mix-legend-item">
                        <div>
                          <span className="admin-mix-dot" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
                          <span>{t('adminDashboard.revSubscription')}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatIDR(revenueMix.all_time?.subscription?.revenue_idr || 0)}</strong>
                          <span style={styles.mixPctLabel}>{t('adminDashboard.pctInParen', { pct: revenueMix.all_time?.subscription?.pct || 0 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabel Riwayat Bulanan (Monthly Breakdown) */}
              {Boolean(revenueMix.monthly_history?.length) && (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.th}>{t('adminDashboard.thPeriod')}</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thPackRev', 'Paket Credit')}</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thTopupRev')}</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thLegacyRev')}</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thTotalRev')}</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>{t('adminDashboard.thMixRatio')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueMix.monthly_history.map((row) => (
                        <tr key={row.period} style={styles.tr}>
                          <td style={styles.tdBold}>{row.period}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: 'var(--accent-cyan)' }}>
                            {formatIDR(row.pack?.revenue_idr || 0)}
                            <span style={styles.mixPctLabel}> {t('adminDashboard.pctInParen', { pct: row.pack?.pct || 0 })}</span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: 'var(--accent-green)' }}>
                            {formatIDR(row.topup?.revenue_idr || 0)}
                            <span style={styles.mixPctLabel}> {t('adminDashboard.pctInParen', { pct: row.topup?.pct || 0 })}</span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatIDR((row.module?.revenue_idr || 0) + (row.subscription?.revenue_idr || 0))}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700' }}>
                            {formatIDR(row.total_revenue_idr || 0)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                            {t('adminDashboard.ratioDisplay', { a: row.pack?.pct || 0, b: row.topup?.pct || 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. Operasi Admin: Manual Grant */}
          <div style={styles.operationsGrid}>
            {/* Card Manual Grant */}
            <div style={styles.operationCard} className="card">
              <div style={styles.opHeader}>
                <UserCheck size={18} color="var(--accent-cyan)" />
                <h3 style={styles.cardHeading}>{t('adminDashboard.grantTitle', 'Manual Credit Grant')}</h3>
              </div>
              <p style={styles.opDesc}>
                {t('adminDashboard.grantDesc', 'Allocate credits directly to workspace wallet for support or corporate contracts.')}
              </p>

              {grantSuccess && (
                <div style={styles.successAlert}>
                  <CheckCircle2 size={15} />
                  <span>{grantSuccess}</span>
                </div>
              )}

              <form onSubmit={handleGrantSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('adminDashboard.grantWsId', 'Workspace ID')}</label>
                  <input
                    type="text"
                    value={grantWsId}
                    onChange={(e) => setGrantWsId(e.target.value)}
                    placeholder={t('adminDashboard.placeholderWs', 'uuid-workspace-target')}
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('adminDashboard.grantBucket', 'Bucket')}</label>
                    <select
                      value={grantBucket}
                      onChange={(e) => setGrantBucket(e.target.value)}
                      style={styles.select}
                    >
                      <option value="topup">{t('adminDashboard.optTopup', 'topup (never expires)')}</option>
                      <option value="sub">{t('adminDashboard.optSub', 'sub (monthly)')}</option>
                      <option value="trial">{t('adminDashboard.optTrial', { days: TRIAL_DAYS })}</option>
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('adminDashboard.grantAmount', 'Amount (Credits)')}</label>
                    <input
                      type="number"
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(e.target.value)}
                      min="1"
                      required
                      style={styles.input}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('adminDashboard.grantReason', 'Reason / Note')}</label>
                  <input
                    type="text"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder={t('adminDashboard.placeholderReason', 'e.g. Downtime compensation / Enterprise POC')}
                    style={styles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={grantLoading}
                  style={styles.submitBtn}
                >
                  {grantLoading ? t('adminDashboard.granting', 'Granting...') : t('adminDashboard.btnGrant', 'Grant Credits')}
                </button>
              </form>
            </div>


          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1.5rem',
  },
  forbiddenContainer: {
    maxWidth: '500px',
    margin: '4rem auto',
    padding: '2.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  badgeRow: {
    marginBottom: '0.4rem',
  },
  adminBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    borderRadius: '6px',
    padding: '0.2rem 0.55rem',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '0.35rem 0 0 0',
  },
  monthSelectorBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.8rem',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
  },
  monthInput: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: 'var(--accent-red)',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.25)',
    color: 'var(--accent-green)',
    padding: '0.6rem 0.8rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.825rem',
  },
  loadingBox: {
    padding: '3rem 1rem',
    textAlign: 'center',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  metricCard: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  metricCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metricVal: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  internalUsageCard: {
    padding: '1.25rem',
    marginBottom: '1.5rem',
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  internalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  badgeBypass: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  internalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    gap: '1rem',
  },
  internalItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  internalLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  internalVal: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  tableCard: {
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  cardHeading: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  tableWrapper: {
    overflowX: 'auto',
    marginTop: '1rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  tableHeaderRow: {
    borderBottom: '1px solid var(--border-muted)',
  },
  th: {
    padding: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid var(--border-muted)',
  },
  td: {
    padding: '0.75rem',
    color: 'var(--text-secondary)',
  },
  tdBold: {
    padding: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  operationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  operationCard: {
    padding: '1.25rem',
  },
  opHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  },
  opDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: '0 0 1rem 0',
    lineHeight: 1.4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '16px', // Cegah iOS zoom
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '16px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  submitBtn: {
    padding: '0.75rem 1rem',
    minHeight: '44px', // Target sentuh minimal 44px
    backgroundColor: 'var(--accent-cyan)',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    width: '100%',
  },
  reportSectionCard: {
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  sectionHeader: {
    marginBottom: '1.25rem',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sectionSubtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    marginTop: '0.35rem',
    lineHeight: '1.4',
  },
  subMetricCard: {
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  subMetricLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  subMetricVal: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  subMetricDivider: {
    margin: '0 0.25rem',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  subMetricTotal: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  safetyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
  },
  safetyText: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  mixCard: {
    padding: '1.25rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
  },
  mixCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  mixPeriodBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--accent-cyan)',
    border: '1px solid var(--border-muted)',
  },
  mixTotalAmount: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
  },
  mixPctLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginLeft: '0.25rem',
  },
};
