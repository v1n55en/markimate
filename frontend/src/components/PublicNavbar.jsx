import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn, Menu, X } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import MarkimateLogo from './common/MarkimateLogo';

export default function PublicNavbar() {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.brand} onClick={() => setMobileMenuOpen(false)}>
          <div style={styles.logoBox}>
            <MarkimateLogo size={24} />
          </div>
          <div>
            <span style={styles.brandTitle}>Markimate</span>
            <span style={styles.brandSub}>powered by 3our</span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav style={styles.nav} className="hide-on-mobile">
          <a href="/#roles" style={styles.navLink}>{t('nav.teamRoles', 'AI Roles')}</a>
          <a href="/#how-it-works" style={styles.navLink}>{t('nav.howItWorks', 'How It Works')}</a>
          <a href="/#pricing" style={styles.navLink}>{t('nav.pricing', 'Pricing')}</a>
          <Link to="/privacy" style={styles.navLink}>{t('nav.privacy', 'Privacy')}</Link>
        </nav>

        {/* Desktop CTA Group */}
        <div style={styles.ctaGroup} className="hide-on-mobile">
          <LanguageSwitcher />
          <Link to="/login" style={styles.loginBtn}>
            <LogIn size={15} />
            <span>{t('nav.login', 'Sign In')}</span>
          </Link>
          <Link to="/register" style={styles.registerBtn}>
            <span>{t('nav.register', 'Start 7-Day Free Trial')}</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Mobile Action Controls: Language Switcher + Hamburger */}
        <div style={styles.mobileActions} className="show-on-mobile">
          <LanguageSwitcher size="small" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={styles.mobileToggleBtn}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div style={styles.mobileDropdown}>
          <nav style={styles.mobileNavList}>
            <a
              href="/#roles"
              style={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.teamRoles', 'AI Roles')}
            </a>
            <a
              href="/#how-it-works"
              style={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.howItWorks', 'How It Works')}
            </a>
            <a
              href="/#pricing"
              style={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.pricing', 'Pricing')}
            </a>
            <Link
              to="/privacy"
              style={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.privacy', 'Privacy')}
            </Link>
          </nav>

          <div style={styles.mobileDrawerCtas}>
            <Link
              to="/login"
              style={styles.mobileLoginBtn}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LogIn size={16} />
              <span>{t('nav.login', 'Sign In')}</span>
            </Link>
            <Link
              to="/register"
              style={styles.mobileRegisterBtn}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{t('nav.register', 'Start 7-Day Free Trial')}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    borderBottom: '1px solid var(--border-muted)',
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    backdropFilter: 'blur(16px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0.75rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    textDecoration: 'none',
    minWidth: 0,
  },
  logoBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    display: 'block',
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  navLink: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
  ctaGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  loginBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.825rem',
    fontWeight: '500',
    textDecoration: 'none',
  },
  registerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    textDecoration: 'none',
  },
  mobileActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  mobileToggleBtn: {
    background: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    padding: '0.4rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDropdown: {
    borderTop: '1px solid var(--border-muted)',
    backgroundColor: 'rgba(9, 9, 11, 0.98)',
    backdropFilter: 'blur(16px)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    animation: 'fadeIn 0.2s ease',
  },
  mobileNavList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  mobileNavLink: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    padding: '0.4rem 0',
    borderBottom: '1px solid rgba(39, 39, 42, 0.5)',
  },
  mobileDrawerCtas: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    paddingTop: '0.5rem',
  },
  mobileLoginBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    textDecoration: 'none',
    width: '100%',
  },
  mobileRegisterBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '0.9rem',
    fontWeight: '700',
    textDecoration: 'none',
    width: '100%',
  },
};

