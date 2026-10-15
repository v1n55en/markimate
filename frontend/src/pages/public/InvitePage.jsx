import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { api, getToken } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { LocalizedLink, useLocalizedNavigate } from '../../lib/localized-router';
import { SiteLink } from '../../lib/hosts';
import MarkimateLogo from '../../components/common/MarkimateLogo';

export default function InvitePage() {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useLocalizedNavigate();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Muat info undangan dan user yang sedang login
  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError(t('auth.errTokenMissing', 'Invitation link does not contain a valid token.'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Cek user login
        if (getToken()) {
          try {
            const meRes = await api('/api/me');
            if (meRes?.user) setCurrentUser(meRes.user);
          } catch {}
        }

        // Cek info undangan
        const infoRes = await api(`/api/invites/info?token=${encodeURIComponent(token)}`);
        if (!infoRes || !infoRes.valid) {
          setError(infoRes?.message || t('auth.inviteInvalid', 'Invitation is invalid or has expired.'));
        } else {
          setInviteInfo(infoRes.invite);
        }
      } catch (err) {
        setError(err.message || t('auth.inviteInvalid', 'Failed to load invitation information.'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token, t]);

  // Handler menerima undangan
  const handleAcceptInvite = async () => {
    try {
      setAccepting(true);
      setAcceptError('');
      const res = await api('/api/invites/accept', {
        method: 'POST',
        body: { token }
      });

      if (res && res.success) {
        setAcceptSuccess(true);
        window.dispatchEvent(new CustomEvent('markimate:workspace-changed', {
          detail: { id: res.workspace?.id }
        }));
        setTimeout(() => {
          navigate('/app/ads');
        }, 2000);
      }
    } catch (err) {
      setAcceptError(err.message || t('auth.inviteInvalid', 'Failed to accept invitation.'));
    } finally {
      setAccepting(false);
    }
  };

  const isEmailMatch = currentUser && inviteInfo &&
    currentUser.email?.toLowerCase() === inviteInfo.email?.toLowerCase();

  return (
    <div className="auth-page-container">
      <div className="auth-card-box card">
        {/* Header / Brand */}
        <div className="auth-header">
          <SiteLink to="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '0.5rem' }}>
            <MarkimateLogo size={36} />
          </SiteLink>
          <h1 className="auth-title">{t('auth.inviteTitle')}</h1>
          <p className="auth-subtitle">
            {t('auth.inviteSubtitle')}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            <p>{t('auth.inviteChecking')}</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div>
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>{t('auth.inviteInvalid')}</strong>
                <p style={{ margin: '4px 0 0 0' }}>{error}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <LocalizedLink to="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                {t('auth.backToSignIn')}
              </LocalizedLink>
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && acceptSuccess && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <CheckCircle2 size={26} color="var(--accent-green)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t('auth.inviteAcceptedTitle')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {t('auth.inviteAcceptedDesc', {
                workspaceName: inviteInfo?.workspaceName,
                role: inviteInfo?.role === 'admin' ? t('auth.roleAdmin') : t('auth.roleViewer')
              })}
            </p>
          </div>
        )}

        {/* Info Undangan & Aksi */}
        {!loading && !error && !acceptSuccess && inviteInfo && (
          <div>
            {/* Box Detail Undangan */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-muted)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={18} color="var(--accent-cyan)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('auth.inviteTargetWorkspace')}</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {inviteInfo.workspaceName}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                fontSize: '0.8rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-muted)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>{t('auth.inviteInviter')}</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{inviteInfo.inviterName}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>{t('auth.inviteRole')}</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: inviteInfo.role === 'admin' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                    color: inviteInfo.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontWeight: '600'
                  }}>
                    {inviteInfo.role === 'admin' ? t('auth.roleAdmin') : t('auth.roleViewer')}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t('auth.inviteFor')} <strong style={{ color: 'var(--text-primary)' }}>{inviteInfo.email}</strong>
              </div>
            </div>

            {acceptError && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{acceptError}</span>
              </div>
            )}

            {/* Skenario 1: Belum Login */}
            {!currentUser && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>
                  {t('auth.inviteLoginPrompt', { email: inviteInfo.email })}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <LocalizedLink
                    to={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <LogIn size={16} />
                    <span>{t('auth.btnSignIn')}</span>
                  </LocalizedLink>
                  <LocalizedLink
                    to={`/register?next=${encodeURIComponent(`/invite?token=${token}`)}`}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <UserPlus size={16} />
                    <span>{t('auth.tabRegister')}</span>
                  </LocalizedLink>
                </div>
              </div>
            )}

            {/* Skenario 2: Login dengan Email Sesuai */}
            {currentUser && isEmailMatch && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textAlign: 'center' }}>
                  {t('auth.inviteLoggedInAs', { email: currentUser.email })}
                </p>

                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  disabled={accepting}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                >
                  <ShieldCheck size={18} />
                  <span>{accepting ? t('auth.btnProcessing') : t('auth.btnAcceptInvite')}</span>
                </button>
              </div>
            )}

            {/* Skenario 3: Login dengan Email Berbeda */}
            {currentUser && !isEmailMatch && (
              <div>
                <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.825rem' }}>
                    <strong>{t('auth.inviteEmailMismatchTitle')}</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      {t('auth.inviteEmailMismatchDesc', {
                        inviteEmail: inviteInfo.email,
                        currentEmail: currentUser.email
                      })}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new Event('markimate:logout'));
                      navigate(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
                    }}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>{t('auth.inviteSwitchAccount')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="auth-card-footer">
          <SiteLink to="/terms" className="auth-link">{t('auth.termsOfService')}</SiteLink>
          <span>·</span>
          <SiteLink to="/privacy" className="auth-link">{t('auth.privacyPolicy')}</SiteLink>
        </div>
      </div>
    </div>
  );
}
