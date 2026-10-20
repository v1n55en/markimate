import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal,
  LayoutDashboard,
  Eye,
  Sparkles,
  ArrowRight,
  Lock,
  CheckCircle2,
  Layers,
  FileText,
  Check,
  RefreshCw,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLanguage } from '../../context/LanguageContext';
import { MODULE_PRICES, MODULE_QUOTA, formatIDR } from '../../config/pricing';
import { ROLES } from '../../config/roles';
import { getAdsSummary, listConnections } from '../../ads/adsApi';
import { formatCompactIDR, formatRoas } from '../../ads/format';

export default function WorkspaceDashboardPage({ me }) {
  const { activeWorkspace, isModuleActive } = useWorkspace();
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [adsSummary, setAdsSummary] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);

  const isSeoActive = isModuleActive('seo');
  const isAdsActive = isModuleActive('ads_report');
  const isSpyActive = isModuleActive('ads_spy');

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdsActive) {
        const [sum, conn] = await Promise.all([
          getAdsSummary().catch(() => null),
          listConnections().catch(() => ({ connections: [] })),
        ]);
        setAdsSummary(sum);
        const activeConns = (conn.connections || []).filter(
          (c) => c.status === 'connected'
        );
        setConnectedCount(activeConns.length);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const onWsChange = () => {
      loadData();
    };
    window.addEventListener('markimate:workspace-changed', onWsChange);
    window.addEventListener('supermat:workspace-changed', onWsChange);
    return () => {
      window.removeEventListener('markimate:workspace-changed', onWsChange);
      window.removeEventListener('supermat:workspace-changed', onWsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, isAdsActive]);

  const seoRuns = me?.usage?.runsThisMonth || 12;
  const seoLimit = me?.usage?.limit || 100;

  return (
    <div style={styles.container}>
      {/* 1. Header Banner Workspace */}
      <div style={styles.headerBanner} className="card">
        <div style={styles.headerLeft}>
          <div style={styles.brandIconBox}>
            <Briefcase size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={styles.brandTitleRow}>
              <h1 style={styles.brandTitle}>{activeWorkspace?.name || t('app.workspaceSelector.defaultWorkspace')}</h1>
              <span style={styles.nicheBadge}>{activeWorkspace?.niche || t('app.workspaceSelector.nicheDigitalMarketing')}</span>
            </div>
            <p style={styles.headerSub}>
              {t('app.dashboard.headerSub')}
            </p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.activeModulesCounter}>
            <Layers size={16} color="var(--accent-cyan)" />
            <span>
              <strong>{activeWorkspace?.modules?.length || 0}</strong>{' '}
              {t('app.dashboard.activeCoreRolesCount')}
            </span>
          </div>
          <Link to="/app/billing" style={styles.headerUpgradeLink}>
            <span>{t('sidebar.billing', 'Subscription & Billing')}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 2. Grid Ringkasan 3 Modul Utama (SEO, Ads, Spy) */}
      <div style={styles.moduleGrid}>
        {/* Modul SEO Specialist */}
        <div
          style={{
            ...styles.moduleCard,
            ...(isSeoActive ? styles.moduleCardActive : styles.moduleCardLocked),
          }}
          className="card"
        >
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderTitleRow}>
              <div
                style={{
                  ...styles.cardIconBox,
                  backgroundColor: isSeoActive
                    ? 'rgba(6, 182, 212, 0.1)'
                    : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Terminal
                  size={18}
                  color={isSeoActive ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                />
              </div>
              <div>
                <h3 style={styles.cardTitle}>{t('app.dashboard.roleSeo')}</h3>
                <span style={styles.cardCategory}>{t('app.dashboard.seoCat')}</span>
              </div>
            </div>
            {isSeoActive ? (
              <span style={styles.activeStatusTag}>
                <Check size={11} />
                {t('common.active')}
              </span>
            ) : (
              <span style={styles.lockedStatusTag}>
                <Lock size={11} />
                {t('common.locked')}
              </span>
            )}
          </div>

          {isSeoActive ? (
            <div style={styles.cardBody}>
              <p style={styles.cardDesc}>
                {t('app.dashboard.seoDescActive')}
              </p>
              <div style={styles.kpiRow}>
                <div style={styles.kpiBlock}>
                  <span style={styles.kpiLabel}>{t('app.dashboard.seoArticlesMonth')}</span>
                  <strong style={styles.kpiValue}>
                    {seoRuns} <span style={styles.kpiSub}>/ {seoLimit}</span>
                  </strong>
                </div>
                <div style={styles.kpiBlock}>
                  <span style={styles.kpiLabel}>{t('app.dashboard.cmsStatus')}</span>
                  <strong style={{ ...styles.kpiValue, color: 'var(--accent-green)' }}>
                    {t('app.dashboard.connected')}
                  </strong>
                </div>
              </div>
              <Link to="/app/seo/keywords" style={styles.cardActionBtn}>
                <span>{t('app.dashboard.manageSeo')}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div style={styles.cardBodyLocked}>
              <p style={styles.lockedDesc}>
                {t('app.dashboard.seoDescLocked')}
              </p>
              <div style={styles.lockedPriceBox}>
                <span>{t('app.dashboard.fromPrice')} <strong>{formatIDR(MODULE_PRICES.seo, lang)}</strong>{t('app.dashboard.perMonth')}</span>
                <span style={styles.lockedQuotaText}>{MODULE_QUOTA.seo}</span>
              </div>
              <Link to="/app/modules/seo" style={styles.cardActivateBtn}>
                <Sparkles size={14} />
                <span>{t('app.dashboard.activateSeo')}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Modul Ads Specialist (Reporting) */}
        <div
          style={{
            ...styles.moduleCard,
            ...(isAdsActive ? styles.moduleCardActive : styles.moduleCardLocked),
          }}
          className="card"
        >
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderTitleRow}>
              <div
                style={{
                  ...styles.cardIconBox,
                  backgroundColor: isAdsActive
                    ? 'rgba(6, 182, 212, 0.1)'
                    : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <LayoutDashboard
                  size={18}
                  color={isAdsActive ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                />
              </div>
              <div>
                <h3 style={styles.cardTitle}>{t('app.dashboard.roleAds')}</h3>
                <span style={styles.cardCategory}>{t('app.dashboard.adsCat')}</span>
              </div>
            </div>
            {isAdsActive ? (
              <span style={styles.activeStatusTag}>
                <Check size={11} />
                {t('common.active')}
              </span>
            ) : (
              <span style={styles.lockedStatusTag}>
                <Lock size={11} />
                {t('common.locked')}
              </span>
            )}
          </div>

          {isAdsActive ? (
            <div style={styles.cardBody}>
              <p style={styles.cardDesc}>
                {t('app.dashboard.adsDescActive')}
              </p>
              {loading ? (
                <div style={styles.loadingBox}>
                  <RefreshCw size={16} className="spin" />
                  <span>{t('app.dashboard.adsLoading')}</span>
                </div>
              ) : (
                <div style={styles.kpiRow}>
                  <div style={styles.kpiBlock}>
                    <span style={styles.kpiLabel}>{t('app.dashboard.adsTotalSpend')}</span>
                    <strong style={styles.kpiValue}>
                      {adsSummary ? formatCompactIDR(adsSummary.totals.spend) : formatCompactIDR(0)}
                    </strong>
                  </div>
                  <div style={styles.kpiBlock}>
                    <span style={styles.kpiLabel}>{t('app.dashboard.adsBlendedRoas')}</span>
                    <strong style={{ ...styles.kpiValue, color: 'var(--accent-cyan)' }}>
                      {adsSummary ? formatRoas(adsSummary.totals.roas) : '0x'}
                    </strong>
                  </div>
                </div>
              )}
              <div style={styles.subMetaRow}>
                <span>{t('app.dashboard.adsConnectedPlatforms', { count: connectedCount })}</span>
                {adsSummary?.period && <span>{'·'}</span>}
                {adsSummary?.period && <span>{adsSummary.period}</span>}
              </div>
              <Link to="/app/ads" style={styles.cardActionBtn}>
                <span>{t('app.dashboard.viewAdReports')}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div style={styles.cardBodyLocked}>
              <p style={styles.lockedDesc}>
                {t('app.dashboard.adsDescLocked')}
              </p>
              <div style={styles.lockedPriceBox}>
                <span>{t('app.dashboard.fromPrice')} <strong>{formatIDR(MODULE_PRICES.ads_report, lang)}</strong>{t('app.dashboard.perMonth')}</span>
                <span style={styles.lockedQuotaText}>{MODULE_QUOTA.ads_report}</span>
              </div>
              <Link to="/app/modules/ads_report" style={styles.cardActivateBtn}>
                <Sparkles size={14} />
                <span>{t('app.dashboard.activateAds')}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Modul Ads Creative Spy */}
        <div
          style={{
            ...styles.moduleCard,
            ...(isSpyActive ? styles.moduleCardActive : styles.moduleCardLocked),
          }}
          className="card"
        >
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderTitleRow}>
              <div
                style={{
                  ...styles.cardIconBox,
                  backgroundColor: isSpyActive
                    ? 'rgba(6, 182, 212, 0.1)'
                    : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Eye
                  size={18}
                  color={isSpyActive ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                />
              </div>
              <div>
                <h3 style={styles.cardTitle}>{t('app.dashboard.roleSpy')}</h3>
                <span style={styles.cardCategory}>{t('app.dashboard.spyCat')}</span>
              </div>
            </div>
            {isSpyActive ? (
              <span style={styles.activeStatusTag}>
                <Check size={11} />
                {t('common.active')}
              </span>
            ) : (
              <span style={styles.lockedStatusTag}>
                <Lock size={11} />
                {t('common.locked')}
              </span>
            )}
          </div>

          {isSpyActive ? (
            <div style={styles.cardBody}>
              <p style={styles.cardDesc}>
                {t('app.dashboard.spyDescActive')}
              </p>
              <div style={styles.kpiRow}>
                <div style={styles.kpiBlock}>
                  <span style={styles.kpiLabel}>{t('app.dashboard.spyTrackedCompetitors')}</span>
                  <strong style={styles.kpiValue}>
                    {'3 '}
                    <span style={styles.kpiSub}>{t('app.dashboard.outOfFive')}</span>
                  </strong>
                </div>
                <div style={styles.kpiBlock}>
                  <span style={styles.kpiLabel}>{t('app.dashboard.spyNewCreatives')}</span>
                  <strong style={{ ...styles.kpiValue, color: 'var(--accent-yellow)' }}>
                    {t('app.dashboard.spyAdsCount', { count: 14 })}
                  </strong>
                </div>
              </div>
              <div style={styles.subMetaRow}>
                <span>{t('app.dashboard.metaAdLibrary')}</span>
                <span>{'·'}</span>
                <span>{t('app.dashboard.autoWeeklyScan')}</span>
              </div>
              <Link to="/app/spy" style={styles.cardActionBtn}>
                <span>{t('app.dashboard.openCreativeSpy')}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div style={styles.cardBodyLocked}>
              <p style={styles.lockedDesc}>
                {t('app.dashboard.spyDescLocked')}
              </p>
              <div style={styles.lockedPriceBox}>
                <span>{t('app.dashboard.fromPrice')} <strong>{formatIDR(MODULE_PRICES.ads_spy, lang)}</strong>{t('app.dashboard.perMonth')}</span>
                <span style={styles.lockedQuotaText}>{MODULE_QUOTA.ads_spy}</span>
              </div>
              <Link to="/app/modules/ads_spy" style={styles.cardActivateBtn}>
                <Sparkles size={14} />
                <span>{t('app.dashboard.activateSpy')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 3. Output AI Terbaru (Human-in-the-Loop Activity) */}
      <div style={styles.activityCard} className="card">
        <div style={styles.activityHeader}>
          <div>
            <h3 style={styles.activityTitle}>{t('app.dashboard.recentActivityTitle')}</h3>
            <p style={styles.activitySub}>
              {t('app.dashboard.recentActivitySub')}
            </p>
          </div>
          <span style={styles.humanReviewBadge}>
            <CheckCircle2 size={13} color="var(--accent-green)" />
            {t('app.dashboard.hitlActive')}
          </span>
        </div>

        <div style={styles.activityList}>
          {isAdsActive && (
            <div style={styles.activityItem}>
              <div style={{ ...styles.activityIconBox, backgroundColor: 'rgba(24, 119, 242, 0.12)' }}>
                <FileText size={16} color="#1877F2" />
              </div>
              <div style={styles.activityInfo}>
                <strong style={styles.activityItemTitle}>
                  {t('app.dashboard.activityAdsTitle', { name: activeWorkspace?.name || '' })}
                </strong>
                <span style={styles.activityItemMeta}>
                  {t('app.dashboard.activityAdsMeta')}
                </span>
              </div>
              <Link to="/app/ads/reports" style={styles.activityActionLink}>
                <span>{t('app.dashboard.openReport')}</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          )}

          {isSeoActive && (
            <div style={styles.activityItem}>
              <div style={{ ...styles.activityIconBox, backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                <Terminal size={16} color="var(--accent-green)" />
              </div>
              <div style={styles.activityInfo}>
                <strong style={styles.activityItemTitle}>
                  {t('app.dashboard.activitySeoTitle')}
                </strong>
                <span style={styles.activityItemMeta}>
                  {t('app.dashboard.activitySeoMeta')}
                </span>
              </div>
              <Link to="/app/seo/keywords" style={styles.activityActionLink}>
                <span>{t('app.dashboard.reviewDraft')}</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {isSpyActive && (
            <div style={styles.activityItem}>
              <div style={{ ...styles.activityIconBox, backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
                <Eye size={16} color="var(--accent-yellow)" />
              </div>
              <div style={styles.activityInfo}>
                <strong style={styles.activityItemTitle}>
                  {t('app.dashboard.activitySpyTitle')}
                </strong>
                <span style={styles.activityItemMeta}>
                  {t('app.dashboard.activitySpyMeta')}
                </span>
              </div>
              <Link to="/app/spy" style={styles.activityActionLink}>
                <span>{t('app.dashboard.viewInsight')}</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 4. Banner Role Masa Depan */}
      <div style={styles.roadmapTeaser} className="card">
        <div style={styles.roadmapTeaserLeft}>
          <Sparkles size={20} color="var(--accent-cyan)" />
          <div>
            <h4 style={styles.roadmapTitle}>{t('app.dashboard.roadmapTitle', { soonRoles: soonRolesCount })}</h4>
            <p style={styles.roadmapSub}>
              {t('app.dashboard.roadmapSub')}
            </p>
          </div>
        </div>
        <Link to="/#roles" style={styles.roadmapBtn}>
          <span>{t('app.dashboard.viewAllRoles', { totalRoles: totalRolesCount })}</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 'clamp(0.85rem, 2.5vw, 1.75rem)',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    overflowY: 'auto',
    height: '100%',
    width: '100%',
  },
  headerBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'clamp(1rem, 2.5vw, 1.5rem)',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    gap: '1.25rem',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    flex: 1,
    minWidth: 'min(280px, 100%)',
  },
  brandIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '0.35rem',
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: 'clamp(1.2rem, 3.5vw, 1.4rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  nicheBadge: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
  },
  headerSub: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '650px',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  activeModulesCounter: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.35rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
  },
  headerUpgradeLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(290px, 100%), 1fr))',
    gap: '1.25rem',
  },
  moduleCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '280px',
  },
  moduleCardActive: {
    border: '1px solid var(--border-active)',
  },
  moduleCardLocked: {
    border: '1px dashed var(--border-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  cardHeaderTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  cardIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  cardCategory: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  activeStatusTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    padding: '0.15rem 0.45rem',
    borderRadius: '999px',
  },
  lockedStatusTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    padding: '0.15rem 0.45rem',
    borderRadius: '999px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
    justifyContent: 'space-between',
  },
  cardDesc: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  kpiRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem',
    backgroundColor: 'var(--bg-base)',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
  },
  kpiBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  kpiLabel: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  subMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  cardActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
  },
  cardBodyLocked: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flex: 1,
    justifyContent: 'space-between',
  },
  lockedDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.45,
    margin: 0,
  },
  lockedPriceBox: {
    padding: '0.65rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  lockedQuotaText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  cardActivateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    textDecoration: 'none',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
  activityCard: {
    padding: '1.5rem',
    borderRadius: '12px',
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  activityTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
  },
  activitySub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  humanReviewBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: '600',
    color: 'var(--accent-green)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  activityIconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    minWidth: '220px',
  },
  activityItemTitle: {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    marginBottom: '0.15rem',
  },
  activityItemMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  activityActionLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  roadmapTeaser: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    border: '1px dashed rgba(6, 182, 212, 0.25)',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  roadmapTeaserLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: '260px',
  },
  roadmapTitle: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.2rem 0',
  },
  roadmapSub: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  roadmapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
};
