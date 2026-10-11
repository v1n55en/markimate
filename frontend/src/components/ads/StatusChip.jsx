// Komponen chip status koneksi dan laporan iklan

const STATUS_CONFIGS = {
  // Status Koneksi Platform
  connected: {
    label: 'Terhubung',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  disconnected: {
    label: 'Belum terhubung',
    bg: 'rgba(113, 113, 122, 0.12)',
    color: '#a1a1aa',
    border: 'rgba(113, 113, 122, 0.25)',
    dot: '#71717a',
  },
  expired: {
    label: 'Perlu dihubungkan ulang',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.25)',
    dot: '#ef4444',
  },
  pending_approval: {
    label: 'Menunggu persetujuan platform',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.25)',
    dot: '#f59e0b',
  },

  // Status Laporan Bulanan
  'Diproses': {
    label: 'Diproses',
    bg: 'rgba(6, 182, 212, 0.12)',
    color: '#06b6d4',
    border: 'rgba(6, 182, 212, 0.25)',
    dot: '#06b6d4',
  },
  'Menunggu approve 3Our': {
    label: 'Menunggu approve 3Our',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.25)',
    dot: '#f59e0b',
  },
  'Terkirim': {
    label: 'Terkirim',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  'Gagal': {
    label: 'Gagal',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.25)',
    dot: '#ef4444',
  },
  'Dilewati – tidak ada iklan': {
    label: 'Dilewati – tidak ada iklan',
    bg: 'rgba(113, 113, 122, 0.12)',
    color: '#a1a1aa',
    border: 'rgba(113, 113, 122, 0.25)',
    dot: '#71717a',
  },
};

export default function StatusChip({ status, size = 'md' }) {
  const config = STATUS_CONFIGS[status] || {
    label: status || 'Unknown',
    bg: 'rgba(113, 113, 122, 0.12)',
    color: '#a1a1aa',
    border: 'rgba(113, 113, 122, 0.25)',
    dot: '#71717a',
  };

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '0.35rem' : '0.45rem',
        padding: isSmall ? '0.2rem 0.5rem' : '0.25rem 0.65rem',
        borderRadius: '999px',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontSize: isSmall ? '0.72rem' : '0.78rem',
        fontWeight: '600',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: isSmall ? '5px' : '6px',
          height: isSmall ? '5px' : '6px',
          borderRadius: '50%',
          backgroundColor: config.dot,
          boxShadow: `0 0 6px ${config.dot}`,
        }}
      />
      {config.label}
    </span>
  );
}
