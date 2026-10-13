import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, LogIn, ArrowRight, Coins, Mail } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('F&B');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');

  // State untuk verifikasi email
  const [verificationSentEmail, setVerificationSentEmail] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  const handleCancelDeletion = async () => {
    try {
      setCancellingDeletion(true);
      setError('');
      setErrorCode('');
      const res = await api('/api/account/delete/cancel', {
        method: 'POST',
        body: { email, password }
      });
      if (res && res.accessToken) {
        setToken(res.accessToken);
        if (onLoginSuccess) onLoginSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Gagal membatalkan penghapusan akun.');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const handleResendVerification = async (targetEmail) => {
    const em = targetEmail || unverifiedEmail || email;
    if (!em) return;
    setResending(true);
    setResendNotice('');
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email: em }
      });
      setResendNotice(lang === 'id'
        ? 'Tautan verifikasi baru telah dikirim. Silakan periksa inbox email atau folder spam Anda.'
        : 'A new verification link has been sent. Please check your inbox or spam folder.');
    } catch (err) {
      setResendNotice(err.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setResendNotice('');
    setUnverifiedEmail('');

    if (!email || !password) {
      setError(lang === 'id' ? 'Harap isi semua field wajib.' : 'Please fill in all required fields.');
      return;
    }
    if (!isLogin) {
      if (!brandName) {
        setError(lang === 'id' ? 'Harap isi nama brand bisnis Anda.' : 'Please enter your brand / workspace name.');
        return;
      }
      if (password.length < 10) {
        setError(lang === 'id' ? 'Kata sandi minimal 10 karakter untuk keamanan akun Anda.' : 'Password must be at least 10 characters.');
        return;
      }
      if (!acceptTerms) {
        setError(lang === 'id' ? 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi.' : 'You must accept the Terms of Service and Privacy Policy.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        setToken(data.token);
        await onLoginSuccess(data.user);
        navigate(nextParam);
      } else {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: { email, password, brandName, niche, name, acceptTerms: true }
        });
        if (data.status === 'verification_sent') {
          setVerificationSentEmail(data.email || email);
        }
      }
    } catch (err) {
      setError(err.message || (lang === 'id' ? 'Gagal masuk. Periksa email dan kata sandi Anda.' : 'Sign in failed. Please check your email and password.'));
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setErrorCode('EMAIL_NOT_VERIFIED');
        setUnverifiedEmail(err.email || email);
      } else if (err.code === 'ACCOUNT_PENDING_DELETION') {
        setErrorCode('ACCOUNT_PENDING_DELETION');
      }
    } finally {
      setLoading(false);
    }
  };

  // Layar "Cek Email Kamu" setelah registrasi berhasil
  if (verificationSentEmail) {
    return (
      <div className="auth-page-container">
        <div className="auth-card-box">
          <div className="auth-header">
            <Link to="/" style={styles.logoLink}>
              <div style={styles.logoContainer}>
                <MarkimateLogo size={36} />
              </div>
            </Link>
            <h1 style={styles.title}>Markimate</h1>
          </div>

          <div style={{ textAlign: 'center', padding: '12px 0 24px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Mail size={32} color="#2563eb" />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
              {lang === 'id' ? 'Cek Inbox Email Anda' : 'Check Your Email'}
            </h2>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569', margin: '0 0 20px 0' }}>
              {lang === 'id' ? (
                <>Kami telah mengirimkan tautan verifikasi ke <strong>{verificationSentEmail}</strong>. Buka email Anda dan klik tombol verifikasi untuk mengaktifkan akun serta mengklaim <strong>Free Trial 7 Hari (300 credit)</strong>.</>
              ) : (
                <>We sent a verification link to <strong>{verificationSentEmail}</strong>. Click the button in the email to activate your account and claim your <strong>7-Day Free Trial (300 credits)</strong>.</>
              )}
            </p>

            {resendNotice && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {resendNotice}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleResendVerification(verificationSentEmail)}
              disabled={resending}
              style={{
                width: '100%',
                padding: '12px 18px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '16px'
              }}
            >
              {resending
                ? (lang === 'id' ? 'Mengirimkan…' : 'Sending…')
                : (lang === 'id' ? 'Kirim Ulang Email Verifikasi' : 'Resend Verification Email')}
            </button>

            <button
              type="button"
              onClick={() => {
                setVerificationSentEmail('');
                setIsLogin(true);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              ← {lang === 'id' ? 'Kembali ke Halaman Masuk' : 'Back to Sign In'}
            </button>
          </div>

          <div style={styles.footer}>
            <ShieldCheck size={14} color="var(--accent-green)" />
            <span style={styles.footerText}>
              Markimate · powered by 3our · Verifikasi Email Wajib
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
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

        {/* Baris ajakan coba gratis 7 hari saat mode login */}
        {isLogin && (
          <div style={styles.trialPrompt}>
            <span>{lang === 'id' ? 'Belum punya akun?' : "Don't have an account?"}</span>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); setErrorCode(''); }}
              style={styles.trialPromptBtn}
            >
              <span>{lang === 'id' ? 'Coba gratis 7 hari (300 credit) →' : 'Start 7-day free trial (300 credits) →'}</span>
            </button>
          </div>
        )}

        <div style={styles.tabContainer}>
          <button 
            type="button"
            style={{...styles.tab, ...(isLogin ? styles.tabActive : {})}} 
            onClick={() => { setIsLogin(true); setError(''); setErrorCode(''); }}
          >
            <LogIn size={15} />
            {t('nav.login', 'Sign In')}
          </button>
          <button 
            type="button"
            style={{...styles.tab, ...(!isLogin ? styles.tabActive : {})}} 
            onClick={() => { setIsLogin(false); setError(''); setErrorCode(''); }}
          >
            <UserPlus size={15} />
            {lang === 'id' ? 'Daftar Baru' : 'Register'}
          </button>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <div>{error}</div>
            {errorCode === 'EMAIL_NOT_VERIFIED' && (
              <div style={{ marginTop: '10px' }}>
                {resendNotice ? (
                  <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 500 }}>{resendNotice}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleResendVerification(unverifiedEmail)}
                    disabled={resending}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {resending ? 'Mengirimkan…' : 'Kirim Ulang Email Verifikasi'}
                  </button>
                )}
              </div>
            )}
            {errorCode === 'ACCOUNT_PENDING_DELETION' && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleCancelDeletion}
                  disabled={cancellingDeletion}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {cancellingDeletion ? 'Membatalkan…' : 'Batalkan Penghapusan & Masuk ke Akun'}
                </button>
              </div>
            )}
          </div>
        )}

        {!isLogin && (
          <div style={styles.trialBox}>
            <Coins size={16} color="var(--accent-cyan)" />
            <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {lang === 'id'
                ? 'Daftar sekarang & dapatkan Free Trial 7 Hari (300 credit) otomatis setelah verifikasi email, tanpa perlu kartu kredit.'
                : 'Register now & instantly get a 7-Day Free Trial (300 credits) upon email verification, zero credit card required.'}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={styles.label}>Nama Anda / PIC</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Contoh: Budi Pratama" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  required 
                />
              </div>

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

          <div className="form-group" style={{ marginBottom: !isLogin ? '0.5rem' : '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ ...styles.label, marginBottom: 0 }}>Kata Sandi</label>
              {isLogin && (
                <Link to="/forgot" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  {lang === 'id' ? 'Lupa kata sandi?' : 'Forgot password?'}
                </Link>
              )}
            </div>
            <input 
              type="password" 
              className="form-input" 
              placeholder={!isLogin ? 'Minimal 10 karakter' : '••••••••'} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required 
            />
            {!isLogin && (
              <div style={{
                fontSize: '11px',
                color: password.length >= 10 ? '#10b981' : '#64748b',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {password.length >= 10 ? '✓ Panjang kata sandi memenuhi syarat (≥10 karakter)' : '• Minimal 10 karakter untuk standar keamanan akun'}
              </div>
            )}
          </div>

          {!isLogin && (
            <div style={{ marginBottom: '1.25rem', marginTop: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#2563eb' }}
                  required
                />
                <span>
                  Saya menyetujui{' '}
                  <Link to="/terms" target="_blank" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Syarat & Ketentuan
                  </Link>{' '}
                  dan{' '}
                  <Link to="/privacy" target="_blank" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Kebijakan Privasi
                  </Link>{' '}
                  Markimate.
                </span>
              </label>
            </div>
          )}

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
                <span>Daftar & Kirim Verifikasi</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-separator">
          <span>{lang === 'id' ? 'atau lanjutkan dengan' : 'or continue with'}</span>
        </div>

        <button
          type="button"
          onClick={() => { window.location.href = '/api/auth/google/start'; }}
          className="btn-google-auth"
          id="btn-google-auth"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" className="google-icon">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>
            {isLogin
              ? (lang === 'id' ? 'Masuk dengan Google' : 'Sign in with Google')
              : (lang === 'id' ? 'Daftar dengan Google' : 'Sign up with Google')}
          </span>
        </button>

        <div style={styles.footerLinks}>
          <Link to="/privacy" style={styles.footerLink}>Kebijakan Privasi</Link>
          <span>·</span>
          <Link to="/terms" style={styles.footerLink}>Syarat & Ketentuan</Link>
          <span>·</span>
          <Link to="/data-deletion" style={styles.footerLink}>Penghapusan Data</Link>
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
  trialPrompt: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.4rem',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    borderRadius: '8px',
    padding: '0.6rem 0.85rem',
    marginBottom: '1rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  trialPromptBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--accent-cyan)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline',
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
