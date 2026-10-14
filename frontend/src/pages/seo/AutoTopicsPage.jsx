import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Play, Plus, X, Calendar, Clock, AlertTriangle,
  CheckCircle2, Loader2, Sparkles, Lock, RefreshCw, Layers, ArrowRight, Check
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime, formatNumber } from '../../lib/format';
import { api, GEO_OPTIONS, LN_OPTIONS, CMS_LABEL } from '../../api';

const getWeekdays = (lang = 'id') => [
  { value: 0, label: lang.startsWith('en') ? 'Sunday' : 'Minggu' },
  { value: 1, label: lang.startsWith('en') ? 'Monday' : 'Senin' },
  { value: 2, label: lang.startsWith('en') ? 'Tuesday' : 'Selasa' },
  { value: 3, label: lang.startsWith('en') ? 'Wednesday' : 'Rabu' },
  { value: 4, label: lang.startsWith('en') ? 'Thursday' : 'Kamis' },
  { value: 5, label: lang.startsWith('en') ? 'Friday' : 'Jumat' },
  { value: 6, label: lang.startsWith('en') ? 'Saturday' : 'Sabtu' },
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

  const weekdays = useMemo(() => getWeekdays(lang), [lang]);

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
      setError(lang.startsWith('id') ? 'Masukkan minimal 1 seed keyword untuk riset Google Trends.' : 'Enter at least 1 seed keyword for Google Trends research.');
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
      setNotice(lang.startsWith('id') ? 'Pengaturan topik otomatis berhasil disimpan.' : 'Autonomous topics settings saved successfully.');
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (!isPremium) {
      setError(lang.startsWith('id') ? 'Topik otomatis dengan Google Trends hanya untuk paket Pro.' : 'Autonomous topics with Google Trends is only available on Pro plans.');
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
        lang.startsWith('id')
          ? `Berhasil menemukan ${res.topics?.length || 0} topik baru dari Google Trends!`
          : `Successfully discovered ${res.topics?.length || 0} new trending topics from Google Trends!`
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
            {lang.startsWith('id') ? 'Topik Otomatis (Google Trends)' : 'Autonomous Topics (Google Trends)'}
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          {lang.startsWith('id')
            ? 'Markimate memantau lonjakan tren pencarian Google secara berkala berdasarkan kata kunci fokus Anda, menyaring topik yang mirip dengan artikel lama di CMS, lalu menyiapkannya sebagai draf artikel siap review.'
            : 'Markimate monitors real-time Google search trends based on your focus seed keywords, deduplicates against published CMS posts, and stages them as review-ready article drafts.'}
        </p>
      </header>

      {!isPremium && (
        <div className="card" style={{ ...styles.alert, marginBottom: '1.5rem', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <Lock size={18} color="var(--accent-yellow)" />
          <div style={{ flex: 1, fontSize: '0.88rem' }}>
            {lang.startsWith('id') ? (
              <>Fitur <b>Topik Otomatis</b> hanya aktif pada paket <b>Pro</b>. Sistem akan menjalankan cron mingguan di server untuk menemukan topik baru dan mengisi backlog artikel secara otomatis.</>
            ) : (
              <>The <b>Autonomous Topics</b> feature is active on <b>Pro</b> plans. The server executes a weekly background cron to surface trending topics and queue rank-ready articles.</>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => goTo && goTo('billing')}>
            {lang.startsWith('id') ? 'Upgrade ke Pro' : 'Upgrade to Pro'}
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
              {lang.startsWith('id') ? 'Konfigurasi Riset Tren' : 'Trend Research Configuration'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {lang.startsWith('id') ? 'Tentukan fokus topik dan waktu eksekusi otomatis' : 'Specify focus seed keywords and autonomous scheduling'}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              disabled={!isPremium}
            />
            <span>{active ? (lang.startsWith('id') ? 'Jadwal Aktif' : 'Schedule Active') : (lang.startsWith('id') ? 'Jadwal Dijeda' : 'Schedule Paused')}</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Seed Keywords Chips */}
          <div>
            <label className="form-label">
              {lang.startsWith('id') ? 'Seed Keywords (Fokus Topik / Niche)' : 'Seed Keywords (Topic Focus / Niche)'}
            </label>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {lang.startsWith('id')
                ? 'Masukkan kata kunci inti produk/bisnis Anda. Google Trends akan mencari query naik daun (rising queries) yang relevan dengan topik ini.'
                : 'Enter core keywords for your business/product. Google Trends will discover high-velocity rising search queries matching these topics.'}
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
                placeholder={lang.startsWith('id') ? 'contoh: kopi arabika, kafe aesthetic...' : 'e.g. coffee beans, specialty cafe...'}
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '0 0.9rem' }}>
                <Plus size={15} /> {lang.startsWith('id') ? 'Tambah Seed' : 'Add Seed'}
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Target CMS */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'CMS Tujuan' : 'Target CMS'}</label>
              <select className="form-select" value={cmsType} onChange={e => setCmsType(e.target.value)}>
                {anyCms.map(c => <option key={c} value={c}>{CMS_LABEL[c] || c}</option>)}
              </select>
            </div>

            {/* Negara & Bahasa */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'Target Negara' : 'Target Region'}</label>
              <select className="form-select" value={geo} onChange={e => setGeo(e.target.value)}>
                {GEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'Bahasa Riset' : 'Research Language'}</label>
              <select className="form-select" value={ln} onChange={e => setLn(e.target.value)}>
                {LN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Hari & Jam Mingguan */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'Hari Eksekusi Mingguan' : 'Weekly Execution Day'}</label>
              <select className="form-select" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
                {weekdays.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'Jam Eksekusi (WIB / GMT+7)' : 'Execution Hour (WIB / GMT+7)'}</label>
              <select className="form-select" value={hour} onChange={e => setHour(Number(e.target.value))}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00 WIB</option>
                ))}
              </select>
            </div>

            {/* Topics per run */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{lang.startsWith('id') ? 'Topik per Run (Maksimal)' : 'Topics per Run (Max)'}</label>
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
              <label className="form-label">{lang.startsWith('id') ? 'Volume Pencarian Minimum' : 'Minimum Search Volume'}</label>
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
                  {lang.startsWith('id') ? 'Langsung tulis artikel & buat draf (Auto-generate)' : 'Directly generate articles & create drafts (Auto-generate)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {lang.startsWith('id') ? (
                    <>Jika dimatikan, topik akan masuk ke daftar <b>Suggested</b> di Kontrol Automasi agar Anda bisa menyetujui atau mengabaikannya terlebih dahulu.</>
                  ) : (
                    <>When disabled, trending topics appear in the <b>Suggested</b> queue for manual approval before AI writing begins.</>
                  )}
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
              {lang.startsWith('id') ? 'Simpan Pengaturan' : 'Save Settings'}
            </button>
            <button
              className="btn btn-primary"
              onClick={runNow}
              disabled={running || !isPremium}
            >
              {running ? <Loader2 size={15} className="spin-icon" /> : <Play size={15} />}
              {lang.startsWith('id') ? 'Jalankan Sekarang' : 'Run Now'}
            </button>
            {source && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {source.last_run_at && (
                  <span>
                    {lang.startsWith('id') ? 'Terakhir jalan:' : 'Last run:'}{' '}
                    {formatDateTime(source.last_run_at, lang)}
                  </span>
                )}
                {source.next_run_at && (
                  <span>
                    · {lang.startsWith('id') ? 'Jadwal berikutnya:' : 'Next scheduled:'}{' '}
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
                {lang.startsWith('id') ? 'Hasil Riset Tren Google' : 'Google Trends Research Results'}
              </h2>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              onClick={() => goTo && goTo('keywords')}
            >
              {lang.startsWith('id') ? 'Buka Kontrol Automasi' : 'Open Automation Control'}{' '}
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{lang.startsWith('id') ? 'Topik Baru' : 'New Topics'}</span>
              <span style={styles.statValue}>{runResult.topics?.length || 0}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{lang.startsWith('id') ? 'Dilewati (Duplikat)' : 'Skipped (Duplicate)'}</span>
              <span style={styles.statValue}>{runResult.skipped?.duplicate ?? 0}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>{lang.startsWith('id') ? 'Dilewati (Volume Rendah)' : 'Skipped (Low Volume)'}</span>
              <span style={styles.statValue}>{runResult.skipped?.lowVolume ?? 0}</span>
            </div>
          </div>

          {runResult.topics && runResult.topics.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang.startsWith('id') ? 'Keyword Rekomendasi' : 'Recommended Keyword'}</th>
                    <th>{lang.startsWith('id') ? 'Seed Induk' : 'Seed Topic'}</th>
                    <th>{lang.startsWith('id') ? 'Volume / KD' : 'Volume / KD'}</th>
                    <th>{lang.startsWith('id') ? 'Potensi Traffic' : 'Traffic Potential'}</th>
                  </tr>
                </thead>
                <tbody>
                  {runResult.topics.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{t.keyword}</td>
                      <td><span style={styles.sub}>{t.seed}</span></td>
                      <td>
                        {t.searchVolume ? formatNumber(Number(t.searchVolume), lang) : '–'}{' '}
                        <span style={styles.sub}>/ KD {t.difficulty ?? '–'}</span>
                      </td>
                      <td>
                        {t.trafficPotential ? formatNumber(Number(t.trafficPotential), lang) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {lang.startsWith('id')
                ? 'Tidak ada topik baru yang lolos filter (semua topik sudah ada di CMS atau volume di bawah batas minimum).'
                : 'No new topics passed filtering (all queries already published to CMS or below volume threshold).'}
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
