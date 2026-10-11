import { ShieldCheck, Mail, MapPin, Building2, CheckCircle2, Lock } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <PublicNavbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.iconBox}>
            <ShieldCheck size={28} color="var(--accent-green)" />
          </div>
          <h1 style={styles.title}>Kebijakan Privasi Supermat</h1>
          <p style={styles.subtitle}>
            Terakhir diperbarui: 11 Oktober 2026 · Berlaku untuk seluruh pengguna dan peninjau platform
          </p>
        </div>

        <div style={styles.contentCard} className="card">
          {/* Section 1 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>1. Pendahuluan & Identitas Pengelola</h2>
            <p style={styles.paragraph}>
              Selamat datang di <strong>Supermat</strong>, platform perangkat lunak sebagai layanan (SaaS) yang dikembangkan dan dioperasikan oleh <strong>Supermat Powered by 3Our Indonesia</strong>. Kami berkomitmen penuh untuk melindungi privasi, integritas, dan keamanan data seluruh pengguna kami, termasuk data yang diakses melalui integrasi Application Programming Interface (API) platform pihak ketiga.
            </p>
            <div style={styles.highlightBox}>
              <div style={styles.companyRow}>
                <Building2 size={16} color="var(--accent-cyan)" />
                <span><strong>Entitas Pengelola Resmi:</strong> Supermat Powered by 3Our Indonesia</span>
              </div>
              <div style={styles.companyRow}>
                <MapPin size={16} color="var(--accent-cyan)" />
                <span><strong>Alamat Kantor:</strong> Jl. BSD Raya Utama, Kabupaten Tangerang, Banten, Indonesia</span>
              </div>
              <div style={styles.companyRow}>
                <Mail size={16} color="var(--accent-cyan)" />
                <span><strong>Email Kontak Resmi:</strong> 3our.id@gmail.com</span>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>2. Data yang Kami Kumpulkan & Akses</h2>
            <p style={styles.paragraph}>
              Supermat menyediakan dua modul layanan: <em>SEO Article Automation</em> dan <em>Ads Performance Report</em>. Dalam menyediakan layanan laporan performa periklanan, sistem kami mengakses data dari platform mitra (seperti Shopee Open Platform, TikTok Marketing API & TikTok Shop, Meta Marketing API, serta Google Ads API):
            </p>
            <ul style={styles.bulletList}>
              <li>
                <strong>Metrik Performa Kampanye:</strong> Total biaya iklan (spend/cost), impresi (impressions), klik (clicks), rasio klik-tayang (CTR), biaya per klik (CPC), jumlah konversi/pesanan (conversions/orders), Gross Merchandise Value (GMV), dan Return on Ad Spend (ROAS).
              </li>
              <li>
                <strong>Identitas Akun & Toko:</strong> Nama toko/akun iklan, ID toko (Shop ID), ID akun iklan (Ad Account ID / Customer ID / Advertiser ID).
              </li>
              <li>
                <strong>Metadata Kampanye & Materi Iklan:</strong> Nama kampanye, grup iklan, nama produk terkait iklan, format iklan, serta thumbnail materi kreatif untuk keperluan penyusunan laporan visual.
              </li>
              <li>
                <strong>Data Akun Pengguna Supermat:</strong> Nama brand bisnis, alamat email, serta preferensi CMS yang didaftarkan saat pembuatan akun.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>3. Tujuan Penggunaan Data & Sifat Akses Read-Only</h2>
            <div style={styles.alertBox}>
              <CheckCircle2 size={18} color="var(--accent-green)" style={{ flexShrink: 0 }} />
              <div>
                <strong>Akses Sepenuhnya Read-Only (Hanya Baca):</strong> Seluruh otorisasi yang diminta oleh Supermat bersifat read-only. Kami <em>tidak pernah</em> meminta atau menggunakan izin untuk membuat, memodifikasi, menghentikan kampanye iklan, memotong saldo keuangan, atau mengubah pengaturan toko Anda.
              </div>
            </div>
            <p style={styles.paragraph}>Data yang diakses digunakan semata-mata untuk tujuan:</p>
            <ul style={styles.bulletList}>
              <li>Menghasilkan ringkasan dasbor performa multi-platform bulanan bagi pemilik akun.</li>
              <li>Menyusun laporan presentasi eksekutif otomatis (Google Slides) dan spreadsheet rekapitulasi data (Google Sheets) untuk keperluan review bisnis Anda.</li>
              <li>Menghasilkan analisis komparatif dan insight rekomendasi optimasi biaya berbasis AI.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>4. Jaminan Tidak Menjual atau Membagikan Data</h2>
            <p style={styles.paragraph}>
              <strong>Supermat Powered by 3Our Indonesia menegaskan bahwa kami tidak pernah dan tidak akan pernah menjual, menyewakan, menukar, atau memonetisasi data bisnis, data iklan, atau informasi pelanggan Anda kepada pihak ketiga mana pun</strong> untuk tujuan periklanan pihak ketiga, pialang data (data broker), atau tujuan lain di luar operasional layanan Supermat yang secara tegas disetujui pengguna.
            </p>
          </section>

          {/* Section 5 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>5. Penyimpanan Data & Keamanan Token OAuth</h2>
            <div style={styles.securityBox}>
              <Lock size={18} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              <div>
                <strong>Enkripsi Tingkat Tinggi:</strong> Kredensial otentikasi (Access Token & Refresh Token OAuth) disimpan secara terenkripsi menggunakan algoritma standar industri (AES-256) pada pangkalan data terisolasi. Token hanya didekripsi saat sistem melakukan panggilan API terjadwal untuk penyusunan laporan berkala.
              </div>
            </div>
            <p style={styles.paragraph}>
              Kami menerapkan kontrol akses berbasis peran (RBAC), transmisi data terenkripsi SSL/TLS HTTPS end-to-end, dan pemantauan keamanan berkala untuk mencegah akses tanpa hak.
            </p>
          </section>

          {/* Section 6 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>6. Hak Pengguna & Cara Mencabut Akses Otorisasi</h2>
            <p style={styles.paragraph}>
              Pengguna memiliki kendali penuh atas koneksi platform iklan dan marketplace yang terhubung. Anda dapat mencabut izin akses kapan saja melalui salah satu cara berikut:
            </p>
            <ol style={styles.orderedList}>
              <li>
                <strong>Melalui Dasbor Supermat:</strong> Masuk ke akun Anda, buka menu <em>Ads Report → Koneksi Platform</em>, lalu klik tombol <em>Putuskan</em> pada akun yang ingin dicabut. Token akses akan segera dihapus dari sistem kami.
              </li>
              <li>
                <strong>Melalui Pengaturan Platform Masing-Masing:</strong>
                <ul style={{ ...styles.bulletList, marginTop: '0.5rem' }}>
                  <li>Shopee: Masuk ke <em>Shopee Seller Centre → Pengaturan Akun → Aplikasi Mitra Terhubung</em> dan klik Cabut Akses.</li>
                  <li>TikTok: Masuk ke <em>TikTok Business Center / Seller Center → Authorized Apps</em> dan hapus otorisasi Supermat.</li>
                  <li>Meta: Buka <em>Pengaturan Bisnis Meta → Integrasi Bisnis</em> dan hapus Supermat.</li>
                  <li>Google: Buka <em>Akun Google → Keamanan → Kelola akses pihak ketiga</em> dan cabut izin.</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Section 7 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>7. Perubahan Kebijakan Privasi</h2>
            <p style={styles.paragraph}>
              Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu seiring dengan penambahan fitur atau penyesuaian regulasi perlindungan data. Setiap pembaruan substansial akan diumumkan melalui pemberitahuan di dasbor aplikasi atau melalui email terdaftar.
            </p>
          </section>

          {/* Section 8 */}
          <section style={styles.section}>
            <h2 style={styles.sectionHeading}>8. Kontak Pertanyaan & Layanan Pelanggan</h2>
            <p style={styles.paragraph}>
              Apabila Anda memiliki pertanyaan, klarifikasi, atau permintaan penghapusan data terkait kebijakan privasi ini, silakan hubungi tim kami di:
            </p>
            <div style={styles.contactCard}>
              <p style={{ margin: 0 }}><strong>Departemen Legal & Privasi Data</strong></p>
              <p style={{ margin: '0.25rem 0' }}>Supermat Powered by 3Our Indonesia</p>
              <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>Jl. BSD Raya Utama, Kabupaten Tangerang, Banten</p>
              <p style={{ margin: '0.25rem 0' }}>
                Email:{' '}
                <a href="mailto:3our.id@gmail.com" style={{ color: 'var(--accent-cyan)' }}>
                  3our.id@gmail.com
                </a>
              </p>
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
    padding: '2.5rem 1.5rem 4rem 1.5rem',
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
    fontSize: '2rem',
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
