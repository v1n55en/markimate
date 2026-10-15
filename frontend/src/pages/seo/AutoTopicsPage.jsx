import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Play, Plus, X, Calendar, Clock, AlertTriangle,
  CheckCircle2, Loader2, Sparkles, Lock, RefreshCw, Layers, ArrowRight, Check
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime, formatNumber } from '../../lib/format';
import { api, GEO_OPTIONS, LN_OPTIONS, CMS_LABEL } from '../../api';

const getWeekdays = (t) => [
  { value: 0, label: t('common.weekdays.sun') },
  { value: 1, label: t('common.weekdays.mon') },
  { value: 2, label: t('common.weekdays.tue') },
  { value: 3, label: t('common.weekdays.wed') },
  { value: 4, label: t('common.weekdays.thu') },
  { value: 5, label: t('common.weekdays.fri') },
  { value: 6, label: t('common.weekdays.sat') },
];

export default function AutoTopicsPage({ me = {}, refreshMe, goTo }) {
  const { lang, t } = useLanguage();
  const user = me?.user || {};
  const isPremium = user.plan === 'premium' || (me.plan && me.plan.id !== 'free') || ['seo', 'focus3', 'all_in_one'].includes(user.plan);
  const anyCms = useMemo(() => (me.cms || []).map(c => c.cmsType), [me.cms]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [source, setSource] = useState(null);
  const [cmsType, setCmsType] = useState(anyCms[0] || 'wordpress');
  const [seedInput, setSeedInput] = useState('');
  const [seedKeywords, setSeedKeywords] = useState(['digital marketing umkm', 'iklan tiktok']);
  const [geo, setGeo] = useState('ID');
  const [ln, setLn] = useState('id');
  const [weekday, setWeekday] = useState(6); // Sabtu
  const [hour, setHour] = useState(0); // 00:00 WIB
  const [topicsPerRun, setTopicsPerRun] = useState(3);
  const [minVolume, setMinVolume] = useState(50);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [active, setActive] = useState(true);

  const [runResult, setRunResult] = useState(null);

  const weekdays = useMemo(() => getWeekdays(t), [t]);

  const loadSources = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api('/api/seo/topic-sources');
      const list = res.sources || [];
      if (list.length > 0) {
        const s = list[0];
        setSource(s);
        setCmsType(s.cms_type || anyCms[0] || 'wordpress');
        setSeedKeywords(Array.isArray(s.seed_keywords) ? s.seed_keywords : []);
        setGeo(s.geo || 'ID');
        setLn(s.ln || 'id');
        setWeekday(s.weekday ?? 6);
        setHour(s.hour ?? 0);
        setTopicsPerRun(s.topics_per_run || 3);
        setMinVolume(s.min_volume ?? 50);
        setAutoGenerate(!!s.auto_generate);
        setActive(s.active !== false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [anyCms]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const addSeed = (e) => {
    if (e) e.preventDefault();
    const val = seedInput.trim().toLowerCase();
    if (val && !seedKeywords.includes(val)) {
      setSeedKeywords([...seedKeywords, val]);
      setSeedInput('');
    }
  };

  const removeSeed = (seed) => {
    setSeedKeywords(seedKeywords.filter(s => s !== seed));
  };

  const saveSource = async () => {
    if (!seedKeywords.length) {
      setError(t('seo.autoTopics.errSeedRequired'));
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await api('/api/seo/topic-sources', {
        method: 'PUT',
        body: {
          id: source?.id,
          cmsType,
          seedKeywords,
          geo,
          ln,
          weekday,
          hour,
          topicsPerRun,
          minVolume,
          autoGenerate,
          active
        }
      });
      setSource(res.source);
      setNotice(t('seo.autoTopics.settingsSaved'));
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (!isPremium) {
      setError(t('seo.autoTopics.proRequired'));
      return;
    }
    if (!source?.id) {
      await saveSource();
    }
    setRunning(true); setError(''); setRunResult(null);
    try {
      const saveRes = await api('/api/seo/topic-sources', {
        method: 'PUT',
        body: {
          id: source?.id,
          cmsType,
          seedKeywords,
          geo, ln, weekday, hour,
          topicsPerRun, minVolume, autoGenerate, active
        }
      });
      const s = saveRes.source;
      setSource(s);

      const res = await api(`/api/seo/topic-sources/${s.id}/run`, { method: 'POST' });
      setRunResult(res);
      refreshMe && refreshMe();
      setNotice(
        t('seo.autoTopics.runSuccess', {
          new: res.topics?.length || 0,
          skipped: (res.skipped?.duplicate ?? 0) + (res.skipped?.lowVolume ?? 0)
        })
      );
    } catch (e) {
      setError(e.message);
      if (e.status === 402 && goTo) setTimeout(() => goTo('billing'), 1500);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <TrendingUp size={24} color="var(--accent-cyan)" />
          <h1 style={{ margin: 0 }}>
            {t('seo.autoTopics.pageTitle')}
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('seo.autoTopics.pageSubtitle')}
        </p>
      </header>

      {!isPremium && (
        <div className="card" style={{ ...styles.alert, marginBottom: '1.5rem', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <Lock size={18} color="var(--accent-yellow)" />
          <div style={{ flex: 1, fontSize: '0.88rem' }}>
            {t('seo.autoTopics.proBannerDesc')}
          </div>
          <button className="btn btn-primary" onClick={() => goTo && goTo('billing')}>
            {t('seo.autoTopics.upgradeToPro')}
          </button>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <AlertTriangle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={styles.closeBtn}><X size={14} /></button>
        </div>
      )}
      {notice && (
        <div style={styles.noticeBox}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Form Konfigurasi Topik Otomatis */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-muted)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
              {t('seo.autoTopics.configTitle')}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('seo.autoTopics.configSubtitle')}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              disabled={!isPremium}
            />
            <span>{active ? t('seo.autoTopics.scheduleActive') : t('seo.autoTopics.schedulePaused')}</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Seed Keywords Chips */}
          <div>
            <label className="form-label">
              {t('seo.autoTopics.seedLabel')}
            </label>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {t('seo.autoTopics.seedDesc')}
            </div>

            <div style={styles.chipsContainer}>
              {seedKeywords.map(s => (
                <span key={s} style={styles.chip}>
                  {s}
                  <button type="button" onClick={() => removeSeed(s)} style={styles.chipRemoveBtn}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={addSeed} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                className="form-input"
                style={{ maxWidth: '320px' }}
                placeholder={t('seo.autoTopics.seedPlaceholder')}
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '0 0.9rem' }}>
                <Plus size={15} /> {t('seo.autoTopics.addSeed')}
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Target CMS */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.targetCms')}</label>
              <select className="form-select" value={cmsType} onChange={e => setCmsType(e.target.value)}>
                {anyCms.map(c => <option key={c} value={c}>{CMS_LABEL[c] || c}</option>)}
              </select>
            </div>

            {/* Negara & Bahasa */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.targetRegion')}</label>
              <select className="form-select" value={geo} onChange={e => setGeo(e.target.value)}>
                {GEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.researchLang')}</label>
              <select className="form-select" value={ln} onChange={e => setLn(e.target.value)}>
                {LN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Hari & Jam Mingguan */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.weeklyDay')}</label>
              <select className="form-select" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
                {weekdays.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.executionHour')}</label>
              <select className="form-select" value={hour} onChange={e => setHour(Number(e.target.value))}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00 WIB`}</option>
                ))}
              </select>
            </div>

            {/* Topics per run */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.topicsPerRun')}</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="10"
                value={topicsPerRun}
                onChange={e => setTopicsPerRun(Number(e.target.value) || 3)}
              />
            </div>

            {/* Min Volume */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('seo.autoTopics.minVolume')}</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="10"
                value={minVolume}
                onChange={e => setMinVolume(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Mode Eksekusi: Suggested vs Auto-Generate */}
          <div style={styles.toggleCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="autoGenerateToggle"
                checked={autoGenerate}
                onChange={e => setAutoGenerate(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
              />
              <label htmlFor="autoGenerateToggle" style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('seo.autoTopics.autoGenLabel')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('seo.autoTopics.autoGenDesc')}
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={saveSource}
              disabled={saving || !isPremium}
            >
              {saving ? <Loader2 size={15} className="spin-icon" /> : <Check size={15} />}
              {t('seo.autoTopics.saveSettings')}
            </button>
            <button
              className="btn btn-primary"
              onClick={runNow}
              disabled={running || !isPremium}
            >
              {running ? <Loader2 size={15} className="spin-icon" /> : <Play size={15} />}
              {t('seo.autoTopics.runNow')}
            </button>
            {source && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {source.last_run_at && (
                  <span>
                    {t('seo.autoTopics.lastRun')}{' '}
                    {formatDateTime(source.last_run_at, lang)}
                  </span>
                )}
                {source.next_run_at && (
                  <span>
                    · {t('seo.autoTopics.nextScheduled')}{' '}
                    {formatDateTime(source.next_run_at, lang)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hasil Run Langsung */}
      {runResult && (
        <div className="card" style={{ border: '1px solid var(--accent-cyan)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="var(--accent-cyan)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                {t('seo.autoTopics.resultsTitle')}
              </h2>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              onClick={() => goTo && goTo('keywords')}
            >
              {t('seo.autoTopics.openAutomation')}{' '}
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{t('seo.autoTopics.newTopics')}</span>
              <span style={styles.statValue}>{runResult.topics?.length || 0}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{t('seo.autoTopics.skippedDuplicate')}</span>
              <span style={styles.statValue}>{runResult.skipped?.duplicate ?? 0}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{t('seo.autoTopics.skippedLowVolume')}</span>
              <span style={styles.statValue}>{runResult.skipped?.lowVolume ?? 0}</span>
            </div>
          </div>

          {runResult.topics && runResult.topics.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('seo.autoTopics.thKeyword')}</th>
                    <th>{t('seo.autoTopics.thSeed')}</th>
                    <th>{t('seo.autoTopics.thVolumeKd')}</th>
                    <th>{t('seo.autoTopics.thPotential')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runResult.topics.map((tItem, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{tItem.keyword}</td>
                      <td><span style={styles.sub}>{tItem.seed}</span></td>
                      <td>
                        {tItem.searchVolume ? formatNumber(Number(tItem.searchVolume), lang) : '–'}{' '}
                        <span style={styles.sub}>{`/ KD ${tItem.difficulty ?? '–'}`}</span>
                      </td>
                      <td>
                        {tItem.trafficPotential ? formatNumber(Number(tItem.trafficPotential), lang) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t('seo.autoTopics.emptyResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  alert: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.25rem' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem',
    marginBottom: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.85rem'
  },
  noticeBox: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem',
    marginBottom: '1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.08)', color: '#6ee7b7', fontSize: '0.85rem'
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', padding: '0.25rem', borderRadius: '4px', display: 'flex', alignItems: 'center'
  },
  chipsContainer: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem',
    backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-muted)', borderRadius: '6px'
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem',
    padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(6, 182, 212, 0.1)',
    color: '#67e8f9', border: '1px solid rgba(6, 182, 212, 0.25)'
  },
  chipRemoveBtn: {
    background: 'transparent', border: 'none', color: '#67e8f9', cursor: 'pointer',
    padding: 0, display: 'flex', alignItems: 'center'
  },
  toggleCard: {
    padding: '1rem', borderRadius: '8px', backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--border-muted)'
  },
  statBox: {
    flex: '1 1 140px', padding: '0.75rem 1rem', borderRadius: '6px',
    backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-muted)',
    display: 'flex', flexDirection: 'column', gap: '0.2rem'
  },
  statLabel: { fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 },
  statValue: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' },
  sub: { fontSize: '0.75rem', color: 'var(--text-muted)' }
};
