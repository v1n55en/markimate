import { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Plus, Trash2, Eye, ExternalLink, Loader2, RefreshCw, Rocket, FileText, Lock, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { api, GEO_OPTIONS, LN_OPTIONS, CMS_LABEL } from '../api';

const STATUS_BADGE = {
  'Pending': 'badge-secondary', 'AI Writing...': 'badge-info', 'Review Ready': 'badge-warning',
  'Draft Created': 'badge-info', 'Published': 'badge-success', 'Error': 'badge-danger',
};

export default function KeywordManager({ me, refreshMe, goTo }) {
  const user = me.user;
  const isPremium = user.plan === 'premium';
  const webApprover = isPremium && user.webApprover !== false;
  const connectedCms = useMemo(() => (me.cms || []).filter(c => c.verified).map(c => c.cmsType), [me.cms]);
  const anyCms = useMemo(() => (me.cms || []).map(c => c.cmsType), [me.cms]);

  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState({}); // id -> 'run' | 'publish' | 'delete'
  const [form, setForm] = useState({ keyword: '', geo: 'ID', ln: 'id', cms: anyCms[0] || 'wordpress', schedule: 'immediate' });
  const [drawer, setDrawer] = useState(null); // keyword object being reviewed
  const [draft, setDraft] = useState(null);   // editable article copy
  const [drawerBusy, setDrawerBusy] = useState('');
  const [drawerError, setDrawerError] = useState('');

  useEffect(() => { if (!anyCms.includes(form.cms) && anyCms[0]) setForm(f => ({ ...f, cms: anyCms[0] })); }, [anyCms]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const d = await api('/api/keywords'); setKeywords(d.keywords); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upsertRow = (row) => setKeywords(list => list.some(k => k.id === row.id) ? list.map(k => k.id === row.id ? row : k) : [row, ...list]);
  const setBusyFor = (id, v) => setBusy(b => { const n = { ...b }; if (v) n[id] = v; else delete n[id]; return n; });
  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const runKeyword = async (id) => {
    setBusyFor(id, 'run'); setError('');
    setKeywords(list => list.map(k => k.id === id ? { ...k, status: 'AI Writing...', error: '' } : k));
    try {
      const d = await api(`/api/keywords/${id}/run`, { method: 'POST' });
      upsertRow(d.keyword); refreshMe();
      if (d.keyword.status === 'Review Ready') flash('Artikel siap ditinjau. Klik "Tinjau Draf".');
      else if (d.keyword.status === 'Draft Created') flash('Draf berhasil dibuat di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '.');
      else if (d.keyword.error) setError(d.keyword.error);
    } catch (e) {
      setError(e.message); await load();
      if (e.status === 402) goTo && setTimeout(() => goTo('billing'), 1500);
    } finally { setBusyFor(id, null); }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!form.keyword.trim()) return;
    if (!anyCms.length) { setError('Hubungkan CMS dulu di menu Pengaturan CMS & API.'); return; }
    setError('');
    try {
      const d = await api('/api/keywords', { method: 'POST', body: { keyword: form.keyword.trim(), geo: form.geo, ln: form.ln, cmsType: form.cms, schedule: form.schedule } });
      upsertRow(d.keyword); setForm(f => ({ ...f, keyword: '' }));
      if (form.schedule === 'immediate') runKeyword(d.keyword.id);
      else flash('Keyword dijadwalkan. Artikel pertama dibuat otomatis sesuai jadwal.');
    } catch (err) { setError(err.message); if (err.status === 402 && goTo) setTimeout(() => goTo('billing'), 1500); }
  };

  const deleteKeyword = async (id) => {
    if (!window.confirm('Hapus keyword ini dari Markimate? (Post di CMS tidak ikut terhapus)')) return;
    setBusyFor(id, 'delete');
    try { await api(`/api/keywords/${id}`, { method: 'DELETE' }); setKeywords(l => l.filter(k => k.id !== id)); } catch (e) { setError(e.message); } finally { setBusyFor(id, null); }
  };

  const publishExisting = async (id, action) => {
    setBusyFor(id, 'publish'); setError('');
    try { const d = await api(`/api/keywords/${id}/publish`, { method: 'POST', body: { action } }); upsertRow(d.keyword); flash(action === 'publish' ? 'Artikel diterbitkan.' : 'Draf dibuat di CMS.'); }
    catch (e) { setError(e.message); } finally { setBusyFor(id, null); }
  };

  // ---- drawer ----
  const openDrawer = (kw) => { setDrawer(kw); setDraft({ title: kw.article?.title || '', slug: kw.article?.slug || '', excerpt: kw.article?.excerpt || '', bodyMarkdown: kw.article?.bodyMarkdown || '' }); setDrawerError(''); };
  const closeDrawer = () => { setDrawer(null); setDraft(null); setDrawerBusy(''); };
  const submitDrawer = async (action) => {
    if (!drawer) return;
    setDrawerBusy(action); setDrawerError('');
    try {
      const d = await api(`/api/keywords/${drawer.id}/publish`, { method: 'POST', body: { action, article: draft } });
      upsertRow(d.keyword); closeDrawer(); flash(action === 'publish' ? 'Artikel diterbitkan di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '.' : 'Draf tersimpan di ' + (CMS_LABEL[d.keyword.cms] || d.keyword.cms) + '. Cek & terbitkan dari CMS atau dari sini.');
    } catch (e) { setDrawerError(e.message); setDrawerBusy(''); }
  };
  const regenerate = async () => { if (!drawer) return; const id = drawer.id; closeDrawer(); await runKeyword(id); };

  const wordCount = draft ? draft.bodyMarkdown.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div>
      <header style={styles.header}>
        <h1>Kontrol Automasi</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Masukkan keyword → 3Our meriset tren & volume, menulis artikel SEO, lalu {webApprover ? 'menunggu persetujuanmu sebelum dikirim ke' : 'langsung membuat draf di'} CMS-mu.</p>
      </header>

      {!anyCms.length && (
        <div className="card" style={{ ...styles.alert, borderColor: 'rgba(245,158,11,0.4)' }}>
          <AlertTriangle size={18} color="var(--accent-yellow)" />
          <div style={{ flex: 1 }}>Belum ada CMS yang terhubung. Hubungkan WordPress atau Wix dulu supaya artikel bisa dikirim.</div>
          <button className="btn btn-secondary" onClick={() => goTo && goTo('settings')}>Buka Pengaturan CMS</button>
        </div>
      )}
      {!isPremium && (
        <div className="card" style={styles.alert}>
          <Lock size={16} color="var(--text-muted)" />
          <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paket Free: {me.usage?.limit} artikel/bulan, draf langsung masuk CMS tanpa review. Upgrade ke <b>Pro</b> untuk Web Approver (review & edit sebelum terbit) dan jadwal otomatis.</div>
          <button className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => goTo && goTo('billing')}>Lihat paket</button>
        </div>
      )}

      {/* Form tambah keyword */}
      <form onSubmit={addKeyword} className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={styles.formRow}>
          <div className="form-group" style={{ flex: 2, minWidth: '220px', marginBottom: 0 }}>
            <label className="form-label">Keyword target</label>
            <input className="form-input" placeholder="contoh: digital marketing kuliner" value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label className="form-label">Negara</label>
            <select className="form-select" value={form.geo} onChange={e => setForm({ ...form, geo: e.target.value })}>{GEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          <div className="form-group" style={{ minWidth: '170px', marginBottom: 0 }}>
            <label className="form-label">Bahasa</label>
            <select className="form-select" value={form.ln} onChange={e => setForm({ ...form, ln: e.target.value })}>{LN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label className="form-label">CMS tujuan</label>
            <select className="form-select" value={form.cms} onChange={e => setForm({ ...form, cms: e.target.value })} disabled={!anyCms.length}>
              {anyCms.length ? anyCms.map(c => <option key={c} value={c}>{CMS_LABEL[c] || c}{connectedCms.includes(c) ? '' : ' (belum terverifikasi)'}</option>) : <option>Belum ada CMS</option>}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '190px', marginBottom: 0 }}>
            <label className="form-label">Jadwal {isPremium ? '' : '🔒 Pro'}</label>
            <select className="form-select" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}>
              <option value="immediate">Eksekusi langsung</option>
              <option value="daily" disabled={!isPremium}>Harian (otomatis)</option>
              <option value="weekly" disabled={!isPremium}>Mingguan (otomatis)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={styles.addBtn} disabled={!form.keyword.trim() || !anyCms.length}><Plus size={16} /> Tambah & Jalankan</button>
        </div>
      </form>

      {error && <div style={styles.errorBox}><AlertTriangle size={16} /> <span style={{ flex: 1 }}>{error}</span><button onClick={() => setError('')} style={styles.closeBtn}><X size={14} /></button></div>}
      {notice && <div style={styles.noticeBox}><CheckCircle2 size={16} /> {notice}</div>}

      {/* Tabel keyword */}
      <div className="card" style={{ padding: 0 }}>
        <div style={styles.tableHeader}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Daftar Keyword & Artikel</h2>
          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> Muat ulang</button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Keyword</th><th>Target</th><th>Volume / KD</th><th>CMS</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading && !keywords.length && <tr><td colSpan={6} style={styles.emptyCell}>Memuat…</td></tr>}
              {!loading && !keywords.length && <tr><td colSpan={6} style={styles.emptyCell}>Belum ada keyword. Tambahkan satu di atas untuk mulai.</td></tr>}
              {keywords.map(kw => {
                const b = busy[kw.id];
                const a = kw.article;
                return (
                  <tr key={kw.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{kw.keyword}</div>
                      <div style={styles.sub}>{kw.date}{kw.schedule !== 'immediate' ? ` · jadwal ${kw.schedule === 'daily' ? 'harian' : 'mingguan'}` : ''}</div>
                      {a?.title && <div style={{ ...styles.sub, color: 'var(--text-secondary)', marginTop: '0.2rem' }} title={a.title}>“{a.title.length > 70 ? a.title.slice(0, 70) + '…' : a.title}”</div>}
                    </td>
                    <td><span style={styles.sub}>{kw.geo} · {kw.ln}</span></td>
                    <td>{kw.volume ? <span>{Number(kw.volume).toLocaleString('id-ID')}<span style={styles.sub}> / KD {kw.difficulty ?? '–'}</span></span> : <span style={styles.sub}>–</span>}</td>
                    <td><span className="badge badge-secondary">{CMS_LABEL[kw.cms] || kw.cms}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[kw.status] || 'badge-secondary'}`}>{kw.status === 'AI Writing...' && <Loader2 size={12} className="spin-icon" />} {kw.status}</span>
                      {kw.error && <div style={{ ...styles.sub, color: 'var(--accent-red)', maxWidth: '260px' }} title={kw.error}>{kw.error.length > 90 ? kw.error.slice(0, 90) + '…' : kw.error}</div>}
                    </td>
                    <td>
                      <div style={styles.actionCell}>
                        {(kw.status === 'Pending' || kw.status === 'Error') && (
                          <button className="btn btn-primary" style={styles.smallBtn} disabled={!!b} onClick={() => runKeyword(kw.id)}>{b === 'run' ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />} Jalankan</button>
                        )}
                        {kw.status === 'Review Ready' && a && (
                          <button className="btn btn-secondary" style={{ ...styles.smallBtn, ...styles.reviewBtn }} onClick={() => openDrawer(kw)}><Eye size={14} /> Tinjau Draf</button>
                        )}
                        {kw.status === 'Draft Created' && (
                          <>
                            {kw.draftUrl && <a className="btn btn-secondary" style={styles.smallBtn} href={kw.draftUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Buka Draf</a>}
                            <button className="btn btn-primary" style={styles.smallBtn} disabled={!!b} onClick={() => publishExisting(kw.id, 'publish')} title="Terbitkan draf ini di CMS">{b === 'publish' ? <Loader2 size={14} className="spin-icon" /> : <Rocket size={14} />} Terbitkan</button>
                            {a && webApprover && <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => openDrawer(kw)} title="Edit lalu kirim ulang"><FileText size={14} /></button>}
                          </>
                        )}
                        {kw.status === 'Published' && (
                          <>
                            {kw.publicUrl && <a className="btn btn-secondary" style={styles.smallBtn} href={kw.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Lihat Artikel</a>}
                            {kw.draftUrl && <a className="btn btn-secondary" style={styles.smallBtn} href={kw.draftUrl} target="_blank" rel="noreferrer" title="Edit di CMS"><FileText size={14} /></a>}
                          </>
                        )}
                        {kw.status !== 'AI Writing...' && kw.status !== 'Pending' && (
                          <button className="btn btn-secondary" style={styles.smallBtn} disabled={!!b} onClick={() => runKeyword(kw.id)} title="Tulis ulang artikel"><RefreshCw size={14} /></button>
                        )}
                        <button className="btn btn-secondary" style={{ ...styles.smallBtn, color: 'var(--accent-red)' }} disabled={!!b} onClick={() => deleteKeyword(kw.id)} title="Hapus"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer review */}
      {drawer && draft && (
        <div style={styles.drawerOverlay} onClick={closeDrawer}>
          <div style={styles.drawer} onClick={e => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <div>
                <div style={{ fontWeight: 700 }}>Review Artikel: {drawer.keyword}</div>
                <div style={styles.sub}>Target: {drawer.article?.primaryKeyword || drawer.keyword} · {drawer.geo}/{drawer.ln} · tujuan {CMS_LABEL[drawer.cms] || drawer.cms}</div>
              </div>
              <button onClick={closeDrawer} style={styles.closeBtn}><X size={18} /></button>
            </div>
            <div style={styles.drawerBody}>
              <div style={styles.metricsRow}>
                <div style={styles.metricCard}><span style={styles.metricLabel}>Volume (Ahrefs)</span><span style={styles.metricValue}>{drawer.article?.searchVolume ? Number(drawer.article.searchVolume).toLocaleString('id-ID') : '–'}</span></div>
                <div style={styles.metricCard}><span style={styles.metricLabel}>Keyword Difficulty</span><span style={styles.metricValue}>{drawer.article?.difficulty ?? '–'}</span></div>
                <div style={styles.metricCard}><span style={styles.metricLabel}>Traffic Potential</span><span style={styles.metricValue}>{drawer.article?.trafficPotential ? Number(drawer.article.trafficPotential).toLocaleString('id-ID') : '–'}</span></div>
                <div style={styles.metricCard}><span style={styles.metricLabel}>Kata</span><span style={styles.metricValue}>{wordCount}</span></div>
              </div>
              {drawer.article?.keywords?.length > 1 && <div style={styles.sub}>Keyword terkait: {drawer.article.keywords.slice(1, 6).join(', ')}</div>}
              <div className="form-group"><label className="form-label">Judul</label><input className="form-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Slug</label><input className="form-input" value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Excerpt / Meta description</label><textarea className="form-input" rows={2} value={draft.excerpt} onChange={e => setDraft({ ...draft, excerpt: e.target.value })} /></div>
              <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label className="form-label">Isi artikel (Markdown)</label><textarea className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', minHeight: '320px', lineHeight: 1.5 }} value={draft.bodyMarkdown} onChange={e => setDraft({ ...draft, bodyMarkdown: e.target.value })} /></div>
              {drawerError && <div style={styles.errorBox}><AlertTriangle size={16} /> {drawerError}</div>}
            </div>
            <div style={styles.drawerFooter}>
              <button className="btn btn-secondary" onClick={regenerate} disabled={!!drawerBusy}><RefreshCw size={16} /> Regenerasi</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => submitDrawer('draft')} disabled={!!drawerBusy}>{drawerBusy === 'draft' ? <Loader2 size={16} className="spin-icon" /> : <FileText size={16} />} Simpan sebagai draf di CMS</button>
              <button className="btn btn-primary" onClick={() => submitDrawer('publish')} disabled={!!drawerBusy || !draft.title.trim()}>{drawerBusy === 'publish' ? <Loader2 size={16} className="spin-icon" /> : <Rocket size={16} />} Publikasikan ke {CMS_LABEL[drawer.cms] || drawer.cms}</button>
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
  tableHeader: { padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  emptyCell: { textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' },
  sub: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  actionCell: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  smallBtn: { padding: '0.375rem 0.7rem', fontSize: '0.75rem', gap: '0.3rem' },
  reviewBtn: { color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)', backgroundColor: 'var(--accent-cyan-glow)' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.85rem' },
  noticeBox: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.08)', color: '#6ee7b7', fontSize: '0.85rem' },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px', display: 'flex', alignItems: 'center' },
  drawerOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
  drawer: { width: '640px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' },
  drawerHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  metricsRow: { display: 'flex', gap: '0.75rem' },
  metricCard: { flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border-muted)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  metricLabel: { fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 },
  metricValue: { fontSize: '0.95rem', fontWeight: 700 },
  drawerFooter: { padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '0.6rem', backgroundColor: 'var(--bg-base)', flexWrap: 'wrap' },
};
