import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play, Plus, Trash2, Eye, ExternalLink, Loader2, RefreshCw, Rocket,
  FileText, AlertTriangle, CheckCircle2, X, Link as LinkIcon, Globe,
  Image as ImageIcon, Sparkles, TrendingUp, Check, Edit2, Layers, ArrowUpRight, Coins,
  ChevronDown, ChevronUp, ArrowUp, ArrowDown
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatNumber, formatDate, formatDateTime } from '../lib/format';
import { api, GEO_OPTIONS, LN_OPTIONS, CMS_LABEL } from '../api';
import {
  TONE_PRESETS,
  ARTICLE_LENGTHS,
  IMAGE_MODES,
  estimateArticleCredits,
  sanitizeCustomTone,
  DEFAULT_ARTICLE_OPTIONS
} from '../config/article-options';

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

const DEFAULT_IMAGE_MIME = 'image/png';

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
              <img src={uploadedImg.url} alt={altOrAnchor || t('seo.defaultAiImage')} style={styles.renderedImg} />
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
              <div style={styles.placeholderPrompt}><b>{t('seo.altPrefix')}</b> {altOrAnchor || promptObj?.alt || '–'}</div>
              {promptObj?.prompt && <div style={styles.placeholderPrompt}><b>{t('seo.promptAiPrefix')}</b> {promptObj.prompt}</div>}
            </div>
          );
        }
      } else if (!isImg) {
        // Link: check internal vs external
        const isExternal = /^https?:\/\//i.test(url);
        let domain = '';
        if (isExternal) {
          try { domain = new URL(url).hostname.replace('www.', ''); } catch (e) { domain = t('seo.keywords.externalLinkDomainFallback'); }
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
  const webApprover = user.webApprover !== false;
  const connectedCms = useMemo(() => (me.cms || []).filter(c => c.verified).map(c => c.cmsType), [me.cms]);
  const anyCms = useMemo(() => (me.cms || []).map(c => c.cmsType), [me.cms]);

  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState({}); // id -> 'run' | 'publish' | 'delete'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Review Ready' | 'draft_pub' | 'Suggested' | 'Duplicate' | 'Error'

  const [form, setForm] = useState({ keyword: '', geo: 'ID', ln: 'id', cms: anyCms[0] || 'wordpress', schedule: 'immediate' });
  const [showArticleOptions, setShowArticleOptions] = useState(false);
  const [keywordOptions, setKeywordOptions] = useState({
    tone: { preset: 'professional', custom: '' },
    length: 'standard',
    images: { mode: 'auto', count: 3, hero: true }
  });
  const [regenBusyIdx, setRegenBusyIdx] = useState(null);
  const isRegenEnabled = import.meta.env.VITE_SEO_IMAGE_REGEN_ENABLED !== 'false';
  const liveEstimate = useMemo(() => estimateArticleCredits(keywordOptions), [keywordOptions]);

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

  // Polling otomatis ketika ada keyword berstatus AI Writing...
  useEffect(() => {
    const hasWriting = keywords.some(k => k.status === 'AI Writing...');
    if (!hasWriting) return;
    const interval = setInterval(async () => {
      try {
        const d = await api('/api/keywords');
        if (d && Array.isArray(d.keywords)) {
          setKeywords(d.keywords);
          const stillWriting = d.keywords.some(k => k.status === 'AI Writing...');
          if (!stillWriting) {
            refreshMe();
            window.dispatchEvent(new Event('markimate:credits_updated'));
            window.dispatchEvent(new Event('supermat:credits_updated'));
          }
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [keywords, refreshMe]);

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
      if (d.keyword.status === 'Review Ready') flash(t('seo.keywords.flashReviewReady'));
      else if (d.keyword.status === 'Draft Created') flash(t('seo.keywords.flashDraftCreated', { cms: CMS_LABEL[d.keyword.cms] || d.keyword.cms }));
      else if (d.keyword.status === 'Duplicate') flash(t('seo.keywords.flashDuplicate'));
      else if (d.keyword.error) setError(d.keyword.error);
    } catch (e) {
      setError(e.message); await load();
      if (e.status === 402 && goTo) setTimeout(() => goTo('billing/credits'), 1500);
    } finally { setBusyFor(id, null); }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!form.keyword.trim()) return;
    if (!anyCms.length) { setError(t('seo.keywords.errConnectCmsFirst')); return; }
    setError('');
    try {
      if (showArticleOptions && keywordOptions.tone?.preset === 'custom') {
        sanitizeCustomTone(keywordOptions.tone?.custom);
      }
      const d = await api('/api/keywords', {
        method: 'POST',
        body: {
          keyword: form.keyword.trim(),
          geo: form.geo,
          ln: form.ln,
          cmsType: form.cms,
          schedule: form.schedule,
          articleOptions: showArticleOptions ? keywordOptions : null
        }
      });
      upsertRow(d.keyword); setForm(f => ({ ...f, keyword: '' }));
      if (form.schedule === 'immediate') runKeyword(d.keyword.id);
      else flash(t('seo.keywords.flashScheduled'));
    } catch (err) { setError(err.message); if (err.status === 402 && goTo) setTimeout(() => goTo('billing/credits'), 1500); }
  };

  const deleteKeyword = async (id) => {
    if (!window.confirm(t('seo.keywords.confirmDeleteKw'))) return;
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
      flash(action === 'publish' ? t('seo.keywords.flashPublished') : t('seo.keywords.flashDraftMade'));
    } catch (e) { setError(e.message); } finally { setBusyFor(id, null); }
  };

  // ---- Drawer Web Approver ----
  const openDrawer = (kw) => {
    setDrawer(kw);
    setImagesEnabled(true);
    const art = kw.article || {};
    const rawPrompts = Array.isArray(kw.imagePrompts || art.imagePrompts)
      ? JSON.parse(JSON.stringify(kw.imagePrompts || art.imagePrompts))
      : [];
    const prompts = rawPrompts.map((p, i) => ({
      ...p,
      placement: p.placement || (p.idx === 0 ? 'hero' : `h2:${p.idx || i}`)
    }));
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

  const closeDrawer = () => { setDrawer(null); setDraft(null); setDrawerBusy(''); setRegenBusyIdx(null); };

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
      flash(t('seo.keywords.flashDraftSaved'));
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
        ? t('seo.keywords.flashPublishSuccess', { cms: CMS_LABEL[d.keyword.cms] || d.keyword.cms })
        : t('seo.keywords.flashDraftSavedCms', { cms: CMS_LABEL[d.keyword.cms] || d.keyword.cms }));
    } catch (e) { setDrawerError(e.message); setDrawerBusy(''); }
  };

  const regenerate = async () => {
    if (!drawer) return;
    const id = drawer.id; closeDrawer(); await runKeyword(id);
  };

  // Image editing & contextual placement helpers (PRD F6b §3.3 & §3.4)
  const draftBodyMarkdown = draft?.bodyMarkdown;
  const h2Sections = useMemo(() => {
    if (!draftBodyMarkdown) return [];
    const lines = draftBodyMarkdown.split('\n');
    const sections = [];
    let h2Idx = 1;
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)$/);
      if (m) {
        sections.push({ index: h2Idx, title: m[1].trim() });
        h2Idx++;
      }
    }
    return sections;
  }, [draftBodyMarkdown]);

  const updateImagePrompt = (idx, field, val) => {
    if (!draft) return;
    const next = [...(draft.imagePrompts || [])];
    const targetIdx = next.findIndex(p => p.idx === idx);
    if (targetIdx >= 0) {
      next[targetIdx] = { ...next[targetIdx], [field]: val };
      setDraft({ ...draft, imagePrompts: next });
    }
  };

  const repositionImage = (imgIdx, targetPlacement) => {
    if (!draft) return;
    const nextPrompts = (draft.imagePrompts || []).map(p => {
      if (p.idx !== imgIdx) return p;
      let sectionTitle = p.sectionTitle;
      let aspect = p.aspect;
      if (targetPlacement === 'hero') {
        sectionTitle = 'Hero';
        aspect = '16:9';
      } else if (targetPlacement.startsWith('h2:')) {
        const secIdx = parseInt(targetPlacement.slice(3), 10);
        const sec = h2Sections.find(s => s.index === secIdx);
        sectionTitle = sec ? sec.title : p.sectionTitle;
        aspect = '4:3';
      }
      return { ...p, placement: targetPlacement, sectionTitle, aspect };
    });

    let body = draft.bodyMarkdown || '';
    const tagRegex = new RegExp(`\\n*!\\[[^\\]]*\\]\\(markimate:image:${imgIdx}\\)\\n*`, 'g');
    body = body.replace(tagRegex, '\n\n');

    const promptObj = nextPrompts.find(p => p.idx === imgIdx);
    const alt = promptObj?.alt || promptObj?.sectionTitle || 'Ilustrasi';
    const newTag = `![${alt}](markimate:image:${imgIdx})`;

    if (targetPlacement === 'hero') {
      body = `${newTag}\n\n${body.trim()}`;
    } else if (targetPlacement.startsWith('h2:')) {
      const secIdx = parseInt(targetPlacement.slice(3), 10);
      const lines = body.split('\n');
      const newLines = [];
      let currentH2 = 0;
      let inserted = false;

      for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);
        if (/^##\s+/.test(lines[i])) {
          currentH2++;
          if (currentH2 === secIdx && !inserted) {
            newLines.push('', newTag, '');
            inserted = true;
          }
        }
      }
      if (!inserted) {
        newLines.push('', newTag, '');
      }
      body = newLines.join('\n');
    }

    setDraft({ ...draft, imagePrompts: nextPrompts, bodyMarkdown: body });
  };

  const moveImageStep = (imgIdx, delta) => {
    const prompt = (draft.imagePrompts || []).find(p => p.idx === imgIdx);
    if (!prompt) return;
    const curPlacement = prompt.placement || (prompt.idx === 0 ? 'hero' : `h2:${prompt.idx}`);
    if (curPlacement === 'hero') {
      if (delta > 0 && h2Sections.length > 0) {
        repositionImage(imgIdx, 'h2:1');
      }
    } else if (curPlacement.startsWith('h2:')) {
      const curIdx = parseInt(curPlacement.slice(3), 10);
      const nextIdx = curIdx + delta;
      if (nextIdx <= 0) {
        repositionImage(imgIdx, 'hero');
      } else if (nextIdx <= h2Sections.length) {
        repositionImage(imgIdx, `h2:${nextIdx}`);
      }
    }
  };

  const removeInlineImage = (idx) => {
    if (!draft) return;
    if (idx === 0 && !window.confirm(t('seo.articleOptions.deleteImageConfirm'))) return;
    const nextPrompts = (draft.imagePrompts || []).filter(p => p.idx !== idx);
    const re = new RegExp(`!\\[[^\\]]*\\]\\(markimate:image:${idx}\\)\\n*`, 'g');
    const nextBody = draft.bodyMarkdown.replace(re, '');
    setDraft({ ...draft, imagePrompts: nextPrompts, bodyMarkdown: nextBody });
  };

  const regenerateImage = async (img) => {
    if (!drawer) return;
    setRegenBusyIdx(img.idx);
    setDrawerError('');
    try {
      let snippet = '';
      if (draft?.bodyMarkdown && img.placement && img.placement.startsWith('h2:')) {
        const h2Index = parseInt(img.placement.slice(3), 10);
        const parts = draft.bodyMarkdown.split(/^##\s+/m);
        if (parts[h2Index]) {
          snippet = parts[h2Index].replace(/^[^\n]+\n/, '').slice(0, 300);
        }
      }

      const res = await api(`/api/keywords/${drawer.id}/images/${img.idx}/regenerate`, {
        method: 'POST',
        body: {
          sectionTitle: img.sectionTitle || '',
          sectionText: snippet,
          style: img.style || drawer.article_options?.images?.style || 'foto editorial, warna hangat, tanpa teks di gambar',
          aspect: img.aspect || (img.idx === 0 ? '16:9' : '4:3'),
          alt: img.alt || img.sectionTitle || drawer.keyword
        }
      });

      upsertRow(res.keyword);
      setDrawer(res.keyword);
      window.dispatchEvent(new Event('markimate:credits_updated'));
      window.dispatchEvent(new Event('supermat:credits_updated'));
      flash(t('seo.articleOptions.regenerateImageSuccess'));
    } catch (err) {
      setDrawerError(err.message);
    } finally {
      setRegenBusyIdx(null);
    }
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

  const filterTabs = useMemo(() => [
    { id: 'all', label: t('seo.tabAll') },
    { id: 'Review Ready', label: t('seo.tabReviewReady') },
    { id: 'draft_pub', label: t('seo.tabDraftPub') },
    { id: 'Suggested', label: t('seo.tabSuggested') },
    { id: 'Duplicate', label: t('seo.tabDuplicate') },
    { id: 'Error', label: t('seo.tabError') },
  ], [t]);

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
            <label className="form-label">{t('seo.scheduleLabel')}</label>
            <select className="form-select" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}>
              <option value="immediate">{t('seo.scheduleImmediate')}</option>
              <option value="daily">{t('seo.scheduleDaily')}</option>
              <option value="weekly">{t('seo.scheduleWeekly')}</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={styles.addBtn} disabled={!form.keyword.trim() || !anyCms.length}>
            <Plus size={16} /> {t('seo.addAndRunBtn')}
            <span style={styles.creditPill}><Coins size={12} /> {t('seo.approxCredits', { amount: liveEstimate.totalCredits })}</span>
          </button>
        </div>

        {/* Accordion Opsi Artikel & Live Estimate (PRD F6b) */}
        <div className="article-options-card">
          <button
            type="button"
            className={`article-options-toggle ${showArticleOptions ? 'open' : ''}`}
            onClick={() => setShowArticleOptions(!showArticleOptions)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Layers size={16} color="var(--accent-cyan)" />
              <span>{t('seo.articleOptions.accordionToggle')}</span>
              <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 500 }}>
                {t(`seo.articleOptions.${ARTICLE_LENGTHS[keywordOptions.length]?.labelKey || 'lengthStandard'}`)} • {keywordOptions.images.mode === 'none' ? t('seo.articleOptions.imageModeNone') : t('seo.articleOptions.imagesCount', { count: keywordOptions.images.count })}
              </span>
            </div>
            {showArticleOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showArticleOptions && (
            <div className="article-options-body">
              <div className="article-options-grid">
                {/* Tone */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.articleOptions.toneLabel')}</label>
                  <select
                    className="form-select"
                    value={keywordOptions.tone.preset}
                    onChange={e => setKeywordOptions(k => ({ ...k, tone: { ...k.tone, preset: e.target.value } }))}
                  >
                    <option value="professional">{t('seo.articleOptions.toneProfessional')}</option>
                    <option value="casual">{t('seo.articleOptions.toneCasual')}</option>
                    <option value="educational">{t('seo.articleOptions.toneEducational')}</option>
                    <option value="persuasive">{t('seo.articleOptions.tonePersuasive')}</option>
                    <option value="storytelling">{t('seo.articleOptions.toneStorytelling')}</option>
                    <option value="custom">{t('seo.articleOptions.toneCustom')}</option>
                  </select>
                  {keywordOptions.tone.preset === 'custom' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        className="form-input"
                        maxLength={120}
                        value={keywordOptions.tone.custom}
                        onChange={e => setKeywordOptions(k => ({ ...k, tone: { ...k.tone, custom: e.target.value } }))}
                        placeholder={t('seo.articleOptions.customTonePlaceholder')}
                      />
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {t('seo.articleOptions.customToneHint')} {`(${keywordOptions.tone.custom.length}/120)`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Panjang Artikel */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.articleOptions.lengthLabel')}</label>
                  <div className="article-options-pill-group">
                    {Object.values(ARTICLE_LENGTHS).map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className={`article-options-pill ${keywordOptions.length === l.id ? 'active' : ''}`}
                        onClick={() => setKeywordOptions(k => ({ ...k, length: l.id }))}
                      >
                        {t(`seo.articleOptions.${l.labelKey}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Gambar & Jumlah */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.articleOptions.imageModeLabel')}</label>
                  <div className="article-options-pill-group">
                    {Object.values(IMAGE_MODES).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className={`article-options-pill ${keywordOptions.images.mode === m.id ? 'active' : ''}`}
                        onClick={() => setKeywordOptions(k => ({ ...k, images: { ...k.images, mode: m.id } }))}
                      >
                        {t(`seo.articleOptions.${m.labelKey}`)}
                      </button>
                    ))}
                  </div>

                  {keywordOptions.images.mode !== 'none' && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('seo.articleOptions.imageCountLabel')}:</span>
                        <div className="article-options-pill-group">
                          {[1, 2, 3, 4, 5, 6].map(c => (
                            <button
                              key={c}
                              type="button"
                              className={`article-options-pill ${keywordOptions.images.count === c ? 'active' : ''}`}
                              onClick={() => setKeywordOptions(k => ({ ...k, images: { ...k.images, count: c } }))}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={keywordOptions.images.hero}
                          onChange={e => setKeywordOptions(k => ({ ...k, images: { ...k.images, hero: e.target.checked } }))}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                        />
                        {t('seo.articleOptions.heroImageLabel')}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Credit Estimate Bar */}
              <div className="article-options-live-bar">
                <Coins size={16} />
                <span style={{ fontWeight: 600 }}>{t('seo.articleOptions.liveEstimateTitle')}</span>
                <span>
                  {liveEstimate.imageMode === 'none'
                    ? t('seo.articleOptions.liveEstimateFormulaNoImage', { words: liveEstimate.words.toLocaleString(), total: liveEstimate.totalCredits })
                    : t('seo.articleOptions.liveEstimateFormula', { words: liveEstimate.words.toLocaleString(), images: liveEstimate.imageCount, total: liveEstimate.totalCredits })}
                </span>
              </div>
            </div>
          )}
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
          {filterTabs.map(tTab => (
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
                        {isDuplicate ? t('seo.statusDuplicate') : isSuggested ? t('seo.statusSuggested') : kw.status}
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
                              <span style={styles.creditPillLight}><Coins size={10} /> {t('seo.approxCredits', { amount: 60 })}</span>
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
                            <span style={styles.creditPillLight}><Coins size={10} /> {t('seo.approxCredits', { amount: 60 })}</span>
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
                              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => openDrawer(kw)} title={t('seo.keywords.btnReviewDraft')}>
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
                              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => openDrawer(kw)} title={t('seo.keywords.btnReviewDraft')}>
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
                      <div style={styles.placeholderPrompt}><b>{t('seo.altPrefix')}</b> {heroPromptObj.alt}</div>
                      <div style={styles.placeholderPrompt}><b>{t('seo.promptAiPrefix')}</b> {heroPromptObj.prompt}</div>
                    </div>
                  ) : null}

                  {/* Title & Excerpt */}
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>{draft.title || t('seo.noTitlePlaceholder')}</h1>
                  {draft.excerpt && (
                    <div style={styles.previewExcerpt}>
                      <b>{t('seo.metaDescriptionPrefix')}</b> {draft.excerpt}
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
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('seo.placeholderPrefix')}<code>{'![alt](markimate:image:1)'}</code></span>
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

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {t('seo.articleOptions.freeReorderNotice')}
                  </div>

                  {(!draft.imagePrompts || !draft.imagePrompts.length) ? (
                    <div style={styles.emptyCell}>{t('seo.promptEmpty')}</div>
                  ) : (
                    draft.imagePrompts.map((img) => {
                      const isHero = img.idx === 0 || img.placement === 'hero';
                      const uploadedImg = currentImages.find(i => i.idx === img.idx);
                      const mime = uploadedImg?.mime || DEFAULT_IMAGE_MIME;
                      const imgSrc = uploadedImg?.url || (uploadedImg?.base64 ? `data:${mime};base64,${uploadedImg.base64}` : null);

                      return (
                        <div key={img.idx} className="approver-image-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <ImageIcon size={16} color="var(--accent-cyan)" />
                              <span style={{ fontWeight: 600 }}>
                                {isHero
                                  ? t('seo.keywords.imgHeroBanner')
                                  : t('seo.keywords.imgInline', { idx: img.idx })}
                              </span>
                              <span style={styles.badgeMuted}>{img.aspect || (isHero ? '16:9' : '4:3')}</span>
                              {imgSrc && <span style={styles.badgeSuccessSmall}>{t('seo.keywords.uploadedBadge')}</span>}
                              {img.placement && (
                                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                  {img.placement === 'hero' ? t('seo.articleOptions.repositionHero') : (img.sectionTitle ? `H2: ${img.sectionTitle}` : img.placement)}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary approver-action-btn"
                              style={{ color: 'var(--accent-red)', minHeight: '44px', padding: '0.4rem 0.75rem' }}
                              onClick={() => removeInlineImage(img.idx)}
                              title={t('seo.articleOptions.deleteImage')}
                            >
                              <Trash2 size={13} /> {t('seo.articleOptions.deleteImage')}
                            </button>
                          </div>

                          {imgSrc && (
                            <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-muted)', maxHeight: '200px' }}>
                              <img src={imgSrc} alt={img.alt || t('seo.defaultAiImage')} style={{ maxHeight: '200px', width: '100%', objectFit: 'cover' }} />
                            </div>
                          )}

                          {/* Kontrol Penempatan & Urutan (PRD F6b §3.3) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {t('seo.articleOptions.repositionImage')}:
                            </label>
                            <select
                              className="form-select"
                              style={{ fontSize: '0.78rem', minHeight: '44px', width: 'auto', flex: 1, minWidth: '180px' }}
                              value={img.placement || (img.idx === 0 ? 'hero' : `h2:${img.idx}`)}
                              onChange={e => repositionImage(img.idx, e.target.value)}
                            >
                              <option value="hero">{t('seo.articleOptions.repositionHero')}</option>
                              {h2Sections.map(sec => (
                                <option key={sec.index} value={`h2:${sec.index}`}>
                                  {t('seo.articleOptions.repositionAfterH2', { title: sec.title })}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ minHeight: '44px', minWidth: '44px', padding: '0.4rem 0.6rem' }}
                              title={t('seo.articleOptions.moveUp')}
                              onClick={() => moveImageStep(img.idx, -1)}
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ minHeight: '44px', minWidth: '44px', padding: '0.4rem 0.6rem' }}
                              title={t('seo.articleOptions.moveDown')}
                              onClick={() => moveImageStep(img.idx, 1)}
                            >
                              <ArrowDown size={16} />
                            </button>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('seo.altText')}</label>
                            <input
                              className="form-input"
                              value={img.alt || ''}
                              onChange={e => updateImagePrompt(img.idx, 'alt', e.target.value)}
                              placeholder={t('seo.keywords.placeholderAlt')}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('seo.aiPromptVisual')}</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              value={img.prompt || ''}
                              onChange={e => updateImagePrompt(img.idx, 'prompt', e.target.value)}
                              placeholder={t('seo.keywords.placeholderPrompt')}
                            />
                          </div>

                          {/* Tombol Buat Ulang Gambar Kontekstual (PRD F6b §3.4) */}
                          {isRegenEnabled && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '0.25rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary approver-action-btn"
                                style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                                disabled={regenBusyIdx === img.idx || !!drawerBusy}
                                onClick={() => regenerateImage(img)}
                              >
                                {regenBusyIdx === img.idx ? (
                                  <><Loader2 size={14} className="spin-icon" /> {t('seo.articleOptions.regenerating')}</>
                                ) : (
                                  <><Sparkles size={14} /> {t('seo.articleOptions.regenerateImageCost')}</>
                                )}
                              </button>
                            </div>
                          )}
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
                  <Coins size={12} /> {imagesEnabled && draft.imagePrompts?.length ? t('seo.approxCredits', { amount: draft.imagePrompts.length * 5 }) : t('seo.zeroCredits')}
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
