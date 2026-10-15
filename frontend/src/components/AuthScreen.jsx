import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, UserPlus, LogIn, ArrowRight, Coins, Mail } from 'lucide-react';
import { api, setToken } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { LocalizedLink } from '../lib/localized-router';
import MarkimateLogo from './common/MarkimateLogo';

export default function AuthScreen({ onLoginSuccess, initialMode = 'login' }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
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
        if (res.user?.locale && res.user.locale !== lang) {
          setLang(res.user.locale);
        }
        if (onLoginSuccess) onLoginSuccess(res);
      }
    } catch (err) {
      setError(err.message || t('auth.errCancelDeletionFailed', 'Failed to cancel account deletion.'));
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
      setResendNotice(t('auth.resendSuccess', 'A new verification link has been sent. Please check your inbox or spam folder.'));
    } catch (err) {
      setResendNotice(err.message || t('auth.btnResend', 'Failed to resend verification email.'));
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
      setError(t('auth.errRequiredFields', 'Please fill in all required fields.'));
      return;
    }
    if (!isLogin) {
      if (!brandName) {
        setError(t('auth.errBrandRequired', 'Please enter your brand / workspace name.'));
        return;
      }
      if (password.length < 10) {
        setError(t('auth.errPasswordMinLength', 'Password must be at least 10 characters for account security.'));
        return;
      }
      if (!acceptTerms) {
        setError(t('auth.errAcceptTerms', 'You must accept the Terms of Service and Privacy Policy.'));
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        setToken(data.token);
        if (data.user?.locale && data.user.locale !== lang) {
          setLang(data.user.locale);
        }
        await onLoginSuccess(data.user);
        navigate(nextParam);
      } else {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: { email, password, brandName, niche, name, acceptTerms: true, locale: lang }
        });
        if (data.status === 'verification_sent') {
          setVerificationSentEmail(data.email || email);
        }
      }
    } catch (err) {
      const translated = err.code ? t(`errors.${err.code}`) : '';
      const displayMsg = (translated && translated !== `errors.${err.code}`)
        ? translated
        : (err.message || t('auth.errSignInFailed', 'Sign in failed. Please check your email and password.'));
      setError(displayMsg);
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

  // Layar "Cek Email Anda" setelah registrasi berhasil
  if (verificationSentEmail) {
    return (
      <div className="auth-page-container">
        <div className="auth-glow-cyan" aria-hidden="true" />
        <div className="auth-glow-purple" aria-hidden="true" />
        <div className="auth-card-box">
          <div className="auth-header">
            <LocalizedLink to="/" className="auth-logo-link">
              <div className="auth-logo-container">
                <MarkimateLogo size={36} />
              </div>
            </LocalizedLink>
            <h1 className="auth-title">Markimate</h1>
          </div>

          <div style={{ textAlign: 'center', padding: '12px 0 24px 0' }}>
            <div className="auth-verify-icon-box">
              <Mail size={32} color="#2563eb" />
            </div>

            <h2 className="auth-verify-title">
              {t('auth.checkInboxTitle')}
            </h2>

            <p className="auth-verify-desc">
              {t('auth.checkInboxDesc', { email: verificationSentEmail })}
            </p>

            {resendNotice && (
              <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '16px' }}>
                {resendNotice}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleResendVerification(verificationSentEmail)}
              disabled={resending}
              className="auth-verify-resend-btn"
            >
              {resending ? t('auth.btnResending') : t('auth.btnResend')}
            </button>

            <button
              type="button"
              onClick={() => {
                setVerificationSentEmail('');
                setIsLogin(true);
                setError('');
              }}
              className="auth-verify-back-btn"
            >
              ← {t('auth.backToSignIn')}
            </button>
          </div>

          <div className="auth-footer-security">
            <ShieldCheck size={14} color="var(--accent-green)" />
            <span>
              Markimate · powered by 3our · {t('auth.emailVerificationRequired')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-glow-cyan" aria-hidden="true" />
      <div className="auth-glow-purple" aria-hidden="true" />
      <div className="auth-card-box">
        <div className="auth-header">
          <LocalizedLink to="/" className="auth-logo-link">
            <div className="auth-logo-container">
              <MarkimateLogo size={32} />
            </div>
          </LocalizedLink>
          <h1 className="auth-title">Markimate</h1>
          <p className="auth-subtitle">
            {t('auth.tagline')} · <strong>powered by 3our</strong>
          </p>
        </div>

        {/* Baris ajakan coba gratis saat mode login */}
        {isLogin && (
          <div className="auth-trial-prompt">
            <span>{t('auth.trialLoginPrompt')}</span>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); setErrorCode(''); }}
              className="auth-trial-prompt-btn"
            >
              <span>{t('auth.trialLoginPromptBtn')}</span>
            </button>
          </div>
        )}

        <div className="auth-tab-container">
          <button 
            type="button"
            className={`auth-tab ${isLogin ? 'auth-tab-active' : ''}`} 
            onClick={() => { setIsLogin(true); setError(''); setErrorCode(''); }}
          >
            <LogIn size={15} />
            {t('auth.tabLogin', 'Sign In')}
          </button>
          <button 
            type="button"
            className={`auth-tab ${!isLogin ? 'auth-tab-active' : ''}`} 
            onClick={() => { setIsLogin(false); setError(''); setErrorCode(''); }}
          >
            <UserPlus size={15} />
            {t('auth.tabRegister', 'Register')}
          </button>
        </div>

        {error && (
          <div className="auth-error-alert" style={{ marginBottom: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
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
                    className="btn btn-primary"
                    style={{ minHeight: '36px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    {resending ? t('auth.btnResending') : t('auth.btnResend')}
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
                  className="btn btn-secondary"
                  style={{ minHeight: '36px', fontSize: '12px', padding: '6px 14px' }}
                >
                  {cancellingDeletion ? t('auth.btnCancellingDeletion') : t('auth.btnCancelDeletion')}
                </button>
              </div>
            )}
          </div>
        )}

        {!isLogin && (
          <div className="auth-trial-box">
            <Coins size={16} color="var(--accent-cyan)" />
            <div className="auth-trial-box-text">
              {t('auth.trialRegisterNote')}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <div className="auth-field">
                <label className="auth-field-label">{t('auth.labelBrandPic')}</label>
                <input 
                  type="text" 
                  className="auth-input" 
                  placeholder={t('auth.placeholderBrandPic')} 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">{t('auth.labelBrandName')}</label>
                <input 
                  type="text" 
                  className="auth-input" 
                  placeholder={t('auth.placeholderBrand')} 
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required 
                />
              </div>

              <div className="auth-field">
                <label className="auth-field-label">{t('auth.labelNiche')}</label>
                <select 
                  className="auth-input"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                >
                  <option value="F&B">F&B (Kuliner / Kafe / Resto)</option>
                  <option value="Retail">Retail & Fashion (E-commerce)</option>
                  <option value="Agency">Creative Agency / Jasa</option>
                  <option value="Tech">Software / Startup Teknologi</option>
                  <option value="Property">Properti & Real Estate</option>
                  <option value="Other">Lainnya / Other</option>
                </select>
              </div>
            </>
          )}

          <div className="auth-field">
            <label className="auth-field-label">{t('auth.labelEmail')}</label>
            <input 
              type="email" 
              className="auth-input" 
              placeholder={t('auth.placeholderEmail')} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-field-label">{t('auth.labelPassword')}</label>
              {isLogin && (
                <LocalizedLink to="/forgot" className="auth-forgot-link">
                  {t('auth.forgotPasswordLink')}
                </LocalizedLink>
              )}
            </div>
            <input 
              type="password" 
              className="auth-input" 
              placeholder={!isLogin ? t('auth.placeholderPassword') : '••••••••'} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            {!isLogin && (
              <div className="auth-password-hint" style={{ color: password.length >= 10 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {password.length >= 10 ? t('auth.passwordHintValid') : t('auth.passwordHintMin')}
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="auth-checkbox-row" style={{ marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="accept-terms"
                className="auth-checkbox-input"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <label htmlFor="accept-terms" style={{ cursor: 'pointer', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {t('auth.agreeTermsPrefix')}{' '}
                <LocalizedLink to="/terms" target="_blank" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                  {t('auth.termsOfService')}
                </LocalizedLink>{' '}
                {t('auth.andText')}{' '}
                <LocalizedLink to="/privacy" target="_blank" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                  {t('auth.privacyPolicy')}
                </LocalizedLink>{' '}
                Markimate.
              </label>
            </div>
          )}

          <button 
            type="submit" 
            className="auth-btn-primary" 
            disabled={loading}
          >
            {loading ? (
              <span>{t('auth.btnProcessing')}</span>
            ) : isLogin ? (
              <>
                <span>{t('auth.btnSignIn')}</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>{t('auth.btnSignUp')}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-separator">
          <span>{t('auth.orContinueWith')}</span>
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
            {isLogin ? t('auth.btnGoogleLogin') : t('auth.btnGoogleRegister')}
          </span>
        </button>

        <div className="auth-footer-links">
          <LocalizedLink to="/privacy" className="auth-footer-link">{t('auth.privacyPolicy')}</LocalizedLink>
          <span>·</span>
          <LocalizedLink to="/terms" className="auth-footer-link">{t('auth.termsOfService')}</LocalizedLink>
          <span>·</span>
          <LocalizedLink to="/data-deletion" className="auth-footer-link">{t('auth.dataDeletion')}</LocalizedLink>
          <span>·</span>
          <LocalizedLink to="/" className="auth-footer-link">{t('auth.home')}</LocalizedLink>
        </div>

        <div className="auth-footer-security">
          <ShieldCheck size={14} color="var(--accent-green)" />
          <span>
            Markimate · powered by 3our · {t('auth.footerSecurityNote')}
          </span>
        </div>
      </div>
    </div>
  );
}
