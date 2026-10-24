// frontend/src/pages/ads/AdsTemplatesPage.jsx
// Halaman Template Builder, Metrics Custom (F5b), dan Profil Laporan (PRD F5 Langkah 7)

import { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  Calculator,
  Calendar,
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Layers
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getTemplates,
  saveTemplate,
  removeTemplate,
  getCustomMetrics,
  saveCustomMetric,
  testFormula,
  removeCustomMetric,
  getProfiles,
  saveProfile,
  removeProfile
} from '../../ads/adsApi';
import AdsDeckSettings from './AdsDeckSettings';

const PAGE_TYPES = [
  { type: 'kpi', label: '+ KPI' },
  { type: 'trend', label: '+ Trend' },
  { type: 'table', label: '+ Table' },
  { type: 'breakdown', label: '+ Breakdown' },
  { type: 'creatives', label: '+ Creatives' },
  { type: 'ai_insight', label: '+ AI Insight' }
];

export default function AdsTemplatesPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'metrics' | 'profiles'

  const [templates, setTemplates] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Template Editor State
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tplPages, setTplPages] = useState([]);

  // Metric Form State
  const [metricName, setMetricName] = useState('');
  const [metricFormula, setMetricFormula] = useState('');
  const [metricUnit, setMetricUnit] = useState('number');
  const [metricDecimals, setMetricDecimals] = useState(2);
  const [testResult, setTestResult] = useState(null);
  const [testingFormula, setTestingFormula] = useState(false);

  // Profile Form State
  const [profileName, setProfileName] = useState('');
  const [profileTemplateId, setProfileTemplateId] = useState('');
  const [profileSchedule, setProfileSchedule] = useState('none');
  const [profileRecipients, setProfileRecipients] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [tplRes, metRes, profRes] = await Promise.all([
        getTemplates().catch(() => ({ templates: [] })),
        getCustomMetrics().catch(() => ({ metrics: [] })),
        getProfiles().catch(() => ({ profiles: [] }))
      ]);

      const tpls = tplRes.templates || [];
      setTemplates(tpls);
      setMetrics(metRes.metrics || []);
      setProfiles(profRes.profiles || []);

      if (tpls.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tpls[0]);
        setTplPages(tpls[0].spec?.pages || []);
        setProfileTemplateId(tpls[0].id);
      } else if (selectedTemplate) {
        // segarkan spec template terpilih (mis. deck baru disimpan) tanpa mengubah editor halaman
        const fresh = tpls.find((x) => x.id === selectedTemplate.id);
        if (fresh) setSelectedTemplate(fresh);
      }
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const onWsChange = () => loadAll();
    window.addEventListener('markimate:workspace-changed', onWsChange);
    window.addEventListener('supermat:workspace-changed', onWsChange);
    return () => {
      window.removeEventListener('markimate:workspace-changed', onWsChange);
      window.removeEventListener('supermat:workspace-changed', onWsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setTplPages(tpl.spec?.pages || []);
    setError('');
    setSuccess('');
  };

  const handleDuplicateTemplate = async (tpl) => {
    try {
      const dup = {
        name: `${tpl.name} (Copy)`,
        spec: { ...tpl.spec, name: `${tpl.name} (Copy)` }
      };
      const res = await saveTemplate(dup);
      if (res.status === 'ok') {
        setSuccess(t('ads.templates.duplicateSuccess'));
        setTimeout(() => setSuccess(''), 3000);
        await loadAll();
      }
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await removeTemplate(id);
      setSuccess(t('ads.templates.deleteTemplateSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  // Reorder slide pages
  const handleMovePage = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tplPages.length) return;
    const updated = [...tplPages];
    const temp = updated[idx];
    updated[idx] = updated[newIdx];
    updated[newIdx] = temp;
    setTplPages(updated);
  };

  const handleAddPage = (type) => {
    const newPage = {
      type,
      title: type.toUpperCase()
    };
    setTplPages([...tplPages, newPage]);
  };

  const handleDeletePage = (idx) => {
    setTplPages(tplPages.filter((_, i) => i !== idx));
  };

  const handleSaveTemplatePages = async () => {
    if (!selectedTemplate) return;
    try {
      const updatedSpec = {
        ...selectedTemplate.spec,
        pages: tplPages
      };
      await saveTemplate({ spec: updatedSpec }, selectedTemplate.id);
      setSuccess(t('ads.templates.saveTemplateSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  const handleDeckSaved = async (tpl, message) => {
    if (tpl) setSelectedTemplate((prev) => ({ ...prev, ...tpl }));
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
    await loadAll();
  };

  // Metric handlers
  const handleTestFormula = async () => {
    setTestingFormula(true);
    setTestResult(null);
    try {
      const res = await testFormula(metricFormula);
      if (res.ok) {
        setTestResult({ ok: true, sample: res.sampleResult });
      } else {
        setTestResult({ ok: false, error: res.error });
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestingFormula(false);
    }
  };

  const handleSaveMetric = async (e) => {
    e.preventDefault();
    try {
      await saveCustomMetric({
        name: metricName,
        formula: metricFormula,
        unit: metricUnit,
        decimals: Number(metricDecimals)
      });
      setSuccess(t('ads.customMetrics.saveSuccess'));
      setMetricName('');
      setMetricFormula('');
      setTestResult(null);
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  const handleDeleteMetric = async (id) => {
    try {
      await removeCustomMetric(id);
      setSuccess(t('ads.customMetrics.deleteSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  // Profile handlers
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const recipientsArr = profileRecipients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveProfile({
        name: profileName,
        template_id: profileTemplateId,
        account_ids: [],
        schedule: profileSchedule === 'monthly' ? 'monthly' : null,
        recipients: recipientsArr
      });
      setSuccess(t('ads.profiles.saveSuccess'));
      setProfileName('');
      setProfileRecipients('');
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  const handleDeleteProfile = async (id) => {
    try {
      await removeProfile(id);
      setSuccess(t('ads.profiles.deleteSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  return (
    <div className="ads-container">
      {/* Header */}
      <div className="ads-header">
        <div>
          <h1 className="ads-title">{t('ads.templates.heading')}</h1>
          <p className="ads-subtitle">{t('ads.templates.subheading')}</p>
        </div>
        <button
          type="button"
          className="ads-btn ads-btn-secondary"
          onClick={loadAll}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>{t('ads.reports.reload')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="ads-tabs">
        <button
          type="button"
          className={`ads-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <LayoutTemplate size={16} />
          <span>{t('ads.templates.tabTemplates')}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          <Calculator size={16} />
          <span>{t('ads.templates.tabMetrics')}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          <Calendar size={16} />
          <span>{t('ads.templates.tabProfiles')}</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="ads-card" style={{ marginBottom: '1.25rem', background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10b981' }}>
          <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600 }}>{success}</span>
        </div>
      )}
      {error && (
        <div className="ads-card" style={{ marginBottom: '1.25rem', background: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* TAB 1: TEMPLATES */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Credit formula notice */}
          <div className="ads-card" style={{ background: 'rgba(6, 182, 212, 0.08)', borderColor: 'var(--accent-cyan)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {t('ads.templates.creditNotice', { base: 300, maxAcc: 3, perAcc: 50, perAi: 50 })}
              </span>
            </div>
          </div>

          <div className="ads-grid">
            {/* Template List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {t('ads.templates.templateListTitle', { count: templates.length })}
              </h3>
              {templates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className="ads-card"
                    style={{
                      borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-color)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tpl.name}</div>
                      {tpl.is_system ? (
                        <span className="ads-badge ads-badge-system">{t('ads.templates.systemBadge')}</span>
                      ) : (
                        <span className="ads-badge ads-badge-active">{t('ads.templates.customBadge')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {t('ads.templates.pageCount', { count: tpl.spec?.pages?.length || 0 })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="ads-btn ads-btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateTemplate(tpl);
                        }}
                        style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                      >
                        <Copy size={13} />
                        <span>{t('ads.templates.btnDuplicate')}</span>
                      </button>
                      {!tpl.is_system && (
                        <button
                          type="button"
                          className="ads-btn ads-btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(tpl.id);
                          }}
                          style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                        >
                          <Trash2 size={13} />
                          <span>{t('ads.templates.btnDelete')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slide Pages Editor */}
            {selectedTemplate && (
              <div className="ads-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedTemplate.name}
                    </h3>
                    <span className="ads-form-help">
                      {selectedTemplate.is_system ? t('ads.templates.systemTemplateNotice') : t('ads.templates.customTemplateNotice')}
                    </span>
                  </div>
                  {!selectedTemplate.is_system && (
                    <button
                      type="button"
                      className="ads-btn ads-btn-primary"
                      onClick={handleSaveTemplatePages}
                      style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                    >
                      {t('common.save')}
                    </button>
                  )}
                </div>

                {/* Page list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tplPages.map((page, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-input, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '28px', whiteSpace: 'nowrap' }}>
                          #{idx + 1}
                        </span>
                        <Layers size={16} color="var(--accent-cyan)" />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {page.title || page.type}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {t('ads.templates.pageTypeLabel', { type: page.type })}
                          </div>
                        </div>
                      </div>

                      {!selectedTemplate.is_system && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, -1)}
                            disabled={idx === 0}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, 1)}
                            disabled={idx === tplPages.length - 1}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePage(idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!selectedTemplate.is_system && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      {t('ads.templates.addPage')}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {PAGE_TYPES.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="ads-btn ads-btn-secondary"
                          onClick={() => handleAddPage(item.type)}
                          style={{ minHeight: '34px', padding: '0 0.65rem', fontSize: '0.78rem' }}
                        >
                          <Plus size={12} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AdsDeckSettings
                  template={selectedTemplate}
                  pageTypes={tplPages.map((p) => p.type)}
                  onSaved={handleDeckSaved}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM METRICS (F5b) */}
      {activeTab === 'metrics' && (
        <div className="ads-grid">
          {/* Metric Form */}
          <div className="ads-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              {t('ads.customMetrics.newMetricBtn')}
            </h3>
            <form onSubmit={handleSaveMetric}>
              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.customMetrics.metricName')}</label>
                <input
                  type="text"
                  className="ads-input"
                  placeholder={t('ads.customMetrics.namePlaceholder')}
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  required
                />
              </div>

              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.customMetrics.formula')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="ads-input"
                    placeholder={t('ads.customMetrics.formulaPlaceholder')}
                    value={metricFormula}
                    onChange={(e) => setMetricFormula(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ads-btn ads-btn-secondary"
                    onClick={handleTestFormula}
                    disabled={!metricFormula || testingFormula}
                    style={{ minHeight: '44px', width: 'auto', whiteSpace: 'nowrap' }}
                  >
                    {testingFormula ? <RefreshCw size={14} className="spin" /> : t('ads.customMetrics.testBtn')}
                  </button>
                </div>
                <span className="ads-form-help">{t('ads.customMetrics.formulaHelp')}</span>
              </div>

              {testResult && (
                <div style={{ margin: '0.75rem 0', padding: '0.65rem', borderRadius: 'var(--radius-md)', background: testResult.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' }}>
                  {testResult.ok ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={15} />
                      <span>{t('ads.customMetrics.testSuccess', { sample: testResult.sample })}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.85rem' }}>
                      <AlertCircle size={15} />
                      <span>{t('ads.customMetrics.testError', { error: testResult.error })}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="ads-form-group" style={{ flex: 1, minWidth: '130px' }}>
                  <label className="ads-form-label">{t('ads.customMetrics.unit')}</label>
                  <select
                    className="ads-input"
                    value={metricUnit}
                    onChange={(e) => setMetricUnit(e.target.value)}
                  >
                    <option value="number">{t('ads.customMetrics.unitNumber')}</option>
                    <option value="currency">{t('ads.customMetrics.unitCurrency')}</option>
                    <option value="percent">{t('ads.customMetrics.unitPercent')}</option>
                    <option value="ratio">{t('ads.customMetrics.unitRatio')}</option>
                  </select>
                </div>

                <div className="ads-form-group" style={{ flex: 1, minWidth: '130px' }}>
                  <label className="ads-form-label">{t('ads.customMetrics.decimals')}</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    className="ads-input"
                    value={metricDecimals}
                    onChange={(e) => setMetricDecimals(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="ads-btn ads-btn-primary" style={{ marginTop: '0.5rem' }}>
                <Plus size={16} />
                <span>{t('common.save')}</span>
              </button>
            </form>
          </div>

          {/* Metric Directory */}
          <div className="ads-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              {t('ads.customMetrics.heading')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
              {metrics.length === 0 ? (
                <div className="ads-form-help">{t('ads.customMetrics.emptyMetrics')}</div>
              ) : (
                metrics.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-input, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{m.name}</strong>
                        {m.is_custom ? (
                          <span className="ads-badge ads-badge-active">{t('ads.customMetrics.badgeCustom')}</span>
                        ) : (
                          <span className="ads-badge ads-badge-system">{t('ads.customMetrics.badgeStandard')}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {m.is_custom ? (
                          <code>{m.formula}</code>
                        ) : (
                          <span>{m.description || m.key}</span>
                        )}
                      </div>
                    </div>

                    {m.is_custom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMetric(m.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILES */}
      {activeTab === 'profiles' && (
        <div className="ads-grid">
          {/* Profile Form */}
          <div className="ads-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              {t('ads.profiles.newProfileBtn')}
            </h3>
            <form onSubmit={handleSaveProfile}>
              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.profiles.profileName')}</label>
                <input
                  type="text"
                  className="ads-input"
                  placeholder={t('ads.profiles.namePlaceholder')}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>

              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.reports.selectTemplate')}</label>
                <select
                  className="ads-input"
                  value={profileTemplateId}
                  onChange={(e) => setProfileTemplateId(e.target.value)}
                  required
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.profiles.scheduleLabel')}</label>
                <select
                  className="ads-input"
                  value={profileSchedule}
                  onChange={(e) => setProfileSchedule(e.target.value)}
                >
                  <option value="none">{t('ads.profiles.scheduleNone')}</option>
                  <option value="monthly">{t('ads.profiles.scheduleMonthly')}</option>
                </select>
              </div>

              <div className="ads-form-group">
                <label className="ads-form-label">{t('ads.profiles.recipients')}</label>
                <input
                  type="text"
                  className="ads-input"
                  placeholder={t('ads.profiles.recipientsPlaceholder')}
                  value={profileRecipients}
                  onChange={(e) => setProfileRecipients(e.target.value)}
                />
                <span className="ads-form-help">{t('ads.profiles.recipientsHelp')}</span>
              </div>

              <button type="submit" className="ads-btn ads-btn-primary" style={{ marginTop: '0.5rem' }}>
                <Plus size={16} />
                <span>{t('common.save')}</span>
              </button>
            </form>
          </div>

          {/* Profile List */}
          <div className="ads-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              {t('ads.profiles.profilesListTitle', { count: profiles.length })}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {profiles.length === 0 ? (
                <div className="ads-form-help">{t('ads.profiles.emptyProfiles')}</div>
              ) : (
                profiles.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '0.75rem 0.85rem',
                      background: 'var(--bg-input, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {t('ads.profiles.scheduleInfo', { schedule: p.schedule === 'monthly' ? t('ads.profiles.scheduleMonthlyBadge') : t('ads.profiles.scheduleManualBadge') })}
                        </div>
                        {p.recipients?.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                            {t('ads.profiles.recipientsInfo', { recipients: p.recipients.join(', ') })}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
