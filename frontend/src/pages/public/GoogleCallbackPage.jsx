import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, KeyRound, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { setToken, API_BASE_URL } from '../../api.js';
import { useLanguage } from '../../context/LanguageContext';
import { LocalizedLink, useLocalizedNavigate } from '../../lib/localized-router';

export default function GoogleCallbackPage({ onLogin }) {
  const { t, lang, setLang } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useLocalizedNavigate();

  const [status, setStatus] = useState('processing'); // 'processing' | 'link_required' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [emailToLink, setEmailToLink] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  const exchangeStartedRef = useRef(false);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const handleExchange = useCallback(async (authCode, authState) => {
    try {
      setStatus('processing');

      const res = await fetch(`${API_BASE_URL}/api/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: authCode,
          state: authState
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.code === 'LINK_PASSWORD_REQUIRED') {
          setStatus('link_required');
          setEmailToLink(data.email || '');
          setPendingToken(data.pendingToken || '');
          return;
        }
        throw new Error(data.error || t('auth.googleDefaultError', 'An unexpected error occurred while connecting your account.'));
      }

      setStatus('success');
      if (data.accessToken) {
        setToken(data.accessToken);
      }
      if (data.user?.locale && data.user.locale !== lang) {
        setLang(data.user.locale);
      }
      if (onLogin) {
        onLogin(data.user, data.accessToken);
      }

      setTimeout(() => {
        navigate('/app/ads', { replace: true });
      }, 700);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || t('auth.googleDefaultError', 'Failed to connect with Google.'));
    }
  }, [navigate, onLogin, lang, setLang, t]);

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setErrorMessage(
        errorParam === 'access_denied'
          ? t('auth.googleCancelled', 'Google authorization was cancelled by the user.')
          : `${t('auth.googleFailedTitle')}: ${errorParam}`
      );
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage(t('auth.googleParamMissing', 'Google authorization parameters are incomplete.'));
      return;
    }

    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    handleExchange(code, state);
  }, [code, state, errorParam, handleExchange, t]);

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!linkPassword || !pendingToken) return;
    try {
      setSubmittingLink(true);
      setErrorMessage('');

      const res = await fetch(`${API_BASE_URL}/api/auth/google/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pendingToken,
          password: linkPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('auth.googleDefaultError', 'Failed to link Google account.'));
      }

      setStatus('success');
      if (data.accessToken) {
        setToken(data.accessToken);
      }
      if (data.user?.locale && data.user.locale !== lang) {
        setLang(data.user.locale);
      }
      if (onLogin) {
        onLogin(data.user, data.accessToken);
      }

      setTimeout(() => {
        navigate('/app/ads', { replace: true });
      }, 700);
    } catch (err) {
      setErrorMessage(err.message || t('auth.googleDefaultError', 'Failed to link account.'));
    } finally {
      setSubmittingLink(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {status === 'processing' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-cyan">
              <Loader2 size={36} className="animate-spin" />
            </div>
            <h2 className="callback-title">{t('auth.googleConnecting')}</h2>
            <p className="callback-desc">
              {t('auth.googleConnectingDesc')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-green">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="callback-title">{t('auth.googleSuccess')}</h2>
            <p className="callback-desc">
              {t('auth.googleSuccessDesc')}
            </p>
          </div>
        )}

        {status === 'link_required' && (
          <div>
            <div className="callback-header-row">
              <div className="callback-header-icon">
                <Lock size={22} />
              </div>
              <div className="callback-header-text">
                <h2>{t('auth.linkPasswordRequiredTitle')}</h2>
                <p>{t('auth.linkPasswordRequiredSubtitle')}</p>
              </div>
            </div>

            <div className="callback-info-callout">
              {t('auth.linkPasswordRequiredCallout', { email: emailToLink })}
            </div>

            {errorMessage && (
              <div className="auth-error-alert" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">{t('auth.linkPasswordLabel')}</label>
                <div className="auth-input-wrapper">
                  <input
                    type="password"
                    className="auth-input"
                    placeholder={t('auth.linkPasswordPlaceholder')}
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <KeyRound size={16} className="auth-input-icon" />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingLink || !linkPassword}
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '44px', fontWeight: 600, fontSize: '15px' }}
              >
                {submittingLink ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t('auth.btnProcessing')}</span>
                  </>
                ) : (
                  <span>{t('auth.btnLinkAccount')}</span>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <LocalizedLink to="/login" className="callback-cancel-link">
                <ArrowLeft size={14} />
                <span>{t('auth.btnCancelLink')}</span>
              </LocalizedLink>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="callback-status-box">
            <div className="callback-icon-circle callback-icon-red">
              <AlertCircle size={36} />
            </div>
            <h2 className="callback-title">{t('auth.googleFailedTitle')}</h2>
            <p className="callback-desc">
              {errorMessage || t('auth.googleDefaultError')}
            </p>
            <div style={{ width: '100%' }}>
              <LocalizedLink
                to="/login"
                className="btn btn-primary"
                style={{ width: '100%', minHeight: '44px', textDecoration: 'none', fontWeight: 600 }}
              >
                <ArrowLeft size={16} />
                <span>{t('auth.backToSignIn')}</span>
              </LocalizedLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
