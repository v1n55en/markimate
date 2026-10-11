import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import StatusChip from './StatusChip';

export default function PlatformCard({
  platformKey,
  config,
  connections = [],
  onConnect,
  onDisconnect,
  loading = false,
}) {
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetToDisconnect, setTargetToDisconnect] = useState(null);

  // Status utama kartu: jika ada minimal 1 connected -> 'connected', dll
  const primaryConnection = connections[0];
  const isConnected = connections.some((c) => c.status === 'connected');
  const hasExpired = connections.some((c) => c.status === 'expired');

  let overallStatus = 'disconnected';
  if (hasExpired) overallStatus = 'expired';
  else if (isConnected) overallStatus = 'connected';
  else if (primaryConnection?.status) overallStatus = primaryConnection.status;

  const handleOpenDisconnect = (conn) => {
    setTargetToDisconnect(conn);
    setShowConfirmModal(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!targetToDisconnect) return;
    setDisconnectingId(targetToDisconnect.id);
    try {
      await onDisconnect(targetToDisconnect.id);
    } finally {
      setDisconnectingId(null);
      setShowConfirmModal(false);
      setTargetToDisconnect(null);
    }
  };

  return (
    <div style={styles.card} className="card">
      {/* Header platform */}
      <div style={styles.header}>
        <div style={styles.brandRow}>
          <div
            style={{
              ...styles.platformIcon,
              backgroundColor: config.accentBg,
              borderColor: config.badgeBorder,
              color: config.color,
            }}
          >
            {platformKey === 'meta' && 'Meta'}
            {platformKey === 'google' && 'G'}
            {platformKey === 'tiktok' && 'TT'}
            {platformKey === 'tiktok_gmvmax' && 'GMV'}
            {platformKey === 'shopee' && 'Shopee'}
          </div>
          <div>
            <h3 style={styles.platformName}>{config.name}</h3>
            <span style={styles.companyName}>{config.company}</span>
          </div>
        </div>

        <StatusChip status={overallStatus} size="sm" />
      </div>

      {/* Deskripsi platform */}
      <p style={styles.description}>{config.description}</p>

      {/* Daftar Akun Terhubung */}
      <div style={styles.accountsSection}>
        <div style={styles.accountsTitle}>
          <span>Akun & Toko Terhubung</span>
          <span style={styles.accountsCount}>({connections.filter(c => c.status === 'connected').length})</span>
        </div>

        {connections.length === 0 || !isConnected ? (
          <div style={styles.emptyAccount}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Belum ada akun {config.name} yang terhubung.
            </span>
          </div>
        ) : (
          <div style={styles.accountsList}>
            {connections
              .filter((c) => c.status === 'connected')
              .map((conn) => (
                <div key={conn.id} style={styles.accountRow}>
                  <div style={styles.accountDetails}>
                    <div style={styles.accountName} title={conn.name}>
                      {conn.name}
                    </div>
                    <div style={styles.accountIdBadge}>
                      <span style={{ color: 'var(--text-muted)' }}>{config.idLabel}:</span>{' '}
                      <code style={styles.monoId}>{conn.externalId}</code>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenDisconnect(conn)}
                    style={styles.disconnectBtn}
                    title="Putuskan koneksi akun ini"
                    disabled={loading || disconnectingId === conn.id}
                  >
                    <Trash2 size={14} color="var(--accent-red)" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Info Izin & Privasi Read-Only */}
      <div style={styles.permissionBox}>
        <div style={styles.permissionHeader}>
          <ShieldCheck size={14} color="var(--accent-green)" />
          <span style={styles.permissionTitle}>Akses Aman Read-Only</span>
        </div>
        <p style={styles.permissionText}>{config.permissionsText}</p>
        <Link to="/privacy" style={styles.privacyLink} target="_blank">
          Pelajari Kebijakan Privasi <ExternalLink size={11} />
        </Link>
      </div>

      {/* Tombol Aksi */}
      <div style={styles.footerActions}>
        {!isConnected ? (
          <button
            onClick={() => onConnect(platformKey)}
            style={{
              ...styles.primaryConnectBtn,
              backgroundColor: config.color,
            }}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Plus size={16} />
            )}
            <span>Hubungkan {config.name}</span>
          </button>
        ) : (
          <div style={styles.connectedActionsRow}>
            <button
              onClick={() => onConnect(platformKey)}
              style={styles.secondaryAddBtn}
              title="Hubungkan akun iklan tambahan di platform ini"
              disabled={loading}
            >
              <Plus size={14} />
              <span>Tambah Akun</span>
            </button>
            <span style={styles.activeSyncText}>Sinkronisasi aktif</span>
          </div>
        )}
      </div>

      {/* Modal Dialog Konfirmasi Putuskan */}
      {showConfirmModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="card">
            <div style={styles.modalHeader}>
              <AlertCircle size={22} color="var(--accent-red)" />
              <h4 style={styles.modalTitle}>Putuskan Koneksi Platform?</h4>
            </div>
            <p style={styles.modalBody}>
              Apakah Anda yakin ingin memutuskan integrasi akun{' '}
              <strong>{targetToDisconnect?.name}</strong> ({targetToDisconnect?.externalId})?
              Data pelaporan baru tidak akan dapat disinkronkan hingga Anda menghubungkannya kembali.
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={styles.modalCancelBtn}
                disabled={disconnectingId}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDisconnect}
                style={styles.modalConfirmBtn}
                disabled={disconnectingId}
              >
                {disconnectingId ? 'Memutuskan…' : 'Ya, Putuskan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1.5rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    transition: 'border-color var(--transition-fast)',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  platformIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.85rem',
    border: '1px solid',
  },
  platformName: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  companyName: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  description: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    marginBottom: '1.25rem',
    minHeight: '2.5rem',
  },
  accountsSection: {
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    padding: '0.75rem',
    marginBottom: '1rem',
  },
  accountsTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  accountsCount: {
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  emptyAccount: {
    padding: '0.5rem 0',
    textAlign: 'center',
  },
  accountsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  accountRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
  },
  accountDetails: {
    minWidth: 0,
    flex: 1,
  },
  accountName: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  accountIdBadge: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    marginTop: '0.15rem',
  },
  monoId: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    padding: '0.1rem 0.3rem',
    borderRadius: '4px',
  },
  disconnectBtn: {
    background: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '6px',
    padding: '0.35rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)',
    marginLeft: '0.5rem',
  },
  permissionBox: {
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    marginBottom: '1.25rem',
  },
  permissionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    marginBottom: '0.3rem',
  },
  permissionTitle: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--accent-green)',
  },
  permissionText: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
    margin: 0,
  },
  privacyLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.72rem',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
    marginTop: '0.35rem',
    fontWeight: '500',
  },
  footerActions: {
    marginTop: 'auto',
  },
  primaryConnectBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  connectedActionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  activeSyncText: {
    fontSize: '0.75rem',
    color: 'var(--accent-green)',
    fontWeight: '500',
  },
  // Modal dialog
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modalContent: {
    maxWidth: '440px',
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  modalBody: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  modalCancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  modalConfirmBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-red)',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
