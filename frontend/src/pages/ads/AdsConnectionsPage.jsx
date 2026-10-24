// frontend/src/pages/ads/AdsConnectionsPage.jsx
// Halaman Kelola Koneksi Akun Iklan (PRD F5 Langkah 7)

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Unlink,
  Check,
  Building2
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  listConnections,
  getMetaOAuthUrl,
  disconnect,
  getAdAccounts,
  toggleSelectAccount
} from '../../ads/adsApi';

export default function AdsConnectionsPage() {
  const { t } = useLanguage();
  const [connections, setConnections] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [confirmDisconnectId, setConfirmDisconnectId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [connRes, accRes] = await Promise.all([
        listConnections().catch(() => ({ connections: [] })),
        getAdAccounts().catch(() => ({ accounts: [] }))
      ]);
      setConnections(connRes.connections || []);
      setAdAccounts(accRes.accounts || []);
    } catch (err) {
      setError(err.message || t('ads.connections.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onWsChange = () => loadData();
    window.addEventListener('markimate:workspace-changed', onWsChange);
    window.addEventListener('supermat:workspace-changed', onWsChange);
    return () => {
      window.removeEventListener('markimate:workspace-changed', onWsChange);
      window.removeEventListener('supermat:workspace-changed', onWsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectMeta = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await getMetaOAuthUrl();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err.message || t('ads.connections.authStartError'));
      setActionLoading(false);
    }
  };

  const handleDisconnect = async (connId) => {
    setActionLoading(true);
    setError('');
    try {
      await disconnect(connId);
      setSuccessNotice(t('ads.connections.disconnectSuccess'));
      setConfirmDisconnectId(null);
      setTimeout(() => setSuccessNotice(''), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || t('ads.connections.disconnectError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAccount = async (accId, currentVal) => {
    try {
      await toggleSelectAccount(accId, !currentVal);
      setAdAccounts((prev) =>
        prev.map((a) => (a.id === accId ? { ...a, selected: !currentVal } : a))
      );
    } catch (err) {
      setError(err.message || t('ads.connections.loadError'));
    }
  };

  const metaConn = connections.find((c) => c.platform === 'meta');
  const metaAccounts = adAccounts.filter((a) => a.platform === 'meta');

  return (
    <div className="ads-container">
      {/* Header */}
      <div className="ads-header">
        <div>
          <h1 className="ads-title">{t('ads.connections.heading')}</h1>
          <p className="ads-subtitle">{t('ads.connections.subheading')}</p>
        </div>
        <button
          className="ads-btn ads-btn-secondary"
          onClick={loadData}
          disabled={loading}
          type="button"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>{t('ads.reports.reload')}</span>
        </button>
      </div>

      {/* Security Guarantee Alert */}
      <div className="ads-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <ShieldCheck size={22} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {t('ads.connections.guaranteeTitle')}
            </strong>
            <p className="ads-form-help" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
              {t('ads.connections.guaranteeText')}
            </p>
            <Link to="/legal/privacy" style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', textDecoration: 'none' }} target="_blank">
              {t('ads.connections.readPrivacyPolicy')}
            </Link>
          </div>
        </div>
      </div>

      {/* Expiry Warning Banner (< 10 hari) */}
      {metaConn && metaConn.expires_in_days !== undefined && metaConn.expires_in_days < 10 && (
        <div className="ads-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
                {t('ads.connections.expiryWarning', { days: metaConn.expires_in_days })}
              </strong>
            </div>
            <button
              className="ads-btn ads-btn-primary"
              onClick={handleConnectMeta}
              disabled={actionLoading}
              type="button"
              style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
            >
              {t('ads.connections.btnReconnect')}
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {successNotice && (
        <div className="ads-card" style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10b981' }}>
          <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600 }}>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="ads-card" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Connections Grid */}
      <div className="ads-grid">
        {/* Meta Ads Card */}
        <div className="ads-card">
          <div className="ads-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {t('ads.connections.metaTitle')}
                </h2>
                {metaConn ? (
                  <span className="ads-badge ads-badge-active">
                    <CheckCircle2 size={12} />
                    <span>{t('ads.status.connected')}</span>
                  </span>
                ) : (
                  <span className="ads-badge ads-badge-soon">
                    {t('ads.status.disconnected')}
                  </span>
                )}
              </div>
              <p className="ads-form-help">{t('ads.connections.metaDesc')}</p>
            </div>
          </div>

          {metaConn ? (
            <div>
              <div style={{ padding: '0.75rem', background: 'var(--bg-input, rgba(255,255,255,0.03))', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('ads.connections.connectedAdvertiser')}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {metaConn.display_name || t('ads.connections.metaTitle')}
                </div>
              </div>

              {/* Accounts list */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {t('ads.connections.accountsList', { count: metaAccounts.length })}
                </div>

                {metaAccounts.length === 0 ? (
                  <div className="ads-form-help">{t('ads.connections.noAccounts')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {metaAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building2 size={16} color="var(--accent-cyan)" />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {acc.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {t('ads.connections.accountInfo', { id: acc.external_id, currency: acc.currency })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleAccount(acc.id, acc.selected)}
                          className={`ads-badge ${acc.selected ? 'ads-badge-active' : 'ads-badge-soon'}`}
                          style={{ cursor: 'pointer', border: 'none', background: acc.selected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)' }}
                        >
                          {acc.selected ? <Check size={12} /> : null}
                          <span>{acc.selected ? t('ads.connections.accountSelected') : t('ads.connections.accountSkip')}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ads-btn ads-btn-secondary"
                  onClick={handleConnectMeta}
                  disabled={actionLoading}
                >
                  <RefreshCw size={14} />
                  <span>{t('ads.connections.btnReconnect')}</span>
                </button>
                <button
                  type="button"
                  className="ads-btn ads-btn-danger"
                  onClick={() => setConfirmDisconnectId(metaConn.id)}
                  disabled={actionLoading}
                >
                  <Unlink size={14} />
                  <span>{t('ads.connections.disconnect')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="ads-btn ads-btn-primary"
                onClick={handleConnectMeta}
                disabled={actionLoading}
              >
                <ExternalLink size={16} />
                <span>{t('ads.connections.btnConnect')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Google Ads Card (Coming Soon / Segera Hadir F5-Google) */}
        <div className="ads-card" style={{ opacity: 0.85 }}>
          <div className="ads-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {t('ads.connections.googleTitle', 'Google Ads')}
                </h2>
                <span className="ads-badge ads-badge-soon">
                  {t('ads.connections.googleSoon')}
                </span>
              </div>
              <p className="ads-form-help">{t('ads.connections.googleDesc', 'Akses performa Search, Performance Max, dan YouTube Ads.')}</p>
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              type="button"
              className="ads-btn ads-btn-secondary"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <span>{t('ads.connections.googleSoon')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnectId && (
        <div className="ads-modal-overlay">
          <div className="ads-modal-content">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              {t('ads.connections.confirmDisconnectTitle', { platform: 'Meta Ads' })}
            </h3>
            <p className="ads-form-help" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {t('ads.connections.confirmDisconnectDesc', { account: metaConn?.display_name || 'Meta Ads' })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ads-btn ads-btn-secondary"
                onClick={() => setConfirmDisconnectId(null)}
                disabled={actionLoading}
              >
                {t('ads.connections.cancel')}
              </button>
              <button
                type="button"
                className="ads-btn ads-btn-danger"
                onClick={() => handleDisconnect(confirmDisconnectId)}
                disabled={actionLoading}
              >
                {t('ads.connections.yesDisconnect')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
