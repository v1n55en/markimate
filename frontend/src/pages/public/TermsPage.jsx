import { FileText } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import SeoHead from '../../components/common/SeoHead';

export default function TermsPage() {
  return (
    <div style={styles.page}>
      <SeoHead
        title="Syarat & Ketentuan Layanan"
        description="Syarat dan Ketentuan Penggunaan Layanan Markimate: Ketentuan umum, hak cipta, dan kewajiban pengguna."
        path="/terms"
      />
      <PublicNavbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.iconBox}>
            <FileText size={28} color="var(--accent-cyan)" />
          </div>
          <h1 style={styles.title}>Syarat & Ketentuan Layanan</h1>
          <p style={styles.subtitle}>
            Markimate · powered by 3our · Terakhir diperbarui: Oktober 2026
          </p>
        </div>

        <div style={styles.contentCard} className="card">
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>1. Ketentuan Umum</h2>
            <p style={styles.paragraph}>
              Dengan mendaftar, mengakses, atau menggunakan layanan Markimate yang disediakan oleh <strong>Markimate · powered by 3our</strong> (&quot;kami&quot;), Anda menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini. Apabila Anda tidak menyetujui bagian mana pun dari ketentuan ini, Anda dipersilakan untuk tidak menggunakan layanan kami.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>2. Deskripsi Layanan</h2>
            <p style={styles.paragraph}>
              Markimate menyediakan platform dengan Semua Tim Digital Marketing dalam satu platform dengan tiga modul utama:
            </p>
            <ul style={styles.bulletList}>
              <li>
                <strong>SEO Article Automation:</strong> Perangkat lunak periset kata kunci dan generator artikel AI yang dapat terbit langsung ke Content Management System (CMS) terdaftar milik pengguna.
              </li>
              <li>
                <strong>Ads Performance Report:</strong> Integrasi pelaporan analitik berbasis API dari platform periklanan (Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, dan Shopee Ads) guna menyajikan visualisasi data, analisis ROAS, dan ekspor ke Google Slides/Sheets.
              </li>
              <li>
                <strong>Ads Creative Spy:</strong> Alat pemantauan materi iklan kompetitor di Meta Ad Library dan TikTok Creative Center guna kurasi format winning dan formula copywriting.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>3. Kewajiban & Integritas Akun Pengguna</h2>
            <p style={styles.paragraph}>
              Pengguna bertanggung jawab penuh atas kerahasiaan kredensial akun mereka. Pengguna menjamin bahwa akun toko, ad account, serta website CMS yang dihubungkan ke Markimate adalah milik sah pengguna atau pengguna memiliki kuasa resmi dari pemilik yang bersangkutan untuk mengelolanya.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>4. Kepatuhan Terhadap Kebijakan Platform Mitra</h2>
            <p style={styles.paragraph}>
              Pengguna setuju untuk mematuhi seluruh syarat layanan dan panduan kebijakan pengembang dari masing-masing platform mitra yang dihubungkan, termasuk namun tidak terbatas pada:
            </p>
            <ul style={styles.bulletList}>
              <li>Shopee Open Platform Terms of Service & Developer Policy</li>
              <li>TikTok Commercial Product API Terms & TikTok Shop Partner Rules</li>
              <li>Meta Platform Terms & Developer Policies</li>
              <li>Google Ads API Terms & Conditions</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>5. Batasan Tanggung Jawab</h2>
            <p style={styles.paragraph}>
              Markimate berfungsi sebagai alat automasi pelaporan dan pembuatan konten. Kami tidak menjamin hasil peringkat mesin pencari (ranking SEO tertentu) atau performa return of ad spend (ROAS) tertentu, karena faktor algoritma platform pihak ketiga dan dinamika pasar berada di luar kendali kami.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>6. Kontak Legalitas</h2>
            <p style={styles.paragraph}>
              Untuk pertanyaan resmi atau korespondensi terkait Syarat dan Ketentuan ini, silakan hubungi:
            </p>
            <div style={styles.legalBox}>
              <p style={{ margin: 0 }}><strong>Markimate · powered by 3our</strong></p>
              <p style={{ margin: '0.2rem 0', color: 'var(--text-muted)' }}>Jl. BSD Raya Utama, Kabupaten Tangerang, Banten</p>
              <p style={{ margin: '0.2rem 0' }}>Email: <a href="mailto:info@3ourasia.id" style={{ color: 'var(--accent-cyan)' }}>info@3ourasia.id</a></p>
              <p style={{ margin: '0.2rem 0' }}>WhatsApp: <a href="https://wa.me/6285179642520" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>+62 851-7964-2520</a></p>
            </div>
          </section>
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
