import { Link } from 'react-router-dom';
import { ArrowRight, LogIn } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import SupermatLogo from './common/SupermatLogo';

export default function PublicNavbar() {
  const { t } = useLanguage();

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.brand}>
          <div style={styles.logoBox}>
            <SupermatLogo size={24} />
          </div>
          <div>
            <span style={styles.brandTitle}>Supermat</span>
            <span style={styles.brandSub}>Powered by 3Our Indonesia</span>
          </div>
        </Link>

        <nav style={styles.nav}>
          <a href="/#roles" style={styles.navLink}>{t('nav.teamRoles', 'AI Roles')}</a>
          <a href="/#how-it-works" style={styles.navLink}>{t('nav.howItWorks', 'How It Works')}</a>
          <a href="/#pricing" style={styles.navLink}>{t('nav.pricing', 'Pricing')}</a>
          <Link to="/privacy" style={styles.navLink}>{t('nav.privacy', 'Privacy')}</Link>
        </nav>

        <div style={styles.ctaGroup}>
          <LanguageSwitcher />
          <Link to="/login" style={styles.loginBtn}>
            <LogIn size={15} />
            <span>{t('nav.login', 'Sign In')}</span>
          </Link>
          <Link to="/register" style={styles.registerBtn}>
            <span>{t('nav.register', 'Start Free Demo')}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    borderBottom: '1px solid var(--border-muted)',
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0.875rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    textDecoration: 'none',
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
  },
  brandTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    display: 'block',
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
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
};
