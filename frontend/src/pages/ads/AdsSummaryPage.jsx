import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Eye,
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
  Award,
  Link2,
  FileText,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { getAdsSummary, listConnections, isAdsMock } from '../../ads/adsApi';
import { PLATFORMS_META } from '../../ads/mockData';
import { formatCompactIDR } from '../../ads/format';
import KpiCard from '../../components/ads/KpiCard';
import StatusChip from '../../components/ads/StatusChip';
import ModuleComingSoonCard from '../../components/common/ModuleComingSoonCard';

export default function AdsSummaryPage() {
  if (!isAdsMock()) {
    return <ModuleComingSoonCard roleKey="ads_report" />;
  }
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [connections, setConnections] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sumData, connData] = await Promise.all([
        getAdsSummary(),
        listConnections(),
      ]);
      setSummary(sumData);
      setConnections(connData.connections || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat ringkasan performa iklan.');
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

  const connectedList = connections.filter((c) => c.status === 'connected');
  const hasNoConnections = connectedList.length === 0;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <RefreshCw size={24} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Memuat ringkasan Ads Report…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorBox}>
        <AlertCircle size={20} color="var(--accent-red)" />
        <span style={{ color: 'var(--accent-red)', fontSize: '0.9rem' }}>{error}</span>
        <button onClick={loadData} style={styles.retryBtn}>Coba Lagi</button>
      </div>
    );
  }

  const totals = summary?.totals || {};
  const deltas = summary?.deltas || {};
  const platforms = summary?.platforms || [];

  return (
    <div style={styles.page}>
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>Ringkasan Ads Report</h1>
          <p style={styles.subheading}>
            Konsolidasi performa iklan multi-platform periode{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{summary?.period || 'Bulan Terakhir'}</strong>
          </p>
        </div>

        <div style={styles.headerActions}>
          <Link to="/app/ads/connections" style={styles.secondaryBtn}>
            <Link2 size={16} />
            <span>Kelola Koneksi</span>
          </Link>
          <Link to="/app/ads/reports" style={styles.primaryBtn}>
            <FileText size={16} />
            <span>Semua Laporan</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Empty State bila belum ada koneksi sama sekali */}
      {hasNoConnections ? (
        <div style={styles.emptyCard} className="card">
          <div style={styles.emptyIconBox}>
            <Link2 size={36} color="var(--accent-cyan)" />
          </div>
          <h2 style={styles.emptyTitle}>Belum Ada Platform Iklan yang Terhubung</h2>
          <p style={styles.emptySubtitle}>
            Hubungkan akun Meta Ads, Google Ads, TikTok Ads, TikTok Shop GMV Max, atau Shopee Ads Anda untuk melihat agregasi metrik otomatis, analisis ROAS, dan pembuatan laporan berkala.
          </p>
          <button
            onClick={() => navigate('/app/ads/connections')}
            style={styles.connectNowBtn}
          >
            <Plus size={16} />
            <span>Hubungkan Platform Sekarang</span>
          </button>
        </div>
      ) : (
        <>
          {/* Grid 6 KPI Cards Gabungan */}
          <div style={styles.kpiGrid}>
            <KpiCard
              title="Total Spend (Biaya Iklan)"
              value={totals.spend}
              format="currency"
              delta={deltas.spend}
              isGoodWhenLower={false}
              icon={DollarSign}
            />
            <KpiCard
              title="Total Impresi"
              value={totals.impressions}
              format="compact"
              delta={deltas.impressions}
              isGoodWhenLower={false}
              icon={Eye}
            />
            <KpiCard
              title="Total Klik"
              value={totals.clicks}
              format="compact"
              delta={deltas.clicks}
              isGoodWhenLower={false}
              icon={MousePointerClick}
            />
            <KpiCard
              title="Total Hasil / Konversi"
              value={totals.results}
              format="compact"
              delta={deltas.results}
              isGoodWhenLower={false}
              icon={ShoppingBag}
            />
            <KpiCard
              title="Total GMV (Nilai Penjualan)"
              value={totals.gmv}
              format="compactCurrency"
              delta={deltas.gmv}
              isGoodWhenLower={false}
              icon={TrendingUp}
            />
            <KpiCard
              title="ROAS Gabungan"
              value={totals.roas}
              format="roas"
              delta={deltas.roas}
              isGoodWhenLower={false}
              icon={Award}
            />
          </div>

          {/* Section Kartu Per Platform Terhubung */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Performa Per Platform</h2>
                <p style={styles.sectionDesc}>
                  Ringkasan metrik dari setiap ad account & toko yang aktif terhubung
                </p>
              </div>
              <Link to="/app/ads/connections" style={styles.textLink}>
                Lihat detail koneksi →
              </Link>
            </div>

            <div style={styles.platformsGrid}>
              {platforms.map((p) => {
                const meta = PLATFORMS_META[p.platform] || {
                  name: p.platform,
                  color: 'var(--accent-cyan)',
                  accentBg: 'rgba(6, 182, 212, 0.1)',
                  badgeBorder: 'rgba(6, 182, 212, 0.2)',
                };
                const conn = connections.find((c) => c.platform === p.platform);
                const isConn = conn?.status === 'connected';

                return (
                  <div key={p.platform} style={styles.platformCard} className="card">
                    <div style={styles.platformCardHeader}>
                      <div style={styles.platformIdentity}>
                        <div
                          style={{
                            ...styles.platformMiniBadge,
                            backgroundColor: meta.accentBg,
                            borderColor: meta.badgeBorder,
                            color: meta.color,
                          }}
                        >
                          {meta.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 style={styles.platformCardName}>{meta.name}</h4>
                          <span style={styles.platformAccountSub}>
                            {p.accountName || 'Akun Utama'}
                          </span>
                        </div>
                      </div>

                      <StatusChip status={isConn ? 'connected' : 'disconnected'} size="sm" />
                    </div>

                    <div style={styles.platformMetrics}>
                      <div style={styles.platformMetricRow}>
                        <span style={styles.metricLabel}>Spend Bulan Ini:</span>
                        <strong style={styles.metricValue}>
                          {formatCompactIDR(p.spend)}
                        </strong>
                      </div>
                      <div style={styles.platformMetricRow}>
                        <span style={styles.metricLabel}>Hasil Utama:</span>
                        <strong style={{ ...styles.metricValue, color: 'var(--accent-cyan)' }}>
                          {p.results}
                        </strong>
                      </div>
                      <div style={styles.platformMetricRow}>
                        <span style={styles.metricLabel}>Laporan Terakhir:</span>
                        <StatusChip status={p.lastReportStatus || 'Terkirim'} size="sm" />
                      </div>
                    </div>

                    <div style={styles.platformCardFooter}>
                      <button
                        onClick={() => navigate('/app/ads/reports')}
                        style={styles.cardViewReportsBtn}
                      >
                        <span>Lihat Laporan</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Banner Promo / Rekomendasi n8n & Google Slides */}
          <div style={styles.bannerBox} className="card">
            <div style={styles.bannerContent}>
              <div style={styles.bannerIconBox}>
                <FileText size={24} color="var(--accent-cyan)" />
              </div>
              <div>
                <h4 style={styles.bannerTitle}>Otomatisasi Laporan Siap Pakai</h4>
                <p style={styles.bannerText}>
                  Setiap awal bulan, Markimate dan mesin automasi 3Our menyusun laporan eksekutif lengkap ke Google Slides dan Google Sheets yang dapat langsung dibagikan atau dipresentasikan kepada stakeholder.
                </p>
              </div>
            </div>
            <Link to="/app/ads/reports" style={styles.bannerActionBtn}>
              Buka Katalog Laporan
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    minHeight: '60vh',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    marginBottom: '1.5rem',
  },
  retryBtn: {
    marginLeft: 'auto',
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '2rem',
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '600',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'opacity var(--transition-fast)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontWeight: '500',
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
    marginBottom: '2.5rem',
  },
  section: {
    marginBottom: '2.5rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  sectionDesc: {
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
    marginTop: '0.2rem',
  },
  textLink: {
    fontSize: '0.825rem',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
    fontWeight: '500',
  },
  platformsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
  },
  platformCard: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  platformCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  platformIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  platformMiniBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.75rem',
    border: '1px solid',
  },
  platformCardName: {
    fontSize: '0.925rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  platformAccountSub: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
  },
  platformMetrics: {
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  platformMetricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
  },
  metricValue: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  platformCardFooter: {
    marginTop: 'auto',
  },
  cardViewReportsBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  emptyCard: {
    padding: '3rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '560px',
    margin: '3rem auto',
  },
  emptyIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  emptySubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '1.75rem',
  },
  connectNowBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    color: '#000000',
    fontWeight: '700',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
  },
  bannerBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5rem',
    padding: '1.5rem',
    flexWrap: 'wrap',
    borderLeft: '4px solid var(--accent-cyan)',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    maxWidth: '750px',
  },
  bannerIconBox: {
    padding: '0.75rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    flexShrink: 0,
  },
  bannerTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  bannerText: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
    lineHeight: 1.45,
    margin: 0,
  },
  bannerActionBtn: {
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
