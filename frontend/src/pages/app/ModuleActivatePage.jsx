import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  Layers,
  Check,
  ChevronLeft,
  Bell,
  ArrowUpRight,
} from 'lucide-react';
import { getRoleByKey } from '../../config/roles';
import { MODULES, formatCurrency } from '../../config/pricing';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLanguage } from '../../context/LanguageContext';
import WaitlistModal from '../../components/common/WaitlistModal';

export default function ModuleActivatePage() {
  const { key } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace, isModuleActive, activateModule } = useWorkspace();
  const { t, lang } = useLanguage();

  const [waitlistRole, setWaitlistRole] = useState(null);
  const [activating, setActivating] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  const role = getRoleByKey(key, lang);

  if (!role) {
    return (
      <div style={styles.notFoundContainer}>
        <div style={styles.notFoundCard} className="card">
          <h2>{t('app.activatePage.notFoundTitle')}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {t('app.activatePage.notFoundDesc')}
          </p>
          <button onClick={() => navigate('/app')} style={styles.primaryBtn}>
            {t('app.activatePage.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  const isAvailable = role.status === 'available';
  const isActive = isModuleActive(role.key);
  const modInfo = MODULES[role.key];
  const price = modInfo?.price || 0;
  const getModuleDesc = (moduleKey) => {
    if (moduleKey === 'seo') return t('common.moduleDescSeo');
    if (moduleKey === 'ads_report') return t('common.moduleDescAdsReport');
    if (moduleKey === 'ads_spy') return t('common.moduleDescAdsSpy');
    return modInfo?.desc || '';
  };
  const quota = modInfo
    ? t('common.moduleQuotaMonthly', {
        credits: modInfo.monthlyCredits,
        desc: getModuleDesc(role.key)
      })
    : t('app.activatePage.unlimitedAccess');

  const getModuleHomePath = (roleKey) => {
    if (roleKey === 'seo') return '/app/seo/keywords';
    if (roleKey === 'ads_report') return '/app/ads';
    if (roleKey === 'ads_spy') return '/app/spy';
    return '/app/ads';
  };

  const handleActivate = () => {
    setActivating(true);
    setTimeout(() => {
      activateModule(role.key);
      setActivating(false);
      setJustActivated(true);
    }, 450);
  };

  return (
    <div style={styles.page}>
      {/* Top Bar Navigasi */}
      <div style={styles.topBar}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <ChevronLeft size={16} />
          <span>{t('common.back')}</span>
        </button>
        <span style={styles.workspaceIndicator}>
          {`${t('app.moduleActivate.workspacePrefix')} `}<strong>{activeWorkspace?.name}</strong>
        </span>
      </div>

      <div style={styles.content}>
        {/* Banner Status Modul Aktif */}
        {(isActive || justActivated) && (
          <div style={styles.activeBanner}>
            <div style={styles.activeBannerContent}>
              <CheckCircle2 size={20} color="var(--accent-green)" />
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                  {t('app.activatePage.activeBannerTitle', { name: activeWorkspace?.name })}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('app.activatePage.fullAccessNotice', { role: role.name })}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate(getModuleHomePath(role.key))}
              style={styles.openModuleBtn}
            >
              <span>{t('dashboard.openModule', 'Open Module')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        <div style={styles.grid} className="responsive-split-grid">
          {/* Sisi Kiri: Detail Role & Fitur */}
          <div style={styles.leftCol}>
            <div style={styles.roleHeaderCard} className="card">
              <div style={styles.badgeRow}>
                <span style={styles.categoryBadge}>{role.category}</span>
                {isAvailable ? (
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: 'var(--accent-green)',
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Check size={12} />
                    {t('rolesGrid.statusAvailable', 'Available')}
                  </span>
                ) : (
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      color: 'var(--accent-yellow)',
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <Clock size={12} />
                    {t('rolesGrid.statusSoon', 'Coming Soon')}
                  </span>
                )}
              </div>

              <h1 style={styles.title}>{role.name}</h1>
              <p style={styles.description}>{role.longDescription || role.description}</p>

              {/* Deliverables Box */}
              {role.deliverables && (
                <div style={styles.deliverablesBox}>
                  <div style={styles.deliverablesLabel}>
                    <Layers size={14} color="var(--accent-cyan)" />
                    <span>{t('roleDetail.deliverablesTitle', 'Expected Deliverables')}</span>
                  </div>
                  <p style={styles.deliverablesText}>{role.deliverables}</p>
                </div>
              )}
            </div>

            {/* Daftar Kemampuan & Fitur */}
            {role.features && role.features.length > 0 && (
              <div style={styles.featuresCard} className="card">
                <h3 style={styles.sectionHeading}>
                  <Zap size={16} color="var(--accent-cyan)" />
                  {t('activatePage.featuresTitle', 'Core AI Capabilities')}
                </h3>
                <div style={styles.featuresList}>
                  {role.features.map((feat, idx) => (
                    <div key={idx} style={styles.featureItem}>
                      <div style={styles.checkIconBox}>
                        <Check size={13} color="var(--accent-cyan)" />
                      </div>
                      <span style={styles.featureText}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sisi Kanan: Kartu Pembelian / Waitlist */}
          <div style={styles.rightCol}>
            {isAvailable ? (
              <div style={styles.actionCard} className="card">
                <div style={styles.actionHeader}>
                  <div style={styles.lockIconBox}>
                    {isActive ? (
                      <CheckCircle2 size={24} color="var(--accent-green)" />
                    ) : (
                      <Lock size={24} color="var(--accent-cyan)" />
                    )}
                  </div>
                  <div>
                    <span style={styles.planSub}>{t('activatePage.pricingCardTitle', 'Module Pricing')}</span>
                    <div style={styles.priceRow}>
                      <span style={styles.priceNumber}>{formatCurrency(price, lang)}</span>
                      <span style={styles.pricePeriod}>{t('bundles.lifetimeBadge', 'Lifetime Access')}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.quotaBox}>
                  <span style={styles.quotaTitle}>{t('roleDetail.quotaTitle', 'Included Quota:')}</span>
                  <p style={styles.quotaValue}>{quota}</p>
                </div>

                <div style={styles.actionBenefits}>
                  <div style={styles.benefitRow}>
                    <Check size={14} color="var(--accent-green)" />
                    <span>{t('app.activatePage.benefitAuto')}</span>
                  </div>
                  <div style={styles.benefitRow}>
                    <Check size={14} color="var(--accent-green)" />
                    <span>{t('app.activatePage.benefitHitl')}</span>
                  </div>
                  <div style={styles.benefitRow}>
                    <Check size={14} color="var(--accent-green)" />
                    <span>{t('app.activatePage.benefitCancel')}</span>
                  </div>
                </div>

                {isActive ? (
                  <button
                    onClick={() => navigate(getModuleHomePath(role.key))}
                    style={styles.actionPrimaryBtn}
                  >
                    <span>{t('dashboard.openModule', 'Open Console')}</span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleActivate}
                    disabled={activating}
                    style={styles.actionPrimaryBtn}
                  >
                    {activating ? (
                      <span>{t('activatePage.activating', 'Activating Module...')}</span>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>{t('activatePage.btnActivate', 'Activate Module Now (1-Click)')}</span>
                      </>
                    )}
                  </button>
                )}

                <div style={styles.bundleHint}>
                  <span style={styles.bundleHintText}>
                    {t('app.moduleActivate.bundleHint')}
                  </span>
                  <Link to="/app/billing" style={styles.bundleLink}>
                    <span>{t('app.moduleActivate.bundleCta')}</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div style={styles.securityNote}>
                  <Shield size={14} color="var(--text-muted)" />
                  <span>{t('app.moduleActivate.securityNote')}</span>
                </div>
              </div>
            ) : (
              <div style={styles.actionCard} className="card">
                <div style={styles.actionHeader}>
                  <div
                    style={{
                      ...styles.lockIconBox,
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    }}
                  >
                    <Clock size={24} color="var(--accent-yellow)" />
                  </div>
                  <div>
                    <span style={styles.planSub}>{t('app.moduleActivate.devStatus')}</span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {t('app.moduleActivate.comingSoon')}
                    </h3>
                  </div>
                </div>

                <p style={styles.soonNotice}>
                  {t('app.moduleActivate.soonNotice', { name: role.name })}
                </p>

                <button
                  onClick={() => setWaitlistRole(role)}
                  style={{
                    ...styles.actionPrimaryBtn,
                    backgroundColor: 'var(--accent-yellow)',
                    color: '#000000',
                  }}
                >
                  <Bell size={16} />
                  <span>{t('app.moduleActivate.waitlistBtn')}</span>
                </button>

                <div style={styles.securityNote}>
                  <Sparkles size={14} color="var(--accent-cyan)" />
                  <span>{t('app.moduleActivate.waitlistPerk')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Waitlist untuk Role Segera Hadir */}
      {waitlistRole && (
        <WaitlistModal
          role={waitlistRole}
          onClose={() => setWaitlistRole(null)}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '1.5rem',
    maxWidth: '1100px',
    margin: '0 auto',
    overflowY: 'auto',
    height: '100%',
  },
  notFoundContainer: {
    padding: '3rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundCard: {
    maxWidth: '450px',
    textAlign: 'center',
    padding: '2rem',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    transition: 'color var(--transition-fast)',
  },
  workspaceIndicator: {
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  activeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    flexWrap: 'wrap',
  },
  activeBannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  openModuleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.55rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-green)',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.825rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  roleHeaderCard: {
    padding: '1.75rem',
    borderRadius: '12px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '1rem',
  },
  categoryBadge: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    border: '1px solid transparent',
  },
  title: {
    fontSize: 'clamp(1.3rem, 4vw, 1.65rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 0.75rem 0',
    lineHeight: 1.25,
  },
  description: {
    fontSize: '0.925rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 1.25rem 0',
  },
  deliverablesBox: {
    padding: '1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  deliverablesLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.35rem',
  },
  deliverablesText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  featuresCard: {
    padding: '1.5rem',
    borderRadius: '12px',
  },
  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 1rem 0',
  },
  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
  },
  checkIconBox: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  featureText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  actionCard: {
    padding: '1.75rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  lockIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planSub: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  priceNumber: {
    fontSize: '1.45rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  pricePeriod: {
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
  },
  quotaBox: {
    padding: '0.85rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  quotaTitle: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.2rem',
  },
  quotaValue: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  },
  actionBenefits: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  benefitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  actionPrimaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    padding: '0.8rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.9rem',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
    transition: 'all var(--transition-fast)',
  },
  bundleHint: {
    padding: '0.85rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    border: '1px dashed rgba(6, 182, 212, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  bundleHintText: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  bundleLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: 'var(--accent-cyan)',
    fontSize: '0.78rem',
    fontWeight: '700',
    textDecoration: 'none',
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  soonNotice: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  primaryBtn: {
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
