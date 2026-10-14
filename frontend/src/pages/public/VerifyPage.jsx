import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowRight, Mail, RefreshCw } from 'lucide-react';
import { api, setToken } from '../../api';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { LocalizedLink, useLocalizedNavigate } from '../../lib/localized-router';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function VerifyPage({ onLoginSuccess }) {
  const { t, lang, setLang } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useLocalizedNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(token ? '' : t('auth.errTokenMissing', 'Verification token is missing or invalid.'));

  // State untuk form kirim ulang
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    async function doVerify() {
      try {
        setLoading(true);
        setError('');
        const res = await api('/api/auth/verify', {
          method: 'POST',
          body: { token }
        });

        if (isMounted) {
          setVerified(true);
          setUserData(res.user);
          if (res.user?.locale && res.user.locale !== lang) {
            setLang(res.user.locale);
          }
          if (res.token) {
            setToken(res.token);
            if (onLoginSuccess) {
              await onLoginSuccess(res.user);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || t('auth.verifyErrorTitle', 'Verification link is invalid or has expired.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    doVerify();
    return () => { isMounted = false; };
  }, [token, onLoginSuccess, lang, setLang, t]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendNotice('');
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email: resendEmail }
      });
      setResendNotice(t('auth.resendSuccess', 'A new verification link has been sent. Please check your inbox or spam folder.'));
    } catch (err) {
      setResendNotice(err.message || t('auth.btnResend', 'Failed to resend verification email.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {/* Language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <LanguageSwitcher size="small" />
        </div>

        {/* Header Logo */}
        <div className="auth-header">
          <LocalizedLink to="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <MarkimateLogo size={36} />
          </LocalizedLink>
          <h1 className="auth-title">Markimate</h1>
          <p className="auth-subtitle">{t('auth.verifyTitle')}</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <RefreshCw size={36} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('auth.verifySubtitle')}
            </p>
          </div>
        )}

        {/* Success State */}
        {!loading && verified && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <CheckCircle2 size={40} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              {t('auth.verifySuccessTitle')}
            </h2>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              {t('auth.verifySuccessDesc')}
            </p>

            <button
              onClick={() => navigate('/app/ads')}
              className="auth-btn-primary"
            >
              <span>{t('auth.btnEnterDashboard')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Error / Invalid Token State */}
        {!loading && !verified && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem auto'
            }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h2 style={{ textAlign: 'center', fontSize: '1.15rem', fontWeight: 700, color: '#f87171', margin: 0 }}>
              {t('auth.verifyErrorTitle')}
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
              {error}
            </p>

            <div style={{
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-muted)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {t('auth.btnResendVerification')}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {t('auth.verifyResendInstruction')}
              </p>

              {resendNotice && (
                <div className="auth-alert-box auth-alert-info">{resendNotice}</div>
              )}

              <form onSubmit={handleResend} className="auth-form" style={{ gap: '0.75rem' }}>
                <input
                  type="email"
                  className="auth-input"
                  placeholder={t('auth.placeholderEmail')}
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={resending}
                  style={{ minHeight: '40px', fontSize: '0.85rem' }}
                >
                  {resending ? t('auth.btnResending') : t('auth.btnResendVerification')}
                </button>
              </form>
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <LocalizedLink to="/login" style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
                <span>{t('auth.backToSignIn')}</span>
              </LocalizedLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
