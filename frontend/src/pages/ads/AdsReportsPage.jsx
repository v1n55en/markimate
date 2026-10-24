// frontend/src/pages/ads/AdsReportsPage.jsx
// Halaman Daftar Laporan Iklan & Modal Generator (PRD F5 Langkah 7)

import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  ExternalLink,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  listReports,
  getTemplates,
  getProfiles,
  getAdAccounts,
  generateAdsReport
} from '../../ads/adsApi';

export default function AdsReportsPage() {
  const { t } = useLanguage();
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Form State
  const [genMode, setGenMode] = useState('profile'); // 'profile' | 'manual'
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const pollTimerRef = useRef(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [repRes, tplRes, profRes, accRes] = await Promise.all([
        listReports().catch(() => ({ reports: [] })),
        getTemplates().catch(() => ({ templates: [] })),
        getProfiles().catch(() => ({ profiles: [] })),
        getAdAccounts().catch(() => ({ accounts: [] }))
      ]);

      setReports(repRes.reports || []);
      setTemplates(tplRes.templates || []);
      setProfiles(profRes.profiles || []);
      const accs = accRes.accounts || [];
      setAdAccounts(accs);

      // Default selections
      if (profRes.profiles?.length > 0 && !selectedProfileId) {
        setSelectedProfileId(profRes.profiles[0].id);
      }
      if (tplRes.templates?.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(tplRes.templates[0].id);
      }
      if (accs.length > 0 && selectedAccountIds.length === 0) {
        setSelectedAccountIds(accs.filter((a) => a.selected).map((a) => a.id));
      }

      // Default periode: bulan lalu
      if (!periodStart || !periodEnd) {
        const now = new Date();
        const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
        const pad = (n) => String(n).padStart(2, '0');
        setPeriodStart(`${firstDayPrev.getFullYear()}-${pad(firstDayPrev.getMonth() + 1)}-01`);
        setPeriodEnd(`${lastDayPrev.getFullYear()}-${pad(lastDayPrev.getMonth() + 1)}-${pad(lastDayPrev.getDate())}`);
      }
    } catch {
      // Abaikan error background fetch
    } finally {
      if (!silent) setLoading(false);
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

  // Polling otomatis tiap 4 detik bila ada laporan running / queued
  useEffect(() => {
    const hasRunning = reports.some((r) => r.status === 'running' || r.status === 'queued');
    if (hasRunning) {
      pollTimerRef.current = setTimeout(() => {
        loadData(true);
      }, 4000);
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const handleOpenModal = () => {
    setGenError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setGenError('');
  };

  const handleToggleSelectAccount = (id) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStartGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenError('');

    try {
      const payload = genMode === 'profile'
        ? { profileId: selectedProfileId }
        : {
            templateId: selectedTemplateId,
            accountIds: selectedAccountIds,
            periodStart,
            periodEnd,
            compare: true
          };

      const res = await generateAdsReport(payload);
      if (res.status === 'ok') {
        handleCloseModal();
        await loadData(true);
      }
    } catch (err) {
      setGenError(err.message || t('ads.reports.loadError'));
    } finally {
      setGenerating(false);
    }
  };

  // Kalkulasi estimasi kredit
  let estimatedCredits = 350;
  if (genMode === 'manual') {
    const accCount = selectedAccountIds.length;
    const extraAcc = Math.max(0, accCount - 3);
    estimatedCredits = 300 + (extraAcc * 50) + 50; // 1 AI page bawaan
  }

  return (
    <div className="ads-container">
      {/* Header */}
      <div className="ads-header">
        <div>
          <h1 className="ads-title">{t('ads.reports.heading')}</h1>
          <p className="ads-subtitle">{t('ads.reports.subheading')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '360px' }}>
          <button
            type="button"
            className="ads-btn ads-btn-secondary"
            onClick={() => loadData(false)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>{t('ads.reports.reload')}</span>
          </button>
          <button
            type="button"
            className="ads-btn ads-btn-primary"
            onClick={handleOpenModal}
          >
            <Plus size={16} />
            <span>{t('ads.reports.newReportBtn')}</span>
          </button>
        </div>
      </div>

      {/* Reports Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.75rem auto' }} />
          <div>{t('common.loading')}</div>
        </div>
      ) : reports.length === 0 ? (
        <div className="ads-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <FileText size={48} color="var(--accent-cyan)" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            {t('ads.reports.emptyReports')}
          </h3>
          <p className="ads-form-help" style={{ maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            {t('ads.reports.subheading')}
          </p>
          <button
            type="button"
            className="ads-btn ads-btn-primary"
            onClick={handleOpenModal}
            style={{ margin: '0 auto' }}
          >
            <Plus size={16} />
            <span>{t('ads.reports.newReportBtn')}</span>
          </button>
        </div>
      ) : (
        <div>
          {/* Mobile Card List (< 640px) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="mobile-only-block">
            {reports.map((rep) => {
              const isReady = rep.status === 'ready';
              const isRunning = rep.status === 'running' || rep.status === 'queued';
              const isError = rep.status === 'error';

              return (
                <div key={rep.id} className="ads-card">
                  <div className="ads-card-header">
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {rep.template_snapshot?.name || t('ads.templates.systemBadge')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {rep.period_start} – {rep.period_end}
                      </div>
                    </div>

                    <div>
                      {isReady && (
                        <span className="ads-badge ads-badge-active">
                          <CheckCircle2 size={12} />
                          <span>{t('ads.reports.statusReady')}</span>
                        </span>
                      )}
                      {isRunning && (
                        <span className="ads-badge ads-badge-running">
                          <Clock size={12} />
                          <span>{t('ads.reports.statusRunning')}</span>
                        </span>
                      )}
                      {isError && (
                        <span className="ads-badge ads-badge-error">
                          <AlertTriangle size={12} />
                          <span>{t('ads.reports.statusError')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {rep.summary && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--bg-input, rgba(255,255,255,0.03))', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>
                      {rep.summary}
                    </div>
                  )}

                  {isError && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                      {rep.error_code || t('ads.reports.statusError')}: {t('ads.reports.refundNotice')}
                    </div>
                  )}

                  {isReady && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {rep.slides_url && (
                        <a
                          href={rep.slides_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ads-btn ads-btn-primary"
                        >
                          <ExternalLink size={14} />
                          <span>{t('ads.reports.openSlides')}</span>
                        </a>
                      )}
                      {rep.pdf_path && (
                        <a
                          href={rep.pdf_path}
                          target="_blank"
                          rel="noreferrer"
                          className="ads-btn ads-btn-secondary"
                        >
                          <Download size={14} />
                          <span>{t('ads.reports.downloadPdf')}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 640px) */}
          <div className="desktop-only-block ads-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="ads-table-responsive">
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>{t('ads.reports.colPeriod')}</th>
                    <th>{t('ads.reports.colTemplate')}</th>
                    <th>{t('ads.reports.colStatus')}</th>
                    <th>{t('ads.reports.colCredits')}</th>
                    <th>{t('ads.reports.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((rep) => {
                    const isReady = rep.status === 'ready';
                    const isRunning = rep.status === 'running' || rep.status === 'queued';
                    const isError = rep.status === 'error';

                    return (
                      <tr key={rep.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {rep.period_start} – {rep.period_end}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(rep.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{rep.template_snapshot?.name || t('ads.templates.systemBadge')}</div>
                        </td>
                        <td>
                          {isReady && (
                            <span className="ads-badge ads-badge-active">
                              <CheckCircle2 size={12} />
                              <span>{t('ads.reports.statusReady')}</span>
                            </span>
                          )}
                          {isRunning && (
                            <span className="ads-badge ads-badge-running">
                              <Clock size={12} />
                              <span>{t('ads.reports.statusRunning')}</span>
                            </span>
                          )}
                          {isError && (
                            <span className="ads-badge ads-badge-error">
                              <AlertTriangle size={12} />
                              <span>{t('ads.reports.statusError')}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{t('adminDashboard.creditsVal', { amount: rep.credits_charged || 0 })}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {isReady && rep.slides_url && (
                              <a
                                href={rep.slides_url}
                                target="_blank"
                                rel="noreferrer"
                                className="ads-btn ads-btn-secondary"
                                style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                              >
                                <ExternalLink size={13} />
                                <span>{t('ads.reports.openSlides')}</span>
                              </a>
                            )}
                            {isReady && rep.pdf_path && (
                              <a
                                href={rep.pdf_path}
                                target="_blank"
                                rel="noreferrer"
                                className="ads-btn ads-btn-secondary"
                                style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                              >
                                <Download size={13} />
                                <span>{t('ads.reports.downloadPdf')}</span>
                              </a>
                            )}
                            {isError && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {t('ads.reports.refundNotice')}
                              </span>
                            )}
                            {isRunning && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                                {t('ads.reports.generating')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {modalOpen && (
        <div className="ads-modal-overlay">
          <div className="ads-modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {t('ads.reports.modalGenerateTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {genError && (
              <div className="ads-card" style={{ marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.875rem' }}>
                  <AlertCircle size={16} />
                  <span>{genError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleStartGenerate}>
              {/* Mode Selection */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`ads-tab-btn ${genMode === 'profile' ? 'active' : ''}`}
                  onClick={() => setGenMode('profile')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {t('ads.reports.generateModeProfile')}
                </button>
                <button
                  type="button"
                  className={`ads-tab-btn ${genMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setGenMode('manual')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {t('ads.reports.generateModeManual')}
                </button>
              </div>

              {genMode === 'profile' ? (
                <div className="ads-form-group">
                  <label className="ads-form-label">{t('ads.reports.selectProfile')}</label>
                  {profiles.length === 0 ? (
                    <div className="ads-form-help">
                      {t('ads.reports.noProfilesNotice')}
                    </div>
                  ) : (
                    <select
                      className="ads-input"
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      required
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <div className="ads-form-group">
                    <label className="ads-form-label">{t('ads.reports.selectTemplate')}</label>
                    <select
                      className="ads-input"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      required
                    >
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} {tpl.is_system ? `(${t('ads.templates.systemBadge')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ads-form-group">
                    <label className="ads-form-label">{t('ads.reports.selectAccounts')}</label>
                    {adAccounts.length === 0 ? (
                      <div className="ads-form-help">
                        {t('ads.reports.noAccountsNotice')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                        {adAccounts.map((acc) => {
                          const isChecked = selectedAccountIds.includes(acc.id);
                          return (
                            <label
                              key={acc.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.6rem',
                                background: isChecked ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-input, rgba(255,255,255,0.03))',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectAccount(acc.id)}
                              />
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 400 }}>
                                {acc.name} ({acc.currency})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div className="ads-form-group" style={{ flex: 1, minWidth: '140px' }}>
                      <label className="ads-form-label">{t('ads.reports.periodStart')}</label>
                      <input
                        type="date"
                        className="ads-input"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        required
                      />
                    </div>
                    <div className="ads-form-group" style={{ flex: 1, minWidth: '140px' }}>
                      <label className="ads-form-label">{t('ads.reports.periodEnd')}</label>
                      <input
                        type="date"
                        className="ads-input"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Estimate & Action */}
              <div style={{ background: 'var(--bg-input, rgba(255,255,255,0.03))', padding: '0.85rem', borderRadius: 'var(--radius-md)', margin: '1.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {t('ads.reports.estimatedCost')}:
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {t('adminDashboard.creditsVal', { amount: estimatedCredits })}
                  </span>
                </div>
                <div className="ads-form-help" style={{ marginTop: '0.25rem' }}>
                  {t('ads.reports.costHelp')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ads-btn ads-btn-secondary"
                  onClick={handleCloseModal}
                  disabled={generating}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="ads-btn ads-btn-primary"
                  disabled={generating || (genMode === 'profile' && !selectedProfileId) || (genMode === 'manual' && selectedAccountIds.length === 0)}
                >
                  {generating ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>{t('ads.reports.generating')}</span>
                    </>
                  ) : (
                    <span>{t('ads.reports.generateConfirmBtn', { credits: estimatedCredits })}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
