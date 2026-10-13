import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Bell,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  BarChart2,
  Eye,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ROLES } from '../../config/roles';
import WaitlistModal from './WaitlistModal';

const ROLE_ICONS = {
  ads_report: BarChart2,
  ads_spy: Eye,
};

export default function ModuleComingSoonCard({ roleKey = 'ads_report' }) {
  const { lang } = useLanguage();
  const [showWaitlist, setShowWaitlist] = useState(false);

  const role = ROLES.find((r) => r.key === roleKey) || {
    key: roleKey,
    name: 'AI Marketing Specialist',
    name_id: 'AI Marketing Specialist',
    description: 'Modul ini sedang dalam tahap pengembangan roadmap.',
    description_id: 'Modul ini sedang dalam tahap pengembangan roadmap.',
    category: 'Marketing',
    features: ['Integrasi platform langsung', 'Analisis otomatis AI'],
    features_id: ['Integrasi platform langsung', 'Analisis otomatis AI'],
  };

  const roleName = lang === 'id' && role.name_id ? role.name_id : role.name;
  const roleDesc = lang === 'id' && role.longDescription_id ? role.longDescription_id : (role.longDescription || role.description);
  const features = (lang === 'id' && role.features_id ? role.features_id : role.features) || [];
  const IconComponent = ROLE_ICONS[roleKey] || Layers;

  return (
    <div style={styles.container}>
      <div style={styles.card} className="card">
        {/* Header Tag & Icon */}
        <div style={styles.headerRow}>
          <div style={styles.iconBox}>
            <IconComponent size={28} color="var(--accent-cyan)" />
          </div>
          <div style={styles.badgeRow}>
            <span style={styles.roadmapBadge}>
              <Clock size={13} />
              <span>{lang === 'id' ? 'Segera Hadir di Produksi' : 'Coming Soon to Production'}</span>
            </span>
            <span style={styles.categoryBadge}>{role.category}</span>
          </div>
        </div>

        {/* Title & Description */}
        <h1 style={styles.title}>{roleName}</h1>
        <p style={styles.description}>{roleDesc}</p>

        {/* Feature Highlights */}
        {features.length > 0 && (
          <div style={styles.featuresSection}>
            <h3 style={styles.featuresTitle}>
              {lang === 'id' ? 'Kapabilitas yang Sedang Dipersiapkan:' : 'Capabilities in Development:'}
            </h3>
            <div style={styles.featuresGrid}>
              {features.map((feat, idx) => (
                <div key={idx} style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={styles.featureText}>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Guarantee Callout */}
        <div style={styles.infoCallout}>
          <ShieldCheck size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
          <div style={styles.infoText}>
            <strong>{lang === 'id' ? 'Aman & Transparan: ' : 'Safe & Transparent: '}</strong>
            {lang === 'id'
              ? 'Selama tahap persiapan integrasi API platform, modul ini tidak menampilkan data rekaan dan tidak memotong saldo credit Anda.'
              : 'During platform API integration development, this module does not display sample/mock data and will not consume your credits.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionRow}>
          <button
            type="button"
            onClick={() => setShowWaitlist(true)}
            style={styles.primaryBtn}
          >
            <Bell size={16} />
            <span>{lang === 'id' ? 'Gabung Waitlist Early Access' : 'Join Early Access Waitlist'}</span>
          </button>

          <Link to="/app" style={styles.secondaryBtn}>
            <span>{lang === 'id' ? 'Kembali ke Overview' : 'Back to Overview'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {showWaitlist && (
        <WaitlistModal role={role} onClose={() => setShowWaitlist(false)} />
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 'clamp(1rem, 3vw, 2rem)',
    maxWidth: '860px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    borderRadius: '16px',
    padding: 'clamp(1.5rem, 4vw, 2.5rem)',
    boxShadow: 'var(--shadow-md)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  iconBox: {
    width: '54px',
    height: '54px',
    borderRadius: '14px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  roadmapBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.65rem',
    borderRadius: '20px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: 'var(--accent-yellow)',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.65rem',
    borderRadius: '20px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  title: {
    fontSize: 'clamp(1.4rem, 3vw, 1.85rem)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
    lineHeight: 1.25,
  },
  description: {
    fontSize: '0.925rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '1.75rem',
  },
  featuresSection: {
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    border: '1px solid var(--border-muted)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  featuresTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0.75rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  featureText: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  infoCallout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    marginBottom: '1.75rem',
  },
  infoText: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.7rem 1.1rem',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
};
