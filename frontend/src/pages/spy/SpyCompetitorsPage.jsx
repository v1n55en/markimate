import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Eye,
  Sparkles,
  TrendingUp,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  X,
  Clock,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateTime } from '../../lib/format';
import { listCompetitors, addCompetitor, removeCompetitor, scanNow, isSpyMock } from '../../spy/spyApi';
import ModuleComingSoonCard from '../../components/common/ModuleComingSoonCard';

export default function SpyCompetitorsPage() {
  const { lang, t } = useLanguage();
  const mockActive = isSpyMock();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState(null);
  const [notice, setNotice] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form tambah kompetitor
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [country, setCountry] = useState('ID');
  const [schedule, setSchedule] = useState('weekly');
  const [adding, setAdding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCompetitors();
      setCompetitors(res.competitors || []);
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

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleScan = async (id, compName) => {
    setScanningId(id);
    try {
      await scanNow(id);
      flash(t('spy.competitors.scanSuccess', { brand: compName }));
      await loadData();
    } catch {
      flash(t('spy.competitors.scanFailed'));
    } finally {
      setScanningId(null);
    }
  };

  const handleDelete = async (id, compName) => {
    if (!window.confirm(t('spy.competitors.deleteConfirm', { brand: compName }))) return;
    try {
      await removeCompetitor(id);
      flash(t('spy.competitors.deleteSuccess', { brand: compName }));
      await loadData();
    } catch {
      flash(t('spy.competitors.deleteFailed'));
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addCompetitor({
        name,
        handle,
        pageUrl,
        country,
        schedule,
        platform: 'meta',
      });
      setName('');
      setHandle('');
      setPageUrl('');
      setShowAddModal(false);
      flash(t('spy.competitors.addSuccess', { brand: name }));
      await loadData();
    } catch {
      flash(t('spy.competitors.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  const quotaUsed = competitors.length;
  const quotaLimit = 5;

  if (!mockActive) {
    return <ModuleComingSoonCard roleKey="ads_spy" />;
  }

  return (
    <div style={styles.container}>
      {/* 1. Sub-nav Tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabsLeft}>
          <Link to="/app/spy" style={styles.tabBtn}>
            <Eye size={15} />
            <span>{t('spy.tabOverview')}</span>
          </Link>
          <Link to="/app/spy/competitors" style={{ ...styles.tabBtn, ...styles.tabBtnActive }}>
            <Users size={15} />
            <span>{t('spy.tabCompetitors')} ({competitors.length})</span>
          </Link>
          <Link to="/app/spy/library" style={styles.tabBtn}>
            <Sparkles size={15} />
            <span>{t('spy.tabLibrary')}</span>
          </Link>
          <Link to="/app/spy/insights" style={styles.tabBtn}>
            <TrendingUp size={15} />
            <span>{t('spy.tabInsights')}</span>
          </Link>
        </div>

        <div style={styles.tabsRight}>
          <span style={styles.quotaPill}>
            {t('spy.competitors.quota', { used: quotaUsed, limit: quotaLimit })}
          </span>
        </div>
      </div>

      {/* 2. Header & Action Row */}
      <div style={styles.actionHeaderRow}>
        <div>
          <h1 style={styles.pageTitle}>{t('spy.competitors.heading')}</h1>
          <p style={styles.pageSubtitle}>
            {t('spy.competitors.subheading')}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={styles.addBtn}
          disabled={quotaUsed >= quotaLimit}
        >
          <Plus size={16} />
          <span>{t('spy.competitors.addBtn')}</span>
        </button>
      </div>

      {/* Toast Notification */}
      {notice && (
        <div style={styles.noticeToast}>
          <CheckCircle2 size={16} color="var(--accent-green)" />
          <span>{notice}</span>
        </div>
      )}

      {/* 3. Table / Card List of Competitors */}
      {loading ? (
        <div style={styles.loadingBox}>
          <RefreshCw size={24} className="spin" color="var(--accent-cyan)" />
          <span>{t('spy.overview.scanningCreatives')}</span>
        </div>
      ) : competitors.length === 0 ? (
        <div style={styles.emptyCard} className="card">
          <Users size={36} color="var(--text-muted)" />
          <h3>{t('spy.competitors.emptyTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 0 1.25rem 0' }}>
            {t('spy.competitors.emptyDesc')}
          </p>
          <button onClick={() => setShowAddModal(true)} style={styles.addBtn}>
            <Plus size={16} />
            <span>{t('spy.competitors.addFirstBtn')}</span>
          </button>
        </div>
      ) : (
        <div style={styles.tableCard} className="card">
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>{t('spy.competitors.thBrand')}</th>
                  <th style={styles.th}>{t('spy.competitors.thActive')}</th>
                  <th style={styles.th}>{t('spy.competitors.thNew')}</th>
                  <th style={styles.th}>{t('spy.competitors.thWinning')}</th>
                  <th style={styles.th}>{t('spy.competitors.thLastScan')}</th>
                  <th style={styles.th}>{t('spy.competitors.thAction')}</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((comp) => {
                  const isScanning = scanningId === comp.id;
                  return (
                    <tr key={comp.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.brandCell}>
                          <strong style={styles.compName}>{comp.name}</strong>
                          <div style={styles.metaBadgeRow}>
                            <span style={styles.platformBadge}>{comp.platformLabel}</span>
                            <span style={styles.countryTag}>{t('spy.competitors.country')} {comp.country}</span>
                            {comp.pageUrl && (
                              <a
                                href={comp.pageUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.linkIcon}
                                title={t('spy.competitors.openPage')}
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.boldMetric}>{t('spy.competitors.adsCount', { count: comp.activeAdsCount })}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.boldMetric, color: 'var(--accent-yellow)' }}>
                          +{t('spy.competitors.adsCount', { count: comp.newAdsThisWeek })}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.boldMetric, color: 'var(--accent-red)' }}>
                          {t('spy.competitors.adsCount', { count: comp.winningAdsCount })}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.scanDateCell}>
                          <Clock size={12} color="var(--text-muted)" />
                          <span>
                            {formatDateTime(comp.lastScannedAt, lang)}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionBtnGroup}>
                          <button
                            onClick={() => handleScan(comp.id, comp.name)}
                            disabled={isScanning}
                            style={styles.scanBtn}
                            title={t('spy.competitors.scanNow')}
                          >
                            <RefreshCw
                              size={13}
                              className={isScanning ? 'spin' : ''}
                            />
                            <span>{isScanning ? t('spy.competitors.scanning') : t('spy.competitors.scanNow')}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(comp.id, comp.name)}
                            style={styles.deleteBtn}
                            title={t('spy.competitors.deleteTracking')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Modal Tambah Kompetitor */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div
            style={styles.modalCard}
            className="card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div style={styles.modalIconBox}>
                <Plus size={18} color="var(--accent-cyan)" />
              </div>
              <h3 style={styles.modalTitle}>{t('spy.competitors.modalTitle')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('spy.competitors.modalNameLabel')}</label>
                <input
                  type="text"
                  placeholder={t('spy.competitors.modalNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('spy.competitors.modalHandleLabel')}</label>
                <input
                  type="text"
                  placeholder={t('spy.competitors.modalHandlePlaceholder')}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('spy.competitors.modalUrlLabel')}</label>
                <input
                  type="url"
                  placeholder="https://facebook.com/..."
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('spy.competitors.modalPlatformLabel')}</label>
                  <select style={styles.select} disabled defaultValue="meta">
                    <option value="meta">Meta Ad Library ({t('common.active')})</option>
                    <option value="tiktok">TikTok Creative Center ({t('common.soon')})</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('spy.competitors.modalCountryLabel')}</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={styles.select}
                  >
                    <option value="ID">Indonesia (ID)</option>
                    <option value="MY">Malaysia (MY)</option>
                    <option value="SG">Singapura (SG)</option>
                    <option value="ALL">{t('spy.competitors.allCountries')}</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('spy.competitors.scanSchedule')}</label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  style={styles.select}
                >
                  <option value="weekly">{t('spy.competitors.scheduleWeekly')}</option>
                  <option value="daily">{t('spy.competitors.scheduleDaily')}</option>
                </select>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={styles.cancelBtn}
                >
                  {t('spy.competitors.modalCancel')}
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  style={styles.submitBtn}
                >
                  {adding ? t('spy.competitors.modalSubmitting') : t('spy.competitors.modalSubmit')}
                </button>
              </div>
            </form>
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
  quotaPill: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-base)',
    padding: '0.3rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid var(--border-muted)',
  },
  actionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
  },
  pageSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    margin: 0,
    maxWidth: '650px',
    lineHeight: 1.45,
  },
  addBtn: {
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
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  noticeToast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: 'var(--accent-green)',
    fontSize: '0.825rem',
    fontWeight: '500',
  },
  tableCard: {
    padding: '0.5rem',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thRow: {
    borderBottom: '1px solid var(--border-muted)',
  },
  th: {
    padding: '0.75rem 1rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid var(--border-muted)',
  },
  td: {
    padding: '0.9rem 1rem',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
  },
  brandCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  compName: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  metaBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  platformBadge: {
    fontSize: '0.65rem',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
  },
  countryTag: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
  },
  linkIcon: {
    color: 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  boldMetric: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  scanDateCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  actionBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  scanBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.4rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--accent-red)',
    cursor: 'pointer',
  },
  emptyCard: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '3rem',
    color: 'var(--text-muted)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modalCard: {
    maxWidth: '480px',
    width: '100%',
    padding: '1.75rem',
    borderRadius: '12px',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '1.25rem',
  },
  modalIconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    flex: 1,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  select: {
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  cancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '0.55rem 1.15rem',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-cyan)',
    border: 'none',
    color: '#000000',
    fontSize: '0.825rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
