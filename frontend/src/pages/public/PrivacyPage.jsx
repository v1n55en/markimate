import { ShieldCheck, Mail, MapPin, Phone, Building2, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import SeoHead from '../../components/common/SeoHead';
import { useLanguage } from '../../context/LanguageContext';
import { PRIVACY_CONTENT, LEGAL_PREVAILING_NOTICE } from '../../content/legal-content';

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const content = PRIVACY_CONTENT[lang] || PRIVACY_CONTENT.id;
  const prevailingNotice = LEGAL_PREVAILING_NOTICE[lang] || LEGAL_PREVAILING_NOTICE.id;

  return (
    <div style={styles.page}>
      <SeoHead
        title={content.seoTitle}
        description={content.seoDescription}
        path="/privacy"
      />
      <PublicNavbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.iconBox}>
            <ShieldCheck size={28} color="var(--accent-green)" />
          </div>
          <h1 style={styles.title}>{content.title}</h1>
          <p style={styles.subtitle}>{content.lastUpdated}</p>
        </div>

        {/* Banner Klausul Hukum (Indonesian prevailing clause) */}
        <div style={styles.prevailingBanner}>
          <AlertTriangle size={18} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Notice / Pemberitahuan: </strong>
            {prevailingNotice}
          </div>
        </div>

        <div style={styles.contentCard} className="card">
          {content.sections.map((sec) => (
            <section key={sec.number} style={styles.section}>
              <h2 style={styles.sectionHeading}>
                {sec.number}. {sec.title}
              </h2>

              {sec.alertBox && (
                <div style={styles.alertBox}>
                  <CheckCircle2 size={18} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                  <div>{sec.alertBox}</div>
                </div>
              )}

              {sec.securityBox && (
                <div style={styles.securityBox}>
                  <Lock size={18} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                  <div>{sec.securityBox}</div>
                </div>
              )}

              <p style={styles.paragraph}>{sec.content}</p>

              {sec.bullets && (
                <ul style={styles.bulletList}>
                  {sec.bullets.map((b, bIdx) => (
                    <li key={bIdx}>{b}</li>
                  ))}
                </ul>
              )}

              {sec.ordered && (
                <ol style={styles.orderedList}>
                  {sec.ordered.map((o, oIdx) => (
                    <li key={oIdx}>{o}</li>
                  ))}
                </ol>
              )}

              {sec.hasCompanyBox && (
                <div style={styles.highlightBox}>
                  <div style={styles.companyRow}>
                    <Building2 size={16} color="var(--accent-cyan)" />
                    <span><strong>Entitas / Entity:</strong> {content.companyOfficial}</span>
                  </div>
                  <div style={styles.companyRow}>
                    <MapPin size={16} color="var(--accent-cyan)" />
                    <span><strong>Alamat / Address:</strong> {content.companyAddress}</span>
                  </div>
                  <div style={styles.companyRow}>
                    <Mail size={16} color="var(--accent-cyan)" />
                    <span><strong>Email:</strong> <a href={`mailto:${content.companyEmail}`} style={{ color: 'var(--accent-cyan)' }}>{content.companyEmail}</a></span>
                  </div>
                  <div style={styles.companyRow}>
                    <Phone size={16} color="var(--accent-cyan)" />
                    <span><strong>WhatsApp:</strong> <a href="https://wa.me/6285179642520" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{content.companyPhone}</a></span>
                  </div>
                </div>
              )}

              {sec.hasContactCard && (
                <div style={styles.contactCard}>
                  <p style={{ margin: 0 }}><strong>Departemen Legal & Privasi Data / Legal & Privacy Office</strong></p>
                  <p style={{ margin: '0.25rem 0' }}>{content.companyOfficial}</p>
                  <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>{content.companyAddress}</p>
                  <p style={{ margin: '0.25rem 0' }}>
                    Email:{' '}
                    <a href={`mailto:${content.companyEmail}`} style={{ color: 'var(--accent-cyan)' }}>
                      {content.companyEmail}
                    </a>
                  </p>
                  <p style={{ margin: '0.25rem 0' }}>
                    WhatsApp:{' '}
                    <a href="https://wa.me/6285179642520" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                      {content.companyPhone}
                    </a>
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)',
  },
  main: {
    flex: 1,
    padding: 'clamp(1.25rem, 3vw, 2.5rem) clamp(0.75rem, 3vw, 1.5rem) 4rem clamp(0.75rem, 3vw, 1.5rem)',
    maxWidth: '920px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  iconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  title: {
    fontSize: 'clamp(1.4rem, 4.5vw, 2rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  prevailingBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.85rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    border: '1px solid rgba(234, 179, 8, 0.25)',
    marginBottom: '1.5rem',
  },
  contentCard: {
    padding: '2.5rem',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    lineHeight: 1.65,
  },
  section: {
    marginBottom: '2.25rem',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.85rem',
    borderBottom: '1px solid var(--border-muted)',
    paddingBottom: '0.4rem',
  },
  paragraph: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
  },
  highlightBox: {
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.85rem',
  },
  companyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--text-secondary)',
  },
  bulletList: {
    paddingLeft: '1.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  orderedList: {
    paddingLeft: '1.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  alertBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  securityBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  contactCard: {
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    fontSize: '0.85rem',
  },
};
