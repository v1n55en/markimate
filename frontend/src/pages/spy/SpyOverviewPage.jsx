import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Users,
  Sparkles,
  TrendingUp,
  Bookmark,
  ArrowRight,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { listCompetitors, listCreatives, getInsights } from '../../spy/spyApi';
import { useWorkspace } from '../../context/WorkspaceContext';

export default function SpyOverviewPage() {
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState([]);
  const [winningCreatives, setWinningCreatives] = useState([]);
  const [insights, setInsights] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, creatRes, insRes] = await Promise.all([
        listCompetitors(),
        listCreatives({ isWinning: true }),
        getInsights(),
      ]);
      setCompetitors(compRes.competitors || []);
      setWinningCreatives((creatRes.creatives || []).slice(0, 3));
      setInsights(insRes.insights || null);
    } catch {
      // abaikan
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

  const totalMonitored = competitors.length;
  const newAdsCount = competitors.reduce((acc, c) => acc + (c.newAdsThisWeek || 0), 0);

  return (
    <div style={styles.container}>
      {/* 1. Sub-nav Tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabsLeft}>
          <Link to="/app/spy" style={{ ...styles.tabBtn, ...styles.tabBtnActive }}>
            <Eye size={15} />
            <span>Ringkasan</span>
          </Link>
          <Link to="/app/spy/competitors" style={styles.tabBtn}>
            <Users size={15} />
            <span>Kompetitor ({competitors.length})</span>
          </Link>
          <Link to="/app/spy/library" style={styles.tabBtn}>
            <Sparkles size={15} />
            <span>Galeri Creative</span>
          </Link>
          <Link to="/app/spy/insights" style={styles.tabBtn}>
            <TrendingUp size={15} />
            <span>Insight AI</span>
          </Link>
        </div>

        <div style={styles.tabsRight}>
          <span style={styles.brandTag}>{activeWorkspace?.name}</span>
        </div>
      </div>

      {/* 2. Top Header Intro */}
      <div style={styles.headerBox} className="card">
        <div style={styles.headerLeft}>
          <div style={styles.headerIconBox}>
            <Eye size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <h1 style={styles.pageTitle}>Ads Creative Spy</h1>
            <p style={styles.pageSubtitle}>
              Intelijen kompetitor otomatis berbasis Meta Ad Library & analisis pola hook AI. Pantau pergerakan iklan lawan dan kurasi referensi winning untuk brand Anda.
            </p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <Link to="/app/spy/competitors" style={styles.primaryActionBtn}>
            <Users size={15} />
            <span>Kelola Kompetitor</span>
          </Link>
        </div>
      </div>

      {/* 3. KPI Stats Grid */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiIconBox}>
            <Users size={16} color="var(--accent-cyan)" />
          </div>
          <div>
            <span style={styles.kpiLabel}>Kompetitor Dipantau</span>
            <div style={styles.kpiNumberRow}>
              <strong style={styles.kpiNumber}>{totalMonitored}</strong>
              <span style={styles.kpiMax}>/ 5 Kuota</span>
            </div>
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={{ ...styles.kpiIconBox, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Sparkles size={16} color="var(--accent-yellow)" />
          </div>
          <div>
            <span style={styles.kpiLabel}>Iklan Baru Minggu Ini</span>
            <div style={styles.kpiNumberRow}>
              <strong style={{ ...styles.kpiNumber, color: 'var(--accent-yellow)' }}>
                +{newAdsCount}
              </strong>
              <span style={styles.kpiMax}>Creative baru</span>
            </div>
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={{ ...styles.kpiIconBox, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <Flame size={16} color="var(--accent-red)" />
          </div>
          <div>
            <span style={styles.kpiLabel}>Winning Ads Terdeteksi</span>
            <div style={styles.kpiNumberRow}>
              <strong style={{ ...styles.kpiNumber, color: 'var(--accent-red)' }}>
                {insights?.summary?.winningAdsIdentified || 9}
              </strong>
              <span style={styles.kpiMax}>Tayang &gt; 30 hari</span>
            </div>
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={{ ...styles.kpiIconBox, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <Bookmark size={16} color="var(--accent-green)" />
          </div>
          <div>
            <span style={styles.kpiLabel}>Disimpan ke Swipe File</span>
            <div style={styles.kpiNumberRow}>
              <strong style={{ ...styles.kpiNumber, color: 'var(--accent-green)' }}>3</strong>
              <span style={styles.kpiMax}>Inspirasi tersimpan</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Winning Ads Spotlight Grid */}
      <div style={styles.sectionCard} className="card">
        <div style={styles.sectionHeaderRow}>
          <div>
            <h3 style={styles.sectionTitle}>
              <Flame size={18} color="var(--accent-red)" />
              Sorotan Iklan Winning (Tayang &gt; 30 Hari)
            </h3>
            <p style={styles.sectionSub}>
              Iklan yang terus aktif dalam waktu lama merupakan indikator kuat bahwa iklan tersebut menghasilkan ROAS positif bagi pengiklan.
            </p>
          </div>
          <Link to="/app/spy/library?winning=true" style={styles.viewAllLink}>
            <span>Buka Galeri Lengkap</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={20} className="spin" />
            <span>Memindai data creative…</span>
          </div>
        ) : (
          <div style={styles.creativesGrid}>
            {winningCreatives.map((cr) => (
              <div key={cr.id} style={styles.creativeCard} className="card">
                <div style={styles.thumbWrapper}>
                  <img src={cr.thumbnailUrl} alt={cr.headline} style={styles.thumbImg} />
                  <div style={styles.thumbOverlayTags}>
                    <span style={styles.winningBadge}>
                      <Flame size={11} />
                      Winning Ad ({cr.daysRunning} hari)
                    </span>
                    <span style={styles.formatTag}>{cr.formatLabel}</span>
                  </div>
                </div>

                <div style={styles.creativeMeta}>
                  <div style={styles.compBrandRow}>
                    <span style={styles.compBrandName}>{cr.competitorName}</span>
                    <span style={styles.adDateTag}>Mulai {cr.startedDate}</span>
                  </div>
                  <h4 style={styles.crHeadline}>{cr.headline}</h4>
                  <p style={styles.crSnippet}>{cr.bodyText}</p>

                  <div style={styles.aiSnippetBox}>
                    <span style={styles.aiSnippetLabel}>🎯 Formula Hook:</span>
                    <p style={styles.aiSnippetText}>{cr.aiAnalysis?.hook}</p>
                  </div>

                  <div style={styles.cardFooterRow}>
                    <Link to="/app/spy/library" style={styles.detailBtn}>
                      <span>Detail & Analisa AI</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Insight AI Singkat & Rekomendasi */}
      {insights && (
        <div style={styles.insightTeaserCard} className="card">
          <div style={styles.insightHeader}>
            <div style={styles.insightIconBox}>
              <TrendingUp size={20} color="var(--accent-cyan)" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={styles.insightTitle}>Rangkuman Tren & Rekomendasi AI ({insights.periodLabel})</h3>
              <p style={styles.insightSub}>
                Pola dominan: Format {insights.summary.dominantFormat} dengan tema {insights.summary.dominantAngle}.
              </p>
            </div>
            <Link to="/app/spy/insights" style={styles.insightActionBtn}>
              <span>Lihat Analisis Lengkap</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={styles.themesGrid}>
            {insights.dominantThemes.map((th, idx) => (
              <div key={idx} style={styles.themeItem}>
                <div style={styles.themeDot} />
                <div>
                  <strong style={styles.themeTitle}>{th.title}</strong>
                  <p style={styles.themeDesc}>{th.description}</p>
                  <span style={styles.themeTrend}>{th.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 'clamp(0.85rem, 2.5vw, 1.5rem)',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    overflowY: 'auto',
    height: '100%',
    width: '100%',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-muted)',
    paddingBottom: '0.75rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  tabsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.825rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
  },
  tabBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
    border: '1px solid var(--border-active)',
  },
  tabsRight: {
    display: 'flex',
    alignItems: 'center',
  },
  brandTag: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    border: '1px solid var(--border-muted)',
  },
  headerBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.5rem',
    borderRadius: '12px',
    gap: '1.25rem',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    flex: 1,
    minWidth: '280px',
  },
  headerIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  pageTitle: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 0.35rem 0',
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '650px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  primaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.6rem 1.1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    textDecoration: 'none',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    gap: '1rem',
  },
  kpiCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '1.1rem 1.25rem',
    borderRadius: '10px',
  },
  kpiIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiLabel: {
    display: 'block',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
    marginBottom: '0.15rem',
  },
  kpiNumberRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  kpiNumber: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  kpiMax: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  sectionCard: {
    padding: '1.5rem',
    borderRadius: '12px',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
  },
  sectionSub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  viewAllLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  creativesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
    gap: '1.25rem',
  },
  creativeCard: {
    borderRadius: '10px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-muted)',
  },
  thumbWrapper: {
    position: 'relative',
    height: '190px',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbOverlayTags: {
    position: 'absolute',
    top: '0.65rem',
    left: '0.65rem',
    right: '0.65rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  winningBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    backdropFilter: 'blur(4px)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  formatTag: {
    fontSize: '0.65rem',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: '0.2rem 0.45rem',
    borderRadius: '4px',
  },
  creativeMeta: {
    padding: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    flex: 1,
  },
  compBrandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compBrandName: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
  },
  adDateTag: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
  },
  crHeadline: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.35,
  },
  crSnippet: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  aiSnippetBox: {
    padding: '0.65rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  aiSnippetLabel: {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '0.15rem',
  },
  aiSnippetText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    margin: 0,
  },
  cardFooterRow: {
    marginTop: 'auto',
    paddingTop: '0.5rem',
  },
  detailBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textDecoration: 'none',
  },
  insightTeaserCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  insightHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  insightIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.15rem 0',
  },
  insightSub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  insightActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.95rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    textDecoration: 'none',
  },
  themesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
  },
  themeItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.85rem',
    backgroundColor: 'var(--bg-base)',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
  },
  themeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    marginTop: '6px',
    flexShrink: 0,
  },
  themeTitle: {
    display: 'block',
    fontSize: '0.825rem',
    color: 'var(--text-primary)',
    marginBottom: '0.2rem',
  },
  themeDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '0 0 0.35rem 0',
  },
  themeTrend: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '2.5rem',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
};
