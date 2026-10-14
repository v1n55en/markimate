import { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { LocalizedLink } from '../../lib/localized-router';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    if (!em) {
      setError(t('auth.errRequiredFields', 'Please enter your email address.'));
      return;
    }

    try {
      setLoading(true);
      await api('/api/auth/forgot', {
        method: 'POST',
        body: { email: em }
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || t('auth.errResetFailed', 'Failed to send password reset request.'));
    } finally {
      setLoading(false);
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
          <p className="auth-subtitle">{t('auth.forgotTitle')}</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
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
              <CheckCircle2 size={38} color="#10b981" />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              {t('auth.forgotCheckInboxTitle')}
            </h2>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              {t('auth.forgotCheckInboxDesc', { email })}
            </p>

            <LocalizedLink
              to="/login"
              className="auth-btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <ArrowLeft size={16} />
              <span>{t('auth.backToSignIn')}</span>
            </LocalizedLink>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {t('auth.forgotInstruction')}
            </p>

            {error && (
              <div className="auth-alert-box auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">{t('auth.labelEmail')}</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder={t('auth.placeholderEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
              >
                <span>{loading ? t('auth.btnResending') : t('auth.btnSendReset')}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <LocalizedLink
                to="/login"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--accent-cyan)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowLeft size={14} />
                <span>{t('auth.backToSignIn')}</span>
              </LocalizedLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
