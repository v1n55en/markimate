import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Eye,
  Users,
  TrendingUp,
  Search,
  Flame,
  Clock,
  Bookmark,
  ExternalLink,
  X,
  RefreshCw,
  Copy,
  Zap,
} from 'lucide-react';
import { listCreatives, getCreative, saveToSwipe, listCompetitors, isSpyMock } from '../../spy/spyApi';
import { useWorkspace } from '../../context/WorkspaceContext';
import ModuleComingSoonCard from '../../components/common/ModuleComingSoonCard';

export default function SpyLibraryPage() {
  if (!isSpyMock()) {
    return <ModuleComingSoonCard roleKey="ads_spy" />;
  }
  const { activeWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();

  const [creatives, setCreatives] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [competitorFilter, setCompetitorFilter] = useState(searchParams.get('competitor') || 'all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [winningFilter, setWinningFilter] = useState(searchParams.get('winning') === 'true');
  const [newFilter, setNewFilter] = useState(false);
  const [swipeOnly, setSwipeOnly] = useState(false);
  const [keyword, setKeyword] = useState('');

  // Drawer detail state
  const [selectedCreative, setSelectedCreative] = useState(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, creatRes] = await Promise.all([
        listCompetitors(),
        listCreatives({
          competitorId: competitorFilter,
          format: formatFilter,
          isWinning: winningFilter,
          isNew: newFilter,
          onlySwipe: swipeOnly,
          q: keyword,
        }),
      ]);
      setCompetitors(compRes.competitors || []);
      setCreatives(creatRes.creatives || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorFilter, formatFilter, winningFilter, newFilter, swipeOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenDrawer = async (crId) => {
    try {
      const res = await getCreative(crId);
      setSelectedCreative(res.creative);
    } catch {
      // abaikan
    }
  };

  const handleToggleSwipe = async (crId) => {
    try {
      const res = await saveToSwipe(crId);
      setCreatives((prev) =>
        prev.map((c) => (c.id === crId ? { ...c, isSavedToSwipe: res.isSavedToSwipe } : c))
      );
      if (selectedCreative && selectedCreative.id === crId) {
        setSelectedCreative((prev) => ({ ...prev, isSavedToSwipe: res.isSavedToSwipe }));
      }
    } catch {
      // abaikan
    }
  };

  const handleCopyCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  return (
    <div style={styles.container}>
      {/* 1. Sub-nav Tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabsLeft}>
          <Link to="/app/spy" style={styles.tabBtn}>
            <Eye size={15} />
            <span>Ringkasan</span>
          </Link>
          <Link to="/app/spy/competitors" style={styles.tabBtn}>
            <Users size={15} />
            <span>Kompetitor ({competitors.length})</span>
          </Link>
          <Link to="/app/spy/library" style={{ ...styles.tabBtn, ...styles.tabBtnActive }}>
            <Sparkles size={15} />
            <span>Galeri Creative ({creatives.length})</span>
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

      {/* 2. Filter & Search Bar */}
      <div style={styles.filterCard} className="card">
        <form onSubmit={handleSearchSubmit} style={styles.searchRow}>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Cari kata kunci di teks iklan atau nama kompetitor…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <button type="submit" style={styles.searchSubmitBtn}>
            Cari
          </button>
        </form>

        <div style={styles.filterPillsRow}>
          {/* Filter Kompetitor */}
          <select
            value={competitorFilter}
            onChange={(e) => setCompetitorFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">Semua Kompetitor ({competitors.length})</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Filter Format */}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">Semua Format</option>
            <option value="video">Vertical Video (9:16)</option>
            <option value="carousel">Carousel Multi-Item</option>
            <option value="image">Single Image (Static)</option>
          </select>

          {/* Quick Toggle Buttons */}
          <button
            type="button"
            onClick={() => setWinningFilter(!winningFilter)}
            style={{
              ...styles.filterToggleBtn,
              ...(winningFilter ? styles.filterToggleActiveRed : {}),
            }}
          >
            <Flame size={13} />
            <span>Hanya Winning (30+ Hari)</span>
          </button>

          <button
            type="button"
            onClick={() => setNewFilter(!newFilter)}
            style={{
              ...styles.filterToggleBtn,
              ...(newFilter ? styles.filterToggleActiveYellow : {}),
            }}
          >
            <Clock size={13} />
            <span>Iklan Baru Minggu Ini</span>
          </button>

          <button
            type="button"
            onClick={() => setSwipeOnly(!swipeOnly)}
            style={{
              ...styles.filterToggleBtn,
              ...(swipeOnly ? styles.filterToggleActiveGreen : {}),
            }}
          >
            <Bookmark size={13} />
            <span>Swipe File Tersimpan</span>
          </button>
        </div>
      </div>

      {/* 3. Creative Cards Grid */}
      {loading ? (
        <div style={styles.loadingBox}>
          <RefreshCw size={24} className="spin" color="var(--accent-cyan)" />
          <span>Memuat galeri creative…</span>
        </div>
      ) : creatives.length === 0 ? (
        <div style={styles.emptyCard} className="card">
          <Sparkles size={36} color="var(--text-muted)" />
          <h3>Tidak Ada Creative Sesuai Filter</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
            Coba ubah kata kunci pencarian atau reset filter untuk melihat semua iklan yang terpantau.
          </p>
          <button
            onClick={() => {
              setCompetitorFilter('all');
              setFormatFilter('all');
              setWinningFilter(false);
              setNewFilter(false);
              setSwipeOnly(false);
              setKeyword('');
            }}
            style={styles.resetBtn}
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div style={styles.creativesGrid}>
          {creatives.map((cr) => (
            <div key={cr.id} style={styles.creativeCard} className="card">
              <div
                style={styles.thumbWrapper}
                onClick={() => handleOpenDrawer(cr.id)}
                title="Klik untuk melihat detail & analisa AI"
              >
                <img src={cr.thumbnailUrl} alt={cr.headline} style={styles.thumbImg} />
                <div style={styles.thumbOverlayTags}>
                  {cr.isWinning ? (
                    <span style={styles.winningBadge}>
                      <Flame size={11} />
                      Winning Ad ({cr.daysRunning} hari)
                    </span>
                  ) : cr.isNew ? (
                    <span style={styles.newBadge}>
                      <Clock size={11} />
                      Baru ({cr.daysRunning} hari)
                    </span>
                  ) : (
                    <span style={styles.standardDaysBadge}>{cr.daysRunning} hari</span>
                  )}
                  <span style={styles.formatTag}>{cr.formatLabel}</span>
                </div>
              </div>

              <div style={styles.creativeMeta}>
                <div style={styles.brandRow}>
                  <strong style={styles.brandName}>{cr.competitorName}</strong>
                  <button
                    onClick={() => handleToggleSwipe(cr.id)}
                    style={{
                      ...styles.swipeIconBtn,
                      color: cr.isSavedToSwipe ? 'var(--accent-green)' : 'var(--text-muted)',
                    }}
                    title={cr.isSavedToSwipe ? 'Tersimpan di Swipe File' : 'Simpan ke Swipe File'}
                  >
                    <Bookmark
                      size={16}
                      fill={cr.isSavedToSwipe ? 'var(--accent-green)' : 'none'}
                    />
                  </button>
                </div>

                <h4 style={styles.crHeadline}>{cr.headline}</h4>
                <p style={styles.crSnippet}>{cr.bodyText}</p>

                {/* AI Hook Snippet */}
                <div style={styles.hookBox}>
                  <span style={styles.hookLabel}>🎯 Hook 3 Detik:</span>
                  <p style={styles.hookText}>{cr.aiAnalysis?.hook}</p>
                </div>

                <div style={styles.cardActionsRow}>
                  <button
                    onClick={() => handleOpenDrawer(cr.id)}
                    style={styles.openDrawerBtn}
                  >
                    <Sparkles size={13} color="var(--accent-cyan)" />
                    <span>Analisa Lengkap</span>
                  </button>
                  <span style={styles.ctaBadge}>CTA: {cr.cta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Creative Detail Drawer (Modal Analisis Mendalam) */}
      {selectedCreative && (
        <div style={styles.drawerOverlay} onClick={() => setSelectedCreative(null)}>
          <div
            style={styles.drawerCard}
            className="card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.drawerHeader}>
              <div style={styles.drawerHeaderLeft}>
                <span style={styles.drawerBrandTag}>{selectedCreative.competitorName}</span>
                <h3 style={styles.drawerTitle}>{selectedCreative.headline}</h3>
              </div>
              <button
                onClick={() => setSelectedCreative(null)}
                style={styles.drawerCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.drawerContentScroll}>
              {/* Media Preview Box */}
              <div style={styles.drawerMediaBox}>
                <img
                  src={selectedCreative.mediaUrl}
                  alt={selectedCreative.headline}
                  style={styles.drawerMediaImg}
                />
                <div style={styles.drawerMediaOverlay}>
                  {selectedCreative.isWinning && (
                    <span style={styles.winningBadge}>
                      <Flame size={12} />
                      Winning Ad — Telah Tayang {selectedCreative.daysRunning} Hari
                    </span>
                  )}
                  <span style={styles.formatTag}>{selectedCreative.formatLabel}</span>
                </div>
              </div>

              {/* Teks Iklan Lengkap */}
              <div style={styles.copyBox}>
                <div style={styles.copyHeaderRow}>
                  <span style={styles.copyLabel}>Teks Iklan (Copywriting)</span>
                  <button
                    onClick={() => handleCopyCopy(selectedCreative.bodyText)}
                    style={styles.copyTextBtn}
                  >
                    <Copy size={13} />
                    <span>{copiedNotice ? 'Tersalin!' : 'Salin Copy'}</span>
                  </button>
                </div>
                <p style={styles.copyTextFull}>{selectedCreative.bodyText}</p>
                {selectedCreative.landingPageUrl && (
                  <div style={styles.landingLinkRow}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Landing Page URL:
                    </span>
                    <a
                      href={selectedCreative.landingPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.landingLink}
                    >
                      <span>{selectedCreative.landingPageUrl}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* Analisis AI Mendalam */}
              <div style={styles.aiBreakdownCard}>
                <h4 style={styles.aiBreakdownTitle}>
                  <Zap size={16} color="var(--accent-cyan)" />
                  Analisis Formula AI (Reverse-Engineering)
                </h4>

                <div style={styles.aiPointsList}>
                  <div style={styles.aiPointBlock}>
                    <strong style={styles.aiPointLabel}>🎯 Hook (3 Detik Pertama):</strong>
                    <p style={styles.aiPointVal}>{selectedCreative.aiAnalysis?.hook}</p>
                  </div>

                  <div style={styles.aiPointBlock}>
                    <strong style={styles.aiPointLabel}>📐 Angle & Pendekatan Psikologis:</strong>
                    <p style={styles.aiPointVal}>{selectedCreative.aiAnalysis?.angle}</p>
                  </div>

                  <div style={styles.aiPointBlock}>
                    <strong style={styles.aiPointLabel}>🎁 Penawaran (Offer & Pricing):</strong>
                    <p style={styles.aiPointVal}>{selectedCreative.aiAnalysis?.offer}</p>
                  </div>

                  <div style={styles.aiPointBlock}>
                    <strong style={styles.aiPointLabel}>👥 Target Audiens Perkiraan:</strong>
                    <p style={styles.aiPointVal}>{selectedCreative.aiAnalysis?.audience}</p>
                  </div>

                  {selectedCreative.aiAnalysis?.whyWinning && (
                    <div style={styles.aiWinningHighlight}>
                      <strong style={styles.aiPointLabel}>🔥 Mengapa Iklan Ini Berhasil (Winning Reason):</strong>
                      <p style={styles.aiPointVal}>{selectedCreative.aiAnalysis?.whyWinning}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div style={styles.drawerFooter}>
              <button
                onClick={() => handleToggleSwipe(selectedCreative.id)}
                style={{
                  ...styles.swipeActionBtn,
                  backgroundColor: selectedCreative.isSavedToSwipe
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'var(--bg-base)',
                  borderColor: selectedCreative.isSavedToSwipe
                    ? 'rgba(16, 185, 129, 0.4)'
                    : 'var(--border-muted)',
                  color: selectedCreative.isSavedToSwipe
                    ? 'var(--accent-green)'
                    : 'var(--text-primary)',
                }}
              >
                <Bookmark
                  size={15}
                  fill={selectedCreative.isSavedToSwipe ? 'var(--accent-green)' : 'none'}
                />
                <span>
                  {selectedCreative.isSavedToSwipe
                    ? 'Tersimpan di Swipe File'
                    : 'Simpan ke Swipe File'}
                </span>
              </button>

              <button
                onClick={() =>
                  alert(
                    'Fitur "Buat Variasi untuk Brand Saya" segera hadir terhubung ke role Copywriter & Ad Creative Generator!'
                  )
                }
                style={styles.variantActionBtn}
                title="Segera Hadir — Terhubung ke role Copywriter"
              >
                <Sparkles size={15} />
                <span>Buat Variasi untuk Brand Saya</span>
              </button>
            </div>
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
  filterCard: {
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.85rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    flex: 1,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
  },
  searchSubmitBtn: {
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.825rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filterPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
  filterSelect: {
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    outline: 'none',
  },
  filterToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  filterToggleActiveRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    color: 'var(--accent-red)',
    fontWeight: '600',
  },
  filterToggleActiveYellow: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    color: 'var(--accent-yellow)',
    fontWeight: '600',
  },
  filterToggleActiveGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: 'var(--accent-green)',
    fontWeight: '600',
  },
  creativesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
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
    height: '210px',
    backgroundColor: '#000000',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'transform 0.3s ease',
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
  newBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: '#000000',
    backgroundColor: 'var(--accent-yellow)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  standardDaysBadge: {
    fontSize: '0.68rem',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandName: {
    fontSize: '0.8rem',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  swipeIconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem',
    display: 'flex',
    alignItems: 'center',
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
  hookBox: {
    padding: '0.65rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  hookLabel: {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '0.15rem',
  },
  hookText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    margin: 0,
  },
  cardActionsRow: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '0.5rem',
  },
  openDrawerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
  },
  ctaBadge: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid var(--border-muted)',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '3rem',
    color: 'var(--text-muted)',
  },
  emptyCard: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  resetBtn: {
    padding: '0.55rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  // Drawer Detail Modal
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  drawerCard: {
    width: '100%',
    maxWidth: '560px',
    height: '100%',
    backgroundColor: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border-active)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-muted)',
    gap: '1rem',
  },
  drawerHeaderLeft: {
    flex: 1,
  },
  drawerBrandTag: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.2rem',
  },
  drawerTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  },
  drawerCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.35rem',
  },
  drawerContentScroll: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    flex: 1,
  },
  drawerMediaBox: {
    position: 'relative',
    height: '240px',
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  drawerMediaImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  drawerMediaOverlay: {
    position: 'absolute',
    bottom: '0.75rem',
    left: '0.75rem',
    right: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyBox: {
    padding: '1.1rem',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  copyHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyLabel: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  copyTextBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  copyTextFull: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    lineHeight: 1.55,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  landingLinkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingTop: '0.35rem',
    borderTop: '1px solid var(--border-muted)',
    marginTop: '0.35rem',
  },
  landingLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.75rem',
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  aiBreakdownCard: {
    padding: '1.25rem',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
  },
  aiBreakdownTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 1rem 0',
  },
  aiPointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  aiPointBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  aiPointLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  aiPointVal: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
    margin: 0,
  },
  aiWinningHighlight: {
    padding: '0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    marginTop: '0.25rem',
  },
  drawerFooter: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    backgroundColor: 'var(--bg-base)',
  },
  swipeActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.65rem 1rem',
    borderRadius: '6px',
    border: '1px solid var(--border-muted)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  variantActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.65rem 1.15rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
