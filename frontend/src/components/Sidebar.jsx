import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Terminal,
  BarChart2,
  Settings,
  LogOut,
  User,
  CreditCard,
  LayoutDashboard,
  Link2,
  FileText,
  Menu,
  X,
  Lock,
  Eye,
  Users,
  Sparkles,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Coins,
  Shield,
  LayoutTemplate,
} from 'lucide-react';
import WorkspaceSelector from './common/WorkspaceSelector';
import MarkimateLogo from './common/MarkimateLogo';
import { useWorkspace } from '../context/WorkspaceContext';
import { ROLES, getLocalizedRole } from '../config/roles';
import { getCredits } from '../api';
import { isSpyMock } from '../spy/spyApi';
import { TRIAL } from '../config/pricing';

import { useLanguage, LanguageToggle } from '../context/LanguageContext';
import { formatNumber } from '../lib/format';
import { SiteLink } from '../lib/hosts';

export default function Sidebar({ user, onLogout, plan, usage }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soonExpanded, setSoonExpanded] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const [creditsData, setCreditsData] = useState(null);

  useEffect(() => {
    let unmounted = false;
    const fetchCredits = async () => {
      try {
        const data = await getCredits();
        if (!unmounted && data) setCreditsData(data);
      } catch {
        // Fallback default
      }
    };
    fetchCredits();
    window.addEventListener('markimate:credits_updated', fetchCredits);
    window.addEventListener('supermat:credits_updated', fetchCredits);
    return () => {
      unmounted = true;
      window.removeEventListener('markimate:credits_updated', fetchCredits);
      window.removeEventListener('supermat:credits_updated', fetchCredits);
    };
  }, [user]);

  const totalCredits = creditsData?.balance?.total ?? 0;
  const isUnlimited = Boolean(user?.isPlatformAdmin || creditsData?.isUnlimited);
  const isTrialActive = Boolean(creditsData?.trial?.active);
  const trialDaysLeft = creditsData?.trial?.daysLeft ?? 0;
  const maxBaseline = isTrialActive ? TRIAL.credits : (creditsData?.dailyCap || 500);
  const creditPct = maxBaseline > 0 ? Math.min(100, Math.round((totalCredits / maxBaseline) * 100)) : 0;

  let barColor = 'var(--accent-cyan)';
  if (totalCredits === 0) {
    barColor = 'var(--accent-red)';
  } else if (creditPct <= 20) {
    barColor = 'var(--accent-yellow)';
  }

  const activeModules = activeWorkspace?.modules || ['seo', 'ads_report', 'ads_spy'];

  const isSeoActive = activeModules.includes('seo');
  const isAdsActive = activeModules.includes('ads_report');
  const isSpyActive = activeModules.includes('ads_spy');

  // 1. Modul-modul aktif yang dibeli
  const activeSections = [];

  if (isSeoActive) {
    activeSections.push({
      group: t('sidebar.sectionSeo', 'AI SEO Specialist'),
      moduleKey: 'seo',
      items: [
        {
          id: 'seo-keywords',
          path: '/app/seo/keywords',
          label: t('sidebar.seoKeywords', 'Keyword & Content Control'),
          icon: Terminal,
        },
        {
          id: 'seo-topics',
          path: '/app/seo/topics',
          label: t('sidebar.seoTopics', 'Topik Otomatis (Trends)'),
          icon: TrendingUp,
        },
        {
          id: 'seo-analytics',
          path: '/app/seo/analytics',
          label: t('sidebar.seoAnalytics', 'SEO Analytics'),
          icon: BarChart2,
        },
        {
          id: 'seo-settings',
          path: '/app/seo/settings',
          label: t('sidebar.seoSettings', 'CMS & API Settings'),
          icon: Settings,
        },
      ],
    });
  }

  if (isAdsActive) {
    activeSections.push({
      group: t('sidebar.sectionAds', 'AI Ads Performance Reporter'),
      moduleKey: 'ads_report',
      badge: null,
      items: [
        {
          id: 'ads-summary',
          path: '/app/ads',
          label: t('sidebar.adsOverview', 'Executive Summary'),
          icon: LayoutDashboard,
          exact: true,
        },
        {
          id: 'ads-connections',
          path: '/app/ads/connections',
          label: t('sidebar.adsConnections', 'Ad Channel Accounts'),
          icon: Link2,
        },
        {
          id: 'ads-reports',
          path: '/app/ads/reports',
          label: t('sidebar.adsReports', 'Monthly Reports & Slides'),
          icon: FileText,
          matchPrefix: true,
        },
        {
          id: 'ads-templates',
          path: '/app/ads/templates',
          label: t('sidebar.adsTemplates', 'Templates & Metrics'),
          icon: LayoutTemplate,
          matchPrefix: true,
        },
      ],
    });
  }

  if (isSpyActive) {
    const spySoon = !isSpyMock();
    activeSections.push({
      group: t('sidebar.sectionSpy', 'AI Ads Creative Spy'),
      moduleKey: 'ads_spy',
      badge: spySoon ? t('common.soon') : null,
      items: [
        {
          id: 'spy-summary',
          path: '/app/spy',
          label: t('sidebar.spyOverview', 'Spy Overview'),
          icon: Eye,
          exact: true,
        },
        {
          id: 'spy-competitors',
          path: '/app/spy/competitors',
          label: t('sidebar.spyCompetitors', 'Tracked Competitors'),
          icon: Users,
        },
        {
          id: 'spy-library',
          path: '/app/spy/library',
          label: t('sidebar.spyLibrary', 'Ad Creative Library'),
          icon: Sparkles,
        },
        {
          id: 'spy-insights',
          path: '/app/spy/insights',
          label: t('sidebar.spyInsights', 'Weekly Intelligence'),
          icon: TrendingUp,
        },
      ],
    });
  }

  // 2. Modul tersedia tapi belum dibeli (terkunci dengan ikon gembok)
  const lockedRoles = [];
  if (!isSeoActive) {
    lockedRoles.push({
      key: 'seo',
      name: t('sidebar.sectionSeo', 'AI SEO Specialist'),
      category: 'Content',
      path: '/app/modules/seo',
      icon: Terminal,
    });
  }
  if (!isAdsActive) {
    lockedRoles.push({
      key: 'ads_report',
      name: t('sidebar.sectionAds', 'AI Ads Performance Reporter'),
      category: 'Ads',
      path: '/app/modules/ads_report',
      icon: LayoutDashboard,
    });
  }
  if (!isSpyActive) {
    lockedRoles.push({
      key: 'ads_spy',
      name: t('sidebar.sectionSpy', 'AI Ads Creative Spy'),
      category: 'Research',
      path: '/app/modules/ads_spy',
      icon: Eye,
    });
  }

  // 3. Modul segera hadir (13 role)
  const soonRoles = ROLES.filter((r) => r.status === 'soon');

  const isItemActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    if (item.matchPrefix) return location.pathname.startsWith(item.path);
    return location.pathname === item.path;
  };

  const handleNavClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <div style={styles.mobileBar} className="mobile-top-bar">
        <SiteLink to="/" style={{ ...styles.mobileBrand, textDecoration: 'none' }}>
          <MarkimateLogo size={20} />
          <span style={styles.mobileTitle}>Markimate</span>
        </SiteLink>
        <div style={styles.mobileBarRight}>
          <button
            onClick={() => handleNavClick('/app/billing/credits')}
            style={styles.mobileCreditChip}
            title={t('common.viewCreditWallet')}
          >
            <Coins size={13} color={barColor} />
            <span style={{ ...styles.mobileCreditNum, color: totalCredits === 0 && !isUnlimited ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {isUnlimited ? t('billing.unlimitedBalance', '∞ Unlimited') : formatNumber(totalCredits, lang)}
            </span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={styles.hamburgerBtn}
            aria-label={t('common.toggleNav')}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Overlay Backdrop pada Mobile */}
      {mobileOpen && (
        <div
          style={styles.backdrop}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`app-sidebar ${mobileOpen ? 'drawer-open' : ''}`}
        style={{
          ...styles.sidebar,
          ...(mobileOpen ? styles.sidebarMobileOpen : {}),
        }}
      >
        {/* Branding Header */}
        <div style={styles.brand}>
          <SiteLink to="/" style={{ ...styles.brandLeft, textDecoration: 'none' }}>
            <div style={styles.logoBox}>
              <MarkimateLogo size={24} />
            </div>
            <div>
              <div style={styles.brandTitleRow}>
                <h2 style={styles.brandTitle}>Markimate</h2>
              </div>
              <span style={styles.brandVersion}>powered by 3our</span>
            </div>
          </SiteLink>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              style={styles.closeDrawerBtn}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Pemilih Workspace / Multi-brand */}
        <WorkspaceSelector />

        {/* User Info Card */}
        <div style={styles.userCard}>
          <div style={styles.avatar}>
            <User size={16} color="var(--text-secondary)" />
          </div>
          <div style={styles.userInfo}>
            <p style={styles.userName} title={activeWorkspace?.name || user?.brandName}>
              {activeWorkspace?.name || user?.brandName || t('sidebar.myBrand')}
            </p>
            <span style={styles.userRole}>
              {user?.role === 'admin' ? `🛡️ ${t('sidebar.admin3Our')}` : user?.email}
            </span>
          </div>
        </div>

        {/* Chip Saldo Credit & Progress Bar (PRD §5) */}
        <div
          onClick={() => handleNavClick('/app/billing/credits')}
          style={styles.creditChip}
          className="credit-wallet-chip"
          title={t('common.viewCreditWallet')}
          role="button"
          tabIndex={0}
        >
          <div style={styles.creditChipTop}>
            <div style={styles.creditChipLeft}>
              <div style={styles.coinIconBox}>
                <Coins size={14} color={barColor} />
              </div>
              <span style={styles.creditChipLabel}>
                {t('sidebar.creditsLabel')}
              </span>
            </div>
            <div style={styles.creditChipRight}>
              <span
                style={{
                  ...styles.creditChipAmount,
                  color: totalCredits === 0 && !isUnlimited ? 'var(--accent-red)' : 'var(--text-primary)',
                }}
              >
                {isUnlimited ? t('billing.unlimitedBalance', '∞ Unlimited') : formatNumber(totalCredits, lang)}
              </span>
              {!isUnlimited && <span style={styles.creditChipUnit}>cr</span>}
            </div>
          </div>

          {/* Progress Bar Saldo atau Badge Admin */}
          {isUnlimited ? (
            <div style={styles.adminBadgeRow}>
              <span style={styles.adminUnlimitedBadge}>
                <Shield size={11} color="var(--accent-cyan)" />
                <span>{t('sidebar.adminUnlimitedBadge', 'Admin · Unlimited')}</span>
              </span>
            </div>
          ) : (
            <>
              <div style={styles.creditProgressTrack}>
                <div
                  style={{
                    ...styles.creditProgressFill,
                    width: `${creditPct}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              {/* Badge Trial jika masih aktif */}
              {isTrialActive && (
                <div style={styles.trialBadgeRow}>
                  <span style={styles.trialBadge}>
                    {`⚡ ${t('sidebar.creditTrialBadge', { days: trialDaysLeft })}`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation Sections */}
        <nav style={styles.navScroll}>
          {/* 0. Dashboard Workspace */}
          <div style={styles.sectionBlock}>
            <div style={styles.itemsList}>
              <button
                onClick={() => handleNavClick('/app')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app' && <div style={styles.activeBar} />}
                <LayoutGrid
                  size={17}
                  color={
                    location.pathname === '/app'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.hubDashboard', 'Team Overview')}</span>
              </button>
            </div>
          </div>

          {/* 1. Modul-modul Aktif */}
          {activeSections.map((section, sIdx) => (
            <div key={sIdx} style={styles.sectionBlock}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionGroupTitle}>{section.group}</span>
                {section.badge && (
                  <span style={styles.soonSectionBadge}>{section.badge}</span>
                )}
              </div>

              <div style={styles.itemsList}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.path)}
                      style={{
                        ...styles.navLink,
                        ...(active ? styles.navLinkActive : {}),
                      }}
                    >
                      {active && <div style={styles.activeBar} />}
                      <Icon
                        size={17}
                        color={active ? 'var(--accent-cyan)' : 'var(--text-secondary)'}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 2. Modul Tersedia tapi Terkunci (Belum Diaktifkan untuk Workspace Ini) */}
          {lockedRoles.length > 0 && (
            <div style={styles.sectionBlock}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionGroupTitle}>{t('sidebar.sectionLocked', 'Unlock More Roles')}</span>
              </div>
              <div style={styles.itemsList}>
                {lockedRoles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.key}
                      onClick={() => handleNavClick(role.path)}
                      style={styles.lockedNavLink}
                      title={t('app.activatePage.activateRoleTitle', { name: role.name })}
                    >
                      <Icon size={16} color="var(--text-muted)" />
                      <span style={styles.lockedLabel}>{role.name}</span>
                      <span style={styles.lockedBadge}>
                        <Lock size={10} />
                        {t('sidebar.lockedBadge', 'Locked')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Modul Segera Hadir (Collapsible Accordion) */}
          <div style={styles.sectionBlock}>
            <button
              onClick={() => setSoonExpanded(!soonExpanded)}
              style={styles.soonHeaderBtn}
              type="button"
            >
              <div style={styles.soonHeaderLeft}>
                <span style={styles.sectionGroupTitle}>{t('sidebar.sectionSoon', { soonRoles: soonRoles.length })}</span>
                <span style={styles.soonCountBadge}>{soonRoles.length}</span>
              </div>
              {soonExpanded ? (
                <ChevronDown size={14} color="var(--text-muted)" />
              ) : (
                <ChevronRight size={14} color="var(--text-muted)" />
              )}
            </button>

            {soonExpanded && (
              <div style={styles.soonList}>
                {soonRoles.map((role) => {
                  const localized = getLocalizedRole(role, lang);
                  return (
                    <button
                      key={role.key}
                      onClick={() => handleNavClick(`/app/modules/${role.key}`)}
                      style={styles.soonItemBtn}
                      title={localized.description}
                    >
                      <Clock size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span style={styles.soonItemName}>{localized.name}</span>
                      <span style={styles.soonCategoryTag}>{role.category}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Pengaturan Akun & Tagihan */}
          <div style={styles.sectionBlock}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionGroupTitle}>{t('settings.accountTab')}</span>
            </div>
            <div style={styles.itemsList}>
              <button
                onClick={() => handleNavClick('/app/billing/credits')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app/billing/credits' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app/billing/credits' && <div style={styles.activeBar} />}
                <Coins
                  size={17}
                  color={
                    location.pathname === '/app/billing/credits'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.credits', 'Dompet Credit')}</span>
              </button>
              <button
                onClick={() => handleNavClick('/app/billing')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app/billing' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app/billing' && <div style={styles.activeBar} />}
                <CreditCard
                  size={17}
                  color={
                    location.pathname === '/app/billing'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.billing')}</span>
              </button>
              <button
                onClick={() => handleNavClick('/app/settings/account')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app/settings/account' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app/settings/account' && <div style={styles.activeBar} />}
                <User
                  size={17}
                  color={
                    location.pathname === '/app/settings/account'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.account', 'Profil & Akun')}</span>
              </button>
              <button
                onClick={() => handleNavClick('/app/settings/members')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app/settings/members' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app/settings/members' && <div style={styles.activeBar} />}
                <Users
                  size={17}
                  color={
                    location.pathname === '/app/settings/members'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.members', 'Members & Team')}</span>
              </button>
              <button
                onClick={() => handleNavClick('/app/settings/security')}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/app/settings/security' ? styles.navLinkActive : {}),
                }}
              >
                {location.pathname === '/app/settings/security' && <div style={styles.activeBar} />}
                <Shield
                  size={17}
                  color={
                    location.pathname === '/app/settings/security'
                      ? 'var(--accent-cyan)'
                      : 'var(--text-secondary)'
                  }
                />
                <span>{t('sidebar.security', 'Keamanan & Sesi')}</span>
              </button>
            </div>
          </div>

          {/* 5. Menu Admin Platform (Khusus Platform Admin) */}
          {user?.isPlatformAdmin && (
            <div style={styles.sectionBlock}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionGroupTitle}>{t('sidebar.sectionAdmin', 'Platform Administration')}</span>
              </div>
              <div style={styles.itemsList}>
                <button
                  onClick={() => handleNavClick('/app/admin')}
                  style={{
                    ...styles.navLink,
                    ...(location.pathname.startsWith('/app/admin') ? styles.navLinkActive : {}),
                  }}
                >
                  {location.pathname.startsWith('/app/admin') && <div style={styles.activeBar} />}
                  <Shield
                    size={17}
                    color={
                      location.pathname.startsWith('/app/admin')
                        ? 'var(--accent-cyan)'
                        : 'var(--text-secondary)'
                    }
                  />
                  <span>{t('sidebar.adminConsole', 'Admin Console')}</span>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Footer Language Switcher & Logout */}
        <div style={styles.footer}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.65rem' }}>
            <LanguageToggle />
          </div>
          <button onClick={onLogout} style={styles.logoutBtn} className="logout-btn">
            <LogOut size={17} />
            <span>{t('sidebar.logout', 'Sign Out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

const styles = {
  mobileBar: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-muted)',
    padding: '0 1rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  mobileBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  mobileTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  hamburgerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '0.4rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(3px)',
    zIndex: 140,
  },
  sidebar: {
    width: '260px',
    backgroundColor: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '1.25rem',
    flexShrink: 0,
    transition: 'transform var(--transition-smooth)',
    zIndex: 150,
  },
  sidebarMobileOpen: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    boxShadow: 'var(--shadow-lg)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  brandLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  brandTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.1,
  },
  brandVersion: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  closeDrawerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.65rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    marginBottom: '1.25rem',
  },
  avatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-surface-hover)',
    flexShrink: 0,
  },
  userInfo: {
    minWidth: 0,
    flex: 1,
  },
  userName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    margin: 0,
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  navScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    flex: 1,
    overflowY: 'auto',
    paddingRight: '0.2rem',
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0.5rem 0.25rem 0.5rem',
  },
  soonSectionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: 'var(--accent-yellow)',
    fontSize: '0.62rem',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  sectionGroupTitle: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  navLink: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.75rem',
    fontSize: '0.825rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
    width: '100%',
  },
  navLinkActive: {
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: '20%',
    height: '60%',
    width: '3px',
    backgroundColor: 'var(--accent-cyan)',
    borderRadius: '0 4px 4px 0',
  },
  footer: {
    marginTop: 'auto',
    borderTop: '1px solid var(--border-muted)',
    paddingTop: '0.75rem',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.75rem',
    fontSize: '0.825rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    borderRadius: '6px',
    textAlign: 'left',
    transition: 'color var(--transition-fast)',
  },
  lockedNavLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    border: '1px dashed rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    borderRadius: '6px',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
    width: '100%',
  },
  lockedLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  lockedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
  },
  soonHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.4rem 0.5rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
  },
  soonHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  soonCountBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.1rem 0.35rem',
    borderRadius: '999px',
    border: '1px solid var(--border-muted)',
  },
  soonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    paddingLeft: '0.25rem',
    marginTop: '0.2rem',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  soonItemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color var(--transition-fast)',
  },
  soonItemName: {
    flex: 1,
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  soonCategoryTag: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '0.1rem 0.3rem',
    borderRadius: '4px',
  },
  mobileBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  mobileCreditChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.6rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  mobileCreditNum: {
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  creditChip: {
    margin: '0.5rem 0 0.8rem 0',
    padding: '0.65rem 0.8rem',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  creditChipTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditChipLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  coinIconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  creditChipLabel: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  creditChipRight: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.2rem',
  },
  creditChipAmount: {
    fontSize: '0.95rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  creditChipUnit: {
    fontSize: '0.65rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  creditProgressTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  creditProgressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s ease, background-color 0.3s ease',
  },
  trialBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '0.1rem',
  },
  trialBadge: {
    fontSize: '0.68rem',
    fontWeight: '600',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '4px',
    padding: '0.15rem 0.45rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
  },
  adminBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '0.1rem',
  },
  adminUnlimitedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    letterSpacing: '0.02em',
  },
};
