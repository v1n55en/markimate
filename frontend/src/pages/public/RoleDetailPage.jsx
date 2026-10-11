import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Terminal,
  BarChart2,
  Eye,
  Share2,
  PieChart,
  TrendingUp,
  MessageSquare,
  Users,
  Star,
  Sliders,
  Send,
  Target,
  Activity,
  ShoppingBag,
  Compass,
  ArrowRight,
  ShieldCheck,
  Bell,
} from 'lucide-react';
import { getRoleByKey } from '../../config/roles';
import { MODULE_PRICES, MODULE_QUOTA, formatIDR } from '../../config/pricing';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import WaitlistModal from '../../components/common/WaitlistModal';

// Pemeta ikon Lucide dinamis
const ICON_MAP = {
  Terminal,
  BarChart2,
  Eye,
  Share2,
  PieChart,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Users,
  Star,
  Sliders,
  Send,
  Target,
  Activity,
  ShoppingBag,
  Compass,
};

import { useLanguage } from '../../context/LanguageContext';

export default function RoleDetailPage() {
  const { key } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  const role = getRoleByKey(key, lang);

  if (!role) {
    return (
      <div style={styles.page}>
        <PublicNavbar />
        <main style={{ ...styles.main, textAlign: 'center', padding: '5rem 1rem' }}>
          <h2 style={{ color: 'var(--text-primary)' }}>
            {lang === 'id' ? 'Role Tidak Ditemukan' : 'Role Not Found'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {lang === 'id'
              ? `Role marketing dengan kode "${key}" tidak terdaftar.`
              : `Marketing AI role with key "${key}" was not found.`}
          </p>
          <Link to="/" style={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>{t('roleDetail.backLink', 'Back to All Roles')}</span>
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const IconComponent = ICON_MAP[role.iconName] || Sparkles;
  const isAvailable = role.status === 'available';
  const price = MODULE_PRICES[role.key];
  const quota = MODULE_QUOTA[role.key];

  return (
    <div style={styles.page}>
      <PublicNavbar />

      <main style={styles.main}>
        {/* Back navigation */}
        <div style={styles.topNav}>
          <Link to="/" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>{t('roleDetail.backLink', 'Back to All Roles')}</span>
          </Link>
        </div>

        {/* Role Hero Card */}
        <div style={styles.heroCard} className="card">
          <div style={styles.heroLeft}>
            <div style={styles.badgeRow}>
              <span style={styles.categoryBadge}>{role.category}</span>
              {isAvailable ? (
                <span style={styles.availableBadge}>
                  <span style={styles.greenDot} />
                  {t('roleDetail.statusActive', 'Active & Available')}
                </span>
              ) : (
                <span style={styles.soonBadge}>
                  <Bell size={12} />
                  {t('roleDetail.statusSoon', 'In Development')}
                </span>
              )}
            </div>

            <div style={styles.roleTitleRow}>
              <div style={styles.roleIconBox}>
                <IconComponent
                  size={28}
                  color={isAvailable ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                />
              </div>
              <h1 style={styles.roleTitle}>{role.name}</h1>
            </div>

            <p style={styles.roleDesc}>{role.longDescription || role.description}</p>

            <div style={styles.deliverableBox}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.825rem' }}>
                {t('roleDetail.deliverablesTitle', 'Expected Deliverables & Outputs')}:
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', marginTop: '0.2rem', display: 'block' }}>
                {role.deliverables}
              </span>
            </div>
          </div>

          {/* Sisi Kanan: Harga atau Waitlist Callout */}
          <div style={styles.heroRight}>
            {isAvailable ? (
              <div style={styles.pricingBox}>
                <span style={styles.pricingTag}>
                  {lang === 'id' ? 'Investasi Modul Mandiri' : 'Individual Role Investment'}
                </span>
                <div style={styles.priceRow}>
                  <span style={styles.priceAmount}>{formatIDR(price)}</span>
                  <span style={styles.pricePeriod}>{t('bundles.perMonth', '/ month')}</span>
                </div>
                {quota && (
                  <div style={styles.quotaRow}>
                    <span style={styles.quotaText}>
                      {lang === 'id' ? `Termasuk: ${quota}` : `Includes: ${quota}`}
                    </span>
                  </div>
                )}
                <div style={styles.pricingCtas}>
                  <Link to="/register" style={styles.primaryActionBtn}>
                    <span>{t('bundles.ctaSelect', 'Start Subscription')}</span>
                    <ArrowRight size={15} />
                  </Link>
                  <Link to="/login" style={styles.secondaryActionBtn}>
                    {t('finalCta.btnDemo', 'Explore Demo Account')}
                  </Link>
                </div>
                <div style={styles.guaranteeText}>
                  <ShieldCheck size={14} color="var(--accent-green)" />
                  <span>
                    {lang === 'id'
                      ? 'Garansi Human-in-the-Loop: Review sebelum terbit'
                      : 'Human-in-the-Loop Guarantee: Review before live'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={styles.waitlistBox}>
                <div style={styles.waitlistIconBox}>
                  <Bell size={24} color="var(--accent-yellow)" />
                </div>
                <h3 style={styles.waitlistTitle}>
                  {lang === 'id' ? 'Ingin Menggunakan Role Ini?' : 'Want to Deploy This AI Role?'}
                </h3>
                <p style={styles.waitlistSubtitle}>
                  {lang === 'id'
                    ? 'Daftarkan email Anda untuk mendapatkan prioritas akses beta dan diskon early-bird saat modul ini dirilis.'
                    : 'Register your work email for priority beta onboarding and early-bird discounts when this role launches.'}
                </p>
                <button
                  onClick={() => setShowWaitlistModal(true)}
                  style={styles.notifyBtn}
                >
                  <Bell size={15} />
                  <span>{t('rolesGrid.joinWaitlist', 'Join Waitlist')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fitur & Kemampuan */}
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>{t('roleDetail.capabilitiesTitle', 'Core Capabilities')}</h2>
          <div style={styles.featuresGrid}>
            {role.features?.map((feat, idx) => (
              <div key={idx} style={styles.featureCard} className="card">
                <div style={styles.featIcon}>
                  <CheckCircle2 size={18} color="var(--accent-cyan)" />
                </div>
                <span style={styles.featText}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contoh Output / Mock deliverables */}
        {role.sampleOutput && (
          <div style={styles.section}>
            <h2 style={styles.sectionHeading}>{t('roleDetail.sampleOutputTitle', 'Sample Production Output')}</h2>
            <div style={styles.sampleOutputCard} className="card">
              <div style={styles.sampleHeader}>
                <Sparkles size={16} color="var(--accent-yellow)" />
                <span style={styles.sampleTitle}>Deliverable Preview</span>
              </div>
              <p style={styles.sampleContent}>{role.sampleOutput}</p>
              <div style={styles.sampleFooter}>
                <span style={styles.sampleNote}>
                  {lang === 'id'
                    ? 'Setiap deliverable dapat ditinjau, disunting, dan disetujui di dalam dasbor Supermat sebelum diterbitkan atau digunakan.'
                    : 'Every deliverable can be reviewed, edited, and approved inside the Supermat console before being published.'}
                </span>
                {isAvailable && role.path && (
                  <button
                    onClick={() => navigate(role.path)}
                    style={styles.sampleDirectBtn}
                  >
                    {t('dashboard.openModule', 'Open Console')} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Call to action footer */}
        <div style={styles.bottomCtaBox} className="card">
          <div>
            <h3 style={styles.bottomCtaTitle}>
              {lang === 'id'
                ? 'Butuh Lebih dari Satu Role? Hemat dengan Bundle "Fokus 3"'
                : 'Need Multiple Roles? Save 20% with the Focus 3 Bundle'}
            </h3>
            <p style={styles.bottomCtaDesc}>
              {lang === 'id'
                ? 'Dapatkan SEO Specialist, Ads Specialist (Report), dan Ads Creative Spy sekaligus dengan diskon 20%.'
                : 'Deploy SEO Specialist, Ads Report, and Ads Creative Spy simultaneously with an automatic 20% discount.'}
            </p>
          </div>
          <Link to="/#pricing" style={styles.bottomCtaLink}>
            {t('hero.ctaSecondary', 'View Plans & Pricing')}
          </Link>
        </div>
      </main>

      {showWaitlistModal && (
        <WaitlistModal role={role} onClose={() => setShowWaitlistModal(false)} />
      )}

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
    padding: '2rem 1.5rem 4rem 1.5rem',
    maxWidth: '1100px',
    margin: '0 auto',
    width: '100%',
  },
  topNav: {
    marginBottom: '1.5rem',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontSize: '0.85rem',
  },
  heroCard: {
    padding: '2.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '2.5rem',
    flexWrap: 'wrap',
    marginBottom: '3rem',
    borderLeft: '4px solid var(--accent-cyan)',
  },
  heroLeft: {
    flex: 1,
    minWidth: '320px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '1rem',
  },
  categoryBadge: {
    padding: '0.2rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.725rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  availableBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.2rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: 'var(--accent-green)',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  greenDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-green)',
    boxShadow: '0 0 6px var(--accent-green)',
  },
  soonBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.2rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: 'var(--accent-yellow)',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  roleTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem',
  },
  roleIconBox: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  roleDesc: {
    fontSize: '0.925rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
  },
  deliverableBox: {
    padding: '1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  heroRight: {
    width: '320px',
    flexShrink: 0,
  },
  pricingBox: {
    padding: '1.5rem',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-active)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  pricingTag: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '700',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  priceAmount: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  pricePeriod: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  quotaRow: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  quotaText: {
    fontSize: '0.78rem',
    color: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  pricingCtas: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  primaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.875rem',
    textDecoration: 'none',
  },
  secondaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.65rem',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.825rem',
    textDecoration: 'none',
  },
  guaranteeText: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  waitlistBox: {
    padding: '1.75rem',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  waitlistIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  waitlistTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
  },
  waitlistSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '0 0 1.25rem 0',
  },
  notifyBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-yellow)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.85rem',
    border: 'none',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '3rem',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
  },
  featureCard: {
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  featIcon: {
    flexShrink: 0,
    marginTop: '0.1rem',
  },
  featText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  sampleOutputCard: {
    padding: '1.75rem',
  },
  sampleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  sampleTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sampleContent: {
    fontSize: '0.925rem',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    margin: '0 0 1.25rem 0',
  },
  sampleFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    borderTop: '1px solid var(--border-muted)',
    paddingTop: '1rem',
  },
  sampleNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    flex: 1,
    minWidth: '240px',
  },
  sampleDirectBtn: {
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  bottomCtaBox: {
    padding: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1.5rem',
    borderLeft: '4px solid var(--accent-green)',
  },
  bottomCtaTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.35rem 0',
  },
  bottomCtaDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  bottomCtaLink: {
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-green)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.85rem',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
