import { useState, useEffect } from 'react';
import { Globe, Plug, CheckCircle2, AlertTriangle, Loader2, Key, Copy, RefreshCw, Lock, ExternalLink, Trash2 } from 'lucide-react';
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
    help: 'Buka sanity.io/manage → pilih project → API → Tokens → Add API token → izin "Editor" → salin token. Project ID ada di halaman project. Artikel disimpan sebagai dokumen (default type "post", isi di field "body" berupa Portable Text) — sesuaikan bila schema Studio-mu berbeda.',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'abc123xy' },
      { key: 'dataset', label: 'Dataset', placeholder: 'production' },
      { key: 'token', label: 'API Token (izin Editor)', placeholder: 'sk...', secret: true },
      { key: 'studioUrl', label: 'URL Sanity Studio (opsional, untuk link edit)', placeholder: 'https://namastudio.sanity.studio' },
      { key: 'docType', label: 'Document type (opsional)', placeholder: 'post' },
      { key: 'bodyField', label: 'Field isi artikel (opsional)', placeholder: 'body' },
      { key: 'publicUrlPattern', label: 'Pola URL artikel publik (opsional)', placeholder: 'https://situsmu.com/blog/{slug}' },
    ],
  },
  shopify: {
    label: 'Shopify Blog', color: '#5e8e3e',
    help: 'Buka dev.shopify.com (Dev Dashboard) → Create app → Versions: pilih scope "read_content" & "write_content" → Release → Install app ke tokomu → salin Client ID & Client Secret (Settings). Punya custom app lama? Cukup isi Admin API access token (shpat_…). Domain toko pakai format namatoko.myshopify.com.',
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

export default function CmsSettings({ me, refreshMe, goTo }) {
  const user = me.user;
  const isPremium = user.plan === 'premium';
  const [forms, setForms] = useState({ wordpress: {}, wix: {}, sanity: {}, shopify: {} });
  const [state, setState] = useState({}); // type -> {busy, result}
  const [saved, setSaved] = useState({});
  const [profile, setProfile] = useState({ brandName: user.brandName || '', niche: user.niche || '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    const next = { wordpress: {}, wix: {}, sanity: {}, shopify: {} }; const sv = {};
    for (const c of me.cms || []) { next[c.cmsType] = { ...c.config }; sv[c.cmsType] = c; }
    setForms(next); setSaved(sv);
  }, [me.cms]);

  const setField = (type, key, v) => setForms(f => ({ ...f, [type]: { ...f[type], [key]: v } }));
  const save = async (type) => {
    setState(s => ({ ...s, [type]: { busy: true } }));
    try {
      const d = await api(`/api/cms/${type}`, { method: 'PUT', body: { config: forms[type] } });
      setState(s => ({ ...s, [type]: { busy: false, result: d.test } }));
      await refreshMe();
    } catch (e) { setState(s => ({ ...s, [type]: { busy: false, result: { ok: false, message: e.message } } })); }
  };
  const remove = async (type) => {
    if (!window.confirm(`Putuskan koneksi ${CMS_META[type].label}?`)) return;
    await api(`/api/cms/${type}`, { method: 'DELETE' }); setForms(f => ({ ...f, [type]: {} })); setState(s => ({ ...s, [type]: {} })); await refreshMe();
  };
  const saveProfile = async (e) => {
    e.preventDefault(); setProfileMsg('');
    try { await api('/api/me', { method: 'PATCH', body: profile }); await refreshMe(); setProfileMsg('Profil disimpan.'); } catch (err) { setProfileMsg(err.message); }
  };
  const toggleApprover = async (on) => { try { await api('/api/me', { method: 'PATCH', body: { webApprover: on } }); await refreshMe(); } catch (e) { alert(e.message); } };
  const copyKey = async () => { try { await navigator.clipboard.writeText(user.apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* abaikan */ } };
  const rotateKey = async () => { if (!window.confirm('Buat API key baru? Key lama langsung tidak berlaku.')) return; setRotating(true); try { await api('/api/me/api-key/rotate', { method: 'POST' }); await refreshMe(); } finally { setRotating(false); } };

  const curl = `curl -X POST ${API_BASE_URL}/api/v1/articles/generate \\\n  -H "X-API-Key: ${user.apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"keyword":"digital marketing kuliner","geo":"ID","ln":"id","cmsType":"wordpress"}'`;

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>Pengaturan CMS & API</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Hubungkan CMS milikmu. Kredensial disimpan aman di server Markimate dan hanya dipakai saat mengirim artikel ke situsmu.</p>
      </header>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {Object.entries(CMS_META).map(([type, meta]) => {
          const f = forms[type] || {}; const st = state[type] || {}; const sv = saved[type];
          return (
            <div className="card" key={type}>
              <div style={styles.cardHead}>
                <div style={{ ...styles.cmsIcon, backgroundColor: meta.color + '22', border: `1px solid ${meta.color}55` }}><Globe size={18} color={meta.color} /></div>
                <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: '1rem' }}>{meta.label}</h2><span style={styles.sub}>{sv ? (sv.verified ? 'Terhubung & terverifikasi' : 'Tersimpan, belum terverifikasi') : 'Belum terhubung'}</span></div>
                {sv && <span className={`badge ${sv.verified ? 'badge-success' : 'badge-warning'}`}>{sv.verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {sv.verified ? 'OK' : 'Cek'}</span>}
              </div>
              <p style={{ ...styles.sub, marginBottom: '1rem', lineHeight: 1.5 }}>{meta.help}</p>
              {meta.fields.map(fl => (
                <div className="form-group" key={fl.key}>
                  <label className="form-label">{fl.label}</label>
                  <input className="form-input" type={fl.secret ? 'password' : 'text'} placeholder={fl.placeholder} value={f[fl.key] || ''} onChange={e => setField(type, fl.key, e.target.value)} autoComplete="off" />
                </div>
              ))}
              {st.result && <div style={st.result.ok ? styles.okBox : styles.errBox}>{st.result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {st.result.message}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => save(type)} disabled={st.busy}>{st.busy ? <Loader2 size={16} className="spin-icon" /> : <Plug size={16} />} Simpan & Tes koneksi</button>
                {sv && <button className="btn btn-secondary" onClick={() => remove(type)} title="Putuskan"><Trash2 size={16} /></button>}
              </div>
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
          <h2 style={{ fontSize: '1rem' }}>Persetujuan Konten</h2>
          <div style={styles.toggleRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Web Approver {!isPremium && <Lock size={14} color="var(--text-muted)" />}</div>
              <div style={styles.sub}>Artikel ditahan sebagai "Review Ready" — kamu tinjau & edit di Markimate sebelum dikirim ke CMS. Nonaktif = draf langsung dibuat di CMS.</div>
            </div>
            <label className="switch" title={isPremium ? '' : 'Fitur paket Pro'}>
              <input type="checkbox" checked={isPremium && user.webApprover !== false} disabled={!isPremium} onChange={e => toggleApprover(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>
          {!isPremium && <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => goTo && goTo('billing')}>👑 Upgrade ke Pro untuk mengaktifkan</button>}
          <hr style={styles.hr} />
          <form onSubmit={saveProfile}>
            <h2 style={{ fontSize: '1rem' }}>Profil Brand (dipakai AI untuk CTA)</h2>
            <div className="form-group"><label className="form-label">Nama brand</label><input className="form-input" value={profile.brandName} onChange={e => setProfile({ ...profile, brandName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Niche / bidang usaha</label><input className="form-input" value={profile.niche} onChange={e => setProfile({ ...profile, niche: e.target.value })} placeholder="contoh: coffee shop, klinik kecantikan" /></div>
            <button className="btn btn-primary" type="submit">Simpan profil</button>
            {profileMsg && <span style={{ ...styles.sub, marginLeft: '0.75rem' }}>{profileMsg}</span>}
          </form>
        </div>

        {/* 3Our API */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={16} color="var(--accent-cyan)" /> 3Our API</h2>
          <p style={styles.sub}>Pakai Markimate dari sistemmu sendiri (Zapier, n8n, aplikasi internal). Semua riset & AI pakai infrastruktur 3Our — kamu tidak perlu API key SerpAPI/Gemini sendiri.</p>
          <label className="form-label" style={{ marginTop: '0.75rem' }}>API key kamu</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="form-input" readOnly value={user.apiKey || ''} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
            <button className="btn btn-secondary" onClick={copyKey} title="Salin">{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}</button>
            <button className="btn btn-secondary" onClick={rotateKey} disabled={rotating} title="Buat key baru"><RefreshCw size={16} className={rotating ? 'spin-icon' : ''} /></button>
          </div>
          {!isPremium && <div style={{ ...styles.sub, marginTop: '0.5rem' }}>Paket Free mengikuti kuota {me.usage?.limit} artikel/bulan yang sama.</div>}
          <label className="form-label" style={{ marginTop: '1rem' }}>Contoh: buat artikel</label>
          <pre style={styles.pre}>{curl}</pre>
          <div style={{ ...styles.sub, lineHeight: 1.7 }}>
            <div><code>POST /api/v1/articles/generate</code> → <code>{'{ status, id, article }'}</code></div>
            <div><code>POST /api/v1/articles/:id/publish</code> body <code>{'{ action: "draft" | "publish", article? }'}</code> → kirim ke CMS yang tersimpan</div>
            <div><code>GET /api/v1/articles</code> → daftar artikel</div>
          </div>
          <a href="https://3ourasia.id" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.8rem' }}><ExternalLink size={14} /> Butuh integrasi khusus? Hubungi 3Our</a>
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
};
