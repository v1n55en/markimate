import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, LogIn, ArrowRight, Sparkles, Coins } from 'lucide-react';
import { api, setToken } from '../api';
import { useLanguage, LanguageSwitcher } from '../context/LanguageContext';
import MarkimateLogo from './common/MarkimateLogo';
import { storage } from '../lib/storage';

export default function AuthScreen({ onLoginSuccess, initialMode = 'login' }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const nextParam = searchParams.get('next') || '/app/ads';

  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [niche, setNiche] = useState('F&B');
  const [error, setError] = useState('');

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    // Simulasi sesi demo reviewer
    const demoPayload = {
      user: {
        id: 'demo-reviewer-1',
        email: 'reviewer@shopee-tiktok.demo',
        brandName: '3Our Official Demo Brand',
        isDemo: true,
        role: 'admin',
        plan: 'premium',
      },
      token: 'markimate_demo_token_' + Date.now(),
    };
    try {
      storage.setItem('demo_session', JSON.stringify(demoPayload));
      setToken(demoPayload.token);
      await onLoginSuccess(demoPayload.user);
      navigate(nextParam);
    } catch (err) {
      setError(err.message || (lang === 'id' ? 'Gagal masuk ke akun demo.' : 'Failed to launch demo account.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(lang === 'id' ? 'Harap isi semua field wajib.' : 'Please fill in all required fields.');
      return;
    }
    if (!isLogin && !brandName) {
      setError(lang === 'id' ? 'Harap isi nama brand bisnis Anda.' : 'Please enter your brand / workspace name.');
      return;
    }
    setLoading(true);
    try {
      const data = isLogin
        ? await api('/api/auth/login', { method: 'POST', body: { email, password } })
        : await api('/api/auth/register', { method: 'POST', body: { email, password, brandName, niche } });
      setToken(data.token);
      await onLoginSuccess(data.user);
      navigate(nextParam);
    } catch (err) {
      setError(err.message || (lang === 'id' ? 'Gagal masuk. Pastikan backend aktif atau gunakan Akun Demo Reviewer.' : 'Sign in failed. Make sure backend is running or use Instant Demo Workspace.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Decorative Glow */}
      <div style={styles.glowCyan}></div>
      <div style={styles.glowPurple}></div>

      <div style={styles.authCard} className="card">
        {/* Top bar with language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <LanguageSwitcher size="small" />
        </div>

        <div style={styles.header}>
          <Link to="/" style={styles.logoLink}>
            <div style={styles.logoContainer}>
              <MarkimateLogo size={32} />
            </div>
          </Link>
          <h1 style={styles.title}>Markimate</h1>
          <p style={styles.subtitle}>
            {lang === 'id' ? 'Semua Tim Digital Marketing dalam satu platform' : 'Full Digital Marketing Team in One Platform'} · <strong>powered by 3our</strong>
          </p>
        </div>

        {/* Demo Reviewer Shortcut Button */}
        <div style={styles.demoBox}>
          <div style={styles.demoTopRow}>
            <Sparkles size={16} color="var(--accent-yellow)" />
            <span style={styles.demoTitle}>
              {lang === 'id' ? 'Untuk Reviewer Shopee & TikTok' : 'Instant Reviewer Demo Access'}
            </span>
          </div>
          <p style={styles.demoDesc}>
            {lang === 'id'
              ? 'Gunakan akun demo untuk menguji langsung alur otorisasi toko/iklan dan melihat sampel laporan lengkap tanpa konfigurasi backend.'
              : 'Launch the interactive demo workspace to inspect multi-channel reporting, creative spy intelligence, and approval workflows without backend configuration.'}
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            style={styles.demoBtn}
          >
            <span>{t('auth.btnDemo', 'Launch Instant Demo Workspace')}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={styles.divider}>
          <span>{lang === 'id' ? 'atau masuk dengan akun Anda' : 'or continue with your credentials'}</span>
        </div>

        <div style={styles.tabContainer}>
          <button 
            type="button"
            style={{...styles.tab, ...(isLogin ? styles.tabActive : {})}} 
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            <LogIn size={15} />
            {t('nav.login', 'Sign In')}
          </button>
          <button 
            type="button"
            style={{...styles.tab, ...(!isLogin ? styles.tabActive : {})}} 
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            <UserPlus size={15} />
            {lang === 'id' ? 'Daftar Baru' : 'Register'}
          </button>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        {!isLogin && (
          <div style={styles.trialBox}>
            <Coins size={16} color="var(--accent-cyan)" />
            <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {lang === 'id'
                ? 'Daftar sekarang & dapatkan Free Trial 7 Hari (300 credit) otomatis tanpa perlu kartu kredit.'
                : 'Register now & instantly get a 7-Day Free Trial (300 credits) with zero credit card required.'}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={styles.label}>Nama Brand Bisnis</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Contoh: Kopi Makmur" 
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  style={styles.input}
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={styles.label}>Niche Usaha / Kategori</label>
                <select 
                  className="form-select"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  style={styles.select}
                >
                  <option value="F&B">F&B (Kuliner / Kafe / Resto)</option>
                  <option value="Retail">Retail & Fashion (E-commerce)</option>
                  <option value="Agency">Creative Agency / Jasa</option>
                  <option value="Tech">Software / Startup Teknologi</option>
                  <option value="Property">Properti & Real Estate</option>
                  <option value="Other">Lainnya</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={styles.label}>Alamat Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="nama@bisnis.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={styles.label}>Kata Sandi</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.loader}>Memproses…</span>
            ) : isLogin ? (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>Daftar Akun Baru</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={styles.footerLinks}>
          <Link to="/privacy" style={styles.footerLink}>Kebijakan Privasi</Link>
          <span>·</span>
          <Link to="/terms" style={styles.footerLink}>Syarat & Ketentuan</Link>
          <span>·</span>
          <Link to="/" style={styles.footerLink}>Beranda</Link>
        </div>

        <div style={styles.footer}>
          <ShieldCheck size={14} color="var(--accent-green)" />
          <span style={styles.footerText}>
            Markimate · powered by 3our · Keamanan Data OAuth Read-Only
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(1rem, 3vw, 2rem) clamp(0.75rem, 3vw, 1.5rem)',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-base)',
  },
  glowCyan: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
    pointerEvents: 'none',
  },
  glowPurple: {
    position: 'absolute',
    bottom: '20%',
    right: '25%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
    pointerEvents: 'none',
  },
  authCard: {
    maxWidth: '460px',
    width: '100%',
    padding: 'clamp(1.5rem, 4vw, 2.25rem) clamp(1rem, 3.5vw, 2rem)',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 10,
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.25rem',
  },
  logoLink: {
    display: 'inline-block',
  },
  logoContainer: {
    display: 'inline-flex',
    padding: '0.75rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
  },
  subtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  demoBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    marginBottom: '1.25rem',
  },
  demoTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    marginBottom: '0.3rem',
  },
  demoTitle: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: 'var(--accent-yellow)',
  },
  demoDesc: {
    fontSize: '0.725rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.35,
    margin: '0 0 0.65rem 0',
  },
  demoBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-yellow)',
    border: 'none',
    color: '#000000',
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.725rem',
    marginBottom: '1rem',
  },
  tabContainer: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.25rem',
    backgroundColor: '#09090b',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    marginBottom: '1.25rem',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.75rem',
    fontSize: '0.825rem',
    fontWeight: '500',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all var(--transition-fast)',
  },
  tabActive: {
    backgroundColor: 'var(--bg-surface-hover)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-muted)',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: 'var(--accent-red)',
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginBottom: '0.35rem',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  submitBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.7rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  loader: {
    display: 'inline-block',
  },
  footerLinks: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    marginTop: '1.25rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  footerLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    marginTop: '1rem',
  },
  footerText: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
  },
  trialBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    marginBottom: '1rem',
  },
};
