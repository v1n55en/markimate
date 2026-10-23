import { FileText, AlertTriangle } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import SeoHead from '../../components/common/SeoHead';
import { useLanguage } from '../../context/LanguageContext';
import { TERMS_CONTENT, LEGAL_PREVAILING_NOTICE, LEGAL_LABELS } from '../../content/legal-content';

export default function TermsPage() {
  const { lang } = useLanguage();
  const content = TERMS_CONTENT[lang] || TERMS_CONTENT.id;
  const prevailingNotice = LEGAL_PREVAILING_NOTICE[lang] || LEGAL_PREVAILING_NOTICE.id;
  const labels = LEGAL_LABELS[lang] || LEGAL_LABELS.en;

  return (
    <div style={styles.page}>
      <SeoHead
        title={content.seoTitle}
        description={content.seoDescription}
        path="/terms"
      />
      <PublicNavbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.iconBox}>
            <FileText size={28} color="var(--accent-cyan)" />
          </div>
          <h1 style={styles.title}>{content.title}</h1>
          <p style={styles.subtitle}>{content.lastUpdated}</p>
        </div>

        {/* Banner Klausul Hukum (Indonesian prevailing clause) */}
        <div style={styles.prevailingBanner}>
          <AlertTriangle size={18} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{labels.noticeHeading} </strong>
            {prevailingNotice}
          </div>
        </div>

        <div style={styles.contentCard} className="card">
          {content.sections.map((sec) => (
            <section
              key={sec.number}
              id={sec.number === '4' ? 'credit-system' : undefined}
              style={styles.section}
            >
              <h2 style={styles.sectionHeading}>
                {`${sec.number}. ${sec.title}`}
              </h2>
              <p style={styles.paragraph}>{sec.content}</p>
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
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
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
    marginBottom: '2rem',
  },
  sectionHeading: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
    borderBottom: '1px solid var(--border-muted)',
    paddingBottom: '0.35rem',
  },
  paragraph: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.85rem',
  },
  bulletList: {
    paddingLeft: '1.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  legalBox: {
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    padding: '1rem',
    fontSize: '0.85rem',
  },
};
