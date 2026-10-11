import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  Eye,
  RefreshCw,
  Search,
  Presentation,
  Table as TableIcon,
} from 'lucide-react';
import { listReports } from '../../ads/adsApi';
import { PLATFORMS_META } from '../../ads/mockData';
import { formatIDR, formatNumber, formatRoas } from '../../ads/format';
import StatusChip from '../../components/ads/StatusChip';
import DataTable from '../../components/ads/DataTable';

export default function AdsReportsPage({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listReports({
        platform: platformFilter,
        year: yearFilter,
        clientId: clientSearch,
      });
      setReports(res.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter, yearFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  // Kolom tabel
  const columns = [
    {
      key: 'periodLabel',
      label: 'Periode Laporan',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
            {val || row.period}
          </strong>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
            ID: {row.id}
          </div>
        </div>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'clientName',
            label: 'Klien',
            render: (val) => (
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                {val}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'platforms',
      label: 'Platform Iklan',
      render: (platforms = []) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {platforms.map((pKey) => {
            const meta = PLATFORMS_META[pKey] || {
              name: pKey,
              color: 'var(--text-secondary)',
              accentBg: 'rgba(255,255,255,0.05)',
            };
            return (
              <span
                key={pKey}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.725rem',
                  fontWeight: '600',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: meta.accentBg,
                  color: meta.color,
                  border: `1px solid ${meta.badgeBorder || 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {meta.name}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: 'spend',
      label: 'Total Spend',
      align: 'right',
      render: (val) => (
        <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
          {formatIDR(val)}
        </span>
      ),
    },
    {
      key: 'results',
      label: 'Hasil / Konversi',
      align: 'right',
      render: (val) => (
        <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>
          {formatNumber(val)}
        </span>
      ),
    },
    {
      key: 'roas',
      label: 'ROAS',
      align: 'right',
      render: (val) => (
        <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>
          {formatRoas(val)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Laporan',
      render: (val) => <StatusChip status={val} size="sm" />,
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'center',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => navigate(`/app/ads/reports/${row.id}`)}
            style={styles.viewDetailBtn}
            title="Lihat detail laporan"
          >
            <Eye size={14} />
            <span>Lihat</span>
          </button>
          {row.slidesUrl && (
            <a
              href={row.slidesUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.iconLink}
              title="Buka Google Slides"
            >
              <Presentation size={15} />
            </a>
          )}
          {row.sheetsUrl && (
            <a
              href={row.sheetsUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.iconLink}
              title="Buka Google Sheets"
            >
              <TableIcon size={15} />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>Daftar Laporan Iklan</h1>
          <p style={styles.subheading}>
            Arsip laporan performa bulanan terintegrasi dengan Google Slides & Sheets
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={styles.filterCard} className="card">
        <div style={styles.filterRow}>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>
              <Filter size={13} /> Platform
            </label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">Semua Platform</option>
              <option value="meta">Meta Ads</option>
              <option value="google">Google Ads</option>
              <option value="tiktok">TikTok Ads</option>
              <option value="tiktok_gmvmax">TikTok Shop GMV Max</option>
              <option value="shopee">Shopee Ads</option>
            </select>
          </div>

          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>Tahun</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">Semua Tahun</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {isAdmin && (
            <form onSubmit={handleSearchSubmit} style={{ ...styles.filterItem, flex: 1 }}>
              <label style={styles.filterLabel}>Cari Klien (Admin)</label>
              <div style={styles.searchBox}>
                <input
                  type="text"
                  placeholder="Ketik nama klien…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  style={styles.searchInput}
                />
                <button type="submit" style={styles.searchBtn}>
                  <Search size={14} />
                </button>
              </div>
            </form>
          )}

          <button onClick={loadData} style={styles.refreshBtn} title="Muat ulang laporan">
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Tabel Laporan */}
      {loading ? (
        <div style={styles.loadingBox}>
          <RefreshCw size={24} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Memuat daftar laporan…
          </span>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={reports}
          emptyMessage="Tidak ada laporan yang cocok dengan kriteria filter."
        />
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
  filterCard: {
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    borderRadius: '10px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    minWidth: '160px',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  filterSelect: {
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    padding: '0.55rem 0.75rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  searchBtn: {
    padding: '0.55rem 0.75rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '38px',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    minHeight: '350px',
  },
  viewDetailBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan-glow)',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    color: 'var(--accent-cyan)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  iconLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.35rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
};
