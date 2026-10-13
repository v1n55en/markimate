import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { listConnections, startConnect, disconnect, resetMockData, isAdsMock } from '../../ads/adsApi';
import { PLATFORMS_META } from '../../ads/mockData';
import PlatformCard from '../../components/ads/PlatformCard';

export default function AdsConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listConnections();
      setConnections(res.connections || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat koneksi platform.');
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
  }, []);

  const handleConnect = async (platformKey) => {
    setActionLoading(true);
    setError('');
    try {
      const { authUrl } = await startConnect(platformKey);
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err) {
      setError(err.message || 'Gagal memulai otorisasi koneksi platform.');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async (connectionId) => {
    setActionLoading(true);
    setError('');
    try {
      await disconnect(connectionId);
      setSuccessNotice('Koneksi platform berhasil diputuskan.');
      setTimeout(() => setSuccessNotice(''), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Gagal memutuskan koneksi platform.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDemo = () => {
    resetMockData();
    setSuccessNotice('Data simulasi demo berhasil dikembalikan ke status awal.');
    setTimeout(() => setSuccessNotice(''), 4000);
    loadData();
  };

  const platformKeys = ['meta', 'google', 'tiktok', 'tiktok_gmvmax', 'shopee'];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>Koneksi Platform Iklan</h1>
          <p style={styles.subheading}>
            Hubungkan akun periklanan dan toko marketplace Anda untuk mengaktifkan sinkronisasi otomatis laporan bulanan
          </p>
        </div>

        {isAdsMock() && (
          <button
            onClick={handleResetDemo}
            style={styles.resetBtn}
            title="Kembalikan koneksi dan laporan contoh ke kondisi awal"
          >
            <RotateCcw size={14} />
            <span>Reset Data Demo</span>
          </button>
        )}
      </div>

      {/* Security & Read-Only Guarantee Alert */}
      <div style={styles.guaranteeBox}>
        <ShieldCheck size={20} color="var(--accent-green)" style={{ flexShrink: 0 }} />
        <div style={styles.guaranteeText}>
          <strong>Jaminan Akses Read-Only & Perlindungan Privasi:</strong> Markimate hanya meminta izin baca (read-only) untuk mengagregasi data performa dan biaya kampanye. Kami tidak pernah memodifikasi setelan iklan, memotong saldo, atau membagikan metrik bisnis Anda kepada pihak luar.{' '}
          <Link to="/privacy" style={styles.guaranteeLink} target="_blank">
            Baca Kebijakan Privasi Lengkap →
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div style={styles.successAlert}>
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingContainer}>
          <RefreshCw size={24} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Memuat status koneksi platform…
          </span>
        </div>
      ) : (
        <div style={styles.cardsGrid}>
          {platformKeys.map((key) => {
            const config = PLATFORMS_META[key];
            const platformConns = connections.filter((c) => c.platform === key);

            return (
              <PlatformCard
                key={key}
                platformKey={key}
                config={config}
                connections={platformConns}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                loading={actionLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  subheading: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.35rem',
  },
  resetBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  guaranteeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.85rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    marginBottom: '2rem',
  },
  guaranteeText: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
  },
  guaranteeLink: {
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
    fontWeight: '600',
    marginLeft: '0.35rem',
  },
  successAlert: {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: 'var(--accent-green)',
    fontSize: '0.85rem',
    marginBottom: '1.5rem',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: 'var(--accent-red)',
    fontSize: '0.85rem',
    marginBottom: '1.5rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    minHeight: '50vh',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
};
