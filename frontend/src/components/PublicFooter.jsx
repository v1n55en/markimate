import { Link } from 'react-router-dom';
import { Mail, MapPin, Building2, ShieldCheck } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.topRow}>
          {/* Company info */}
          <div style={styles.companyCol}>
            <div style={styles.legalName}>
              <Building2 size={16} color="var(--accent-cyan)" />
              <strong>PT Stambha Racana Ahita</strong>
              <span style={styles.brandTag}>· 3Our Indonesia</span>
            </div>
            <div style={styles.addressLine}>
              <MapPin size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span>Jl. BSD Raya Utama, Kabupaten Tangerang, Banten, Indonesia</span>
            </div>
            <div style={styles.emailLine}>
              <Mail size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <a href="mailto:3our.id@gmail.com" style={styles.emailLink}>3our.id@gmail.com</a>
            </div>
          </div>

          {/* Links col */}
          <div style={styles.linksCol}>
            <span style={styles.linksTitle}>Platform & Hukum</span>
            <div style={styles.linksGroup}>
              <Link to="/privacy" style={styles.link}>
                <ShieldCheck size={14} color="var(--accent-green)" />
                <span>Kebijakan Privasi</span>
              </Link>
              <Link to="/terms" style={styles.link}>
                <span>Syarat & Ketentuan Layanan</span>
              </Link>
              <Link to="/login" style={styles.link}>
                <span>Portal Masuk Pengguna</span>
              </Link>
            </div>
          </div>
        </div>

        <div style={styles.bottomRow}>
          <span style={styles.copyright}>
            © {new Date().getFullYear()} Supermat by 3Our (PT Stambha Racana Ahita). Seluruh hak cipta dilindungi undang-undang.
          </span>
          <span style={styles.metaNote}>
            Modul SEO Automation & Ads Performance Reporting
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
    padding: '3rem 1.5rem 2rem 1.5rem',
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
    gap: '2.5rem',
    paddingBottom: '2.5rem',
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
