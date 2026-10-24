import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Presentation,
  Table as TableIcon,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShoppingBag,
  Layers,
  Users,
  Award,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { getReport } from '../../ads/adsApi';
import { PLATFORMS_META } from '../../ads/mockData';
import {
  formatIDR,
  formatCompactIDR,
  formatNumber,
  formatCompact,
  formatPercent,
  formatRoas,
} from '../../ads/format';
import StatusChip from '../../components/ads/StatusChip';
import KpiCard from '../../components/ads/KpiCard';
import TrendChart from '../../components/ads/TrendChart';
import DataTable from '../../components/ads/DataTable';

export default function AdsReportDetailPage({ user }) {
  const { lang, t } = useLanguage();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getReport(reportId);
      setReport(data);
    } catch (err) {
      setError(err.message || t('ads.detail.notFound'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <RefreshCw size={26} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {t('ads.detail.loading', { reportId })}
        </span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={styles.errorBox} className="card">
        <AlertCircle size={24} color="var(--accent-red)" />
        <h3 style={{ margin: '0.5rem 0', color: 'var(--text-primary)' }}>{t('ads.reports.notFoundTitle')}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{error}</p>
        <button onClick={() => navigate('/app/ads/reports')} style={styles.backBtn}>
          {t('ads.reports.backToList')}
        </button>
      </div>
    );
  }

  const kpis = report.kpi || {};
  const isPendingApproval = report.status === 'waiting_approval' || report.status === 'pending_approval';

  // Kolom Tabel Kampanye
  const campaignColumns = [
    {
      key: 'name',
      label: t('ads.detail.colCampaign'),
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{val}</strong>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {t('ads.detail.status')} {row.status || t('ads.detail.active')}
          </div>
        </div>
      ),
    },
    {
      key: 'platform',
      label: t('ads.detail.colPlatform'),
      render: (p) => {
        const meta = PLATFORMS_META[p] || { name: p, color: 'var(--text-secondary)' };
        return (
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: meta.color }}>
            {meta.name}
          </span>
        );
      },
    },
    {
      key: 'spend',
      label: t('ads.detail.colSpend'),
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(v, lang)}</span>,
    },
    {
      key: 'impressions',
      label: t('ads.detail.colImpressions'),
      align: 'right',
      render: (v) => formatCompact(v, lang),
    },
    {
      key: 'clicks',
      label: t('ads.detail.colClicks'),
      align: 'right',
      render: (v) => formatCompact(v, lang),
    },
    {
      key: 'ctr',
      label: 'CTR',
      align: 'right',
      render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{formatPercent(v, false, lang)}</span>,
    },
    {
      key: 'results',
      label: t('ads.detail.colResults'),
      align: 'right',
      render: (v) => <strong style={{ color: 'var(--accent-cyan)' }}>{formatNumber(v, lang)}</strong>,
    },
    {
      key: 'costPerResult',
      label: t('ads.detail.colCostResult'),
      align: 'right',
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(v, lang)}</span>,
    },
    {
      key: 'roas',
      label: 'ROAS',
      align: 'right',
      render: (v) => <strong style={{ color: 'var(--accent-green)' }}>{formatRoas(v)}</strong>,
    },
  ];

  return (
    <div style={styles.page}>
      {/* Top Nav Back */}
      <div style={styles.topNav}>
        <Link to="/app/ads/reports" style={styles.backLink}>
          <ArrowLeft size={16} />
          <span>{t('ads.reports.backToList')}</span>
        </Link>
      </div>

      {/* Header Laporan */}
      <div style={styles.headerCard} className="card">
        <div style={styles.headerInfo}>
          <div style={styles.badgeRow}>
            <StatusChip status={report.status} />
            <div style={styles.platformsBadges}>
              {report.platforms?.map((pKey) => {
                const meta = PLATFORMS_META[pKey] || { name: pKey, color: 'var(--text-secondary)' };
                return (
                  <span
                    key={pKey}
                    style={{
                      ...styles.platformChip,
                      color: meta.color,
                      backgroundColor: meta.accentBg || 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {meta.name}
                  </span>
                );
              })}
            </div>
          </div>

          <h1 style={styles.reportTitle}>{report.title || `Laporan ${report.periodLabel}`}</h1>

          <div style={styles.metaRow}>
            <span>{t('ads.detail.client')} <strong>{report.clientName}</strong></span>
            <span>·</span>
            <span>{t('ads.detail.period')} <strong>{report.periodLabel}</strong></span>
          </div>
        </div>

        {/* Action Buttons: Slides, Sheets & Admin Approve */}
        <div style={styles.headerActions}>
          {report.slidesUrl && (
            <a
              href={report.slidesUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.slidesBtn}
            >
              <Presentation size={16} />
              <span>{t('ads.reports.openSlides')}</span>
            </a>
          )}
          {report.sheetsUrl && (
            <a
              href={report.sheetsUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.sheetsBtn}
            >
              <TableIcon size={16} />
              <span>{t('ads.reports.openSheets')}</span>
            </a>
          )}

        </div>
      </div>

      {/* 1. Ringkasan KPI + Delta vs Bulan Lalu */}
      {Object.keys(kpis).length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('ads.detail.section1Title')}</h2>
          <div style={styles.kpiGrid}>
            {Object.entries(kpis).map(([key, item]) => (
              <KpiCard
                key={key}
                title={item.label}
                value={item.value}
                format={item.format}
                delta={item.delta}
                isGoodWhenLower={item.isGoodWhenLower}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* 2. Grafik Tren Performa (6 Bulan & Harian) */}
      {(report.trend?.length > 0 || report.daily?.length > 0) && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('ads.detail.section2Title')}</h2>
          <TrendChart
            monthlyData={report.trend}
            dailyData={report.daily}
            title={t('ads.detail.trendChartTitle')}
          />
        </div>
      )}

      {/* 3. Tabel Kampanye Iklan */}
      {report.campaigns?.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <h2 style={styles.sectionHeading}>{t('ads.detail.section3Title')}</h2>
            <span style={styles.countBadge}>
              {t('ads.detail.campaignsCount', { count: report.campaigns.length })}
            </span>
          </div>
          <DataTable
            columns={campaignColumns}
            data={report.campaigns}
          />
        </div>
      )}

      {/* 4. Breakdown Platform & Placement/Device */}
      {(report.platformBreakdown?.length > 0 || report.placement?.length > 0) && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('ads.detail.section4Title')}</h2>
          <div style={styles.dualGrid}>
            {/* Breakdown Jaringan / Platform */}
            {report.platformBreakdown?.length > 0 && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <Layers size={16} color="var(--accent-cyan)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.channelDistribution')}</h3>
                </div>
                <div style={styles.breakdownList}>
                  {report.platformBreakdown.map((item, idx) => (
                    <div key={idx} style={styles.breakdownItem}>
                      <div style={styles.breakdownMeta}>
                        <span style={styles.breakdownName}>{item.name}</span>
                        <span style={styles.breakdownVal}>
                          {`${formatCompactIDR(item.spend)} (${item.sharePct || Math.round(item.roas)}%)`}
                        </span>
                      </div>
                      <div style={styles.progressTrack}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${item.sharePct || 50}%`,
                            backgroundColor: idx === 0 ? 'var(--accent-cyan)' : 'var(--accent-green)',
                          }}
                        />
                      </div>
                      <div style={styles.breakdownSub}>
                        <span>{t('ads.detail.labelResults')} {formatNumber(item.results)}</span>
                        <span>{t('ads.detail.labelRoas')} <strong>{formatRoas(item.roas)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Placement Breakdown */}
            {report.placement?.length > 0 && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <ShoppingBag size={16} color="var(--accent-green)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.placements')}</h3>
                </div>
                <div style={styles.breakdownList}>
                  {report.placement.map((p, idx) => (
                    <div key={idx} style={styles.placementRow}>
                      <div style={styles.placementLeft}>
                        <span style={styles.placementName}>{p.name}</span>
                        <span style={styles.placementSpend}>{formatCompactIDR(p.spend)}</span>
                      </div>
                      <span style={styles.placementShare}>{p.share}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Demografi Usia & Gender */}
      {report.demographics && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('ads.detail.section5Title')}</h2>
          <div style={styles.dualGrid}>
            {/* Gender */}
            {report.demographics.gender && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <Users size={16} color="var(--accent-cyan)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.genderComposition')}</h3>
                </div>
                <div style={styles.genderRow}>
                  {report.demographics.gender.map((g, idx) => (
                    <div key={idx} style={styles.genderItem}>
                      <div style={{ ...styles.genderBarCircle, borderColor: g.color }}>
                        <span style={{ color: g.color, fontWeight: '700', fontSize: '1.25rem' }}>
                          {g.value}%
                        </span>
                      </div>
                      <span style={styles.genderLabel}>{g.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usia */}
            {report.demographics.age && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <Users size={16} color="var(--accent-yellow)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.ageDistribution')}</h3>
                </div>
                <div style={styles.ageList}>
                  {report.demographics.age.map((a, idx) => (
                    <div key={idx} style={styles.ageRow}>
                      <span style={styles.ageBracket}>{a.bracket}</span>
                      <div style={styles.ageTrack}>
                        <div
                          style={{
                            ...styles.ageFill,
                            width: `${a.pct}%`,
                          }}
                        />
                      </div>
                      <span style={styles.agePct}>{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Top Produk (Shopee & GMV Max) */}
      {report.topProducts?.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitleRow}>
            <h2 style={styles.sectionHeading}>{t('ads.detail.section6Title')}</h2>
            <span style={styles.countBadge}>{t('ads.detail.featuredProducts', { count: report.topProducts.length })}</span>
          </div>
          <div style={styles.productsGrid}>
            {report.topProducts.map((prod) => (
              <div key={prod.id} style={styles.productCard} className="card">
                <div style={styles.productImgWrapper}>
                  <img
                    src={prod.image}
                    alt={prod.name}
                    style={styles.productImg}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <div style={styles.productInfo}>
                  <h4 style={styles.productName} title={prod.name}>{prod.name}</h4>
                  <div style={styles.productMetricsGrid}>
                    <div>
                      <span style={styles.prodMetricLabel}>{t('ads.detail.prodSpend')}</span>
                      <strong style={styles.prodMetricVal}>{formatCompactIDR(prod.spend)}</strong>
                    </div>
                    <div>
                      <span style={styles.prodMetricLabel}>{t('ads.detail.prodGmv')}</span>
                      <strong style={{ ...styles.prodMetricVal, color: 'var(--accent-green)' }}>
                        {formatCompactIDR(prod.gmv)}
                      </strong>
                    </div>
                    <div>
                      <span style={styles.prodMetricLabel}>{t('ads.detail.prodOrders')}</span>
                      <strong style={styles.prodMetricVal}>{formatNumber(prod.orders)}</strong>
                    </div>
                    <div>
                      <span style={styles.prodMetricLabel}>{t('ads.detail.prodRoas')}</span>
                      <strong style={{ ...styles.prodMetricVal, color: 'var(--accent-cyan)' }}>
                        {formatRoas(prod.roas)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Performa Materi Kreatif (Top & Lowest) */}
      {(report.creatives?.length > 0 || report.lowestCreatives?.length > 0) && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('ads.detail.section7Title')}</h2>
          <div style={styles.dualGrid}>
            {/* Top Creatives */}
            {report.creatives?.length > 0 && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <Award size={16} color="var(--accent-green)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.topCreatives')}</h3>
                </div>
                <div style={styles.creativeList}>
                  {report.creatives.map((c) => (
                    <div key={c.id} style={styles.creativeRow}>
                      <img
                        src={c.thumbnail}
                        alt={c.title}
                        style={styles.creativeThumb}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div style={styles.creativeDetails}>
                        <strong style={styles.creativeTitle}>{c.title}</strong>
                        <span style={styles.creativeFormat}>{c.format}</span>
                        <div style={styles.creativeStats}>
                          <span>{t('ads.detail.labelCtr')} <strong>{formatPercent(c.ctr)}</strong></span>
                          <span>{t('ads.detail.labelRoas')} <strong style={{ color: 'var(--accent-green)' }}>{formatRoas(c.roas)}</strong></span>
                          <span>{t('ads.detail.labelResults')} <strong>{c.results}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lowest Creatives */}
            {report.lowestCreatives?.length > 0 && (
              <div style={styles.subCard} className="card">
                <div style={styles.cardHeaderSmall}>
                  <AlertCircle size={16} color="var(--accent-yellow)" />
                  <h3 style={styles.cardTitleSmall}>{t('ads.detail.needsOptimization')}</h3>
                </div>
                <div style={styles.creativeList}>
                  {report.lowestCreatives.map((c) => (
                    <div key={c.id} style={styles.creativeRow}>
                      <img
                        src={c.thumbnail}
                        alt={c.title}
                        style={styles.creativeThumb}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div style={styles.creativeDetails}>
                        <strong style={styles.creativeTitle}>{c.title}</strong>
                        <span style={styles.creativeFormat}>{c.format}</span>
                        <p style={styles.creativeNote}>{c.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Insight AI & Rekomendasi Tindak Lanjut */}
      {report.insights?.length > 0 && (
        <div style={styles.section}>
          <div style={styles.insightHeader}>
            <div style={styles.sparkleBox}>
              <Sparkles size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={styles.sectionHeading}>{t('ads.detail.section8Title')}</h2>
              <p style={styles.insightSubtitle}>
                {t('ads.detail.aiInsightSub')}
              </p>
            </div>
          </div>

          <div style={styles.insightGrid}>
            {report.insights.map((group, idx) => (
              <div key={idx} style={styles.insightCard} className="card">
                <h4 style={styles.insightCategory}>{group.category}</h4>
                <ul style={styles.insightList}>
                  {group.points?.map((pt, pIdx) => (
                    <li key={pIdx} style={styles.insightPoint}>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '3rem',
  },
  topNav: {
    marginBottom: '1.25rem',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    minHeight: '60vh',
  },
  errorBox: {
    maxWidth: '480px',
    margin: '4rem auto',
    padding: '2rem',
    textAlign: 'center',
  },
  backBtn: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontWeight: '600',
    cursor: 'pointer',
  },
  headerCard: {
    padding: '1.75rem',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1.5rem',
    marginBottom: '2rem',
    borderLeft: '4px solid var(--accent-cyan)',
  },
  headerInfo: {
    flex: 1,
    minWidth: '280px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  platformsBadges: {
    display: 'flex',
    gap: '0.35rem',
  },
  platformChip: {
    fontSize: '0.725rem',
    fontWeight: '600',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid currentColor',
  },
  reportTitle: {
    fontSize: '1.65rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.25,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: '0.5rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  slidesBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#ea4335',
    color: '#ffffff',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
    boxShadow: '0 2px 6px rgba(234, 67, 53, 0.2)',
  },
  sheetsBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#0f9d58',
    color: '#ffffff',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
    boxShadow: '0 2px 6px rgba(15, 157, 88, 0.2)',
  },
  approveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-yellow)',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
  },
  successNotification: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: 'var(--accent-green)',
    fontSize: '0.875rem',
    marginBottom: '2rem',
  },
  section: {
    marginBottom: '2.5rem',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  countBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    padding: '0.2rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
  },
  dualGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '1.25rem',
  },
  subCard: {
    padding: '1.25rem',
  },
  cardHeaderSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  cardTitleSmall: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  breakdownItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  breakdownMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
  },
  breakdownName: {
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  breakdownVal: {
    color: 'var(--text-secondary)',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'var(--bg-base)',
    overflow: 'hidden',
    border: '1px solid var(--border-muted)',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
  },
  breakdownSub: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
  },
  placementRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.65rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    marginBottom: '0.5rem',
  },
  placementLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  placementName: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  placementSpend: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
  },
  placementShare: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
  },
  genderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '1rem 0',
  },
  genderItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  genderBarCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-base)',
  },
  genderLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  ageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  ageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  ageBracket: {
    width: '75px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  ageTrack: {
    flex: 1,
    height: '8px',
    borderRadius: '999px',
    backgroundColor: 'var(--bg-base)',
    overflow: 'hidden',
    border: '1px solid var(--border-muted)',
  },
  ageFill: {
    height: '100%',
    borderRadius: '999px',
    backgroundColor: 'var(--accent-yellow)',
  },
  agePct: {
    width: '35px',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textAlign: 'right',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
  },
  productCard: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  productImgWrapper: {
    width: '100%',
    height: '140px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-base)',
  },
  productImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  productMetricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-base)',
    padding: '0.5rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid var(--border-muted)',
  },
  prodMetricLabel: {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  prodMetricVal: {
    fontSize: '0.78rem',
    color: 'var(--text-primary)',
  },
  creativeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  creativeRow: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  creativeThumb: {
    width: '64px',
    height: '64px',
    borderRadius: '6px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  creativeDetails: {
    flex: 1,
  },
  creativeTitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    display: 'block',
    marginBottom: '0.2rem',
  },
  creativeFormat: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    display: 'block',
    marginBottom: '0.35rem',
  },
  creativeStats: {
    display: 'flex',
    gap: '0.75rem',
    fontSize: '0.725rem',
    color: 'var(--text-secondary)',
  },
  creativeNote: {
    fontSize: '0.725rem',
    color: 'var(--accent-red)',
    margin: 0,
    lineHeight: 1.35,
  },
  insightHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  sparkleBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  insightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
  },
  insightCard: {
    padding: '1.25rem',
    borderTop: '3px solid var(--accent-cyan)',
  },
  insightCategory: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
  },
  insightList: {
    paddingLeft: '1.2rem',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  insightPoint: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
};
