// Supermat Backend — API web app + "3Our API" publik untuk klien.
// Alur: user daftar → simpan kredensial CMS (WordPress/Wix) → jalankan keyword → n8n (3Our) riset + tulis artikel
// → (Premium) review di web → publish ke CMS user lewat n8n adapter. Billing masih dummy.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db, dbMode } from './db.js';
import { encrypt, decrypt } from './lib/crypto.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-di-env-JWT_SECRET';
const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'https://n8n.3ourasia.id').replace(/\/+$/, '');
// Override opsional (nama baru, supaya env lama N8N_URL_RUN/N8N_URL_PUBLISH dari versi v1 tidak terpakai)
const N8N_URL_RUN = process.env.SUPERMAT_N8N_RUN_URL || `${N8N_BASE_URL}/webhook/supermat-trigger`;
const N8N_URL_PUBLISH = process.env.SUPERMAT_N8N_PUBLISH_URL || `${N8N_BASE_URL}/webhook/supermat-publish`;
const SUPERMAT_API_KEY = process.env.SUPERMAT_API_KEY || ''; // key 3Our untuk memanggil n8n (header X-Supermat-Key)
const CRON_SECRET = process.env.CRON_SECRET || '';
const FREE_MONTHLY_LIMIT = Number(process.env.FREE_MONTHLY_LIMIT || 3);

export const PLANS = {
  free: { id: 'free', name: 'Free', price: 0, monthlyArticles: FREE_MONTHLY_LIMIT, features: ['3 artikel / bulan', 'Riset keyword + AI writer', 'Draf langsung ke CMS', '1 koneksi CMS'] },
  premium: { id: 'premium', name: 'Pro', price: 299000, monthlyArticles: 60, features: ['60 artikel / bulan', 'Web Approver: review & edit sebelum terbit', 'Jadwal otomatis harian/mingguan', 'WordPress + Wix', 'Akses 3Our API (API key)', 'Prioritas dukungan 3Our'] },
};

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ---------- CORS ----------
const allowed = String(process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.length === 0) return cb(null, /localhost|127\.0\.0\.1|\.vercel\.app$/.test(new URL(origin).host) ? true : false);
    return cb(null, allowed.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ---------- Helpers ----------
const genApiKey = () => 'spm_live_' + randomBytes(18).toString('base64url');
const publicUser = (u) => u && ({ id: u.id, email: u.email, brandName: u.brand_name, niche: u.niche, plan: u.plan || 'free', apiKey: u.api_key, webApprover: u.web_approver !== false, createdAt: u.created_at });
const signToken = (u) => jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '30d' });
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
const mask = (s) => { s = String(s || ''); return s.length <= 6 ? (s ? '••••' : '') : s.slice(0, 3) + '••••' + s.slice(-3); };

async function usageOf(userId) {
  const rows = await db.findMany('keywords', { user_id: userId });
  const since = monthStart();
  return rows.filter(k => k.last_run_at && k.last_run_at >= since).length;
}
const planOf = (u) => PLANS[u.plan] || PLANS.free;

function friendlyN8nError(status, text) {
  let parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
  const msg = parsed && (parsed.message || parsed.error);
  if (status === 404 || /not registered/i.test(text)) return 'Endpoint n8n belum aktif (404). Pastikan workflow "Supermat API" sudah dipublish.';
  if (status === 401) return 'Backend ditolak n8n (401): SUPERMAT_API_KEY di server tidak cocok dengan key di n8n.';
  if (/Error in workflow/i.test(text)) return 'Terjadi error di workflow n8n. Cek eksekusi terakhir di n8n.';
  return msg || `n8n HTTP ${status}`;
}

async function callN8n(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPERMAT_API_KEY) headers['X-Supermat-Key'] = SUPERMAT_API_KEY;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok || !json || json.status === 'error') {
    const err = new Error((json && json.message) || friendlyN8nError(res.status, text));
    err.status = res.status >= 400 && res.status < 500 ? 400 : 502; err.n8n = json; throw err;
  }
  return json;
}

// ---------- Auth middleware ----------
async function auth(req, res, next) {
  try {
    const h = String(req.headers.authorization || '');
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Belum login.' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.findOne('accounts', { id: payload.sub });
    if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan.' });
    req.user = user; next();
  } catch (e) { return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang.' }); }
}
async function apiKeyAuth(req, res, next) {
  const key = String(req.headers['x-api-key'] || '').trim() || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!key) return res.status(401).json({ status: 'error', message: 'Kirim header X-API-Key.' });
  const user = await db.findOne('accounts', { api_key: key });
  if (!user) return res.status(401).json({ status: 'error', message: 'API key tidak valid.' });
  req.user = user; next();
}
const wrap = (fn) => (req, res) => fn(req, res).catch(e => { log(`[ERR] ${req.method} ${req.path}: ${e.message}`); res.status(e.status || 500).json({ error: e.message, n8n: e.n8n || undefined }); });

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: dbMode, n8n: N8N_BASE_URL, time: new Date().toISOString() }));

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password, brandName, niche } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw Object.assign(new Error('Email tidak valid.'), { status: 400 });
  if (String(password || '').length < 6) throw Object.assign(new Error('Kata sandi minimal 6 karakter.'), { status: 400 });
  if (await db.findOne('accounts', { email: em })) throw Object.assign(new Error('Email sudah terdaftar, silakan masuk.'), { status: 409 });
  const user = await db.insert('accounts', { email: em, password_hash: await bcrypt.hash(password, 10), brand_name: String(brandName || '').trim() || em.split('@')[0], niche: String(niche || 'Other'), plan: 'free', api_key: genApiKey(), web_approver: true });
  res.json({ token: signToken(user), user: publicUser(user) });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const em = String((req.body || {}).email || '').trim().toLowerCase();
  const user = await db.findOne('accounts', { email: em });
  if (!user || !(await bcrypt.compare(String((req.body || {}).password || ''), user.password_hash))) throw Object.assign(new Error('Email atau kata sandi salah.'), { status: 401 });
  res.json({ token: signToken(user), user: publicUser(user) });
}));
app.get('/api/me', auth, wrap(async (req, res) => {
  const conns = await db.findMany('cms_connections', { user_id: req.user.id });
  const runs = await usageOf(req.user.id);
  res.json({ user: publicUser(req.user), plan: planOf(req.user), usage: { runsThisMonth: runs, limit: planOf(req.user).monthlyArticles }, cms: conns.map(maskConn) });
}));
app.patch('/api/me', auth, wrap(async (req, res) => {
  const patch = {};
  if (req.body.brandName !== undefined) patch.brand_name = String(req.body.brandName).trim();
  if (req.body.niche !== undefined) patch.niche = String(req.body.niche);
  if (req.body.webApprover !== undefined) patch.web_approver = !!req.body.webApprover;
  const u = await db.update('accounts', { id: req.user.id }, patch);
  res.json({ user: publicUser(u) });
}));
app.post('/api/me/api-key/rotate', auth, wrap(async (req, res) => {
  const u = await db.update('accounts', { id: req.user.id }, { api_key: genApiKey() });
  res.json({ user: publicUser(u) });
}));

// ---------- CMS connections ----------
const CMS_TYPES = ['wordpress', 'wix', 'sanity', 'shopify'];
const CMS_NAME = { wordpress: 'situs WordPress', wix: 'Wix API', sanity: 'Sanity API', shopify: 'Shopify Admin API' };

export function resolveConnConfig(c) {
  if (!c) return {};
  if (c.config_enc && c.config_iv) {
    try {
      const dec = decrypt(c.config_enc, c.config_iv);
      if (dec && typeof dec === 'object') return dec;
    } catch (e) {
      console.error(`[CMS] Gagal dekripsi kredensial ${c.id}: ${e.message}`);
    }
  }
  const raw = c.config || {};
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    try {
      const { enc, iv } = encrypt(raw);
      if (enc && iv) {
        db.update('cms_connections', { id: c.id }, { config_enc: enc, config_iv: iv, config: {} }).catch((err) => {
          console.error(`[CMS] Lazy encrypt update gagal: ${err.message}`);
        });
        c.config_enc = enc;
        c.config_iv = iv;
        c.config = {};
      }
    } catch (err) {
      console.error(`[CMS] Lazy encrypt gagal: ${err.message}`);
    }
  }
  return raw;
}

function maskConn(c) {
  const cfg = resolveConnConfig(c);
  const safe = c.cms_type === 'wordpress'
    ? { url: cfg.url, user: cfg.user, appPassword: mask(cfg.appPassword) }
    : c.cms_type === 'shopify'
      ? { shop: cfg.shop, accessToken: mask(cfg.accessToken), clientId: cfg.clientId || '', clientSecret: mask(cfg.clientSecret), blogId: cfg.blogId || '', authorName: cfg.authorName || '' }
    : c.cms_type === 'sanity'
      ? { projectId: cfg.projectId, dataset: cfg.dataset, token: mask(cfg.token), studioUrl: cfg.studioUrl || '', docType: cfg.docType || 'post', bodyField: cfg.bodyField || 'body', publicUrlPattern: cfg.publicUrlPattern || '' }
      : { siteId: cfg.siteId, apiKey: mask(cfg.apiKey), memberId: cfg.memberId || '' };
  return { cmsType: c.cms_type, config: safe, verified: !!c.verified, verifiedAt: c.verified_at, updatedAt: c.updated_at, articleSettings: c.article_settings || {} };
}
function normalizeConfig(type, input) {
  const s = v => String(v ?? '').trim();
  if (type === 'wordpress') {
    let url = s(input.url); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url; url = url.replace(/\/+$/, '');
    return { url, user: s(input.user), appPassword: s(input.appPassword) };
  }
  if (type === 'shopify') {
    let shop = s(input.shop).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (shop && !shop.includes('.')) shop += '.myshopify.com';
    return { shop, accessToken: s(input.accessToken), clientId: s(input.clientId), clientSecret: s(input.clientSecret), blogId: s(input.blogId), authorName: s(input.authorName) };
  }
  if (type === 'sanity') {
    let studioUrl = s(input.studioUrl); if (studioUrl && !/^https?:\/\//i.test(studioUrl)) studioUrl = 'https://' + studioUrl; studioUrl = studioUrl.replace(/\/+$/, '');
    return { projectId: s(input.projectId).toLowerCase(), dataset: s(input.dataset) || 'production', token: s(input.token), studioUrl, docType: s(input.docType) || 'post', bodyField: s(input.bodyField) || 'body', publicUrlPattern: s(input.publicUrlPattern) };
  }
  return { siteId: s(input.siteId), apiKey: s(input.apiKey), memberId: s(input.memberId) };
}
async function testConnection(type, cfg) {
  try { return await testConnectionInner(type, cfg); }
  catch (e) { return { ok: false, message: 'Tidak bisa menghubungi ' + (CMS_NAME[type] || type) + ': ' + e.message }; }
}
async function testConnectionInner(type, cfg) {
  if (type === 'wordpress') {
    if (!cfg.url || !cfg.user || !cfg.appPassword) return { ok: false, message: 'Isi URL situs, username, dan Application Password.' };
    const r = await fetch(cfg.url + '/wp-json/wp/v2/users/me?context=edit', { headers: { Authorization: 'Basic ' + Buffer.from(cfg.user + ':' + cfg.appPassword.replace(/\s+/g, '')).toString('base64'), 'User-Agent': 'Supermat/1.0' } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (r.ok && j && j.id) { const caps = j.capabilities || {}; const canWrite = caps.edit_posts !== false; return { ok: true, message: `Terhubung sebagai ${j.name || j.slug}${canWrite ? '' : ' (tidak punya izin menulis post)'}`, meta: { userId: j.id, name: j.name } }; }
    if (r.status === 401 || r.status === 403) return { ok: false, message: 'WordPress menolak login (' + r.status + '). Pastikan Application Password benar (Users → Profile → Application Passwords).' };
    if (r.status === 404) return { ok: false, message: 'REST API tidak ditemukan. Pastikan URL benar dan /wp-json aktif.' };
    return { ok: false, message: 'Gagal: HTTP ' + r.status + ' ' + (j && j.message ? j.message : '') };
  }
  if (type === 'sanity') return testSanity(cfg);
  if (type === 'shopify') return testShopify(cfg);
  if (!cfg.siteId || !cfg.apiKey) return { ok: false, message: 'Isi Site ID dan API Key Wix.' };
  const r = await fetch('https://www.wixapis.com/blog/v3/posts?paging.limit=1', { headers: { Authorization: cfg.apiKey, 'wix-site-id': cfg.siteId } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.ok) return { ok: true, message: 'Terhubung ke Wix Blog' + (j && j.posts && j.posts.length ? ' (post terakhir: ' + j.posts[0].title + ')' : ' (belum ada post)'), meta: { memberId: j && j.posts && j.posts[0] ? j.posts[0].memberId : '' } };
  if (r.status === 401 || r.status === 403) return { ok: false, message: 'Wix menolak API key / Site ID (' + r.status + '). Buat API key di Wix Account → API Keys dengan izin Blog.' };
  return { ok: false, message: 'Gagal: HTTP ' + r.status + ' ' + (j && j.message ? j.message : '') };
}
// Sanity: baca jumlah dokumen (cek project/dataset/token) + dry-run mutation (cek izin tulis, tidak menyimpan apa pun)
async function testSanity(cfg) {
  if (!cfg.projectId || !cfg.token) return { ok: false, message: 'Isi Project ID dan API Token Sanity.' };
  if (!/^[a-z0-9]+$/.test(cfg.projectId) || !/^[a-z0-9_-]+$/i.test(cfg.dataset)) return { ok: false, message: 'Format Project ID / dataset tidak valid.' };
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(cfg.docType) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cfg.bodyField)) return { ok: false, message: 'Nama document type / field isi tidak valid.' };
  const api = `https://${cfg.projectId}.api.sanity.io/v2025-02-19/data`;
  const headers = { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' };
  const q = await fetch(`${api}/query/${encodeURIComponent(cfg.dataset)}`, { method: 'POST', headers, body: JSON.stringify({ query: 'count(*[_type == $t])', params: { t: cfg.docType } }) });
  const qj = await q.json().catch(() => ({}));
  if (q.status === 401) return { ok: false, message: 'Token Sanity tidak valid (401). Buat token di sanity.io/manage → API → Tokens.' };
  if (q.status === 404) return { ok: false, message: 'Project ID atau dataset tidak ditemukan (404).' };
  if (!q.ok) return { ok: false, message: 'Gagal membaca Sanity: HTTP ' + q.status + ' ' + ((qj.error && (qj.error.description || qj.error)) || '') };
  const m = await fetch(`${api}/mutate/${encodeURIComponent(cfg.dataset)}?dryRun=true`, { method: 'POST', headers, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'drafts.supermat-connection-test', _type: cfg.docType, title: 'Supermat connection test' } }] }) });
  if (m.status === 401 || m.status === 403) return { ok: false, message: 'Token Sanity hanya bisa membaca (' + m.status + '). Buat token dengan izin Editor.' };
  if (!m.ok) { const mj = await m.json().catch(() => ({})); return { ok: false, message: 'Tes tulis Sanity gagal: HTTP ' + m.status + ' ' + ((mj.error && (mj.error.description || mj.error)) || '') }; }
  return { ok: true, message: `Terhubung ke Sanity (${cfg.projectId}/${cfg.dataset}) — ${qj.result ?? 0} dokumen "${cfg.docType}", izin tulis OK` };
}
// Shopify: (tukar Client ID/Secret → token 24 jam bila perlu) lalu baca toko, blog, dan scope app
async function testShopify(cfg) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cfg.shop || '')) return { ok: false, message: 'Domain toko harus berformat namatoko.myshopify.com (lihat Settings → Domains di Shopify Admin).' };
  let token = cfg.accessToken;
  if (!token) {
    if (!cfg.clientId || !cfg.clientSecret) return { ok: false, message: 'Isi Admin API access token, atau Client ID + Client Secret dari app Dev Dashboard.' };
    const t = await fetch(`https://${cfg.shop}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret }) });
    const tj = await t.json().catch(() => ({}));
    if (!t.ok || !tj.access_token) return { ok: false, message: 'Client ID/Secret ditolak (' + t.status + '): ' + (tj.error_description || tj.error || 'pastikan app sudah di-install di toko ini dan app & toko satu organisasi Shopify.') };
    token = tj.access_token;
  }
  const r = await fetch(`https://${cfg.shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ shop { name } blogs(first: 20) { nodes { id handle title } } currentAppInstallation { accessScopes { handle } } }' }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) return { ok: false, message: 'Token Shopify tidak valid (401).' };
  if (r.status === 403) return { ok: false, message: 'Token Shopify tidak punya izin (403). Tambahkan scope read_content & write_content lalu install ulang app.' };
  if (r.status === 404) return { ok: false, message: 'Toko tidak ditemukan (404). Cek domain .myshopify.com.' };
  if (!r.ok || !j.data) return { ok: false, message: 'Gagal membaca toko: ' + (j.errors ? JSON.stringify(j.errors).slice(0, 160) : 'HTTP ' + r.status) };
  const scopes = ((j.data.currentAppInstallation || {}).accessScopes || []).map(x => x.handle);
  if (scopes.length && !scopes.some(x => x === 'write_content' || x === 'write_online_store_pages')) return { ok: false, message: 'App belum punya scope write_content. Tambahkan di Dev Dashboard → Versions → Access scopes, rilis versi baru, lalu install ulang.' };
  const blogs = (j.data.blogs && j.data.blogs.nodes) || [];
  if (!blogs.length) return { ok: false, message: 'Terhubung ke ' + j.data.shop.name + ', tapi toko belum punya blog. Buat dulu di Online Store → Blog posts → Manage blogs.' };
  const chosen = cfg.blogId ? blogs.find(b => b.id === cfg.blogId || b.id.endsWith('/' + cfg.blogId) || b.handle === cfg.blogId) : blogs[0];
  if (!chosen) return { ok: false, message: 'Blog "' + cfg.blogId + '" tidak ditemukan. Blog yang ada: ' + blogs.map(b => b.handle).join(', ') };
  return { ok: true, message: `Terhubung ke ${j.data.shop.name} — artikel masuk ke blog "${chosen.title}" (${blogs.length} blog tersedia: ${blogs.map(b => b.handle).join(', ')})`, meta: { blogs } };
}
export const DEFAULT_ARTICLE_SETTINGS = {
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

export function normalizeArticleSettings(input = {}) {
  const d = DEFAULT_ARTICLE_SETTINGS;
  const img = input.images || {};
  const lnk = input.links || {};
  const dup = input.duplicateCheck || {};
  const san = input.sanity || {};
  const wp = input.wordpress || {};
  const wx = input.wix || {};
  const sh = input.shopify || {};

  return {
    images: {
      enabled: img.enabled !== undefined ? !!img.enabled : d.images.enabled,
      count: Math.min(Math.max(Number(img.count) || d.images.count, 1), 3),
      style: typeof img.style === 'string' ? img.style : d.images.style,
      aspectHero: typeof img.aspectHero === 'string' ? img.aspectHero : d.images.aspectHero,
      aspectInline: typeof img.aspectInline === 'string' ? img.aspectInline : d.images.aspectInline,
    },
    links: {
      internal: lnk.internal !== undefined ? !!lnk.internal : d.links.internal,
      maxInternal: Math.min(Math.max(Number(lnk.maxInternal) || d.links.maxInternal, 1), 10),
      external: lnk.external !== undefined ? !!lnk.external : d.links.external,
      maxExternal: Math.min(Math.max(Number(lnk.maxExternal) || d.links.maxExternal, 1), 5),
      siteBaseUrl: typeof lnk.siteBaseUrl === 'string' ? lnk.siteBaseUrl.trim() : d.links.siteBaseUrl,
      excludeDomains: Array.isArray(lnk.excludeDomains) ? lnk.excludeDomains.map(s => String(s).trim().toLowerCase()).filter(Boolean) : d.links.excludeDomains,
    },
    duplicateCheck: {
      enabled: dup.enabled !== undefined ? !!dup.enabled : d.duplicateCheck.enabled,
      threshold: typeof dup.threshold === 'number' ? Math.min(Math.max(dup.threshold, 0.1), 1.0) : d.duplicateCheck.threshold,
    },
    sanity: {
      authorId: typeof san.authorId === 'string' ? san.authorId.trim() : d.sanity.authorId,
      autoCreateAuthor: san.autoCreateAuthor !== undefined ? !!san.autoCreateAuthor : d.sanity.autoCreateAuthor,
      categoryIds: Array.isArray(san.categoryIds) ? san.categoryIds : d.sanity.categoryIds,
      categoryMode: ['fixed', 'ai', 'fixed+ai'].includes(san.categoryMode) ? san.categoryMode : d.sanity.categoryMode,
      publishedAtField: typeof san.publishedAtField === 'string' && san.publishedAtField.trim() ? san.publishedAtField.trim() : d.sanity.publishedAtField,
      mainImageField: typeof san.mainImageField === 'string' && san.mainImageField.trim() ? san.mainImageField.trim() : d.sanity.mainImageField,
      excerptField: typeof san.excerptField === 'string' && san.excerptField.trim() ? san.excerptField.trim() : d.sanity.excerptField,
    },
    wordpress: {
      defaultCategoryIds: Array.isArray(wp.defaultCategoryIds) ? wp.defaultCategoryIds : (Array.isArray(wp.categoryIds) ? wp.categoryIds : d.wordpress.defaultCategoryIds),
      authorId: wp.authorId !== undefined ? wp.authorId : d.wordpress.authorId,
    },
    wix: {
      categoryIds: Array.isArray(wx.categoryIds) ? wx.categoryIds : d.wix.categoryIds,
    },
    shopify: {
      tags: Array.isArray(sh.tags) ? sh.tags : d.shopify.tags,
    },
  };
}

async function fetchCmsOptions(type, cfg) {
  try {
    if (type === 'sanity') {
      if (!cfg.projectId || !cfg.token) return { authors: [], categories: [] };
      const api = `https://${cfg.projectId}.api.sanity.io/v2025-02-19/data/query/${encodeURIComponent(cfg.dataset || 'production')}`;
      const query = '*[_type in ["author","category"]]{_id,_type,title,name}';
      const r = await fetch(`${api}?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: 'Bearer ' + cfg.token }
      });
      if (!r.ok) return { authors: [], categories: [], error: 'HTTP ' + r.status };
      const j = await r.json().catch(() => ({}));
      const items = j.result || [];
      return {
        authors: items.filter(x => x._type === 'author').map(x => ({ id: x._id, name: x.name || x.title || x._id })),
        categories: items.filter(x => x._type === 'category').map(x => ({ id: x._id, title: x.title || x.name || x._id }))
      };
    }
    if (type === 'wordpress') {
      if (!cfg.url || !cfg.user || !cfg.appPassword) return { categories: [], authors: [] };
      const authHeader = 'Basic ' + Buffer.from(cfg.user + ':' + cfg.appPassword.replace(/\s+/g, '')).toString('base64');
      const [catsRes, usersRes] = await Promise.all([
        fetch(`${cfg.url}/wp-json/wp/v2/categories?per_page=100`, { headers: { Authorization: authHeader } }).catch(() => null),
        fetch(`${cfg.url}/wp-json/wp/v2/users?per_page=100`, { headers: { Authorization: authHeader } }).catch(() => null)
      ]);
      const cats = (catsRes && catsRes.ok) ? await catsRes.json().catch(() => []) : [];
      const users = (usersRes && usersRes.ok) ? await usersRes.json().catch(() => []) : [];
      return {
        categories: Array.isArray(cats) ? cats.map(c => ({ id: c.id, name: c.name })) : [],
        authors: Array.isArray(users) ? users.map(u => ({ id: u.id, name: u.name || u.slug })) : []
      };
    }
    if (type === 'wix') {
      if (!cfg.siteId || !cfg.apiKey) return { categories: [] };
      const r = await fetch('https://www.wixapis.com/blog/v3/categories?paging.limit=100', {
        headers: { Authorization: cfg.apiKey, 'wix-site-id': cfg.siteId }
      }).catch(() => null);
      if (!r || !r.ok) return { categories: [] };
      const j = await r.json().catch(() => ({}));
      const list = j.categories || [];
      return {
        categories: list.map(c => ({ id: c.id, label: c.label || c.name || c.id }))
      };
    }
    if (type === 'shopify') {
      if (!cfg.shop) return { blogs: [], tags: [] };
      let token = cfg.accessToken;
      if (!token && cfg.clientId && cfg.clientSecret) {
        const t = await fetch(`https://${cfg.shop}/admin/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret })
        }).catch(() => null);
        const tj = t ? await t.json().catch(() => ({})) : {};
        token = tj.access_token;
      }
      if (!token) return { blogs: [], tags: [] };
      const r = await fetch(`https://${cfg.shop}/admin/api/2026-07/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ blogs(first: 20) { nodes { id handle title } } articles(first: 25) { nodes { tags } } }' })
      }).catch(() => null);
      if (!r || !r.ok) return { blogs: [], tags: [] };
      const j = await r.json().catch(() => ({}));
      const blogs = (j.data?.blogs?.nodes || []).map(b => ({ id: b.id, handle: b.handle, title: b.title }));
      const tagSet = new Set();
      for (const a of j.data?.articles?.nodes || []) {
        if (Array.isArray(a.tags)) a.tags.forEach(t => tagSet.add(t));
      }
      return { blogs, tags: Array.from(tagSet) };
    }
  } catch (err) {
    console.error(`[CMS Options] Gagal mengambil opsi ${type}:`, err.message);
  }
  return {};
}

app.get('/api/cms', auth, wrap(async (req, res) => res.json({ cms: (await db.findMany('cms_connections', { user_id: req.user.id })).map(maskConn) })));
app.get('/api/cms/:type/options', auth, wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  const c = await db.findOne('cms_connections', { user_id: req.user.id, cms_type: type });
  if (!c) return res.json({ options: {} });
  const cfg = resolveConnConfig(c);
  const options = await fetchCmsOptions(type, cfg);
  res.json({ options });
}));
app.put('/api/cms/:type', auth, wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  if (!CMS_TYPES.includes(type)) throw Object.assign(new Error('CMS belum didukung: ' + type), { status: 400 });
  const existing = await db.findOne('cms_connections', { user_id: req.user.id, cms_type: type });
  const existingConfig = existing ? resolveConnConfig(existing) : {};
  
  const hasConfig = req.body.config !== undefined || (!req.body.articleSettings && Object.keys(req.body).length > 0);
  const incoming = hasConfig ? normalizeConfig(type, req.body.config || req.body) : existingConfig;
  
  if (existing && hasConfig) {
    for (const k of ['appPassword', 'apiKey', 'token', 'accessToken', 'clientSecret']) {
      if (incoming[k] && incoming[k].includes('••••')) incoming[k] = existingConfig[k];
    }
  }

  const shouldTest = hasConfig && req.body.test !== false;
  const test = shouldTest ? await testConnection(type, incoming) : { ok: existing?.verified ?? false, message: existing?.verified ? 'Terhubung' : 'Belum dites' };
  const { enc, iv } = encrypt(incoming);
  
  const articleSettings = req.body.articleSettings !== undefined
    ? normalizeArticleSettings(req.body.articleSettings)
    : (existing?.article_settings ? normalizeArticleSettings(existing.article_settings) : normalizeArticleSettings({}));

  const row = await db.upsert('cms_connections', { user_id: req.user.id, cms_type: type }, {
    config: {},
    config_enc: enc,
    config_iv: iv,
    article_settings: articleSettings,
    verified: test.ok,
    verified_at: test.ok ? new Date().toISOString() : (existing?.verified_at || null),
  });
  if (test.ok && type === 'wix' && test.meta && test.meta.memberId && !incoming.memberId) {
    const updated = { ...incoming, memberId: test.meta.memberId };
    const e2 = encrypt(updated);
    await db.update('cms_connections', { id: row.id }, { config_enc: e2.enc, config_iv: e2.iv, config: {} });
  }
  res.json({ cms: maskConn(await db.findOne('cms_connections', { id: row.id })), test });
}));
app.post('/api/cms/:type/test', auth, wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  const c = await db.findOne('cms_connections', { user_id: req.user.id, cms_type: type });
  if (!c) throw Object.assign(new Error('Kredensial belum disimpan.'), { status: 404 });
  const cfg = resolveConnConfig(c);
  const test = await testConnection(type, cfg);
  await db.update('cms_connections', { id: c.id }, { verified: test.ok, verified_at: test.ok ? new Date().toISOString() : null });
  res.json({ test });
}));
app.delete('/api/cms/:type', auth, wrap(async (req, res) => { await db.remove('cms_connections', { user_id: req.user.id, cms_type: String(req.params.type).toLowerCase() }); res.json({ ok: true }); }));

// ---------- Keywords & automation ----------
const kwPublic = (k) => ({ id: k.id, keyword: k.keyword, geo: k.geo, ln: k.ln, cms: k.cms_type, status: k.status, schedule: k.schedule, volume: k.volume, difficulty: k.difficulty, article: k.article || null, postId: k.post_id || '', draftUrl: k.draft_url || '', publicUrl: k.public_url || '', postStatus: k.post_status || '', error: k.error || '', date: (k.created_at || '').slice(0, 10), lastRunAt: k.last_run_at, nextRunAt: k.next_run_at });
const nextRun = (schedule) => { if (schedule === 'daily') return new Date(Date.now() + 86400e3).toISOString(); if (schedule === 'weekly') return new Date(Date.now() + 7 * 86400e3).toISOString(); return null; };

app.get('/api/keywords', auth, wrap(async (req, res) => res.json({ keywords: (await db.findMany('keywords', { user_id: req.user.id }, { orderBy: 'created_at' })).map(kwPublic) })));
app.post('/api/keywords', auth, wrap(async (req, res) => {
  const b = req.body || {};
  const keyword = String(b.keyword || '').trim(); if (!keyword) throw Object.assign(new Error('Keyword wajib diisi.'), { status: 400 });
  const cms = String(b.cmsType || b.cms || 'wordpress').toLowerCase();
  const schedule = ['immediate', 'daily', 'weekly'].includes(b.schedule) ? b.schedule : 'immediate';
  if (schedule !== 'immediate' && req.user.plan !== 'premium') throw Object.assign(new Error('Jadwal otomatis hanya untuk paket Pro.'), { status: 402 });
  const row = await db.insert('keywords', { user_id: req.user.id, keyword, geo: String(b.geo || 'ID').toUpperCase(), ln: String(b.ln || 'id').toLowerCase(), cms_type: cms, status: 'Pending', schedule, next_run_at: nextRun(schedule) });
  res.json({ keyword: kwPublic(row) });
}));
app.patch('/api/keywords/:id', auth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Tidak ditemukan.'), { status: 404 });
  const patch = {}; const b = req.body || {};
  if (b.article) patch.article = { ...(k.article || {}), ...b.article };
  if (b.schedule) { patch.schedule = b.schedule; patch.next_run_at = nextRun(b.schedule); }
  if (b.status) patch.status = String(b.status);
  res.json({ keyword: kwPublic(await db.update('keywords', { id: k.id }, patch)) });
}));
app.delete('/api/keywords/:id', auth, wrap(async (req, res) => { await db.remove('keywords', { id: req.params.id, user_id: req.user.id }); res.json({ ok: true }); }));

async function generateFor(user, k) {
  const plan = planOf(user);
  const used = await usageOf(user.id);
  if (used >= plan.monthlyArticles) throw Object.assign(new Error(`Kuota ${plan.name} bulan ini habis (${plan.monthlyArticles} artikel). Upgrade ke Pro untuk melanjutkan.`), { status: 402 });
  await db.update('keywords', { id: k.id }, { status: 'AI Writing...', error: '' });
  try {
    const out = await callN8n(N8N_URL_RUN, { keyword: k.keyword, Geo: k.geo, Ln: k.ln, Client_Name: user.brand_name, niche: user.niche, requestId: k.id });
    const article = out.article;
    return await db.update('keywords', { id: k.id }, { article, volume: article.searchVolume || 0, difficulty: article.difficulty, status: 'Review Ready', last_run_at: new Date().toISOString(), next_run_at: nextRun(k.schedule) });
  } catch (e) {
    await db.update('keywords', { id: k.id }, { status: 'Error', error: e.message, last_run_at: new Date().toISOString(), next_run_at: nextRun(k.schedule) });
    throw e;
  }
}
async function publishFor(user, k, action, articleOverride) {
  const conn = await db.findOne('cms_connections', { user_id: user.id, cms_type: k.cms_type });
  if (!conn) throw Object.assign(new Error(`Kredensial ${k.cms_type} belum disimpan di Pengaturan CMS.`), { status: 400 });
  const connConfig = resolveConnConfig(conn);
  const article = articleOverride ? { ...(k.article || {}), ...articleOverride } : k.article;
  const useExisting = !!k.post_id && !articleOverride; // publish draf yang sudah ada tanpa perubahan konten
  const body = { cmsType: k.cms_type, action, cms: { [k.cms_type]: connConfig }, article: useExisting ? undefined : article, postId: k.post_id || '', clientName: user.brand_name, requestId: k.id };
  try {
    const out = await callN8n(N8N_URL_PUBLISH, body);
    const status = out.postStatus === 'publish' ? 'Published' : 'Draft Created';
    return await db.update('keywords', { id: k.id }, { article, status, post_id: out.postId || k.post_id, draft_url: out.draftEditUrl || k.draft_url, public_url: out.publicUrl || (out.postStatus === 'publish' ? k.public_url : ''), post_status: out.postStatus, error: '' });
  } catch (e) {
    await db.update('keywords', { id: k.id }, { article, status: k.article ? 'Review Ready' : k.status, error: e.message });
    throw e;
  }
}
const webApproverOn = (u) => u.plan === 'premium' && u.web_approver !== false;

app.post('/api/keywords/:id/run', auth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Tidak ditemukan.'), { status: 404 });
  let row = await generateFor(req.user, k);
  if (!webApproverOn(req.user)) {
    // Free (atau Web Approver mati): langsung simpan sebagai DRAF di CMS, tanpa review
    try { row = await publishFor(req.user, row, 'draft'); } catch (e) { row = await db.findOne('keywords', { id: k.id }); row.error = e.message; }
  }
  res.json({ keyword: kwPublic(row) });
}));
app.post('/api/keywords/:id/publish', auth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Tidak ditemukan.'), { status: 404 });
  if (!k.article && !k.post_id) throw Object.assign(new Error('Belum ada artikel. Jalankan dulu.'), { status: 400 });
  const action = req.body.action === 'publish' ? 'publish' : 'draft';
  const row = await publishFor(req.user, k, action, req.body.article || null);
  res.json({ keyword: kwPublic(row) });
}));

// ---------- Billing (dummy) ----------
app.get('/api/billing', auth, wrap(async (req, res) => {
  const subs = await db.findMany('subscriptions', { user_id: req.user.id }, { orderBy: 'created_at' });
  res.json({ plans: Object.values(PLANS), current: planOf(req.user), subscription: subs[0] || null, history: subs.slice(0, 10) });
}));
app.post('/api/billing/checkout', auth, wrap(async (req, res) => {
  const plan = PLANS[req.body.plan] ? req.body.plan : 'premium';
  if (plan === 'free') throw Object.assign(new Error('Pilih paket berbayar.'), { status: 400 });
  const method = String(req.body.method || 'qris');
  const sub = await db.insert('subscriptions', { user_id: req.user.id, plan, status: 'active', method, amount: PLANS[plan].price, invoice_no: 'INV-' + Date.now().toString(36).toUpperCase(), started_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 86400e3).toISOString(), dummy: true });
  const u = await db.update('accounts', { id: req.user.id }, { plan });
  res.json({ user: publicUser(u), subscription: sub, message: 'Pembayaran simulasi berhasil. Paket Pro aktif 30 hari.' });
}));
app.post('/api/billing/cancel', auth, wrap(async (req, res) => {
  const subs = await db.findMany('subscriptions', { user_id: req.user.id, status: 'active' });
  for (const s of subs) await db.update('subscriptions', { id: s.id }, { status: 'cancelled' });
  const u = await db.update('accounts', { id: req.user.id }, { plan: 'free' });
  res.json({ user: publicUser(u) });
}));

// ---------- 3Our Public API (API key per user) ----------
app.post('/api/v1/articles/generate', apiKeyAuth, wrap(async (req, res) => {
  const b = req.body || {}; const keyword = String(b.keyword || '').trim();
  if (!keyword) throw Object.assign(new Error('keyword wajib diisi.'), { status: 400 });
  const k = await db.insert('keywords', { user_id: req.user.id, keyword, geo: String(b.geo || 'ID').toUpperCase(), ln: String(b.ln || 'id').toLowerCase(), cms_type: String(b.cmsType || 'wordpress').toLowerCase(), status: 'Pending', schedule: 'immediate', source: 'api' });
  const row = await generateFor(req.user, k);
  res.json({ status: 'ok', id: row.id, article: row.article });
}));
app.post('/api/v1/articles/:id/publish', apiKeyAuth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Artikel tidak ditemukan.'), { status: 404 });
  const row = await publishFor(req.user, k, req.body.action === 'publish' ? 'publish' : 'draft', req.body.article || null);
  res.json({ status: 'ok', id: row.id, postId: row.post_id, draftEditUrl: row.draft_url, publicUrl: row.public_url, postStatus: row.post_status });
}));
app.get('/api/v1/articles', apiKeyAuth, wrap(async (req, res) => res.json({ status: 'ok', articles: (await db.findMany('keywords', { user_id: req.user.id }, { orderBy: 'created_at' })).map(kwPublic) })));

// ---------- Cron: jadwal harian/mingguan (Vercel Cron → GET /api/cron/run-scheduled) ----------
app.get('/api/cron/run-scheduled', wrap(async (req, res) => {
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query.secret || '');
  if (!CRON_SECRET || given !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const now = new Date().toISOString();
  const all = await db.findMany('keywords', {});
  const due = all.filter(k => ['daily', 'weekly'].includes(k.schedule) && k.next_run_at && k.next_run_at <= now).slice(0, 20);
  const results = [];
  for (const k of due) {
    const user = await db.findOne('accounts', { id: k.user_id });
    if (!user || user.plan !== 'premium') { await db.update('keywords', { id: k.id }, { next_run_at: nextRun(k.schedule) }); results.push({ id: k.id, skipped: 'plan' }); continue; }
    try { let row = await generateFor(user, k); if (!webApproverOn(user)) row = await publishFor(user, row, 'draft'); results.push({ id: k.id, status: row.status }); }
    catch (e) { results.push({ id: k.id, error: e.message }); }
  }
  res.json({ ran: results.length, results });
}));

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan.' }));

if (!process.env.VERCEL) app.listen(PORT, () => log(`Supermat backend di http://localhost:${PORT} (db: ${dbMode}, n8n: ${N8N_BASE_URL})`));
export default app;
