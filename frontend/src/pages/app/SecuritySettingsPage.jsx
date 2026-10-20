import { useState, useEffect } from 'react';
import { Shield, Smartphone, Laptop, Globe, LogOut, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime } from '../../lib/format';

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [revokingId, setRevokingId] = useState(null);
  const { t, lang } = useLanguage();

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api('/api/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || 'Failed to load device sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      await api(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setActionNotice(t('settings.security.revokeBtn'));
      setTimeout(() => setActionNotice(''), 3000);
      await loadSessions();
    } catch (err) {
      setError(err.message || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm(t('settings.security.revokeAllBtn') + '?')) {
      return;
    }
    try {
      setLoading(true);
      await api('/api/auth/logout-all', { method: 'POST' });
      setActionNotice(t('settings.security.revokeAllBtn'));
      setTimeout(() => setActionNotice(''), 3000);
      await loadSessions();
    } catch (err) {
      setError(err.message || 'Failed to logout from all devices.');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (ua) => {
    const lower = String(ua || '').toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
      return <Smartphone size={18} color="var(--accent-cyan)" />;
    }
    return <Laptop size={18} color="var(--accent-cyan)" />;
  };

  return (
    <div className="security-page-container">
      {/* Header Halaman */}
      <div className="security-header-bar">
        <div className="security-title-group">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={22} color="var(--accent-cyan)" />
            <span>{t('settings.security.title')}</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            {t('settings.security.sessionsTitle')}
          </p>
        </div>

        <div className="security-actions-group">
          <button
            onClick={loadSessions}
            className="btn btn-secondary"
            title={t('common.refresh')}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>{t('common.refresh')}</span>
          </button>
          <button
            onClick={handleLogoutAll}
            className="btn btn-danger"
            disabled={loading || sessions.length <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} />
            <span>{t('settings.security.revokeAllBtn')}</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="auth-alert-box auth-alert-success" style={{ marginBottom: '1.25rem' }}>
          {actionNotice}
        </div>
      )}

      {error && (
        <div className="auth-alert-box auth-alert-error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Sesi Perangkat Aktif */}
      <div className="security-card-container">
        <div className="security-card-header">
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.security.sessionsTitle')}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {t('settings.security.currentSession')}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <RefreshCw size={24} color="var(--accent-cyan)" className="spin" />
            <span style={{ fontSize: '0.875rem' }}>{t('common.loading')}</span>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('common.none')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item-row ${s.current ? 'is-current' : ''}`}
              >
                <div className="session-main-info">
                  <div className="session-icon-box">
                    {getDeviceIcon(s.userAgent)}
                  </div>

                    <div className="session-text-content">
                      <div className="session-ua-title">
                        <span>{s.userAgent || t('settings.security.webDeviceFallback')}</span>
                        {s.current && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(6, 182, 212, 0.15)',
                          color: 'var(--accent-cyan)',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          {t('settings.security.currentSession')}
                        </span>
                      )}
                    </div>
                    <div className="session-meta-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={12} /> {`IP: ${s.ip}`}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(s.createdAt, lang)}</span>
                    </div>
                  </div>
                </div>

                <div className="session-actions-slot">
                  {s.current ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {t('common.active')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      disabled={revokingId === s.id}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-red)',
                        borderColor: 'rgba(239, 68, 68, 0.35)'
                      }}
                      title={t('settings.security.revokeBtn')}
                    >
                      <Trash2 size={13} />
                      <span>{revokingId === s.id ? '…' : t('settings.security.revokeBtn')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
