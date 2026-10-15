import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Eye,
  Users,
  Sparkles,
  Download,
  Calendar,
  CheckCircle2,
  Zap,
  ArrowRight,
  PieChart,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { getInsights, isSpyMock } from '../../spy/spyApi';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import ModuleComingSoonCard from '../../components/common/ModuleComingSoonCard';

export default function SpyInsightsPage() {
  const { t } = useLanguage();
  const mockActive = isSpyMock();
  const { activeWorkspace } = useWorkspace();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('2026-W41');
  const [exportNotice, setExportNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getInsights(selectedWeek);
      setInsights(res.insights || null);
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onWsChange = () => loadData();
    window.addEventListener('markimate:workspace-changed', onWsChange);
    window.addEventListener('supermat:workspace-changed', onWsChange);
    return () => {
      window.removeEventListener('markimate:workspace-changed', onWsChange);
      window.removeEventListener('supermat:workspace-changed', onWsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const handleDownloadReport = (format) => {
    setExportNotice(t('spy.insights.exportingToast', { format: format.toUpperCase() }));
    setTimeout(() => {
      setExportNotice('');
      window.open(
        'https://docs.google.com/presentation/d/1_demo_slides_spy_insights_october',
        '_blank'
      );
    }, 1200);
  };

  if (!mockActive) {
    return <ModuleComingSoonCard roleKey="ads_spy" />;
  }

  return (
    <div style={styles.container}>
      {/* 1. Sub-nav Tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabsLeft}>
          <Link to="/app/spy" style={styles.tabBtn}>
            <Eye size={15} />
            <span>{t('spy.tabOverview')}</span>
          </Link>
          <Link to="/app/spy/competitors" style={styles.tabBtn}>
            <Users size={15} />
            <span>{t('spy.tabCompetitors')}</span>
          </Link>
          <Link to="/app/spy/library" style={styles.tabBtn}>
            <Sparkles size={15} />
            <span>{t('spy.tabLibrary')}</span>
          </Link>
          <Link to="/app/spy/insights" style={{ ...styles.tabBtn, ...styles.tabBtnActive }}>
            <TrendingUp size={15} />
            <span>{t('spy.tabInsights')}</span>
          </Link>
        </div>

        <div style={styles.tabsRight}>
          <span style={styles.brandTag}>{activeWorkspace?.name}</span>
        </div>
      </div>

      {/* 2. Top Header & Week Selector & Export Button */}
      <div style={styles.headerCard} className="card">
        <div style={styles.headerLeft}>
          <div style={styles.headerIconBox}>
            <TrendingUp size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <h1 style={styles.pageTitle}>{t('spy.insights.heading')}</h1>
            <p style={styles.pageSubtitle}>
              {t('spy.insights.subheading')}
            </p>
          </div>
        </div>

        <div style={styles.headerActions}>
          <div style={styles.weekSelectWrapper}>
            <Calendar size={14} color="var(--text-muted)" />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              style={styles.weekSelect}
            >
              <option value="2026-W41">{t('spy.insights.weekLatest')}</option>
              <option value="2026-W40">{t('spy.insights.week40')}</option>
              <option value="2026-W39">{t('spy.insights.week39')}</option>
            </select>
          </div>

          <button
            onClick={() => handleDownloadReport('slides')}
            style={styles.exportBtn}
          >
            <Download size={14} />
            <span>{t('spy.insights.exportBtn')}</span>
          </button>
        </div>
      </div>

      {/* Export Notice Toast */}
      {exportNotice && (
        <div style={styles.noticeToast}>
          <CheckCircle2 size={16} color="var(--accent-green)" />
          <span>{exportNotice}</span>
        </div>
      )}

      {loading || !insights ? (
        <div style={styles.loadingBox}>
          <RefreshCw size={24} className="spin" color="var(--accent-cyan)" />
          <span>{t('spy.insights.analyzing')}</span>
        </div>
      ) : (
        <>
          {/* 3. Ringkasan Eksekutif & Distribusi Format */}
          <div style={styles.topInsightGrid}>
            {/* Kartu Ringkasan Performa */}
            <div style={styles.summaryCard} className="card">
              <h3 style={styles.cardHeading}>
                <Lightbulb size={16} color="var(--accent-yellow)" />
                {t('spy.insights.executiveSummaryTitle')}
              </h3>
              <div style={styles.summaryStatsRow}>
                <div style={styles.statBox}>
                  <span style={styles.statLabel}>{t('spy.insights.totalAdsMonitored')}</span>
                  <strong style={styles.statVal}>{insights.summary.totalAdsMonitored}</strong>
                </div>
                <div style={styles.statBox}>
                  <span style={styles.statLabel}>{t('spy.insights.newAdsThisWeek')}</span>
                  <strong style={{ ...styles.statVal, color: 'var(--accent-yellow)' }}>
                    +{insights.summary.newAdsThisWeek}
                  </strong>
                </div>
                <div style={styles.statBox}>
                  <span style={styles.statLabel}>{t('spy.insights.winningAdsIdentified')}</span>
                  <strong style={{ ...styles.statVal, color: 'var(--accent-red)' }}>
                    {insights.summary.winningAdsIdentified}
                  </strong>
                </div>
              </div>

              <div style={styles.summaryHighlight}>
                <span style={styles.highlightLabel}>{t('spy.insights.dominantFormulaLabel')}</span>
                <p style={styles.highlightText}>
                  {t('spy.insights.dominantFormulaDesc', {
                    format: insights.summary.dominantFormat,
                    angle: insights.summary.dominantAngle,
                  })}
                </p>
              </div>
            </div>

            {/* Distribusi Format Creative */}
            <div style={styles.formatCard} className="card">
              <h3 style={styles.cardHeading}>
                <PieChart size={16} color="var(--accent-cyan)" />
                {t('spy.insights.formatDistributionTitle')}
              </h3>
              <div style={styles.formatBarsList}>
                {insights.formatBreakdown.map((fb, idx) => (
                  <div key={idx} style={styles.formatBarItem}>
                    <div style={styles.formatBarLabelRow}>
                      <span style={styles.formatName}>{fb.format}</span>
                      <span style={styles.formatPct}>
                        {`${fb.percentage}% (${t('spy.insights.adsCount', { count: fb.count })})`}
                      </span>
                    </div>
                    <div style={styles.track}>
                      <div
                        style={{
                          ...styles.fill,
                          width: `${fb.percentage}%`,
                          backgroundColor:
                            idx === 0
                              ? 'var(--accent-cyan)'
                              : idx === 1
                              ? 'var(--accent-green)'
                              : 'var(--accent-yellow)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Tema & Pola Dominan Lintas Kompetitor */}
          <div style={styles.sectionCard} className="card">
            <h3 style={styles.sectionTitle}>
              <Zap size={17} color="var(--accent-cyan)" />
              {t('spy.insights.dominantThemesTitle')}
            </h3>
            <div style={styles.themesGrid}>
              {insights.dominantThemes.map((th, idx) => (
                <div key={idx} style={styles.themeCard}>
                  <div style={styles.themeNumBadge}>{idx + 1}</div>
                  <div style={styles.themeBody}>
                    <h4 style={styles.themeCardTitle}>{th.title}</h4>
                    <p style={styles.themeCardDesc}>{th.description}</p>
                    <span style={styles.themeTrendPill}>{th.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Rekomendasi Aksi Konkrit AI untuk Brand Anda */}
          <div style={styles.recsCard} className="card">
            <div style={styles.recsHeaderRow}>
              <div>
                <h3 style={styles.recsTitle}>
                  <Sparkles size={18} color="var(--accent-cyan)" />
                  {t('spy.insights.recommendationsTitle', { brand: activeWorkspace?.name || 'Brand' })}
                </h3>
                <p style={styles.recsSub}>
                  {t('spy.insights.recsSubtitle')}
                </p>
              </div>
              <Link to="/app/spy/library" style={styles.toLibraryBtn}>
                <span>{t('spy.insights.findInspiration')}</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div style={styles.recsList}>
              {insights.actionRecommendations.map((rec, idx) => (
                <div key={rec.id} style={styles.recItem}>
                  <div style={styles.recIconBox}>
                    <CheckCircle2 size={18} color="var(--accent-green)" />
                  </div>
                  <div style={styles.recContent}>
                    <h4 style={styles.recItemTitle}>
                      {`${idx + 1}. ${rec.title}`}
                    </h4>
                    <p style={styles.recActionText}>{rec.action}</p>
                    <div style={styles.recImpactBox}>
                      <span style={styles.recImpactLabel}>{`🎯 ${t('spy.insights.expectedImpact')}`}</span>
                      <span style={styles.recImpactVal}>{rec.impact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 'clamp(0.85rem, 2.5vw, 1.5rem)',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    overflowY: 'auto',
    height: '100%',
    width: '100%',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-muted)',
    paddingBottom: '0.75rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  tabsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.825rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  tabBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
    border: '1px solid var(--border-active)',
  },
  tabsRight: {
    display: 'flex',
    alignItems: 'center',
  },
  brandTag: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    border: '1px solid var(--border-muted)',
  },
  headerCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.5rem',
    borderRadius: '12px',
    gap: '1.25rem',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    flex: 1,
    minWidth: '280px',
  },
  headerIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  pageTitle: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
  },
  pageSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.45,
    maxWidth: '650px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  weekSelectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  weekSelect: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    outline: 'none',
    cursor: 'pointer',
  },
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.825rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  noticeToast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: 'var(--accent-green)',
    fontSize: '0.825rem',
  },
  topInsightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  summaryCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formatCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  cardHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  summaryStatsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },
  statBox: {
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  statLabel: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    lineHeight: 1.2,
  },
  statVal: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  summaryHighlight: {
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  highlightLabel: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.2rem',
  },
  highlightText: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  formatBarsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formatBarItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  formatBarLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatName: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  formatPct: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
  },
  track: {
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'var(--bg-base)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
  },
  sectionCard: {
    padding: '1.5rem',
    borderRadius: '12px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 1.25rem 0',
  },
  themesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
  },
  themeCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    padding: '1.1rem',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  themeNumBadge: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  themeBody: {
    flex: 1,
  },
  themeCardTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.35rem 0',
    lineHeight: 1.3,
  },
  themeCardDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '0 0 0.5rem 0',
  },
  themeTrendPill: {
    display: 'inline-block',
    fontSize: '0.68rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  recsCard: {
    padding: '1.5rem',
    borderRadius: '12px',
  },
  recsHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  recsTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
  },
  recsSub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  toLibraryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  recsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  recItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    padding: '1.1rem',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  recIconBox: {
    marginTop: '2px',
    flexShrink: 0,
  },
  recContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  recItemTitle: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  recActionText: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  recImpactBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    marginTop: '0.35rem',
    width: 'fit-content',
  },
  recImpactLabel: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
  },
  recImpactVal: {
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '3rem',
    color: 'var(--text-muted)',
  },
};
