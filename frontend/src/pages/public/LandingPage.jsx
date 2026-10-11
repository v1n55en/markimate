import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bell,
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
  Zap,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { ROLES, ROLE_CATEGORIES } from '../../config/roles';
import {
  BUNDLES,
  TEAM_COST_BENCHMARK,
  IN_HOUSE_COMPARISON,
  formatIDR,
} from '../../config/pricing';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import WaitlistModal from '../../components/common/WaitlistModal';

// Pemeta ikon Lucide untuk kartu role
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

export default function LandingPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeWaitlistRole, setActiveWaitlistRole] = useState(null);

  // Filter daftar role berdasarkan kategori
  const filteredRoles =
    selectedCategory === 'all'
      ? ROLES
      : ROLES.filter((r) => r.category === selectedCategory);

  const focus3Bundle = BUNDLES.find((b) => b.key === 'focus3');
  const allInOneBundle = BUNDLES.find((b) => b.key === 'all_in_one');
  const managedBundle = BUNDLES.find((b) => b.key === 'managed');

  return (
    <div style={styles.page}>
      <PublicNavbar />

      <main style={styles.main}>
        {/* 1. Hero Section */}
        <section style={styles.hero}>
          <div style={styles.heroBadgeRow}>
            <span style={styles.heroBadge}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              Supermat Powered by 3Our Indonesia
            </span>
          </div>

          <h1 style={styles.heroTitle}>
            Tim Digital Marketing AI untuk Bisnismu
          </h1>

          <p style={styles.heroSubtitle}>
            Pilih role spesialis yang kamu butuhkan atau rekrut seluruh tim — mulai dari sebagian kecil biaya tim in-house, dengan hasil kerja yang tetap kamu review dan setujui.
          </p>

          <div style={styles.heroCtas}>
            <Link to="/login" style={styles.primaryCta}>
              <span>Coba Demo Sekarang</span>
              <ArrowRight size={16} />
            </Link>
            <a href="#pricing" style={styles.secondaryCta}>
              Lihat Paket & Harga
            </a>
          </div>

          <div style={styles.heroProof}>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>3 Role Aktif Siap Digunakan</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>13 Role Dalam Pengembangan</span>
            </div>
            <div style={styles.proofItem}>
              <CheckCircle2 size={15} color="var(--accent-green)" />
              <span>Human-in-the-Loop Approval</span>
            </div>
          </div>
        </section>

        {/* 2. Grid "Tim Kamu" (16 Role) */}
        <section id="roles" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Susunan Tim Marketing AI Kamu</h2>
            <p style={styles.sectionSub}>
              Setiap role bertindak sebagai agen otonom khusus yang menghasilkan pekerjaan nyata untuk brand Anda
            </p>

            {/* Filter Kategori */}
            <div style={styles.categoryFilters}>
              {ROLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    ...styles.categoryTab,
                    ...(selectedCategory === cat.key ? styles.categoryTabActive : {}),
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.rolesGrid}>
            {filteredRoles.map((role) => {
              const IconComp = ICON_MAP[role.iconName] || Sparkles;
              const isAvail = role.status === 'available';

              return (
                <div
                  key={role.key}
                  style={{
                    ...styles.roleCard,
                    ...(isAvail ? styles.roleCardAvailable : {}),
                  }}
                  className="card"
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardIconBox}>
                      <IconComp
                        size={22}
                        color={isAvail ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                      />
                    </div>
                    {isAvail ? (
                      <span style={styles.badgeAvailable}>
                        <span style={styles.greenDot} /> Tersedia
                      </span>
                    ) : (
                      <span style={styles.badgeSoon}>Segera hadir</span>
                    )}
                  </div>

                  <div style={styles.cardBody}>
                    <div style={styles.roleCategoryTag}>{role.category}</div>
                    <h3 style={styles.roleName}>{role.name}</h3>
                    <p style={styles.roleDescription}>{role.description}</p>
                  </div>

                  <div style={styles.cardFooter}>
                    {isAvail ? (
                      <Link to={`/roles/${role.key}`} style={styles.learnMoreLink}>
                        <span>Pelajari Fitur</span>
                        <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <button
                        onClick={() => setActiveWaitlistRole(role)}
                        style={styles.waitlistBtn}
                      >
                        <Bell size={13} />
                        <span>Kabari saya</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Cara Kerja (3 Langkah) */}
        <section id="how-it-works" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Cara Kerja Sederhana</h2>
            <p style={styles.sectionSub}>
              Hanya 3 langkah mudah antara AI yang bekerja di balik layar dan persetujuan bisnis Anda
            </p>
          </div>

          <div style={styles.stepsGrid}>
            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>1</div>
              <h3 style={styles.stepTitle}>Hubungkan Akun Bisnis</h3>
              <p style={styles.stepDesc}>
                Sambungkan CMS blog (WordPress, Wix, Shopify) dan akun iklan (Shopee, TikTok, Meta, Google). Izin sepenuhnya aman & <strong>Read-Only</strong>.
              </p>
            </div>

            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>2</div>
              <h3 style={styles.stepTitle}>AI Bekerja Otomatis</h3>
              <p style={styles.stepDesc}>
                Setiap spesialis AI meriset keyword, menulis draft artikel, mengagregasi ROAS & GMV, serta memindai ads library kompetitor secara terjadwal.
              </p>
            </div>

            <div style={styles.stepCard} className="card">
              <div style={styles.stepNumber}>3</div>
              <h3 style={styles.stepTitle}>Kamu Review & Setujui</h3>
              <p style={styles.stepDesc}>
                Prinsip <em>Human-in-the-Loop</em>: seluruh hasil kerja (artikel atau laporan) masuk ke meja review. Kamu cukup klik setujui untuk terbit atau ekspor.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Perbandingan Biaya (Tim In-House vs Supermat) */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Bandingkan Biaya: Tim In-House vs Supermat</h2>
            <p style={styles.sectionSub}>
              Dapatkan kapabilitas tim profesional tanpa beban rekrutmen, BPJS, pelatihan, dan overhead bulanan
            </p>
          </div>

          <div style={styles.comparisonWrapper} className="card">
            <div style={styles.comparisonHeader}>
              <div style={{ flex: 1 }}>
                <span style={styles.comparisonBadge}>Kalkulator Penghematan</span>
                <h3 style={styles.comparisonTitle}>
                  Hemat Hingga 89% Biaya Operasional Pemasaran
                </h3>
              </div>
              <div style={styles.benchmarkBox}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gaji In-House 3 Role:</span>
                <span style={styles.inHouseTotal}>{formatIDR(TEAM_COST_BENCHMARK.focus3)}/bln</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: '700' }}>
                  Supermat Fokus 3: Rp 3.200.000/bln
                </span>
              </div>
            </div>

            <div style={styles.tableScroll}>
              <table style={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Role Spesialis</th>
                    <th style={styles.th}>Deliverable Bulanan</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Rata-rata Gaji In-House</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Biaya di Supermat</th>
                  </tr>
                </thead>
                <tbody>
                  {IN_HOUSE_COMPARISON.map((row, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{row.role}</strong>
                      </td>
                      <td style={styles.td}>{row.deliverables}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>
                        <span style={{ textDecoration: 'line-through' }}>
                          {formatIDR(row.inHouseMonthly)}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <strong style={{ color: 'var(--accent-cyan)' }}>
                          {formatIDR(row.supermatMonthly)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                  <tr style={styles.totalRow}>
                    <td style={styles.tdTotal} colSpan={2}>
                      <strong>Total Investasi Bulanan (3 Pilar Fokus)</strong>
                    </td>
                    <td style={{ ...styles.tdTotal, textAlign: 'right', color: 'var(--text-muted)' }}>
                      <strong>{formatIDR(TEAM_COST_BENCHMARK.focus3)} / bln</strong>
                    </td>
                    <td style={{ ...styles.tdTotal, textAlign: 'right' }}>
                      <strong style={{ color: 'var(--accent-green)', fontSize: '1.05rem' }}>
                        Rp 3.200.000 / bln (Bundle Hemat)
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5. Paket & Harga (#pricing) */}
        <section id="pricing" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Pilihan Paket Fleksibel</h2>
            <p style={styles.sectionSub}>
              Pilih hanya role yang kamu butuhkan, atau ambil paket bundle lengkap untuk hasil maksimal
            </p>
          </div>

          <div style={styles.pricingCardsGrid}>
            {/* Paket 1: Beli Satuan */}
            <div style={styles.planCard} className="card">
              <span style={styles.planBadge}>Fleksibel</span>
              <h3 style={styles.planName}>Per Modul Mandiri</h3>
              <p style={styles.planDesc}>Beli satuan role sesuai kebutuhan spesifik bisnismu.</p>
              <div style={styles.planPriceRow}>
                <span style={styles.planPriceVal}>Mulai Rp 1 jt</span>
                <span style={styles.planPeriod}>/ bulan</span>
              </div>
              <ul style={styles.planFeatures}>
                <li>SEO Specialist: Rp 1,5 jt (20 artikel)</li>
                <li>Ads Report: Rp 1,5 jt (3 akun iklan)</li>
                <li>Ads Creative Spy: Rp 1 jt (5 kompetitor)</li>
                <li>Aktifkan & batalkan kapan saja</li>
              </ul>
              <Link to="/register" style={styles.planBtnSecondary}>
                Pilih Modul
              </Link>
            </div>

            {/* Paket 2: Bundle Fokus 3 (Paling Populer) */}
            <div style={{ ...styles.planCard, ...styles.planCardFeatured }} className="card">
              <span style={styles.planBadgeFeatured}>{focus3Bundle?.badge || 'Paling Populer'}</span>
              <h3 style={styles.planName}>{focus3Bundle?.name || 'Paket Fokus 3'}</h3>
              <p style={styles.planDesc}>{focus3Bundle?.description}</p>
              <div style={styles.planPriceRow}>
                <span style={styles.planPriceVal}>Rp 3.200.000</span>
                <span style={styles.planPeriod}>/ bulan</span>
              </div>
              <div style={styles.discountBadge}>Hemat 20% vs Beli Satuan (Rp 4.000.000)</div>
              <ul style={styles.planFeatures}>
                <li>Semua fitur SEO Specialist (20 artikel)</li>
                <li>Semua fitur Ads Report (Meta, Google, TikTok, Shopee)</li>
                <li>Semua fitur Ads Creative Spy (5 kompetitor)</li>
                <li>Ekspor Google Slides & Sheets</li>
                <li>Dukungan prioritas tim 3Our</li>
              </ul>
              <Link to="/register" style={styles.planBtnPrimary}>
                Mulai Paket Fokus 3
              </Link>
            </div>

            {/* Paket 3: All-in-One Pre-order */}
            <div style={styles.planCard} className="card">
              <span style={styles.planBadgePreorder}>{allInOneBundle?.badge || 'Pre-order'}</span>
              <h3 style={styles.planName}>{allInOneBundle?.name || 'All-in-One AI Team'}</h3>
              <p style={styles.planDesc}>{allInOneBundle?.description}</p>
              <div style={styles.planPriceRow}>
                <span style={styles.planPriceVal}>{formatIDR(allInOneBundle?.price)}</span>
                <span style={styles.planPeriod}>/ bulan</span>
              </div>
              <div style={styles.preorderNotice}>
                Modul baru otomatis aktif saat rilis tanpa biaya tambahan
              </div>
              <ul style={styles.planFeatures}>
                <li>Akses instan ke 3 role yang sudah tersedia</li>
                <li>Akses otomatis ke 13 role berikutnya saat rilis</li>
                <li>Kuota kompetitor & artikel 2x lipat</li>
                <li>Kunci harga seumur hidup</li>
              </ul>
              <Link to="/register" style={styles.planBtnSecondary}>
                Pre-order All-in-One
              </Link>
            </div>

            {/* Paket 4: Managed by 3Our */}
            <div style={styles.planCard} className="card">
              <span style={styles.planBadge}>Layanan Penuh</span>
              <h3 style={styles.planName}>{managedBundle?.name || 'Managed by 3Our'}</h3>
              <p style={styles.planDesc}>{managedBundle?.description}</p>
              <div style={styles.planPriceRow}>
                <span style={styles.planPriceVal}>Custom</span>
                <span style={styles.planPeriod}>/ konsultasi</span>
              </div>
              <ul style={styles.planFeatures}>
                <li>Platform Supermat dikelola penuh oleh tim 3Our</li>
                <li>Konsultasi strategi bulanan 1-on-1</li>
                <li>Produksi konten & optimasi kampanye ads langsung</li>
                <li>Laporan eksekutif siap presentasi</li>
              </ul>
              <a
                href={managedBundle?.contactUrl || 'https://wa.me/6281234567890'}
                target="_blank"
                rel="noreferrer"
                style={styles.planBtnContact}
              >
                <span>Hubungi Sales</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* 6. Ekosistem Integrasi */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Ekosistem Terintegrasi</h2>
            <p style={styles.sectionSub}>
              Bekerja mulus dengan platform periklanan, marketplace, dan CMS terdepan
            </p>
          </div>

          <div style={styles.integrationPills}>
            <span style={styles.intPill}>Meta Ads (FB & IG)</span>
            <span style={styles.intPill}>Google Ads & PMax</span>
            <span style={styles.intPill}>TikTok Ads API</span>
            <span style={styles.intPill}>TikTok Shop | Tokopedia</span>
            <span style={styles.intPill}>Shopee Ads & Open Platform</span>
            <span style={styles.intPill}>WordPress REST API</span>
            <span style={styles.intPill}>Wix Headless</span>
            <span style={styles.intPill}>Sanity CMS</span>
            <span style={styles.intPill}>Shopify Blog</span>
          </div>
        </section>

        {/* 7. FAQ Section */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionHeading}>Pertanyaan Umum (FAQ)</h2>
            <p style={styles.sectionSub}>Semua hal yang perlu kamu ketahui tentang Supermat v3</p>
          </div>

          <div style={styles.faqList}>
            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                Apakah Supermat aman untuk akun iklan dan toko saya?
              </h4>
              <p style={styles.faqAnswer}>
                Sangat aman. Supermat hanya menggunakan izin <strong>Read-Only</strong> resmi melalui OAuth (Shopee Open Platform, TikTok Marketing API, Meta Graph API, Google Ads). Kami tidak meminta akses untuk mengubah saldo, memodifikasi kampanye, atau mengubah setelan toko. Kredensial token disimpan dengan enkripsi AES-256.
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                Apa yang dimaksud dengan prinsip &quot;Human-in-the-Loop&quot;?
              </h4>
              <p style={styles.faqAnswer}>
                Kami percaya bahwa AI harus mempercepat pekerjaan, bukan menggantikan penilaian manusia sepenuhnya. Setiap artikel blog atau laporan iklan yang dihasilkan oleh Supermat berada dalam status <em>Draft / Review Ready</em> terlebih dahulu. Anda atau tim Anda memiliki kontrol penuh untuk memeriksa, menyunting, dan menyetujuinya sebelum terbit ke CMS atau dikirim ke klien.
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                Bisakah saya hanya berlangganan 1 role saja?
              </h4>
              <p style={styles.faqAnswer}>
                Ya! Supermat v3 bersifat modular. Jika Anda hanya membutuhkan riset iklan kompetitor, Anda cukup mengaktifkan role <em>Ads Creative Spy</em> seharga Rp 1.000.000/bulan tanpa kewajiban membeli modul lain. Anda bisa menambah role lain kapan saja seiring pertumbuhan bisnis.
              </p>
            </div>

            <div style={styles.faqItem} className="card">
              <h4 style={styles.faqQuestion}>
                <HelpCircle size={17} color="var(--accent-cyan)" />
                Bagaimana cara kerja role &quot;Segera Hadir&quot;?
              </h4>
              <p style={styles.faqAnswer}>
                Role yang bertanda <em>Segera Hadir</em> sedang dalam tahap pengujian akhir. Anda dapat mendaftarkan email Anda melalui tombol &quot;Kabari saya&quot; untuk mendapatkan notifikasi peluncuran dan penawaran early-bird. Pemegang paket All-in-One akan otomatis mendapatkan akses ke role baru ini saat dirilis.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section style={styles.ctaBannerSection}>
          <div style={styles.ctaBannerBox} className="card">
            <Zap size={32} color="var(--accent-cyan)" style={{ marginBottom: '1rem' }} />
            <h2 style={styles.ctaBannerTitle}>Mulai Perkuat Pemasaran Digital Bisnismu Hari Ini</h2>
            <p style={styles.ctaBannerSub}>
              Coba akun demo gratis untuk melihat bagaimana tim digital marketing AI bekerja secara sinergis.
            </p>
            <div style={styles.ctaBannerBtns}>
              <Link to="/login" style={styles.primaryCta}>
                <span>Masuk Akun Demo Reviewer</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/register" style={styles.secondaryCta}>
                Daftar Brand Baru
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Waitlist untuk Role 'soon' */}
      {activeWaitlistRole && (
        <WaitlistModal
          role={activeWaitlistRole}
          onClose={() => setActiveWaitlistRole(null)}
        />
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
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  hero: {
    textAlign: 'center',
    padding: '3.5rem 1rem 4rem 1rem',
    maxWidth: '860px',
    margin: '0 auto',
  },
  heroBadgeRow: {
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
    fontSize: '2.75rem',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    lineHeight: 1.18,
    marginBottom: '1.25rem',
    color: 'var(--text-primary)',
  },
  heroSubtitle: {
    fontSize: '1.05rem',
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
    marginBottom: '2.5rem',
  },
  primaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem 1.6rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '0.925rem',
    fontWeight: '700',
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
  },
  secondaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem 1.6rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.925rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  heroProof: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
  },
  proofItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  section: {
    marginBottom: '5rem',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  sectionHeading: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    maxWidth: '680px',
    margin: '0 auto',
    lineHeight: 1.5,
  },
  categoryFilters: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '1.5rem',
  },
  categoryTab: {
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  categoryTabActive: {
    backgroundColor: 'var(--bg-surface-hover)',
    color: 'var(--accent-cyan)',
    borderColor: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
    gap: '1.25rem',
  },
  roleCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
  },
  roleCardAvailable: {
    borderColor: 'rgba(6, 182, 212, 0.3)',
    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  cardIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAvailable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: 'var(--accent-green)',
    fontSize: '0.72rem',
    fontWeight: '600',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  greenDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-green)',
  },
  badgeSoon: {
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(113, 113, 122, 0.12)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '500',
    border: '1px solid rgba(113, 113, 122, 0.2)',
  },
  cardBody: {
    flex: 1,
    marginBottom: '1.25rem',
  },
  roleCategoryTag: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.35rem',
  },
  roleName: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    lineHeight: 1.3,
  },
  roleDescription: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  cardFooter: {
    borderTop: '1px solid var(--border-muted)',
    paddingTop: '0.85rem',
  },
  learnMoreLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    color: 'var(--accent-cyan)',
    fontSize: '0.825rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  waitlistBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  stepCard: {
    padding: '2rem 1.75rem',
    position: 'relative',
  },
  stepNumber: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontSize: '1.1rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  stepTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.65rem',
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    margin: 0,
  },
  comparisonWrapper: {
    padding: '2rem',
    overflow: 'hidden',
  },
  comparisonHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  comparisonBadge: {
    fontSize: '0.725rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'block',
    marginBottom: '0.25rem',
  },
  comparisonTitle: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  benchmarkBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: 'var(--bg-base)',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
  },
  inHouseTotal: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: 'var(--accent-red)',
    textDecoration: 'line-through',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  comparisonTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    borderBottom: '1px solid var(--border-muted)',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid var(--border-muted)',
  },
  td: {
    padding: '0.85rem 1rem',
    color: 'var(--text-secondary)',
  },
  totalRow: {
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  tdTotal: {
    padding: '1rem',
    borderTop: '2px solid var(--border-active)',
    color: 'var(--text-primary)',
  },
  pricingCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.25rem',
  },
  planCard: {
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderRadius: '12px',
  },
  planCardFeatured: {
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.12)',
  },
  planBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  planBadgeFeatured: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: '#000000',
    backgroundColor: 'var(--accent-cyan)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    marginBottom: '0.5rem',
  },
  planBadgePreorder: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--accent-yellow)',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    marginBottom: '0.5rem',
  },
  planName: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
  },
  planDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '1rem',
    minHeight: '2.4rem',
  },
  planPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    marginBottom: '0.5rem',
  },
  planPriceVal: {
    fontSize: '1.65rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  planPeriod: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  discountBadge: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: 'var(--accent-green)',
    marginBottom: '1rem',
  },
  preorderNotice: {
    fontSize: '0.72rem',
    color: 'var(--accent-yellow)',
    marginBottom: '1rem',
  },
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1.5rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    flex: 1,
  },
  planBtnPrimary: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  planBtnSecondary: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  planBtnContact: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid var(--accent-green)',
    color: 'var(--accent-green)',
    fontWeight: '700',
    fontSize: '0.85rem',
    textAlign: 'center',
    textDecoration: 'none',
  },
  integrationPills: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
    maxWidth: '900px',
    margin: '0 auto',
  },
  intPill: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    fontWeight: '500',
  },
  faqList: {
    maxWidth: '850px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  faqItem: {
    padding: '1.5rem',
  },
  faqQuestion: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  faqAnswer: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: '1.75rem',
  },
  ctaBannerSection: {
    marginBottom: '2rem',
  },
  ctaBannerBox: {
    padding: '3rem 2rem',
    textAlign: 'center',
    borderRadius: '16px',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    background:
      'linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(9, 9, 11, 0.95) 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  ctaBannerTitle: {
    fontSize: '1.85rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  ctaBannerSub: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    maxWidth: '640px',
    marginBottom: '2rem',
    lineHeight: 1.5,
  },
  ctaBannerBtns: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
};
