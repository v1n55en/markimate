import { Link } from 'react-router-dom';
import {
  BarChart3,
  Terminal,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

export default function LandingPage() {
  return (
    <div style={styles.page}>
      <PublicNavbar />

      <main style={styles.main}>
        {/* Hero Section */}
        <section style={styles.hero}>
          <div style={styles.badgeRow}>
            <span style={styles.heroBadge}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              SaaS Terintegrasi 3Our Indonesia
            </span>
          </div>

          <h1 style={styles.heroTitle}>
            Satu Platform untuk <span style={styles.gradientText}>Automasi SEO</span> & <span style={styles.gradientTextAds}>Laporan Iklan</span>
          </h1>

          <p style={styles.heroSubtitle}>
            Supermat mempercepat pertumbuhan digital brand Anda dengan 2 mesin bertenaga: automasi penerbitan artikel SEO ke berbagai CMS dan agregasi performa periklanan multi-channel (Shopee, TikTok, Meta, & Google).
          </p>

          <div style={styles.heroCtas}>
            <Link to="/register" style={styles.primaryCta}>
              <span>Mulai Gratis Sekarang</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" style={styles.secondaryCta}>
              Masuk Akun
            </Link>
          </div>

          <div style={styles.proofRow}>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>Integrasi Resmi OAuth Read-Only</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>Ekspor Otomatis ke Slides & Sheets</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>Tersedia Mode Demo untuk Reviewer</span>
            </div>
          </div>
        </section>

        {/* The 2 Core Modules Section */}
        <section style={styles.modulesSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Dua Modul Inti Supermat</h2>
            <p style={styles.sectionSub}>
              Solusi end-to-end yang dirancang khusus untuk brand, agensi, dan e-commerce seller
            </p>
          </div>

          <div style={styles.modulesGrid}>
            {/* Module 1: SEO Automation */}
            <div style={styles.moduleCard} className="card">
              <div style={styles.moduleBadge}>Modul 1</div>
              <div style={styles.moduleIconBox}>
                <Terminal size={24} color="var(--accent-cyan)" />
              </div>
              <h3 style={styles.moduleTitle}>SEO Article Automation</h3>
              <p style={styles.moduleDesc}>
                Automasi penuh alur SEO organik dari riset keyword berbasis data, penulisan artikel berkualitas tinggi dengan AI, hingga penerbitan otomatis ke CMS bisnis Anda.
              </p>

              <ul style={styles.featureList}>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-cyan)" />
                  <span>Riset volume pencarian & search intent otomatis</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-cyan)" />
                  <span>Generator artikel multi-bahasa (ID, EN, MS)</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-cyan)" />
                  <span>Koneksi langsung ke WordPress, Wix, Sanity, dan Shopify</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-cyan)" />
                  <span>Penjadwalan otomatis via n8n workflow engine</span>
                </li>
              </ul>

              <div style={styles.moduleFooter}>
                <Link to="/app/seo/keywords" style={styles.moduleLink}>
                  <span>Buka Kontrol SEO</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Module 2: Ads Report */}
            <div style={{ ...styles.moduleCard, borderColor: 'rgba(16, 185, 129, 0.3)' }} className="card">
              <div style={{ ...styles.moduleBadge, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                Modul 2 · Baru
              </div>
              <div style={{ ...styles.moduleIconBox, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <BarChart3 size={24} color="var(--accent-green)" />
              </div>
              <h3 style={styles.moduleTitle}>Ads Performance Report</h3>
              <p style={styles.moduleDesc}>
                Konsolidasi performa periklanan berbayar dari Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, dan Shopee Ads dalam satu dashboard terpusat.
              </p>

              <ul style={styles.featureList}>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-green)" />
                  <span>Koneksi multi-toko & multi-ad account (OAuth Read-Only)</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-green)" />
                  <span>Agregasi metrik: Spend, Clicks, ROAS, Orders, dan Total GMV</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-green)" />
                  <span>Insight AI mendalam per placement, produk, dan materi iklan</span>
                </li>
                <li style={styles.featureItem}>
                  <CheckCircle2 size={15} color="var(--accent-green)" />
                  <span>Ekspor otomatis siap presentasi (Google Slides & Sheets)</span>
                </li>
              </ul>

              <div style={styles.moduleFooter}>
                <Link to="/app/ads" style={{ ...styles.moduleLink, color: 'var(--accent-green)' }}>
                  <span>Buka Ads Report</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Platforms Grid */}
        <section style={styles.platformsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Ekosistem Terintegrasi</h2>
            <p style={styles.sectionSub}>
              Mendukung jaringan periklanan terbesar dan platform CMS terpopuler
            </p>
          </div>

          <div style={styles.platformPills}>
            <span style={styles.platformPill}>Shopee Ads</span>
            <span style={styles.platformPill}>TikTok Ads & GMV Max</span>
            <span style={styles.platformPill}>TikTok Shop | Tokopedia</span>
            <span style={styles.platformPill}>Meta Ads (Facebook & Instagram)</span>
            <span style={styles.platformPill}>Google Ads & Performance Max</span>
            <span style={styles.platformPill}>WordPress REST API</span>
            <span style={styles.platformPill}>Wix Headless</span>
            <span style={styles.platformPill}>Sanity CMS</span>
            <span style={styles.platformPill}>Shopify</span>
          </div>
        </section>

        {/* Security / Compliance Guarantee Box */}
        <section style={styles.securitySection}>
          <div style={styles.securityCard} className="card">
            <div style={styles.securityIconBox}>
              <ShieldCheck size={32} color="var(--accent-cyan)" />
            </div>
            <div style={styles.securityContent}>
              <h3 style={styles.securityTitle}>Privasi & Keamanan Tingkat Enterprise</h3>
              <p style={styles.securityText}>
                Semua integrasi platform (Shopee Open Platform, TikTok Marketing API, Meta Graph API, Google Ads API) menggunakan otorisasi <strong>Read-Only</strong> resmi. Token akses disimpan dengan enkripsi AES-256 pada database terlindung. Kami tidak pernah memodifikasi setelan iklan Anda ataupun membagikan data Anda kepada pihak ketiga.
              </p>
              <Link to="/privacy" style={styles.securityLink}>
                Pelajari Kebijakan Privasi Lengkap PT Stambha Racana Ahita →
              </Link>
            </div>
          </div>
        </section>

        {/* Call to action card */}
        <section style={styles.ctaSection}>
          <div style={styles.ctaBox} className="card">
            <h2 style={styles.ctaTitle}>Siap Mengotomasi Pertumbuhan Digital Bisnis Anda?</h2>
            <p style={styles.ctaSubtitle}>
              Gunakan Supermat sekarang untuk menyederhanakan laporan iklan bulanan dan mendominasi kata kunci SEO industri Anda.
            </p>
            <div style={styles.ctaButtons}>
              <Link to="/register" style={styles.primaryCta}>
                <span>Daftar Akun Baru</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" style={styles.secondaryCta}>
                Masuk Demo Reviewer
              </Link>
            </div>
          </div>
        </section>
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
    padding: '3rem 1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  hero: {
    textAlign: 'center',
    padding: '3rem 1rem 4rem 1rem',
    maxWidth: '850px',
    margin: '0 auto',
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.85rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
    marginBottom: '1.25rem',
  },
  gradientText: {
    color: 'var(--accent-cyan)',
    background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  gradientTextAds: {
    color: 'var(--accent-green)',
    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '2rem',
  },
  heroCtas: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '2rem',
  },
  primaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '0.9rem',
    fontWeight: '700',
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
  },
  secondaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  proofRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  proofItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  modulesSection: {
    marginBottom: '4rem',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  sectionHeading: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  sectionSub: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '1.5rem',
  },
  moduleCard: {
    padding: '2rem',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  moduleBadge: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    color: 'var(--accent-cyan)',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  moduleIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  moduleTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.65rem',
  },
  moduleDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1.75rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
  },
  moduleFooter: {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-muted)',
  },
  moduleLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--accent-cyan)',
    fontSize: '0.85rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  platformsSection: {
    textAlign: 'center',
    marginBottom: '4rem',
  },
  platformPills: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
    maxWidth: '850px',
    margin: '0 auto',
  },
  platformPill: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    fontWeight: '500',
  },
  securitySection: {
    marginBottom: '4rem',
  },
  securityCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.5rem',
    padding: '2rem',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
  },
  securityIconBox: {
    padding: '0.85rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    flexShrink: 0,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  securityText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    marginBottom: '0.75rem',
  },
  securityLink: {
    color: 'var(--accent-cyan)',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  ctaSection: {
    marginBottom: '2rem',
  },
  ctaBox: {
    padding: '3rem 2rem',
    textAlign: 'center',
    borderRadius: '16px',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.06) 0%, rgba(9, 9, 11, 0.9) 100%)',
  },
  ctaTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
  },
  ctaSubtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    maxWidth: '650px',
    margin: '0 auto 2rem auto',
    lineHeight: 1.5,
  },
  ctaButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
};
