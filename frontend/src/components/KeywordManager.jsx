import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play, Plus, Trash2, Eye, ExternalLink, Loader2, RefreshCw, Rocket,
  FileText, Lock, AlertTriangle, CheckCircle2, X, Link as LinkIcon, Globe,
  Image as ImageIcon, Sparkles, TrendingUp, Check, Edit2, Layers, ArrowUpRight, Coins
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatNumber, formatDate, formatDateTime } from '../lib/format';
import { api, GEO_OPTIONS, LN_OPTIONS, CMS_LABEL } from '../api';

const STATUS_BADGE = {
  'Pending': 'badge-secondary',
  'AI Writing...': 'badge-info',
  'Review Ready': 'badge-warning',
  'Draft Created': 'badge-info',
  'Published': 'badge-success',
  'Error': 'badge-danger',
  'Duplicate': 'badge-secondary',
  'Suggested': 'badge-primary',
};

// Helper: parse simple markdown blocks and inline links/images
function MarkdownRenderer({ content, images = [], imagePrompts = [] }) {
  const { t } = useLanguage();
  if (!content) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('seo.keywords.emptyContent')}</div>;

  const lines = content.split('\n');
  const elements = [];
  let currentList = null;

  const renderInline = (text) => {
    // Regex for markdown links [anchor](url) and image placeholders ![alt](markimate:image:N)
    const parts = [];
    let lastIndex = 0;
    const tokenRegex = /(!?\[([^\]]*)\]\(([^)]+)\))/g;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const isImg = match[1].startsWith('!');
      const altOrAnchor = match[2];
      const url = match[3];

      if (isImg && url.startsWith('markimate:image:')) {
        const idx = Number(url.replace('markimate:image:', ''));
        const uploadedImg = images.find(img => img.idx === idx);
        const promptObj = imagePrompts.find(p => p.idx === idx);

        if (uploadedImg && uploadedImg.url) {
          parts.push(
            <div key={`img-${idx}-${match.index}`} style={styles.renderedImgContainer}>
              <img src={uploadedImg.url} alt={altOrAnchor || 'AI Image'} style={styles.renderedImg} />
              <div style={styles.renderedImgCaption}>
                <span style={styles.badgeSuccessSmall}>{t('seo.keywords.uploadedToCms')}</span>
                <span>{altOrAnchor || promptObj?.alt || `Gambar ${idx}`}</span>
              </div>
            </div>
          );
        } else {
          parts.push(
            <div key={`ph-${idx}-${match.index}`} style={styles.placeholderCard}>
              <div style={styles.placeholderHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <ImageIcon size={15} color="var(--accent-cyan)" />
                  <span>{t('seo.keywords.imagePlaceholderInline', { idx })}</span>
                </div>
                <span style={styles.badgeMuted}>{t('seo.keywords.createdOnPublish')}</span>
              </div>
              <div style={styles.placeholderPrompt}><b>{'Alt:'}</b> {altOrAnchor || promptObj?.alt || '–'}</div>
              {promptObj?.prompt && <div style={styles.placeholderPrompt}><b>{'Prompt AI:'}</b> {promptObj.prompt}</div>}
            </div>
          );
        }
      } else if (!isImg) {
        // Link: check internal vs external
        const isExternal = /^https?:\/\//i.test(url);
        let domain = '';
        if (isExternal) {
          try { domain = new URL(url).hostname.replace('www.', ''); } catch (e) { domain = 'link luar'; }
        }

        parts.push(
          <a
            key={`lnk-${match.index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={isExternal ? styles.extLinkBadge : styles.intLinkBadge}
            title={url}
          >
            {isExternal ? <Globe size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> : <LinkIcon size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />}
            {' '}{altOrAnchor}
            {isExternal && domain && <span style={styles.domainSpan}>({domain})</span>}
          </a>
        );
      } else {
        // Normal markdown image
        parts.push(<img key={`img-std-${match.index}`} src={url} alt={altOrAnchor} style={styles.renderedImg} />);
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Check list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList) currentList = [];
      currentList.push(<li key={`li-${lineIdx}`} style={{ marginBottom: '0.25rem' }}>{renderInline(trimmed.slice(2))}</li>);
      return;
    } else if (currentList) {
      elements.push(<ul key={`ul-${lineIdx}`} style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>{currentList}</ul>);
      currentList = null;
    }

    if (!trimmed) {
      elements.push(<div key={`br-${lineIdx}`} style={{ height: '0.6rem' }} />);
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={`h1-${lineIdx}`} style={{ fontSize: '1.4rem', margin: '1rem 0 0.5rem', fontWeight: 700 }}>{renderInline(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={`h2-${lineIdx}`} style={{ fontSize: '1.2rem', margin: '1rem 0 0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={`h3-${lineIdx}`} style={{ fontSize: '1.05rem', margin: '0.75rem 0 0.3rem', fontWeight: 600 }}>{renderInline(trimmed.slice(4))}</h3>);
    } else {
      elements.push(<p key={`p-${lineIdx}`} style={{ margin: '0 0 0.6rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>{renderInline(trimmed)}</p>);
    }
  });

  if (currentList) {
    elements.push(<ul key="ul-last" style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>{currentList}</ul>);
  }

  return <div>{elements}</div>;
}

export default function KeywordManager({ me, refreshMe, goTo }) {
  const { lang, t } = useLanguage();
  const user = me.user;
  const isPremium = user.plan === 'premium' || (me.plan && me.plan.id !== 'free') || ['seo', 'focus3', 'all_in_one'].includes(user.plan);
  const webApprover = isPremium && user.webApprover !== false;
  const connectedCms = useMemo(() => (me.cms || []).filter(c => c.verified).map(c => c.cmsType), [me.cms]);
  const anyCms = useMemo(() => (me.cms || []).map(c => c.cmsType), [me.cms]);

  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState({}); // id -> 'run' | 'publish' | 'delete'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Review Ready' | 'draft_pub' | 'Suggested' | 'Duplicate' | 'Error'

  const [form, setForm] = useState({ keyword: '', geo: 'ID', ln: 'id', cms: anyCms[0] || 'wordpress', schedule: 'immediate' });
  const [drawer, setDrawer] = useState(null); // keyword object being reviewed
  const [drawerTab, setDrawerTab] = useState('preview'); // 'preview' | 'edit' | 'images'
  const [draft, setDraft] = useState(null);   // editable article copy
  const [imagesEnabled, setImagesEnabled] = useState(true);
  const [drawerBusy, setDrawerBusy] = useState('');
  const [drawerError, setDrawerError] = useState('');

  useEffect(() => {
    if (!anyCms.includes(form.cms) && anyCms[0]) setForm(f => ({ ...f, cms: anyCms[0] }));
  }, [anyCms]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/keywords');
      setKeywords(d.keywords || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upsertRow = (row) => setKeywords(list => list.some(k => k.id === row.id) ? list.map(k => k.id === row.id ? row : k) : [row, ...list]);
  const setBusyFor = (id, v) => setBusy(b => { const n = { ...b }; if (v) n[id] = v; else delete n[id]; return n; });
  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4500); };

  const runKeyword = async (id) => {
    setBusyFor(id, 'run'); setError('');
    setKeywords(list => list.map(k => k.id === id ? { ...k, status: 'AI Writing...', error: '' } : k));
    try {
      const d = await api(`/api/keywords/${id}/run`, { method: 'POST' });
      upsertRow(d.keyword); refreshMe();
      window.dispatchEvent(new Event('markimate:credits_updated'));
      window.dispatchEvent(new Event('supermat:credits_updated'));
      if (d.keyword.status === 'Review Ready') flash('Artikel siap ditinjau di Web Approver.');
      else if (d.keyword.status === 'Draft Created') flash('Draf berhasil dibuat di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '.');
      else if (d.keyword.status === 'Duplicate') flash('Topik mirip sudah ada di CMS (status Duplicate). Kuota tidak berkurang.');
      else if (d.keyword.error) setError(d.keyword.error);
    } catch (e) {
      setError(e.message); await load();
      if (e.status === 402 && goTo) setTimeout(() => goTo('billing/credits'), 1500);
    } finally { setBusyFor(id, null); }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!form.keyword.trim()) return;
    if (!anyCms.length) { setError('Hubungkan CMS dulu di menu Pengaturan CMS & API.'); return; }
    setError('');
    try {
      const d = await api('/api/keywords', {
        method: 'POST',
        body: { keyword: form.keyword.trim(), geo: form.geo, ln: form.ln, cmsType: form.cms, schedule: form.schedule }
      });
      upsertRow(d.keyword); setForm(f => ({ ...f, keyword: '' }));
      if (form.schedule === 'immediate') runKeyword(d.keyword.id);
      else flash('Keyword dijadwalkan. Artikel pertama dibuat otomatis sesuai jadwal.');
    } catch (err) { setError(err.message); if (err.status === 402 && goTo) setTimeout(() => goTo('billing/credits'), 1500); }
  };

  const deleteKeyword = async (id) => {
    if (!window.confirm('Hapus keyword ini dari Markimate? (Post di CMS tidak ikut terhapus)')) return;
    setBusyFor(id, 'delete');
    try {
      await api(`/api/keywords/${id}`, { method: 'DELETE' });
      setKeywords(l => l.filter(k => k.id !== id));
      if (drawer && drawer.id === id) closeDrawer();
    } catch (e) { setError(e.message); } finally { setBusyFor(id, null); }
  };

  const publishExisting = async (id, action) => {
    setBusyFor(id, 'publish'); setError('');
    try {
      const d = await api(`/api/keywords/${id}/publish`, { method: 'POST', body: { action } });
      upsertRow(d.keyword);
      window.dispatchEvent(new Event('markimate:credits_updated'));
      window.dispatchEvent(new Event('supermat:credits_updated'));
      flash(action === 'publish' ? 'Artikel diterbitkan.' : 'Draf dibuat di CMS.');
    } catch (e) { setError(e.message); } finally { setBusyFor(id, null); }
  };

  // ---- Drawer Web Approver ----
  const openDrawer = (kw) => {
    setDrawer(kw);
    setImagesEnabled(true);
    const art = kw.article || {};
    const prompts = Array.isArray(kw.imagePrompts || art.imagePrompts)
      ? JSON.parse(JSON.stringify(kw.imagePrompts || art.imagePrompts))
      : [];
    setDraft({
      title: art.title || '',
      slug: art.slug || '',
      excerpt: art.excerpt || '',
      bodyMarkdown: art.bodyMarkdown || '',
      imagePrompts: prompts,
    });
    setDrawerTab('preview');
    setDrawerError('');
  };

  const closeDrawer = () => { setDrawer(null); setDraft(null); setDrawerBusy(''); };

  const saveDraftLocally = async () => {
    if (!drawer || !draft) return;
    setDrawerBusy('save'); setDrawerError('');
    try {
      const res = await api(`/api/keywords/${drawer.id}`, {
        method: 'PATCH',
        body: { article: draft, imagePrompts: draft.imagePrompts }
      });
      upsertRow(res.keyword);
      setDrawer(res.keyword);
      flash('Perubahan draf berhasil disimpan.');
    } catch (e) { setDrawerError(e.message); } finally { setDrawerBusy(''); }
  };

  const submitDrawer = async (action) => {
    if (!drawer) return;
    setDrawerBusy(action); setDrawerError('');
    try {
      const articleToPublish = imagesEnabled ? draft : { ...draft, imagePrompts: [] };
      const d = await api(`/api/keywords/${drawer.id}/publish`, {
        method: 'POST',
        body: { action, article: articleToPublish }
      });
      upsertRow(d.keyword); closeDrawer();
      window.dispatchEvent(new Event('markimate:credits_updated'));
      window.dispatchEvent(new Event('supermat:credits_updated'));
      flash(action === 'publish'
        ? 'Artikel berhasil diterbitkan di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '.'
        : 'Draf tersimpan di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '. Cek di CMS tujuan.');
    } catch (e) { setDrawerError(e.message); setDrawerBusy(''); }
  };

  const regenerate = async () => {
    if (!drawer) return;
    const id = drawer.id; closeDrawer(); await runKeyword(id);
  };

  // Image editing helpers
  const updateImagePrompt = (idx, field, val) => {
    if (!draft) return;
    const next = [...(draft.imagePrompts || [])];
    const targetIdx = next.findIndex(p => p.idx === idx);
    if (targetIdx >= 0) {
      next[targetIdx] = { ...next[targetIdx], [field]: val };
      setDraft({ ...draft, imagePrompts: next });
    }
  };

  const removeInlineImage = (idx) => {
    if (!draft) return;
    const nextPrompts = (draft.imagePrompts || []).filter(p => p.idx !== idx);
    // Remove markimate:image:N from bodyMarkdown
    const re = new RegExp(`!\\[[^\\]]*\\]\\(markimate:image:${idx}\\)\\n*`, 'g');
    const nextBody = draft.bodyMarkdown.replace(re, '');
    setDraft({ ...draft, imagePrompts: nextPrompts, bodyMarkdown: nextBody });
  };

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    if (statusFilter === 'all') return keywords;
    if (statusFilter === 'draft_pub') return keywords.filter(k => k.status === 'Draft Created' || k.status === 'Published');
    return keywords.filter(k => k.status === statusFilter);
  }, [keywords, statusFilter]);

  const countBy = (st) => {
    if (st === 'all') return keywords.length;
    if (st === 'draft_pub') return keywords.filter(k => k.status === 'Draft Created' || k.status === 'Published').length;
    return keywords.filter(k => k.status === st).length;
  };

  const wordCount = draft ? draft.bodyMarkdown.split(/\s+/).filter(Boolean).length : 0;
  const currentLinks = drawer?.links || drawer?.article?.links || { internal: [], external: [] };
  const currentImages = drawer?.images || drawer?.article?.images || [];
  const currentWarnings = drawer?.warnings || drawer?.article?.warnings || [];
  const heroImageObj = currentImages.find(img => img.idx === 0);
  const heroPromptObj = (draft?.imagePrompts || []).find(p => p.idx === 0);

  return (
    <div>
      <header style={styles.header}>
        <h1>{t('seo.headerTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('seo.headerSubtitle')}
        </p>
      </header>

      {!anyCms.length && (
        <div className="card" style={{ ...styles.alert, borderColor: 'rgba(245,158,11,0.4)' }}>
          <AlertTriangle size={18} color="var(--accent-yellow)" />
          <div style={{ flex: 1 }}>{t('seo.noCmsAlert')}</div>
          <button className="btn btn-secondary" onClick={() => goTo && goTo('settings')}>{t('seo.openCmsSettings')}</button>
        </div>
      )}

      {!isPremium && (
        <div className="card" style={styles.alert}>
          <Lock size={16} color="var(--text-muted)" />
          <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('seo.freeQuotaAlert', { limit: me.usage?.limit || 3 })}
          </div>
          <button className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => goTo && goTo('billing')}>{t('seo.viewPlans')}</button>
        </div>
      )}

      {/* Form tambah keyword */}
      <form onSubmit={addKeyword} className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={styles.formRow}>
          <div className="form-group" style={{ flex: 2, minWidth: '220px', marginBottom: 0 }}>
            <label className="form-label">{t('seo.targetKeywordLabel')}</label>
            <input className="form-input" placeholder={t('seo.targetKeywordPlaceholder')} value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label className="form-label">{t('seo.countryLabel')}</label>
            <select className="form-select" value={form.geo} onChange={e => setForm({ ...form, geo: e.target.value })}>
              {GEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '160px', marginBottom: 0 }}>
            <label className="form-label">{t('seo.languageLabel')}</label>
            <select className="form-select" value={form.ln} onChange={e => setForm({ ...form, ln: e.target.value })}>
              {LN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '160px', marginBottom: 0 }}>
            <label className="form-label">{t('seo.targetCmsLabel')}</label>
            <select className="form-select" value={form.cms} onChange={e => setForm({ ...form, cms: e.target.value })} disabled={!anyCms.length}>
              {anyCms.length ? anyCms.map(c => <option key={c} value={c}>{CMS_LABEL[c] || c}{connectedCms.includes(c) ? '' : t('seo.keywords.cmsUnverified')}</option>) : <option>{t('seo.keywords.noCmsYet')}</option>}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '180px', marginBottom: 0 }}>
            <label className="form-label">{t('seo.scheduleLabel')} {isPremium ? '' : '🔒 Pro'}</label>
            <select className="form-select" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}>
              <option value="immediate">{t('seo.scheduleImmediate')}</option>
              <option value="daily" disabled={!isPremium}>{t('seo.scheduleDaily')}</option>
              <option value="weekly" disabled={!isPremium}>{t('seo.scheduleWeekly')}</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={styles.addBtn} disabled={!form.keyword.trim() || !anyCms.length}>
            <Plus size={16} /> {t('seo.addAndRunBtn')}
            <span style={styles.creditPill}><Coins size={12} /> {'≈ 60 cr'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div style={styles.errorBox}>
          <AlertTriangle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={styles.closeBtn}><X size={14} /></button>
        </div>
      )}
      {notice && <div style={styles.noticeBox}><CheckCircle2 size={16} /> {notice}</div>}

      {/* Filter Tabs & Header */}
      <div style={styles.filterBar}>
        <div style={styles.filterTabs}>
          {[
            { id: 'all', label: t('seo.tabAll') },
            { id: 'Review Ready', label: t('seo.tabReviewReady') },
            { id: 'draft_pub', label: t('seo.tabDraftPub') },
            { id: 'Suggested', label: t('seo.tabSuggested') },
            { id: 'Duplicate', label: t('seo.tabDuplicate') },
            { id: 'Error', label: t('seo.tabError') },
          ].map(tTab => (
            <button
              key={tTab.id}
              onClick={() => setStatusFilter(tTab.id)}
              style={statusFilter === tTab.id ? styles.activeFilterTab : styles.filterTab}
            >
              {tTab.label} <span style={styles.tabBadge}>{countBy(tTab.id)}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> {t('seo.reloadBtn')}
        </button>
      </div>

      {/* Tabel keyword */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('seo.thKeywordTitle')}</th>
                <th>{t('seo.thSource')}</th>
                <th>{t('seo.thTarget')}</th>
                <th>{t('seo.thVolumeKd')}</th>
                <th>{t('seo.thCms')}</th>
                <th>{t('seo.thStatus')}</th>
                <th>{t('seo.thAction')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !keywords.length && <tr><td colSpan={7} style={styles.emptyCell}>{t('seo.loadingKeywords')}</td></tr>}
              {!loading && !filteredKeywords.length && (
                <tr>
                  <td colSpan={7} style={styles.emptyCell}>
                    {keywords.length ? t('seo.emptyFiltered') : t('seo.emptyInitial')}
                  </td>
                </tr>
              )}
              {filteredKeywords.map(kw => {
                const b = busy[kw.id];
                const a = kw.article;
                const isAutoTrends = kw.source === 'auto_trends';
                const isSuggested = kw.status === 'Suggested';
                const isDuplicate = kw.status === 'Duplicate';

                return (
                  <tr key={kw.id}>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{kw.keyword}</span>
                      </div>
                      <div style={styles.sub}>
                        {kw.date}
                        {kw.schedule !== 'immediate' ? ` · ${kw.schedule === 'daily' ? t('seo.scheduleDailyTag') : t('seo.scheduleWeeklyTag')}` : ''}
                      </div>
                      {a?.title && (
                        <div style={{ ...styles.sub, color: 'var(--text-secondary)', marginTop: '0.2rem' }} title={a.title}>
                          “{a.title.length > 60 ? a.title.slice(0, 60) + '…' : a.title}”
                        </div>
                      )}
                      {/* Duplicate detail box */}
                      {isDuplicate && kw.duplicateOf && (
                        <div style={styles.dupInfoBox}>
                          <span style={{ color: 'var(--text-muted)' }}>{t('seo.dupSimilarTopic')}</span>{' '}
                          <b>{kw.duplicateOf.title}</b>{' '}
                          {kw.duplicateOf.similarity ? `(${Math.round(kw.duplicateOf.similarity * 100)}% ${t('seo.dupSimilarPercent')})` : ''}
                          {kw.duplicateOf.url && (
                            <a href={kw.duplicateOf.url} target="_blank" rel="noreferrer" style={{ marginLeft: '0.3rem', color: 'var(--accent-cyan)' }}>
                              <ExternalLink size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {isAutoTrends ? (
                        <span style={styles.sourceTrendsBadge} title={t('seo.keywords.trendsSourceTitle')}>
                          <TrendingUp size={12} /> Trends
                        </span>
                      ) : kw.source === 'api' ? (
                        <span style={styles.sourceBadge}>API</span>
                      ) : (
                        <span style={styles.sourceBadge}>Manual</span>
                      )}
                    </td>
                    <td><span style={styles.sub}>{kw.geo}{' · '}{kw.ln}</span></td>
                    <td>
                      {kw.volume ? (
                        <span>{formatNumber(kw.volume, lang)}<span style={styles.sub}>{' / KD '}{kw.difficulty ?? '–'}</span></span>
                      ) : <span style={styles.sub}>–</span>}
                    </td>
                    <td><span className="badge badge-secondary">{CMS_LABEL[kw.cms] || kw.cms}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[kw.status] || 'badge-secondary'}`}>
                        {kw.status === 'AI Writing...' && <Loader2 size={12} className="spin-icon" />}
                        {isDuplicate ? 'Duplicate' : isSuggested ? 'Suggested' : kw.status}
                      </span>
                      {kw.warnings?.length > 0 && (
                        <div style={{ ...styles.sub, color: 'var(--accent-yellow)', marginTop: '0.2rem' }} title={kw.warnings[0]}>
                          ⚠️ {kw.warnings[0].length > 40 ? kw.warnings[0].slice(0, 40) + '…' : kw.warnings[0]}
                        </div>
                      )}
                      {kw.error && !isDuplicate && (
                        <div style={{ ...styles.sub, color: 'var(--accent-red)', maxWidth: '240px' }} title={kw.error}>
                          {kw.error.length > 70 ? kw.error.slice(0, 70) + '…' : kw.error}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={styles.actionCell}>
                        {/* Suggested action buttons: Setujui vs Abaikan */}
                        {isSuggested && (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ ...styles.smallBtn, backgroundColor: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
                              disabled={!!b}
                              onClick={() => runKeyword(kw.id)}
                            >
                              {b === 'run' ? <Loader2 size={13} className="spin-icon" /> : <Check size={13} />} {t('seo.btnApprove')}
                              <span style={styles.creditPillLight}><Coins size={10} /> {'≈ 60 cr'}</span>
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ ...styles.smallBtn, color: 'var(--text-muted)' }}
                              disabled={!!b}
                              onClick={() => deleteKeyword(kw.id)}
                            >
                              <X size={13} /> {t('seo.btnDismiss')}
                            </button>
                          </>
                        )}

                        {/* Normal status actions */}
                        {(kw.status === 'Pending' || kw.status === 'Error' || isDuplicate) && (
                          <button className="btn btn-primary" style={styles.smallBtn} disabled={!!b} onClick={() => runKeyword(kw.id)}>
                            {b === 'run' ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />} {t('seo.btnRun')}
                            <span style={styles.creditPillLight}><Coins size={10} /> {'≈ 60 cr'}</span>
                          </button>
                        )}

                        {kw.status === 'Review Ready' && a && (
                          <button className="btn btn-secondary" style={{ ...styles.smallBtn, ...styles.reviewBtn }} onClick={() => openDrawer(kw)}>
                            <Eye size={14} /> {t('seo.btnReviewDraft')}
                          </button>
                        )}

                        {kw.status === 'Draft Created' && (
                          <>
                            {kw.draftUrl && (
                              <a className="btn btn-secondary" style={styles.smallBtn} href={kw.draftUrl} target="_blank" rel="noreferrer">
                                <ExternalLink size={14} /> {t('seo.btnCmsDraft')}
                              </a>
                            )}
                            <button className="btn btn-primary" style={styles.smallBtn} disabled={!!b} onClick={() => publishExisting(kw.id, 'publish')}>
                              {b === 'publish' ? <Loader2 size={14} className="spin-icon" /> : <Rocket size={14} />} {t('seo.btnPublish')}
                            </button>
                            {a && webApprover && (
                              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => openDrawer(kw)} title="Review / Edit">
                                <FileText size={14} />
                              </button>
                            )}
                          </>
                        )}

                        {kw.status === 'Published' && (
                          <>
                            {kw.publicUrl && (
                              <a className="btn btn-secondary" style={styles.smallBtn} href={kw.publicUrl} target="_blank" rel="noreferrer">
                                <ExternalLink size={14} /> {t('seo.btnView')}
                              </a>
                            )}
                            {a && webApprover && (
                              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => openDrawer(kw)} title="Review / Edit">
                                <Eye size={14} />
                              </button>
                            )}
                          </>
                        )}

                        {kw.status !== 'AI Writing...' && kw.status !== 'Pending' && !isSuggested && (
                          <button className="btn btn-secondary" style={styles.smallBtn} disabled={!!b} onClick={() => runKeyword(kw.id)} title={t('seo.keywords.rewriteArticle')}>
                            <RefreshCw size={13} />
                          </button>
                        )}
                        {!isSuggested && (
                          <button className="btn btn-secondary" style={{ ...styles.smallBtn, color: 'var(--accent-red)' }} disabled={!!b} onClick={() => deleteKeyword(kw.id)} title={t('seo.deleteBtn')}>
                            <Trash2 size={13} />
                          </button>
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

      {/* Web Approver Drawer */}
      {drawer && draft && (
        <div style={styles.drawerOverlay} onClick={closeDrawer}>
          <div style={styles.drawer} onClick={e => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('seo.drawerTitle', { keyword: drawer.keyword })}</div>
                <div style={styles.sub}>
                  {t('seo.targetLabel')} {drawer.article?.primaryKeyword || drawer.keyword}{' · '}{drawer.geo}/{drawer.ln}{' · CMS '}{CMS_LABEL[drawer.cms] || drawer.cms}
                </div>
              </div>
              <button onClick={closeDrawer} style={styles.closeBtn}><X size={18} /></button>
            </div>

            {/* Warnings banner */}
            {currentWarnings.length > 0 && (
              <div style={styles.drawerWarnings}>
                <AlertTriangle size={16} color="var(--accent-yellow)" style={{ flexShrink: 0 }} />
                <div>
                  {currentWarnings.map((w, idx) => <div key={idx} style={{ fontSize: '0.8rem' }}>{w}</div>)}
                </div>
              </div>
            )}

            {/* Metrics overview */}
            <div style={styles.drawerMetricsBar}>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.volAhrefs')}</span>
                <span style={styles.metricValue}>{drawer.article?.searchVolume ? formatNumber(drawer.article.searchVolume, lang) : '–'}</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.keywordDiff')}</span>
                <span style={styles.metricValue}>{drawer.article?.difficulty ?? '–'}</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.internalLinks')}</span>
                <span style={styles.metricValue}>{currentLinks.internal?.length || 0}</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.externalLinks')}</span>
                <span style={styles.metricValue}>{currentLinks.external?.length || 0}</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.aiImages')}</span>
                <span style={styles.metricValue}>{draft.imagePrompts?.length || 0}</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>{t('seo.wordCount')}</span>
                <span style={styles.metricValue}>{formatNumber(wordCount, lang)}</span>
              </div>
            </div>

            {/* Drawer Sub-tabs */}
            <div style={styles.drawerSubTabs}>
              <button
                style={drawerTab === 'preview' ? styles.activeDrawerSubTab : styles.drawerSubTab}
                onClick={() => setDrawerTab('preview')}
              >
                <Eye size={15} /> {t('seo.drawerTabPreview')}
              </button>
              <button
                style={drawerTab === 'edit' ? styles.activeDrawerSubTab : styles.drawerSubTab}
                onClick={() => setDrawerTab('edit')}
              >
                <Edit2 size={15} /> {t('seo.drawerTabEdit')}
              </button>
              <button
                style={drawerTab === 'images' ? styles.activeDrawerSubTab : styles.drawerSubTab}
                onClick={() => setDrawerTab('images')}
              >
                <ImageIcon size={15} /> {t('seo.drawerTabImages', { count: draft.imagePrompts?.length || 0 })}
              </button>
            </div>

            <div style={styles.drawerBody}>
              {/* TAB 1: PREVIEW TAMPILAN ARTIKEL */}
              {drawerTab === 'preview' && (
                <div style={styles.previewContainer}>
                  {/* Hero image preview */}
                  {heroImageObj?.url ? (
                    <div style={{ marginBottom: '1.25rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-muted)' }}>
                      <img src={heroImageObj.url} alt={draft.title} style={{ width: '100%', maxHeight: '360px', objectFit: 'cover' }} />
                      <div style={styles.renderedImgCaption}>
                        <span style={styles.badgeSuccessSmall}>{t('seo.keywords.heroInCms')}</span>
                        <span>{heroPromptObj?.alt || draft.title}</span>
                      </div>
                    </div>
                  ) : heroPromptObj ? (
                    <div style={{ ...styles.placeholderCard, marginBottom: '1.25rem', borderColor: 'rgba(6, 182, 212, 0.4)' }}>
                      <div style={styles.placeholderHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                          <ImageIcon size={16} color="var(--accent-cyan)" />
                          <span>{t('seo.heroImageTitle')}</span>
                        </div>
                        <span style={styles.badgeMuted}>{t('seo.heroAutoNote')}</span>
                      </div>
                      <div style={styles.placeholderPrompt}><b>{'Alt:'}</b> {heroPromptObj.alt}</div>
                      <div style={styles.placeholderPrompt}><b>{'Prompt AI:'}</b> {heroPromptObj.prompt}</div>
                    </div>
                  ) : null}

                  {/* Title & Excerpt */}
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>{draft.title || t('seo.noTitlePlaceholder')}</h1>
                  {draft.excerpt && (
                    <div style={styles.previewExcerpt}>
                      <b>{'Meta Description:'}</b> {draft.excerpt}
                    </div>
                  )}

                  {/* Link summary badges */}
                  {(currentLinks.internal?.length > 0 || currentLinks.external?.length > 0) && (
                    <div style={styles.linksChipsRow}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('seo.detectedLinks')}</span>
                      {currentLinks.internal?.map((l, i) => (
                        <span key={`int-${i}`} style={styles.intChip} title={l.url}>
                          <LinkIcon size={11} /> {l.anchor}
                        </span>
                      ))}
                      {currentLinks.external?.map((l, i) => (
                        <span key={`ext-${i}`} style={styles.extChip} title={l.url}>
                          <Globe size={11} /> {l.anchor} {l.domain ? `(${l.domain})` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Markdown Body */}
                  <div style={styles.articleBodyCard}>
                    <MarkdownRenderer
                      content={draft.bodyMarkdown}
                      images={currentImages}
                      imagePrompts={draft.imagePrompts || []}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT METADATA & MARKDOWN */}
              {drawerTab === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('seo.articleTitle')}</label>
                    <input className="form-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('seo.slugUrl')}</label>
                    <input className="form-input" value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('seo.metaDescription')}</label>
                    <textarea className="form-input" rows={2} value={draft.excerpt} onChange={e => setDraft({ ...draft, excerpt: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>{t('seo.articleBodyMarkdown')}</label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{'Placeholder: '}<code>{'![alt](markimate:image:1)'}</code></span>
                    </div>
                    <textarea
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', minHeight: '360px', lineHeight: 1.6 }}
                      value={draft.bodyMarkdown}
                      onChange={e => setDraft({ ...draft, bodyMarkdown: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: GAMBAR AI */}
              {drawerTab === 'images' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Coins size={16} color="var(--accent-cyan)" />
                        {t('seo.imageCost', {
                          detail: imagesEnabled
                            ? t('seo.keywords.imageCostActive', { count: draft.imagePrompts?.length || 0, cost: (draft.imagePrompts?.length || 0) * 5 })
                            : t('seo.keywords.imageCostDisabled')
                        })}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {imagesEnabled
                          ? t('seo.keywords.imageDescActive')
                          : t('seo.keywords.imageDescDisabled')}
                      </div>
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={imagesEnabled}
                        onChange={e => setImagesEnabled(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                      />
                      {t('seo.includeAiImages')}
                    </label>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('seo.keywords.imagePromptsNotice')}
                  </div>

                  {(!draft.imagePrompts || !draft.imagePrompts.length) ? (
                    <div style={styles.emptyCell}>{t('seo.promptEmpty')}</div>
                  ) : (
                    draft.imagePrompts.map((img) => {
                      const isHero = img.idx === 0;
                      const uploadedImg = currentImages.find(i => i.idx === img.idx);

                      return (
                        <div key={img.idx} className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-base)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ImageIcon size={16} color="var(--accent-cyan)" />
                              <span style={{ fontWeight: 600 }}>
                                {isHero
                                  ? t('seo.keywords.imgHeroBanner')
                                  : t('seo.keywords.imgInline', { idx: img.idx })}
                              </span>
                              <span style={styles.badgeMuted}>{img.aspect || (isHero ? '16:9' : '4:3')}</span>
                              {uploadedImg?.url && <span style={styles.badgeSuccessSmall}>{t('seo.keywords.uploadedBadge')}</span>}
                            </div>
                            {!isHero && (
                              <button
                                className="btn btn-secondary"
                                style={{ ...styles.smallBtn, color: 'var(--accent-red)' }}
                                onClick={() => removeInlineImage(img.idx)}
                                title={t('seo.deleteBtn')}
                              >
                                <Trash2 size={13} /> {t('seo.deleteBtn')}
                              </button>
                            )}
                          </div>

                          {uploadedImg?.url && (
                            <div style={{ marginBottom: '0.75rem', borderRadius: '6px', overflow: 'hidden' }}>
                              <img src={uploadedImg.url} alt={img.alt} style={{ maxHeight: '180px', width: '100%', objectFit: 'cover' }} />
                            </div>
                          )}

                          <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('seo.altText')}</label>
                            <input
                              className="form-input"
                              value={img.alt || ''}
                              onChange={e => updateImagePrompt(img.idx, 'alt', e.target.value)}
                              placeholder="SEO image description..."
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('seo.aiPromptVisual')}</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              value={img.prompt || ''}
                              onChange={e => updateImagePrompt(img.idx, 'prompt', e.target.value)}
                              placeholder="Prompt visual detail..."
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {drawerError && (
                <div style={styles.errorBox}>
                  <AlertTriangle size={16} /> {drawerError}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div style={styles.drawerFooter}>
              <button className="btn btn-secondary" onClick={regenerate} disabled={!!drawerBusy} title={t('seo.keywords.regenerateFullTitle')}>
                <RefreshCw size={15} /> {t('seo.drawerBtnRegenerate')}
              </button>
              <button className="btn btn-secondary" onClick={saveDraftLocally} disabled={!!drawerBusy} title={t('seo.keywords.saveDraftChangesTitle')}>
                {drawerBusy === 'save' ? <Loader2 size={15} className="spin-icon" /> : <Check size={15} />} {t('seo.drawerBtnSaveDraft')}
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => submitDrawer('draft')} disabled={!!drawerBusy}>
                {drawerBusy === 'draft' ? <Loader2 size={15} className="spin-icon" /> : <FileText size={15} />} {t('seo.drawerBtnSaveCms')}
              </button>
              <button className="btn btn-primary" onClick={() => submitDrawer('publish')} disabled={!!drawerBusy || !draft.title.trim()}>
                {drawerBusy === 'publish' ? <Loader2 size={15} className="spin-icon" /> : <Rocket size={15} />} {t('seo.drawerBtnPublish', { cms: CMS_LABEL[drawer.cms] || drawer.cms })}
                <span style={styles.creditPillLight}>
                  <Coins size={12} /> {imagesEnabled && draft.imagePrompts?.length ? `≈ ${draft.imagePrompts.length * 5} cr` : '0 cr'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { marginBottom: '1.5rem' },
  alert: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.25rem', marginBottom: '1rem' },
  formRow: { display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' },
  addBtn: { padding: '0.625rem 1.25rem', height: '40px', alignSelf: 'flex-end', gap: '0.4rem' },
  filterBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' },
  filterTabs: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  filterTab: {
    padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)', borderRadius: '6px', color: 'var(--text-secondary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
  },
  activeFilterTab: {
    padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-surface-hover)',
    border: '1px solid var(--border-active)', borderRadius: '6px', color: 'var(--text-primary)',
    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
  },
  tabBadge: {
    backgroundColor: 'var(--bg-base)', padding: '0.1rem 0.4rem', borderRadius: '4px',
    fontSize: '0.7rem', color: 'var(--text-muted)'
  },
  emptyCell: { textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' },
  sub: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  actionCell: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  smallBtn: { padding: '0.375rem 0.7rem', fontSize: '0.75rem', gap: '0.3rem' },
  reviewBtn: { color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)', backgroundColor: 'var(--accent-cyan-glow)' },
  sourceBadge: {
    display: 'inline-block', fontSize: '0.7rem', padding: '0.15rem 0.5rem',
    borderRadius: '4px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-muted)', color: 'var(--text-secondary)'
  },
  sourceTrendsBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', padding: '0.15rem 0.5rem',
    borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd'
  },
  dupInfoBox: {
    marginTop: '0.35rem', padding: '0.3rem 0.6rem', borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-muted)',
    fontSize: '0.73rem', color: 'var(--text-secondary)'
  },
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
  drawerOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999
  },
  drawer: {
    width: '840px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
  },
  drawerHeader: {
    padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border-muted)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
  },
  drawerWarnings: {
    padding: '0.75rem 1.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottom: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fcd34d'
  },
  drawerMetricsBar: {
    padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-muted)',
    display: 'flex', gap: '0.5rem', overflowX: 'auto', backgroundColor: 'var(--bg-base)'
  },
  metricCard: {
    flex: '1 1 auto', minWidth: '95px', background: 'var(--bg-surface)',
    border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '0.5rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.2rem'
  },
  metricLabel: { fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 },
  metricValue: { fontSize: '0.95rem', fontWeight: 700 },
  drawerSubTabs: {
    display: 'flex', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--bg-surface)'
  },
  drawerSubTab: {
    flex: 1, padding: '0.75rem 1rem', background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent', color: 'var(--text-secondary)',
    fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
  },
  activeDrawerSubTab: {
    flex: 1, padding: '0.75rem 1rem', background: 'transparent', border: 'none',
    borderBottom: '2px solid var(--accent-cyan)', color: 'var(--accent-cyan)',
    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
  },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  previewContainer: { display: 'flex', flexDirection: 'column' },
  previewExcerpt: {
    padding: '0.75rem 1rem', borderRadius: '6px', backgroundColor: 'var(--bg-base)',
    borderLeft: '3px solid var(--accent-cyan)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem'
  },
  linksChipsRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center',
    marginBottom: '1rem', padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-base)', borderRadius: '6px'
  },
  intChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem',
    padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(6, 182, 212, 0.1)',
    color: '#67e8f9', border: '1px solid rgba(6, 182, 212, 0.25)'
  },
  extChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem',
    padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.25)'
  },
  articleBodyCard: {
    backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-muted)',
    borderRadius: '8px', padding: '1.5rem', fontSize: '0.92rem', lineHeight: 1.7
  },
  renderedImgContainer: { margin: '1.25rem 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-muted)' },
  renderedImg: { width: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' },
  renderedImgCaption: {
    padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-surface)', fontSize: '0.75rem',
    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem'
  },
  placeholderCard: {
    margin: '1.25rem 0', padding: '1rem', borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px dashed rgba(6, 182, 212, 0.35)'
  },
  placeholderHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem'
  },
  placeholderPrompt: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 },
  badgeMuted: {
    fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px',
    backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-muted)'
  },
  badgeSuccessSmall: {
    fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)'
  },
  intLinkBadge: {
    color: 'var(--accent-cyan)', textDecoration: 'none', borderBottom: '1px dotted var(--accent-cyan)',
    padding: '0 0.15rem'
  },
  extLinkBadge: {
    color: 'var(--accent-blue)', textDecoration: 'none', borderBottom: '1px dotted var(--accent-blue)',
    padding: '0 0.15rem'
  },
  domainSpan: { fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.2rem' },
  drawerFooter: {
    padding: '1.1rem 1.5rem', borderTop: '1px solid var(--border-muted)',
    display: 'flex', gap: '0.6rem', backgroundColor: 'var(--bg-base)', flexWrap: 'wrap'
  },
  creditPill: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '0.15rem 0.45rem',
    borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, marginLeft: '0.35rem'
  },
  creditPillLight: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    backgroundColor: 'rgba(255, 255, 255, 0.22)', padding: '0.12rem 0.4rem',
    borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, marginLeft: '0.25rem'
  },
};
