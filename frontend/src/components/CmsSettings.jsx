import { useState, useEffect } from 'react';
import { Globe, Plug, CheckCircle2, AlertTriangle, Loader2, Key, Copy, RefreshCw, Lock, ExternalLink, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api, API_BASE_URL } from '../api';

const CMS_META = {
  wordpress: {
    label: 'WordPress', color: '#21759b',
    help: 'Buat Application Password di WordPress: Users → Profile → Application Passwords → beri nama "Markimate" → salin sandi 24 karakter. Akun harus bisa menulis post (Author/Editor/Admin).',
    fields: [
      { key: 'url', label: 'URL situs WordPress', placeholder: 'https://namadomain.com' },
      { key: 'user', label: 'Username WordPress', placeholder: 'admin' },
      { key: 'appPassword', label: 'Application Password', placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx', secret: true },
    ],
  },
  wix: {
    label: 'Wix Blog', color: '#7c3aed',
    help: 'Buat API Key di Wix: Account → API Keys → Generate → izin "Blog" (opsional "Members") → salin key. Site ID ada di URL dashboard situs (manage.wix.com/dashboard/<site-id>/...). Situs harus sudah punya aplikasi Wix Blog.',
    fields: [
      { key: 'siteId', label: 'Site ID', placeholder: '1a2b3c4d-....' },
      { key: 'apiKey', label: 'API Key (akun Wix)', placeholder: 'IST.eyJraWQ...', secret: true },
      { key: 'memberId', label: 'Member ID penulis (opsional)', placeholder: 'otomatis diambil dari post terakhir' },
    ],
  },
  sanity: {
    label: 'Sanity', color: '#f43f5e',
    help: 'Buka sanity.io/manage → pilih project → API → Tokens → Add API token → izin "Editor" → salin token. Project ID ada di halaman project. Artikel disimpan sebagai dokumen (default type "post", isi di field "body" berupa Portable Text) — sesuaikan bila skema Studio Anda berbeda.',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'abc123xy' },
      { key: 'dataset', label: 'Dataset', placeholder: 'production' },
      { key: 'token', label: 'API Token (izin Editor)', placeholder: 'sk...', secret: true },
      { key: 'studioUrl', label: 'URL Sanity Studio (opsional, untuk link edit)', placeholder: 'https://namastudio.sanity.studio' },
      { key: 'docType', label: 'Document type (opsional)', placeholder: 'post' },
      { key: 'bodyField', label: 'Field isi artikel (opsional)', placeholder: 'body' },
      { key: 'publicUrlPattern', label: 'Pola URL artikel publik (opsional)', placeholder: 'https://situsanda.com/blog/{slug}' },
    ],
  },
  shopify: {
    label: 'Shopify Blog', color: '#5e8e3e',
    help: 'Buka dev.shopify.com (Dev Dashboard) → Create app → Versions: pilih scope "read_content" & "write_content" → Release → Install app ke toko Anda → salin Client ID & Client Secret (Settings). Punya custom app lama? Cukup isi Admin API access token (shpat_…). Domain toko pakai format namatoko.myshopify.com.',
    fields: [
      { key: 'shop', label: 'Domain toko (.myshopify.com)', placeholder: 'namatoko.myshopify.com' },
      { key: 'clientId', label: 'Client ID (app Dev Dashboard)', placeholder: 'a1b2c3...' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'shpss_...', secret: true },
      { key: 'accessToken', label: 'atau Admin API access token (custom app lama)', placeholder: 'shpat_...', secret: true },
      { key: 'blogId', label: 'Blog tujuan (opsional, handle blog)', placeholder: 'news — kosong = blog pertama' },
      { key: 'authorName', label: 'Nama penulis (opsional)', placeholder: 'default: nama brand' },
    ],
  },
};

const DEFAULT_ARTICLE_SETTINGS = {
  images: {
    enabled: true,
    count: 3,
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
        [section]: {
          ...(prev[type]?.[section] || {}),
          [key]: v,
        },
      },
    }));
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
      await api(`/api/cms/${type}`, {
        method: 'PUT',
        body: { config: forms[type], articleSettings: articleSettings[type], test: false },
      });
      setSettingsState(s => ({ ...s, [type]: { busy: false, success: true, msg: 'Pengaturan artikel berhasil disimpan!' } }));
      setTimeout(() => setSettingsState(s => ({ ...s, [type]: { ...s[type], msg: '' } })), 3000);
      await refreshMe();
    } catch (e) {
      setSettingsState(s => ({ ...s, [type]: { busy: false, success: false, msg: e.message } }));
    }
  };

  const remove = async (type) => {
    if (!window.confirm(`Putuskan koneksi ${CMS_META[type].label}?`)) return;
    await api(`/api/cms/${type}`, { method: 'DELETE' });
    setForms(f => ({ ...f, [type]: {} }));
    setState(s => ({ ...s, [type]: {} }));
    await refreshMe();
  };
  const saveProfile = async (e) => {
    e.preventDefault(); setProfileMsg('');
    try { await api('/api/me', { method: 'PATCH', body: profile }); await refreshMe(); setProfileMsg('Profil disimpan.'); } catch (err) { setProfileMsg(err.message); }
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
                    {sv ? (sv.verified ? 'Terhubung & terverifikasi' : 'Tersimpan, belum terverifikasi') : 'Belum terhubung'}
                  </span>
                </div>
                {sv && (
                  <span className={`badge ${sv.verified ? 'badge-success' : 'badge-warning'}`}>
                    {sv.verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {sv.verified ? 'OK' : 'Cek'}
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
                    Kredensial
                  </button>
                  <button
                    style={tab === 'settings' ? styles.tabBtnActive : styles.tabBtn}
                    onClick={() => handleTabChange(type, 'settings')}
                  >
                    Pengaturan Artikel
                  </button>
                </div>
              )}

              {tab === 'creds' ? (
                <>
                  <p style={{ ...styles.sub, marginBottom: '1rem', lineHeight: 1.5 }}>{meta.help}</p>
                  {meta.fields.map(fl => (
                    <div className="form-group" key={fl.key}>
                      <label className="form-label">{fl.label}</label>
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
                      {st.result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {st.result.message}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={() => save(type)} disabled={st.busy}>
                      {st.busy ? <Loader2 size={16} className="spin-icon" /> : <Plug size={16} />} Simpan & Tes koneksi
                    </button>
                    {sv && (
                      <button className="btn btn-secondary" onClick={() => remove(type)} title="Putuskan">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Tab Pengaturan Artikel */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 1. Gambar AI */}
                  <div style={styles.settingBlock}>
                    <div style={styles.settingHeader}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Gambar AI (Hero + Inline)</div>
                        <div style={styles.sub}>
                          Didukung: Sanity & WordPress.{' '}
                          <span style={{ color: 'var(--text-muted)' }}>
                            {type === 'wix' || type === 'shopify' ? '(Wix & Shopify akan dipublish tanpa gambar)' : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {!canUseImages && (
                          <span style={styles.proLockBadge} onClick={() => goTo && goTo('billing')} title="Tersedia di paket Pro / SEO Specialist">
                            <Lock size={12} /> Pro
                          </span>
                        )}
                        <label className="switch" style={{ opacity: canUseImages ? 1 : 0.6 }}>
                          <input
                            type="checkbox"
                            checked={canUseImages && setg.images?.enabled !== false}
                            disabled={!canUseImages}
                            onChange={e => {
                              if (!canUseImages) {
                                goTo && goTo('billing');
                                return;
                              }
                              setSettingPath(type, 'images', 'enabled', e.target.checked);
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    {canUseImages && setg.images?.enabled !== false && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <label className="form-label">Jumlah Gambar</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[1, 2, 3].map(cnt => (
                              <button
                                key={cnt}
                                type="button"
                                style={setg.images?.count === cnt ? styles.pillActive : styles.pill}
                                onClick={() => setSettingPath(type, 'images', 'count', cnt)}
                              >
                                {cnt} {cnt === 1 ? 'Gambar (Hero)' : cnt === 2 ? 'Gambar' : 'Gambar (1 Hero + 2 Inline)'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="form-label">Gaya Gambar (Prompt Style)</label>
                          <input
                            className="form-input"
                            value={setg.images?.style || ''}
                            onChange={e => setSettingPath(type, 'images', 'style', e.target.value)}
                            placeholder="foto editorial, warna hangat, tanpa teks di gambar"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Internal & External Links */}
                  <div style={styles.settingBlock}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>Penyisipan Link Otomatis</div>
                    
                    {/* Internal link */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>Internal Links</div>
                        <div style={styles.sub}>Tautkan ke artikel relevan yang ada di CMS</div>
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
                          <label className="form-label">Maksimal Link</label>
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
                          <label className="form-label">Base URL Artikel (Slug)</label>
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
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>External Links</div>
                        <div style={styles.sub}>Tautkan ke sumber referensi kredibel</div>
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
                          <label className="form-label">Maksimal External Link</label>
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
                          <label className="form-label">Domain yang Dikecualikan (pisahkan koma)</label>
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
                            placeholder="facebook.com, instagram.com, tiktok.com"
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
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>Pengaturan Khusus Sanity</div>
                      <div className="form-group">
                        <label className="form-label">Penulis (Author)</label>
                        <select
                          className="form-input"
                          value={setg.sanity?.authorId || 'author.ai-team'}
                          onChange={e => setSettingPath(type, 'sanity', 'authorId', e.target.value)}
                        >
                          <option value="author.ai-team">AI Team (author.ai-team)</option>
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
                          Buat dokumen author AI Team otomatis jika belum ada di Sanity
                        </label>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Mode Pemilihan Kategori</label>
                        <select
                          className="form-input"
                          value={setg.sanity?.categoryMode || 'fixed'}
                          onChange={e => setSettingPath(type, 'sanity', 'categoryMode', e.target.value)}
                        >
                          <option value="fixed">Fixed (Kategori tetap yang dipilih di bawah)</option>
                          <option value="ai">AI Auto-pick (AI memilih kategori yang paling sesuai)</option>
                          <option value="fixed+ai">Fixed + AI (Gabungan kategori tetap & saran AI)</option>
                        </select>
                      </div>

                      {opts.categories && opts.categories.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">Kategori Sanity</label>
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
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Field Published At</label>
                          <input
                            className="form-input"
                            value={setg.sanity?.publishedAtField || 'publishedAt'}
                            onChange={e => setSettingPath(type, 'sanity', 'publishedAtField', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Field Main Image</label>
                          <input
                            className="form-input"
                            value={setg.sanity?.mainImageField || 'mainImage'}
                            onChange={e => setSettingPath(type, 'sanity', 'mainImageField', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Field Excerpt</label>
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
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>Pengaturan Khusus WordPress</div>
                      {opts.categories && opts.categories.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">Kategori Default</label>
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
                          <label className="form-label">Penulis Post</label>
                          <select
                            className="form-input"
                            value={setg.wordpress?.authorId || ''}
                            onChange={e => setSettingPath(type, 'wordpress', 'authorId', e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Default (Akun Login)</option>
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
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>Kategori Wix Blog</div>
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
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>Tags Shopify Blog</div>
                      <label className="form-label">Tags Artikel (pisahkan koma)</label>
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
                        placeholder="seo, digital-marketing, tips"
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
                    {sSt.busy ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />} Simpan Pengaturan Artikel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', opacity: 0.7 }}>
        <div style={styles.cardHead}><div style={{ ...styles.cmsIcon, backgroundColor: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)' }}><Globe size={18} color="#f43f5e" /></div><div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Webflow, Ghost, Blogger</h2><span style={styles.sub}>Segera hadir — hubungi 3Our bila butuh lebih cepat.</span></div><span className="badge badge-secondary">Soon</span></div>
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
            <label className="switch" title={isPremium ? '' : 'Fitur paket Pro'}>
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
            {profileMsg && <span style={{ ...styles.sub, marginLeft: '0.75rem' }}>{profileMsg === 'Profil disimpan.' ? t('seo.cms.brandSavedMsg') : profileMsg}</span>}
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
            <div><code>POST /api/v1/articles/generate</code> → <code>{'{ status, id, article }'}</code></div>
            <div><code>POST /api/v1/articles/:id/publish</code> body <code>{'{ action: "draft" | "publish", article? }'}</code> → kirim ke CMS yang tersimpan</div>
            <div><code>GET /api/v1/articles</code> → daftar artikel</div>
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
