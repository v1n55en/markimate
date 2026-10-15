import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Search, ExternalLink, ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../api';
import SeoHead from '../../components/common/SeoHead';
import { LocalizedLink } from '../../lib/localized-router';
import { AppLink } from '../../lib/hosts';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime } from '../../lib/format';

export default function DataDeletionPage() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [confirmationCode, setConfirmationCode] = useState(initialCode);
  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState('');

  const handleCheckStatus = async (e) => {
    if (e) e.preventDefault();
    const code = confirmationCode.trim();
    if (!code) {
      setStatusError(t('dataDeletion.errorRequired', 'Please enter your confirmation code.'));
      return;
    }

    setStatusError('');
    setStatusResult(null);
    setChecking(true);

    try {
      const res = await api(`/api/data-deletion/status?code=${encodeURIComponent(code)}`);
      setStatusResult(res);
    } catch (err) {
      setStatusError(err.message || t('dataDeletion.errorInvalid', 'Confirmation code not found or invalid.'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="auth-page-container">
      <SeoHead
        title={t('dataDeletion.pageTitle', 'User & Meta Data Deletion')}
        description={t('dataDeletion.pageSubtitle', 'Platform & Meta Data Deletion Instructions')}
        path="/data-deletion"
      />
      <div className="auth-card-wrapper" style={{ maxWidth: '640px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <AppLink
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>{t('dataDeletion.backToLogin', 'Back to Sign In')}</span>
          </AppLink>
        </div>

        <div className="auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-red)'
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {t('dataDeletion.pageTitle', 'User & Meta Data Deletion')}
              </h1>
              <p style={{ fontSize: '0.825rem', margin: '2px 0 0 0', color: 'var(--text-secondary)' }}>
                {t('dataDeletion.pageSubtitle', 'Platform & Meta Data Deletion Instructions')}
              </p>
            </div>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            <p style={{ marginTop: 0 }}>
              {t('dataDeletion.policyDesc', 'In compliance with Meta Platform Policies and Markimate\'s privacy commitment, users retain the right to request deletion of their account and all connected Meta advertising data, keywords, articles, and CMS connections at any time.')}
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t('dataDeletion.section1Title', '1. Deleting Your Markimate Account & Data')}
            </h3>
            <p>
              {t('dataDeletion.section1Desc', 'If you have an active Markimate account, you can request full account and workspace deletion directly from account settings:')}
            </p>
            <div style={{ margin: '0.75rem 0' }}>
              <LocalizedLink
                to="/app/settings/account"
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  fontSize: '0.85rem'
                }}
              >
                <span>{t('dataDeletion.openSettingsBtn', 'Open Account Settings')}</span>
                <ExternalLink size={14} />
              </LocalizedLink>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('dataDeletion.gracePeriodNote', 'Accounts requested for deletion enter a 30-day grace period before permanent deletion. You may cancel deletion at any time by signing in during this period.')}
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
              {t('dataDeletion.section2Title', '2. Facebook / Meta App Data Deletion')}
            </h3>
            <p>
              {t('dataDeletion.section2Desc', 'If you revoke Markimate app permissions via Settings & Privacy > Settings > Apps and Websites on your Facebook/Meta account, Meta automatically triggers a Data Deletion Webhook Callback to Markimate servers.')}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

          {/* Form Cek Status Penghapusan */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t('dataDeletion.checkFormTitle', 'Check Data Deletion Request Status')}
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1rem' }}>
              {t('dataDeletion.checkFormDesc', 'Enter the Confirmation Code you received from Meta to check processing status:')}
            </p>

            <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="auth-input"
                style={{ flex: '1 1 240px', minWidth: '220px' }}
                placeholder={t('dataDeletion.codePlaceholder', 'e.g. del_a1b2c3d4e5f6...')}
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={checking}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Search size={15} />
                <span>{checking ? t('dataDeletion.checkingBtn', 'Checking...') : t('dataDeletion.checkStatusBtn', 'Check Status')}</span>
              </button>
            </form>

            {statusError && (
              <div
                className="auth-alert-box auth-alert-error"
                style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <AlertCircle size={16} />
                <span>{statusError}</span>
              </div>
            )}

            {statusResult && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem' }}>
                  <CheckCircle2 size={16} />
                  <span>{t('dataDeletion.statusVerified', 'Deletion Request Verified')}</span>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <div>{t('dataDeletion.statusCode', 'Confirmation Code:')} <code style={{ color: 'var(--text-primary)' }}>{statusResult.confirmationCode}</code></div>
                  <div>{t('dataDeletion.statusLabel', 'Process Status:')} <strong style={{ color: 'var(--accent-green)' }}>{statusResult.status?.toUpperCase() || 'COMPLETED'}</strong></div>
                  <div>{t('dataDeletion.statusProcessedAt', 'Processed At:')} {formatDateTime(statusResult.requestedAt, lang)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
