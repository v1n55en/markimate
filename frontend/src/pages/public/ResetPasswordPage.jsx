import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { LocalizedLink, useLocalizedNavigate } from '../../lib/localized-router';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useLocalizedNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(token ? '' : t('auth.errTokenMissing', 'Reset token is missing or invalid.'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('auth.errTokenMissing', 'Reset token is missing or invalid.'));
      return;
    }
    if (password.length < 10) {
      setError(t('auth.errPasswordMinLength', 'Password must be at least 10 characters for account security.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errPasswordMismatch', 'Password confirmation does not match.'));
      return;
    }

    try {
      setLoading(true);
      await api('/api/auth/reset', {
        method: 'POST',
        body: { token, password }
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || t('auth.errResetFailed', 'Reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-box">
        {/* Header Logo */}
        <div className="auth-header">
          <LocalizedLink to="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <MarkimateLogo size={36} />
          </LocalizedLink>
          <h1 className="auth-title">Markimate</h1>
          <p className="auth-subtitle">{t('auth.resetTitle')}</p>
        </div>

        {success ? (
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
              {t('auth.resetSuccessTitle')}
            </h2>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              {t('auth.resetSuccessDesc')}
            </p>

            <button
              onClick={() => navigate('/login')}
              className="auth-btn-primary"
            >
              <span>{t('auth.btnGoToSignIn')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div className="auth-alert-box auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-field-label">{t('auth.labelPassword')}</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder={t('auth.placeholderPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <div style={{
                  fontSize: '0.75rem',
                  color: password.length >= 10 ? 'var(--accent-green, #10b981)' : 'var(--text-secondary)',
                  marginTop: '2px'
                }}>
                  {password.length >= 10 ? t('auth.passwordHintValid') : t('auth.passwordHintMin')}
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-field-label">{t('auth.confirmPasswordLabel')}</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading || !token}
              >
                <span>{loading ? t('auth.btnProcessing') : t('auth.btnSetPassword')}</span>
                <KeyRound size={16} />
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
