import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Terminal,
  BarChart2,
  Settings,
  LogOut,
  Rocket,
  User,
  CreditCard,
  LayoutDashboard,
  Link2,
  FileText,
  Menu,
  X,
} from 'lucide-react';

export default function Sidebar({ user, onLogout, plan, usage }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const used = usage?.runsThisMonth ?? 0;
  const limit = usage?.limit ?? 0;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const isDemo = Boolean(user?.isDemo);

  // Definisi menu navigasi berkelompok
  const navSections = [
    {
      group: 'SEO Automation',
      items: [
        {
          id: 'seo-keywords',
          path: '/app/seo/keywords',
          label: 'Kontrol Automasi',
          icon: Terminal,
        },
        {
          id: 'seo-analytics',
          path: '/app/seo/analytics',
          label: 'Analitik & Insights',
          icon: BarChart2,
        },
        {
          id: 'seo-settings',
          path: '/app/seo/settings',
          label: 'Pengaturan CMS & API',
          icon: Settings,
        },
      ],
      showQuota: true, // Kartu kuota artikel hanya tampil di grup SEO
    },
    {
      group: 'Ads Report',
      items: [
        {
          id: 'ads-summary',
          path: '/app/ads',
          label: 'Ringkasan Ads',
          icon: LayoutDashboard,
          exact: true,
        },
        {
          id: 'ads-connections',
          path: '/app/ads/connections',
          label: 'Koneksi Platform',
          icon: Link2,
        },
        {
          id: 'ads-reports',
          path: '/app/ads/reports',
          label: 'Laporan Iklan',
          icon: FileText,
          matchPrefix: true, // match /app/ads/reports/:reportId juga
        },
      ],
    },
    {
      group: 'Akun',
      items: [
        {
          id: 'billing',
          path: '/app/billing',
          label: 'Langganan',
          icon: CreditCard,
        },
      ],
    },
  ];

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
        <div style={styles.mobileBrand}>
          <Rocket size={18} color="var(--accent-cyan)" />
          <span style={styles.mobileTitle}>Supermat</span>
          {isDemo && <span style={styles.demoBadge}>DEMO</span>}
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={styles.hamburgerBtn}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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
          <div style={styles.brandLeft}>
            <div style={styles.logoBox}>
              <Rocket size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <div style={styles.brandTitleRow}>
                <h2 style={styles.brandTitle}>Supermat</h2>
                {isDemo && <span style={styles.demoBadge}>DEMO</span>}
              </div>
              <span style={styles.brandVersion}>by 3Our · v2.0</span>
            </div>
          </div>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              style={styles.closeDrawerBtn}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* User Info Card */}
        <div style={styles.userCard}>
          <div style={styles.avatar}>
            <User size={16} color="var(--text-secondary)" />
          </div>
          <div style={styles.userInfo}>
            <p style={styles.userName} title={user?.brandName}>
              {user?.brandName || 'My Brand'}
            </p>
            <span style={styles.userRole}>
              {user?.role === 'admin' ? '🛡️ Admin 3Our' : user?.email}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav style={styles.navScroll}>
          {navSections.map((section, sIdx) => (
            <div key={sIdx} style={styles.sectionBlock}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionGroupTitle}>{section.group}</span>
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

              {/* Kuota Artikel - Hanya Tampil di Grup SEO */}
              {section.showQuota && (
                <div style={styles.quotaWrapper}>
                  <div style={styles.planSection}>
                    {plan === 'premium' ? (
                      <button
                        onClick={() => handleNavClick('/app/billing')}
                        style={styles.premiumBadge}
                        title="Kelola langganan"
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>
                          👑 PAKET PRO
                        </span>
                      </button>
                    ) : (
                      <div style={styles.freeBadgeContainer}>
                        <span style={styles.freeBadge}>PAKET FREE</span>
                        <button
                          onClick={() => handleNavClick('/app/billing')}
                          style={styles.upgradeBtn}
                          title="Upgrade ke Pro untuk membuka semua fitur"
                        >
                          👑 Upgrade
                        </button>
                      </div>
                    )}

                    {limit > 0 && (
                      <div
                        style={styles.usageBox}
                        title={`${used} dari ${limit} artikel bulan ini`}
                      >
                        <div style={styles.usageLabel}>
                          <span>Kuota artikel bulan ini</span>
                          <span>{used}/{limit}</span>
                        </div>
                        <div style={styles.usageTrack}>
                          <div
                            style={{
                              ...styles.usageFill,
                              width: `${pct}%`,
                              backgroundColor:
                                pct >= 100 ? 'var(--accent-red)' : 'var(--accent-cyan)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer Logout */}
        <div style={styles.footer}>
          <button onClick={onLogout} style={styles.logoutBtn} className="logout-btn">
            <LogOut size={17} />
            <span>Keluar Akun</span>
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
  demoBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: 'var(--accent-yellow)',
    fontSize: '0.65rem',
    fontWeight: '800',
    letterSpacing: '0.04em',
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
    padding: '0 0.5rem 0.25rem 0.5rem',
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
  quotaWrapper: {
    marginTop: '0.5rem',
    padding: '0 0.25rem',
  },
  planSection: {
    backgroundColor: 'var(--bg-base)',
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
  },
  premiumBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem 0.5rem',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    width: '100%',
  },
  freeBadgeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.2rem 0.4rem',
  },
  freeBadge: {
    fontSize: '0.68rem',
    fontWeight: 'bold',
    color: 'var(--text-muted)',
  },
  upgradeBtn: {
    padding: '0.2rem 0.45rem',
    fontSize: '0.68rem',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#0a84ff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  usageBox: { marginTop: '0.5rem' },
  usageLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    marginBottom: '0.25rem',
  },
  usageTrack: {
    height: '5px',
    borderRadius: '999px',
    backgroundColor: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
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
};
