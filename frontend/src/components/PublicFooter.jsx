import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import { LocalizedLink } from '../lib/localized-router';
import MarkimateLogo from './common/MarkimateLogo';

export default function PublicFooter() {
  const { t } = useLanguage();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.topRow}>
          {/* Company info */}
          <div style={styles.companyCol}>
            <div style={styles.legalName}>
              <MarkimateLogo size={20} />
              <strong>Markimate</strong>
              <span style={styles.brandTag}>powered by 3our</span>
            </div>
            <div style={styles.addressLine}>
              <MapPin size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span>{t('footer.address', 'Jl. BSD Raya Utama, Tangerang Regency, Banten, Indonesia')}</span>
            </div>
            <div style={styles.emailLine}>
              <Mail size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <a href="mailto:info@3ourasia.id" style={styles.emailLink}>info@3ourasia.id</a>
            </div>
            <div style={styles.emailLine}>
              <Phone size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <a href="https://wa.me/6285179642520" target="_blank" rel="noreferrer" style={styles.emailLink}>+62 851-7964-2520</a>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <LanguageSwitcher size="small" />
            </div>
          </div>

          {/* Links col */}
          <div style={styles.linksCol}>
            <span style={styles.linksTitle}>{t('footer.platformLegal', 'Platform & Legal')}</span>
            <div style={styles.linksGroup}>
              <LocalizedLink to="/privacy" style={styles.link}>
                <ShieldCheck size={14} color="var(--accent-green)" />
                <span>{t('footer.privacy', 'Privacy Policy')}</span>
              </LocalizedLink>
              <LocalizedLink to="/terms" style={styles.link}>
                <span>{t('footer.terms', 'Terms of Service')}</span>
              </LocalizedLink>
              <LocalizedLink to="/data-deletion" style={styles.link}>
                <span>{t('footer.dataDeletion', 'Data Deletion')}</span>
              </LocalizedLink>
              <LocalizedLink to="/login" style={styles.link}>
                <span>{t('footer.loginPortal', 'Client Portal Login')}</span>
              </LocalizedLink>
            </div>
          </div>
        </div>

        <div style={styles.bottomRow}>
          <span style={styles.copyright}>
            © {new Date().getFullYear()} Markimate · powered by 3our. {t('footer.rights', 'All rights reserved.')}
          </span>
          <span style={styles.metaNote}>
            {t('footer.slogan', 'Full Digital Marketing Team in One Platform')}
          </span>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    borderTop: '1px solid var(--border-muted)',
    backgroundColor: '#09090b',
    padding: 'clamp(2rem, 4vw, 3rem) clamp(1rem, 3vw, 1.5rem) 2rem clamp(1rem, 3vw, 1.5rem)',
    color: 'var(--text-secondary)',
    marginTop: 'auto',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '2rem',
    paddingBottom: '2rem',
    borderBottom: '1px solid var(--border-muted)',
  },
  companyCol: {
    maxWidth: '460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  legalName: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
  },
  brandTag: {
    fontSize: '0.8rem',
    color: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  addressLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  emailLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
  },
  emailLink: {
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  linksCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  linksTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  linksGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
  bottomRow: {
    paddingTop: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  copyright: {},
  metaNote: {
    fontFamily: 'var(--font-mono)',
  },
};
