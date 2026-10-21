import { useState, useEffect } from 'react';
import { Globe, Plug, CheckCircle2, AlertTriangle, Loader2, Key, Copy, RefreshCw, Lock, ExternalLink, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api, API_BASE_URL } from '../api';
import {
  TONE_PRESETS,
  ARTICLE_LENGTHS,
  IMAGE_MODES,
  estimateArticleCredits,
  sanitizeCustomTone,
  DEFAULT_ARTICLE_OPTIONS
} from '../config/article-options';

const CMS_META = {
  wordpress: {
    label: 'WordPress', color: '#21759b',
    helpKey: 'seo.cms.helpWordpress',
    fields: [
      { key: 'url', label: 'WordPress Site URL', labelKey: 'seo.cms.fieldWpUrl', placeholder: 'https://namadomain.com' },
      { key: 'user', label: 'WordPress Username', labelKey: 'seo.cms.fieldWpUser', placeholder: 'admin' },
      { key: 'appPassword', label: 'Application Password', labelKey: 'seo.cms.fieldWpAppPassword', placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx', secret: true },
    ],
  },
  wix: {
    label: 'Wix Blog', color: '#7c3aed',
    helpKey: 'seo.cms.helpWix',
    fields: [
      { key: 'siteId', label: 'Site ID', labelKey: 'seo.cms.fieldWixSiteId', placeholder: '1a2b3c4d-....' },
      { key: 'apiKey', label: 'API Key (Wix Account)', labelKey: 'seo.cms.fieldWixApiKey', placeholder: 'IST.eyJraWQ...', secret: true },
      { key: 'memberId', label: 'Member ID (optional)', labelKey: 'seo.cms.fieldWixMemberId', placeholder: 'otomatis diambil dari post terakhir' },
    ],
  },
  sanity: {
    label: 'Sanity', color: '#f43f5e',
    helpKey: 'seo.cms.helpSanity',
    fields: [
      { key: 'projectId', label: 'Project ID', labelKey: 'seo.cms.fieldSanityProjectId', placeholder: 'abc123xy' },
      { key: 'dataset', label: 'Dataset', labelKey: 'seo.cms.fieldSanityDataset', placeholder: 'production' },
      { key: 'token', label: 'API Token (Editor permission)', labelKey: 'seo.cms.fieldSanityToken', placeholder: 'sk...', secret: true },
      { key: 'studioUrl', label: 'Sanity Studio URL (optional)', labelKey: 'seo.cms.fieldSanityStudioUrl', placeholder: 'https://namastudio.sanity.studio' },
      { key: 'docType', label: 'Document type (optional)', labelKey: 'seo.cms.fieldSanityDocType', placeholder: 'post' },
      { key: 'bodyField', label: 'Body field name (optional)', labelKey: 'seo.cms.fieldSanityBodyField', placeholder: 'body' },
      { key: 'publicUrlPattern', label: 'Public article URL pattern (optional)', labelKey: 'seo.cms.fieldSanityUrlPattern', placeholder: 'https://situsanda.com/blog/{slug}' },
    ],
  },
  shopify: {
    label: 'Shopify Blog', color: '#5e8e3e',
    helpKey: 'seo.cms.helpShopify',
    fields: [
      { key: 'shop', label: 'Store domain (.myshopify.com)', labelKey: 'seo.cms.fieldShopifyShop', placeholder: 'namatoko.myshopify.com' },
      { key: 'clientId', label: 'Client ID (Dev Dashboard)', labelKey: 'seo.cms.fieldShopifyClientId', placeholder: 'a1b2c3...' },
      { key: 'clientSecret', label: 'Client Secret', labelKey: 'seo.cms.fieldShopifyClientSecret', placeholder: 'shpss_...', secret: true },
      { key: 'accessToken', label: 'Admin API access token (legacy)', labelKey: 'seo.cms.fieldShopifyToken', placeholder: 'shpat_...', secret: true },
      { key: 'blogId', label: 'Blog ID / handle (optional)', labelKey: 'seo.cms.fieldShopifyBlogId', placeholder: 'news — kosong = blog pertama' },
      { key: 'authorName', label: 'Author name (optional)', labelKey: 'seo.cms.fieldShopifyAuthor', placeholder: 'default: nama brand' },
    ],
  },
};

const DEFAULT_ARTICLE_SETTINGS = {
  tone: {
    preset: 'professional',
    custom: '',
  },
  length: 'standard',
  images: {
    enabled: true,
    mode: 'auto',
    count: 3,
    hero: true,
    style: 'foto editorial, warna hangat, tanpa teks di gambar',
    aspectHero: '16:9',
    aspectInline: '4:3',
  },
  links: {
    internal: true,
    maxInternal: 4,
    external: true,
    maxExternal: 2,
    siteBaseUrl: 'https://blog.3ourasia.id/article/',
    excludeDomains: ['facebook.com', 'instagram.com', 'tiktok.com', 'shopee.co.id', 'tokopedia.com', 'youtube.com'],
  },
  duplicateCheck: {
    enabled: true,
    threshold: 0.7,
  },
  sanity: {
    authorId: 'author.ai-team',
    autoCreateAuthor: true,
    categoryIds: [],
    categoryMode: 'fixed',
    publishedAtField: 'publishedAt',
    mainImageField: 'mainImage',
    excerptField: 'excerpt',
  },
  wordpress: {
    defaultCategoryIds: [],
    authorId: null,
  },
  wix: {
    categoryIds: [],
  },
  shopify: {
    tags: [],
  },
};

export default function CmsSettings({ me, refreshMe, goTo }) {
  const { t } = useLanguage();
  const user = me.user;
  const isPremium = user.plan === 'premium' || (me.plan && me.plan.id !== 'free');
  const canUseImages = me.plan ? me.plan.images !== false : isPremium;
  const [forms, setForms] = useState({ wordpress: {}, wix: {}, sanity: {}, shopify: {} });
  const [articleSettings, setArticleSettings] = useState({ wordpress: {}, wix: {}, sanity: {}, shopify: {} });
  const [activeTab, setActiveTab] = useState({ wordpress: 'creds', wix: 'creds', sanity: 'creds', shopify: 'creds' });
  const [cmsOptions, setCmsOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState({});
  const [state, setState] = useState({}); // type -> {busy, result}
  const [settingsState, setSettingsState] = useState({}); // type -> {busy, success, msg}
  const [saved, setSaved] = useState({});
  const [profile, setProfile] = useState({ brandName: user.brandName || '', niche: user.niche || '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    const nextForms = { wordpress: {}, wix: {}, sanity: {}, shopify: {} };
    const nextSettings = { wordpress: {}, wix: {}, sanity: {}, shopify: {} };
    const sv = {};
    for (const c of me.cms || []) {
      nextForms[c.cmsType] = { ...c.config };
      nextSettings[c.cmsType] = {
        ...DEFAULT_ARTICLE_SETTINGS,
        ...c.articleSettings,
        tone: { ...DEFAULT_ARTICLE_SETTINGS.tone, ...(c.articleSettings?.tone || {}) },
        images: { ...DEFAULT_ARTICLE_SETTINGS.images, ...(c.articleSettings?.images || {}) },
        links: { ...DEFAULT_ARTICLE_SETTINGS.links, ...(c.articleSettings?.links || {}) },
        duplicateCheck: { ...DEFAULT_ARTICLE_SETTINGS.duplicateCheck, ...(c.articleSettings?.duplicateCheck || {}) },
        sanity: { ...DEFAULT_ARTICLE_SETTINGS.sanity, ...(c.articleSettings?.sanity || {}) },
        wordpress: { ...DEFAULT_ARTICLE_SETTINGS.wordpress, ...(c.articleSettings?.wordpress || {}) },
        wix: { ...DEFAULT_ARTICLE_SETTINGS.wix, ...(c.articleSettings?.wix || {}) },
        shopify: { ...DEFAULT_ARTICLE_SETTINGS.shopify, ...(c.articleSettings?.shopify || {}) },
      };
      sv[c.cmsType] = c;
    }
    setForms(nextForms);
    setArticleSettings(nextSettings);
    setSaved(sv);
  }, [me.cms]);

  const loadOptions = async (type) => {
    if (cmsOptions[type] || loadingOptions[type]) return;
    setLoadingOptions(l => ({ ...l, [type]: true }));
    try {
      const res = await api(`/api/cms/${type}/options`);
      setCmsOptions(o => ({ ...o, [type]: res.options || {} }));
    } catch {
      // Abaikan bila belum tersambung
    } finally {
      setLoadingOptions(l => ({ ...l, [type]: false }));
    }
  };

  const handleTabChange = (type, tab) => {
    setActiveTab(t => ({ ...t, [type]: tab }));
    if (tab === 'settings') loadOptions(type);
  };

  const setField = (type, key, v) => setForms(f => ({ ...f, [type]: { ...f[type], [key]: v } }));

  const setSettingPath = (type, section, key, v) => {
    setArticleSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...(key === null
          ? { [section]: v }
          : {
            [section]: {
              ...(typeof prev[type]?.[section] === 'object' ? prev[type]?.[section] : {}),
              [key]: v,
            }
          }),
      },
    }));
  };

  const formatCmsTestResult = (result) => {
    if (!result) return '';
    if (result.code) {
      const translated = t(`seo.cms.test.${result.code}`, result.params || {});
      if (translated && !translated.startsWith('seo.cms.test.')) {
        return translated;
      }
    }
    return result.message || '';
  };

  const save = async (type) => {
    setState(s => ({ ...s, [type]: { busy: true } }));
    try {
      const d = await api(`/api/cms/${type}`, {
        method: 'PUT',
        body: { config: forms[type], articleSettings: articleSettings[type] },
      });
      setState(s => ({ ...s, [type]: { busy: false, result: d.test } }));
      await refreshMe();
    } catch (e) {
      setState(s => ({ ...s, [type]: { busy: false, result: { ok: false, message: e.message } } }));
    }
  };

  const saveSettings = async (type) => {
    setSettingsState(s => ({ ...s, [type]: { busy: true, msg: '' } }));
    try {
      const artSet = articleSettings[type] || {};
      if (artSet.tone?.preset === 'custom') {
        sanitizeCustomTone(artSet.tone?.custom);
      }
      await api(`/api/cms/${type}`, {
        method: 'PUT',
        body: { config: forms[type], articleSettings: artSet, test: false },
      });
      setSettingsState(s => ({ ...s, [type]: { busy: false, success: true, msg: t('seo.cms.articleSettingsSaved') } }));
      setTimeout(() => setSettingsState(s => ({ ...s, [type]: { ...s[type], msg: '' } })), 3000);
      await refreshMe();
    } catch (e) {
      setSettingsState(s => ({ ...s, [type]: { busy: false, success: false, msg: e.message } }));
    }
  };

  const remove = async (type) => {
    if (!window.confirm(t('seo.cms.disconnectConfirm', { platform: CMS_META[type].label }))) return;
    await api(`/api/cms/${type}`, { method: 'DELETE' });
    setForms(f => ({ ...f, [type]: {} }));
    setState(s => ({ ...s, [type]: {} }));
    await refreshMe();
  };
  const saveProfile = async (e) => {
    e.preventDefault(); setProfileMsg('');
    try { await api('/api/me', { method: 'PATCH', body: profile }); await refreshMe(); setProfileMsg(t('seo.cms.brandSavedMsg')); } catch (err) { setProfileMsg(err.message); }
  };
  const toggleApprover = async (on) => { try { await api('/api/me', { method: 'PATCH', body: { webApprover: on } }); await refreshMe(); } catch (e) { alert(e.message); } };
  const copyKey = async () => { try { await navigator.clipboard.writeText(user.apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* abaikan */ } };
  const rotateKey = async () => { if (!window.confirm(t('seo.cms.rotateConfirm'))) return; setRotating(true); try { await api('/api/me/api-key/rotate', { method: 'POST' }); await refreshMe(); } finally { setRotating(false); } };

  const curl = `curl -X POST ${API_BASE_URL}/api/v1/articles/generate \\\n  -H "X-API-Key: ${user.apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"keyword":"digital marketing kuliner","geo":"ID","ln":"id","cmsType":"wordpress"}'`;

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>{t('seo.cms.pageTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('seo.cms.pageSubtitle')}
        </p>
      </header>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {Object.entries(CMS_META).map(([type, meta]) => {
          const f = forms[type] || {};
          const st = state[type] || {};
          const sSt = settingsState[type] || {};
          const sv = saved[type];
          const tab = activeTab[type] || 'creds';
          const setg = articleSettings[type] || DEFAULT_ARTICLE_SETTINGS;
          const opts = cmsOptions[type] || {};

          return (
            <div className="card" key={type}>
              <div style={styles.cardHead}>
                <div style={{ ...styles.cmsIcon, backgroundColor: meta.color + '22', border: `1px solid ${meta.color}55` }}>
                  <Globe size={18} color={meta.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1rem' }}>{meta.label}</h2>
                  <span style={styles.sub}>
                    {sv ? (sv.verified ? t('seo.cms.connectedVerified') : t('seo.cms.savedUnverified')) : t('seo.cms.disconnected')}
                  </span>
                </div>
                {sv && (
                  <span className={`badge ${sv.verified ? 'badge-success' : 'badge-warning'}`}>
                    {sv.verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {sv.verified ? t('seo.cms.statusOk') : t('seo.cms.statusCheck')}
                  </span>
                )}
              </div>

              {/* Sub-tabs untuk koneksi yang sudah tersimpan */}
              {sv && (
                <div style={styles.tabBar}>
                  <button
                    style={tab === 'creds' ? styles.tabBtnActive : styles.tabBtn}
                    onClick={() => handleTabChange(type, 'creds')}
                  >
                    {t('seo.cms.tabCreds')}
                  </button>
                  <button
                    style={tab === 'settings' ? styles.tabBtnActive : styles.tabBtn}
                    onClick={() => handleTabChange(type, 'settings')}
                  >
                    {t('seo.cms.tabArticleSettings')}
                  </button>
                </div>
              )}

              {tab === 'creds' ? (
                <>
                  <p style={{ ...styles.sub, marginBottom: '1rem', lineHeight: 1.5 }}>
                    {meta.helpKey ? t(meta.helpKey) : meta.help}
                  </p>
                  {meta.fields.map(fl => (
                    <div className="form-group" key={fl.key}>
                      <label className="form-label">{fl.labelKey ? t(fl.labelKey) : fl.label}</label>
                      <input
                        className="form-input"
                        type={fl.secret ? 'password' : 'text'}
                        placeholder={fl.placeholder}
                        value={f[fl.key] || ''}
                        onChange={e => setField(type, fl.key, e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                  {st.result && (
                    <div style={st.result.ok ? styles.okBox : styles.errBox}>
                      {st.result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {formatCmsTestResult(st.result)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={() => save(type)} disabled={st.busy}>
                      {st.busy ? <Loader2 size={16} className="spin-icon" /> : <Plug size={16} />} {t('seo.cms.saveAndTestBtn')}
                    </button>
                    {sv && (
                      <button className="btn btn-secondary" onClick={() => remove(type)} title={t('seo.cms.disconnectBtn')}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Tab Pengaturan Artikel (PRD F6b) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* 1. Gaya Bahasa (Tone) */}
                  <div style={styles.settingBlock}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.25rem' }}>{t('seo.articleOptions.toneLabel')}</div>
                    <div style={styles.sub}>{t('seo.articleOptions.toneDesc')}</div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <select
                        className="form-select"
                        value={setg.tone?.preset || 'professional'}
                        onChange={e => setSettingPath(type, 'tone', 'preset', e.target.value)}
                      >
                        <option value="professional">{t('seo.articleOptions.toneProfessional')}</option>
                        <option value="casual">{t('seo.articleOptions.toneCasual')}</option>
                        <option value="educational">{t('seo.articleOptions.toneEducational')}</option>
                        <option value="persuasive">{t('seo.articleOptions.tonePersuasive')}</option>
                        <option value="storytelling">{t('seo.articleOptions.toneStorytelling')}</option>
                        <option value="custom">{t('seo.articleOptions.toneCustom')}</option>
                      </select>
                      {setg.tone?.preset === 'custom' && (
                        <div style={{ marginTop: '0.6rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.articleOptions.customToneLabel')}</label>
                          <input
                            className="form-input"
                            maxLength={120}
                            value={setg.tone?.custom || ''}
                            onChange={e => setSettingPath(type, 'tone', 'custom', e.target.value)}
                            placeholder={t('seo.articleOptions.customTonePlaceholder')}
                          />
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {t('seo.articleOptions.customToneHint')} {`(${(setg.tone?.custom || '').length}/120)`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Target Panjang Artikel */}
                  <div style={styles.settingBlock}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.25rem' }}>{t('seo.articleOptions.lengthLabel')}</div>
                    <div style={styles.sub}>{t('seo.articleOptions.lengthDesc')}</div>
                    <div className="article-options-pill-group" style={{ marginTop: '0.75rem' }}>
                      {Object.values(ARTICLE_LENGTHS).map(len => (
                        <button
                          key={len.id}
                          type="button"
                          className={`article-options-pill ${(setg.length || 'standard') === len.id ? 'active' : ''}`}
                          onClick={() => setSettingPath(type, 'length', null, len.id)}
                        >
                          {t(`seo.articleOptions.${len.labelKey}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Mode Gambar AI & Ilustrasi */}
                  <div style={styles.settingBlock}>
                    <div style={styles.settingHeader}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('seo.articleOptions.imageModeLabel')}</div>
                        <div style={styles.sub}>
                          {t('seo.articleOptions.imageModeDesc')}{' '}
                          <span style={{ color: 'var(--text-muted)' }}>
                            {type === 'wix' || type === 'shopify' ? t('seo.cms.wixShopifyNoImageNotice') : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="article-options-pill-group" style={{ marginTop: '0.75rem' }}>
                      {Object.values(IMAGE_MODES).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className={`article-options-pill ${(setg.images?.mode || (setg.images?.enabled === false ? 'none' : 'auto')) === m.id ? 'active' : ''}`}
                          onClick={() => {
                            setSettingPath(type, 'images', 'mode', m.id);
                            setSettingPath(type, 'images', 'enabled', m.id !== 'none');
                          }}
                        >
                          {t(`seo.articleOptions.${m.labelKey}`)}
                        </button>
                      ))}
                    </div>

                    {(setg.images?.mode || (setg.images?.enabled === false ? 'none' : 'auto')) !== 'none' && (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.articleOptions.imageCountLabel')}</label>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('seo.articleOptions.imageCountDesc')}</div>
                          <div className="article-options-pill-group">
                            {[1, 2, 3, 4, 5, 6].map(cnt => (
                              <button
                                key={cnt}
                                type="button"
                                className={`article-options-pill ${(setg.images?.count === undefined ? 3 : setg.images?.count) === cnt ? 'active' : ''}`}
                                onClick={() => setSettingPath(type, 'images', 'count', cnt)}
                              >
                                {t('seo.articleOptions.imagesCount', { count: cnt })}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 500 }}>{t('seo.articleOptions.heroImageLabel')}</div>
                            <div style={styles.sub}>{t('seo.articleOptions.heroImageDesc')}</div>
                          </div>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={setg.images?.hero !== false}
                              onChange={e => setSettingPath(type, 'images', 'hero', e.target.checked)}
                            />
                            <span className="slider round"></span>
                          </label>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('seo.cms.imgStyleLabel')}</label>
                          <input
                            className="form-input"
                            value={setg.images?.style || ''}
                            onChange={e => setSettingPath(type, 'images', 'style', e.target.value)}
                            placeholder={t('seo.cms.placeholderImgStyle')}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Internal & External Links */}
                  <div style={styles.settingBlock}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t('seo.cms.autoLinkingTitle')}</div>
                    
                    {/* Internal link */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('seo.cms.internalLinksTitle')}</div>
                        <div style={styles.sub}>{t('seo.cms.internalLinksDesc')}</div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={setg.links?.internal !== false}
                          onChange={e => setSettingPath(type, 'links', 'internal', e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {setg.links?.internal !== false && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label className="form-label">{t('seo.cms.maxLinksLabel')}</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="form-input"
                            value={setg.links?.maxInternal || 4}
                            onChange={e => setSettingPath(type, 'links', 'maxInternal', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="form-label">{t('seo.cms.baseUrlLabel')}</label>
                          <input
                            className="form-input"
                            value={setg.links?.siteBaseUrl || ''}
                            onChange={e => setSettingPath(type, 'links', 'siteBaseUrl', e.target.value)}
                            placeholder="https://blog.3ourasia.id/article/"
                          />
                        </div>
                      </div>
                    )}

                    {/* External link */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('seo.cms.externalLinksTitle')}</div>
                        <div style={styles.sub}>{t('seo.cms.externalLinksDesc')}</div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={setg.links?.external !== false}
                          onChange={e => setSettingPath(type, 'links', 'external', e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {setg.links?.external !== false && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <label className="form-label">{t('seo.cms.maxExtLinksLabel')}</label>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            className="form-input"
                            style={{ maxWidth: '120px' }}
                            value={setg.links?.maxExternal || 2}
                            onChange={e => setSettingPath(type, 'links', 'maxExternal', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="form-label">{t('seo.cms.excludedDomainsLabel')}</label>
                          <input
                            className="form-input"
                            value={(setg.links?.excludeDomains || []).join(', ')}
                            onChange={e =>
                              setSettingPath(
                                type,
                                'links',
                                'excludeDomains',
                                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              )
                            }
                            placeholder={t('seo.cms.placeholderExcludedDomains')}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Cek Topik Duplikat */}
                  <div style={styles.settingBlock}>
                    <div style={styles.settingHeader}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('seo.cms.dupCheckTitle')}</div>
                        <div style={styles.sub}>{t('seo.cms.dupCheckSub')}</div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={setg.duplicateCheck?.enabled !== false}
                          onChange={e => setSettingPath(type, 'duplicateCheck', 'enabled', e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {setg.duplicateCheck?.enabled !== false && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <label className="form-label" style={{ margin: 0 }}>{t('seo.cms.dupThresholdLabel')}</label>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                            {Math.round((setg.duplicateCheck?.threshold || 0.7) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="0.9"
                          step="0.05"
                          style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                          value={setg.duplicateCheck?.threshold || 0.7}
                          onChange={e => setSettingPath(type, 'duplicateCheck', 'threshold', parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Khusus CMS */}
                  {type === 'sanity' && (
                    <div style={styles.settingBlock}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t('seo.cms.sanitySettingsTitle')}</div>
                      <div className="form-group">
                        <label className="form-label">{t('seo.cms.authorLabel')}</label>
                        <select
                          className="form-input"
                          value={setg.sanity?.authorId || 'author.ai-team'}
                          onChange={e => setSettingPath(type, 'sanity', 'authorId', e.target.value)}
                        >
                          <option value="author.ai-team">{t('seo.cms.authorAiTeam')}</option>
                          {(opts.authors || []).map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input
                          type="checkbox"
                          id="autoCreateAuthor"
                          checked={setg.sanity?.autoCreateAuthor !== false}
                          onChange={e => setSettingPath(type, 'sanity', 'autoCreateAuthor', e.target.checked)}
                        />
                        <label htmlFor="autoCreateAuthor" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                          {t('seo.cms.autoCreateAuthorLabel')}
                        </label>
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t('seo.cms.categoryModeLabel')}</label>
                        <select
                          className="form-input"
                          value={setg.sanity?.categoryMode || 'fixed'}
                          onChange={e => setSettingPath(type, 'sanity', 'categoryMode', e.target.value)}
                        >
                          <option value="fixed">{t('seo.cms.catModeFixed')}</option>
                          <option value="ai">{t('seo.cms.catModeAi')}</option>
                          <option value="fixed+ai">{t('seo.cms.catModeFixedAi')}</option>
                        </select>
                      </div>

                      {opts.categories && opts.categories.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">{t('seo.cms.sanityCategoryLabel')}</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {opts.categories.map(c => {
                              const selected = (setg.sanity?.categoryIds || []).includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  style={selected ? styles.pillActive : styles.pill}
                                  onClick={() => {
                                    const curr = setg.sanity?.categoryIds || [];
                                    const next = selected ? curr.filter(x => x !== c.id) : [...curr, c.id];
                                    setSettingPath(type, 'sanity', 'categoryIds', next);
                                  }}
                                >
                                  {c.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('seo.cms.fieldPublishedAtLabel')}</label>
                          <input
                            className="form-input"
                            value={setg.sanity?.publishedAtField || 'publishedAt'}
                            onChange={e => setSettingPath(type, 'sanity', 'publishedAtField', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('seo.cms.fieldMainImageLabel')}</label>
                          <input
                            className="form-input"
                            value={setg.sanity?.mainImageField || 'mainImage'}
                            onChange={e => setSettingPath(type, 'sanity', 'mainImageField', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('seo.cms.fieldExcerptLabel')}</label>
                          <input
                            className="form-input"
                            value={setg.sanity?.excerptField || 'excerpt'}
                            onChange={e => setSettingPath(type, 'sanity', 'excerptField', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === 'wordpress' && (
                    <div style={styles.settingBlock}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t('seo.cms.wpSettingsTitle')}</div>
                      {opts.categories && opts.categories.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">{t('seo.cms.defaultCategoryLabel')}</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {opts.categories.map(c => {
                              const selected = (setg.wordpress?.defaultCategoryIds || []).includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  style={selected ? styles.pillActive : styles.pill}
                                  onClick={() => {
                                    const curr = setg.wordpress?.defaultCategoryIds || [];
                                    const next = selected ? curr.filter(x => x !== c.id) : [...curr, c.id];
                                    setSettingPath(type, 'wordpress', 'defaultCategoryIds', next);
                                  }}
                                >
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {opts.authors && opts.authors.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">{t('seo.cms.postAuthorLabel')}</label>
                          <select
                            className="form-input"
                            value={setg.wordpress?.authorId || ''}
                            onChange={e => setSettingPath(type, 'wordpress', 'authorId', e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">{t('seo.cms.defaultLoginAccount')}</option>
                            {opts.authors.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {type === 'wix' && opts.categories && opts.categories.length > 0 && (
                    <div style={styles.settingBlock}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t('seo.cms.wixCategoryTitle')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {opts.categories.map(c => {
                          const selected = (setg.wix?.categoryIds || []).includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              style={selected ? styles.pillActive : styles.pill}
                              onClick={() => {
                                const curr = setg.wix?.categoryIds || [];
                                const next = selected ? curr.filter(x => x !== c.id) : [...curr, c.id];
                                setSettingPath(type, 'wix', 'categoryIds', next);
                              }}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {type === 'shopify' && (
                    <div style={styles.settingBlock}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t('seo.cms.shopifyTagsTitle')}</div>
                      <label className="form-label">{t('seo.cms.shopifyTagsLabel')}</label>
                      <input
                        className="form-input"
                        value={(setg.shopify?.tags || []).join(', ')}
                        onChange={e =>
                          setSettingPath(
                            type,
                            'shopify',
                            'tags',
                            e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          )
                        }
                        placeholder={t('seo.cms.placeholderShopifyTags')}
                      />
                    </div>
                  )}

                  {sSt.msg && (
                    <div style={sSt.success ? styles.okBox : styles.errBox}>
                      {sSt.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {sSt.msg}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => saveSettings(type)}
                    disabled={sSt.busy}
                  >
                    {sSt.busy ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />} {t('seo.cms.saveArticleSettingsBtn')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', opacity: 0.7 }}>
        <div style={styles.cardHead}><div style={{ ...styles.cmsIcon, backgroundColor: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)' }}><Globe size={18} color="#f43f5e" /></div><div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: '1rem' }}>{'Webflow, Ghost, Blogger'}</h2><span style={styles.sub}>{t('seo.cms.otherCmsComingSoon')}</span></div><span className="badge badge-secondary">{t('common.soon')}</span></div>
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem', alignItems: 'start' }}>
        {/* Persetujuan konten */}
        <div className="card">
          <h2 style={{ fontSize: '1rem' }}>{t('seo.cms.approverTitle')}</h2>
          <div style={styles.toggleRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{t('seo.cms.approverLabel')} {!isPremium && <Lock size={14} color="var(--text-muted)" />}</div>
              <div style={styles.sub}>
                {t('seo.cms.approverDesc')}
              </div>
            </div>
            <label className="switch" title={isPremium ? '' : t('seo.cms.proFeatureNotice')}>
              <input type="checkbox" checked={isPremium && user.webApprover !== false} disabled={!isPremium} onChange={e => toggleApprover(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>
          {!isPremium && <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => goTo && goTo('billing')}>{t('seo.cms.approverUpgrade')}</button>}
          <hr style={styles.hr} />
          <form onSubmit={saveProfile}>
            <h2 style={{ fontSize: '1rem' }}>{t('seo.cms.brandProfileTitle')}</h2>
            <div className="form-group"><label className="form-label">{t('seo.cms.brandNameLabel')}</label><input className="form-input" value={profile.brandName} onChange={e => setProfile({ ...profile, brandName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{t('seo.cms.brandNicheLabel')}</label><input className="form-input" value={profile.niche} onChange={e => setProfile({ ...profile, niche: e.target.value })} placeholder={t('seo.cms.brandNichePlaceholder')} /></div>
            <button className="btn btn-primary" type="submit">{t('seo.cms.brandSaveBtn')}</button>
            {profileMsg && <span style={{ ...styles.sub, marginLeft: '0.75rem' }}>{profileMsg}</span>}
          </form>
        </div>

        {/* 3Our API */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={16} color="var(--accent-cyan)" /> {t('seo.cms.apiTitle')}</h2>
          <p style={styles.sub}>
            {t('seo.cms.apiSubtitle')}
          </p>
          <label className="form-label" style={{ marginTop: '0.75rem' }}>
            {t('seo.cms.apiKeyLabel')}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="form-input" readOnly value={user.apiKey || ''} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
            <button className="btn btn-secondary" onClick={copyKey} title={t('seo.cms.copyTitle')}>{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}</button>
            <button className="btn btn-secondary" onClick={rotateKey} disabled={rotating} title={t('seo.cms.rotateTitle')}><RefreshCw size={16} className={rotating ? 'spin-icon' : ''} /></button>
          </div>
          {!isPremium && <div style={{ ...styles.sub, marginTop: '0.5rem' }}>{t('seo.cms.freeQuotaNote', { limit: me.usage?.limit })}</div>}
          <label className="form-label" style={{ marginTop: '1rem' }}>{t('seo.cms.exampleTitle')}</label>
          <pre style={styles.pre}>{curl}</pre>
          <div style={{ ...styles.sub, lineHeight: 1.7 }}>
            <div><code>{'POST /api/v1/articles/generate'}</code> {'→'} <code>{'{ status, id, article }'}</code></div>
            <div><code>{'POST /api/v1/articles/:id/publish'}</code> {'body'} <code>{'{ action: "draft" | "publish", article? }'}</code> {'→'} {t('seo.cms.apiPublishHelper')}</div>
            <div><code>{'GET /api/v1/articles'}</code> {'→'} {t('seo.cms.apiArticlesList')}</div>
          </div>
          <a href="https://3ourasia.id" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.8rem' }}><ExternalLink size={14} /> {t('seo.cms.customIntegration')}</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  cardHead: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
  cmsIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  okBox: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6ee7b7', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '0.6rem 0.8rem' },
  errBox: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.6rem 0.8rem' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--bg-base)', border: '1px solid var(--border-muted)', borderRadius: 10 },
  hr: { border: 'none', borderTop: '1px solid var(--border-muted)', margin: '1.25rem 0' },
  pre: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: '#000', border: '1px solid var(--border-muted)', borderRadius: 8, padding: '0.75rem', overflowX: 'auto', color: 'var(--accent-cyan)', whiteSpace: 'pre', marginBottom: '0.75rem' },
  proLockBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.3)', cursor: 'pointer' },
};
