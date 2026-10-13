// Markimate Backend — API web app + "3Our API" publik untuk klien.
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
import {
  getWallet,
  getPrices,
  getDailyUsage,
  estimate,
  assertAffordable,
  charge,
  recordFailedUsage,
  grant,
  expireBuckets,
  grantTrialIfEligible,
  invalidateCreditCaches
} from './lib/credits.js';
import { PLANS, FREE_MONTHLY_LIMIT } from './lib/plans.js';
import { processDailyCreditAlerts } from './lib/notifications.js';
import { createSnapTransaction, handleMidtransWebhook } from './lib/midtrans.js';
import { calculateUsageAndMargin, checkMarginSentinel } from './lib/margin.js';

export { PLANS };

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-di-env-JWT_SECRET';
const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'https://n8n.3ourasia.id').replace(/\/+$/, '');
// Override opsional (nama baru MARKIMATE_N8N_*, dengan fallback ke SUPERMAT_N8N_* supaya backward compatible)
const N8N_URL_RUN = process.env.MARKIMATE_N8N_RUN_URL || process.env.SUPERMAT_N8N_RUN_URL || `${N8N_BASE_URL}/webhook/supermat-trigger`;
const N8N_URL_PUBLISH = process.env.MARKIMATE_N8N_PUBLISH_URL || process.env.SUPERMAT_N8N_PUBLISH_URL || `${N8N_BASE_URL}/webhook/supermat-publish`;
const N8N_URL_TOPICS = process.env.MARKIMATE_N8N_TOPICS_URL || process.env.SUPERMAT_N8N_TOPICS_URL || (process.env.N8N_URL_TOPICS?.startsWith('http') ? process.env.N8N_URL_TOPICS : `${N8N_BASE_URL}${process.env.N8N_URL_TOPICS || '/webhook/supermat-topics'}`);
const MARKIMATE_API_KEY = process.env.MARKIMATE_API_KEY || process.env.SUPERMAT_API_KEY || ''; // key 3Our untuk memanggil n8n (header X-Supermat-Key)
const CRON_SECRET = process.env.CRON_SECRET || '';

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
  const countedStatuses = new Set(['Review Ready', 'Draft Created', 'Published']);
  return rows.filter(k => k.last_run_at && k.last_run_at >= since && countedStatuses.has(k.status)).length;
}
const planOf = (u) => PLANS[u.plan] || PLANS.free;

function friendlyN8nError(status, text) {
  let parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
  const msg = parsed && (parsed.message || parsed.error);
  if (status === 404 || /not registered/i.test(text)) return 'Endpoint n8n belum aktif (404). Pastikan workflow n8n sudah dipublish.';
  if (status === 401) return 'Backend ditolak n8n (401): MARKIMATE_API_KEY / SUPERMAT_API_KEY di server tidak cocok dengan key di n8n.';
  if (status === 409 || (parsed && parsed.status === 'duplicate')) return (parsed && parsed.message) || 'Topik mirip sudah ada di CMS.';
  if (/Error in workflow/i.test(text)) return 'Terjadi error di workflow n8n. Cek eksekusi terakhir di n8n.';
  return msg || `n8n HTTP ${status}`;
}

async function callN8n(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (MARKIMATE_API_KEY) headers['X-Supermat-Key'] = MARKIMATE_API_KEY;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (res.status === 409 || (json && json.status === 'duplicate')) {
    const err = new Error((json && json.message) || 'Topik mirip sudah ada di CMS.');
    err.status = 409;
    err.isDuplicate = true;
    err.duplicateOf = (json && json.duplicateOf) || null;
    err.n8n = json;
    throw err;
  }
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
const wrap = (fn) => (req, res) => fn(req, res).catch(e => {
  log(`[ERR] ${req.method} ${req.path}: ${e.message}`);
  const status = e.status || 500;
  res.status(status).json({
    error: e.message,
    n8n: e.n8n || undefined,
    ...(e.code ? { code: e.code } : {}),
    ...(e.need !== undefined ? { need: e.need } : {}),
    ...(e.have !== undefined ? { have: e.have } : {}),
    ...(e.topupUrl ? { topupUrl: e.topupUrl } : {}),
    ...(e.dailyUsed !== undefined ? { dailyUsed: e.dailyUsed } : {}),
    ...(e.dailyCap !== undefined ? { dailyCap: e.dailyCap } : {})
  });
});

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: dbMode, n8n: N8N_BASE_URL, time: new Date().toISOString() }));

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password, brandName, niche } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw Object.assign(new Error('Email tidak valid.'), { status: 400 });
  if (String(password || '').length < 6) throw Object.assign(new Error('Kata sandi minimal 6 karakter.'), { status: 400 });
  if (await db.findOne('accounts', { email: em })) throw Object.assign(new Error('Email sudah terdaftar, silakan masuk.'), { status: 409 });
  const user = await db.insert('accounts', {
    email: em,
    password_hash: await bcrypt.hash(password, 10),
    brand_name: String(brandName || '').trim() || em.split('@')[0],
    niche: String(niche || 'Other'),
    plan: 'free',
    api_key: genApiKey(),
    web_approver: true,
    email_verified_at: new Date().toISOString()
  });

  // Berikan 300 trial credit (7 hari) untuk email terverifikasi baru (PRD §4.3)
  await grantTrialIfEligible(user.id, em);

  res.json({ token: signToken(user), user: publicUser(user) });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const em = String((req.body || {}).email || '').trim().toLowerCase();
  const user = await db.findOne('accounts', { email: em });
  if (!user || !(await bcrypt.compare(String((req.body || {}).password || ''), user.password_hash))) throw Object.assign(new Error('Email atau kata sandi salah.'), { status: 401 });
  // Klaim trial jika eligible dan belum pernah klaim
  await grantTrialIfEligible(user.id, user.email);
  res.json({ token: signToken(user), user: publicUser(user) });
}));
app.get('/api/me', auth, wrap(async (req, res) => {
  const conns = await db.findMany('cms_connections', { user_id: req.user.id });
  const runs = await usageOf(req.user.id);
  res.json({ user: publicUser(req.user), plan: planOf(req.user), usage: { runsThisMonth: runs, limit: planOf(req.user).monthlyArticles }, cms: conns.map(maskConn) });
}));

// ---------- Credits & Dompet Workspace ----------
app.get('/api/credits', auth, wrap(async (req, res) => {
  const workspaceId = req.user.id;
  // Otomatis grant trial jika user berhak dan belum pernah klaim
  await grantTrialIfEligible(workspaceId, req.user.email);

  const { wallet, totalBalance, activeBuckets } = await getWallet(workspaceId);
  const dailyUsed = await getDailyUsage(workspaceId);
  const prices = await getPrices();

  const now = Date.now();
  const trialEnds = wallet.trial_expires_at ? new Date(wallet.trial_expires_at) : null;
  const isTrialActive = Boolean(
    activeBuckets.trial > 0 && trialEnds && trialEnds.getTime() > now
  );
  const daysLeft = trialEnds && isTrialActive
    ? Math.max(0, Math.ceil((trialEnds.getTime() - now) / (24 * 3600 * 1000)))
    : 0;

  res.json({
    balance: {
      trial: activeBuckets.trial,
      sub: activeBuckets.sub,
      topup: activeBuckets.topup,
      total: totalBalance,
    },
    expires: {
      trial: wallet.trial_expires_at || null,
      sub: wallet.sub_expires_at || null,
      topup: wallet.topup_expires_at || null,
    },
    dailyUsed,
    dailyCap: Number(wallet.daily_cap || 500),
    prices,
    trial: {
      active: isTrialActive,
      endsAt: wallet.trial_expires_at || null,
      daysLeft,
    },
  });
}));

app.get('/api/credits/estimate', auth, wrap(async (req, res) => {
  const { action, qty, images } = req.query;
  const est = await estimate(action || 'seo.article', Number(qty || 1), { images: Number(images || 0) });
  res.json(est);
}));

app.get('/api/credits/ledger', auth, wrap(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = await db.findMany('credit_ledger', { workspace_id: req.user.id }, {
    orderBy: 'created_at',
    ascending: false
  });
  let filtered = rows || [];
  if (req.query.kind) {
    filtered = filtered.filter(r => r.kind === req.query.kind);
  }
  if (req.query.module) {
    filtered = filtered.filter(r => r.action_key && r.action_key.startsWith(req.query.module));
  }
  const paginated = filtered.slice(0, limit);
  res.json({ ledger: paginated, entries: paginated, total: filtered.length });
}));

// Midtrans Snap Top-up (PRD §4.3 & §4.4)
app.post('/api/credits/topup', auth, wrap(async (req, res) => {
  const { packageId } = req.body || {};
  const tx = await createSnapTransaction(req.user, packageId || 'starter');
  res.json(tx);
}));

// Webhook notifikasi Midtrans (PRD §4.3 & §4.4)
app.post('/api/webhooks/midtrans', wrap(async (req, res) => {
  const result = await handleMidtransWebhook(req.body);
  res.json(result);
}));

// ---------- Admin Auth & Endpoints (PRD §2b & §4.4) ----------
const adminAuth = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY || 'default-admin-secret-key';
  const given = req.headers['x-admin-key'];
  if (!given || given !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin Key' });
  }
  next();
};

app.get('/api/admin/credits/usage', adminAuth, wrap(async (req, res) => {
  const result = await calculateUsageAndMargin(req.query.month);
  res.json(result);
}));

app.get('/api/admin/credits/margin', adminAuth, wrap(async (req, res) => {
  const result = await calculateUsageAndMargin(req.query.month);
  res.json(result);
}));

app.put('/api/admin/credit-prices', adminAuth, wrap(async (req, res) => {
  const { actionKey, credits, label, needsReview, active } = req.body || {};
  if (!actionKey) throw Object.assign(new Error('actionKey is required'), { status: 400 });

  const patch = { updated_at: new Date().toISOString() };
  if (credits !== undefined) patch.credits = Number(credits);
  if (label !== undefined) patch.label = String(label);
  if (needsReview !== undefined) patch.needs_review = Boolean(needsReview);
  if (active !== undefined) patch.active = Boolean(active);

  const existing = await db.findOne('credit_prices', { action_key: actionKey });
  if (existing) {
    await db.update('credit_prices', { action_key: actionKey }, patch);
  } else {
    await db.insert('credit_prices', { action_key: actionKey, credits: Number(credits || 0), label: label || actionKey, needs_review: false, active: true, ...patch });
  }

  invalidateCreditCaches();
  const updated = await db.findOne('credit_prices', { action_key: actionKey });
  res.json({ status: 'ok', updated });
}));

app.get('/api/admin/credit-cost-rates', adminAuth, wrap(async (req, res) => {
  const rows = await db.findMany('credit_cost_rates', {});
  res.json({ rates: rows || [] });
}));

app.put('/api/admin/credit-cost-rates', adminAuth, wrap(async (req, res) => {
  const { rateKey, idr, note } = req.body || {};
  if (!rateKey || idr === undefined) throw Object.assign(new Error('rateKey and idr are required'), { status: 400 });

  const patch = { idr: Number(idr), updated_at: new Date().toISOString() };
  if (note !== undefined) patch.note = String(note);

  const existing = await db.findOne('credit_cost_rates', { rate_key: rateKey });
  if (existing) {
    await db.update('credit_cost_rates', { rate_key: rateKey }, patch);
  } else {
    await db.insert('credit_cost_rates', { rate_key: rateKey, ...patch });
  }

  invalidateCreditCaches();
  const updated = await db.findOne('credit_cost_rates', { rate_key: rateKey });
  res.json({ status: 'ok', updated });
}));

// Admin manual subscription activation (PRD §3.2)
app.post('/api/admin/subscriptions', adminAuth, wrap(async (req, res) => {
  const { email, plan, months } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!em) throw Object.assign(new Error('Email wajib diisi.'), { status: 400 });

  const user = await db.findOne('accounts', { email: em });
  if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { status: 404 });

  const planKey = String(plan || '').trim().toLowerCase();
  const planData = PLANS[planKey];
  if (!planData || planKey === 'free') {
    throw Object.assign(new Error('Plan tidak valid atau tidak berbayar. Pilih salah satu paket berbayar yang tersedia.'), { status: 400 });
  }

  const numMonths = Math.max(1, parseInt(months, 10) || 1);
  const endsAt = new Date(Date.now() + numMonths * 30 * 86400e3);
  const sub = await db.insert('subscriptions', {
    user_id: user.id,
    plan: planKey,
    status: 'active',
    method: 'manual',
    amount: planData.price * numMonths,
    invoice_no: 'INV-MANUAL-' + Date.now().toString(36).toUpperCase(),
    started_at: new Date().toISOString(),
    ends_at: endsAt.toISOString(),
    dummy: false
  });

  const updatedUser = await db.update('accounts', { id: user.id }, { plan: planKey });

  const credits = (planData.credits || 0) * numMonths;
  if (process.env.CREDITS_ENABLED !== 'false' && credits > 0) {
    await grant(
      user.id,
      'sub',
      credits,
      endsAt,
      'grant_sub',
      'Aktivasi manual oleh admin',
      { actionKey: 'billing.sub', refType: 'subscription', refId: sub.id, note: 'Aktivasi manual oleh admin' }
    );
  }

  res.json({
    status: 'ok',
    user: publicUser(updatedUser),
    subscription: sub,
    creditsGranted: credits
  });
}));

// Admin manual credits grant (PRD §3.4)
app.post('/api/admin/credits/grant', adminAuth, wrap(async (req, res) => {
  const { email, bucket = 'topup', amount, days, note } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!em) throw Object.assign(new Error('Email wajib diisi.'), { status: 400 });

  const user = await db.findOne('accounts', { email: em });
  if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { status: 404 });

  const targetBucket = String(bucket || 'topup').trim().toLowerCase();
  if (!['topup', 'sub'].includes(targetBucket)) {
    throw Object.assign(new Error("Bucket tidak valid. Harus 'topup' atau 'sub'."), { status: 400 });
  }

  const amt = Number(amount || 0);
  if (!amt || amt <= 0) {
    throw Object.assign(new Error('Jumlah credit (amount) harus berupa angka positif.'), { status: 400 });
  }

  const numDays = days !== undefined && days !== null && !isNaN(Number(days)) ? Number(days) : (targetBucket === 'sub' ? 30 : 365);
  const expiresAt = new Date(Date.now() + numDays * 86400e3);
  const grantNote = String(note || '').trim() || 'Grant kredit manual oleh admin';

  const grantResult = await grant(
    user.id,
    targetBucket,
    amt,
    expiresAt,
    'admin',
    grantNote,
    { actionKey: 'admin.grant', refType: 'admin_grant' }
  );

  res.json({
    status: 'ok',
    email: user.email,
    workspaceId: user.id,
    granted: {
      bucket: targetBucket,
      amount: amt,
      expiresAt: expiresAt.toISOString(),
      kind: 'admin',
      note: grantNote
    },
    balance: grantResult.totalBalance
  });
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
    const r = await fetch(cfg.url + '/wp-json/wp/v2/users/me?context=edit', { headers: { Authorization: 'Basic ' + Buffer.from(cfg.user + ':' + cfg.appPassword.replace(/\s+/g, '')).toString('base64'), 'User-Agent': 'Markimate/1.0' } });
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
  const m = await fetch(`${api}/mutate/${encodeURIComponent(cfg.dataset)}?dryRun=true`, { method: 'POST', headers, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'drafts.markimate-connection-test', _type: cfg.docType, title: 'Markimate connection test' } }] }) });
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

  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (!creditsEnabled && articleSettings.images?.enabled && !planOf(req.user).images) {
    throw Object.assign(new Error('Fitur gambar AI hanya untuk paket berbayar (Pro). Silakan upgrade paket Anda.'), { status: 402 });
  }

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
const kwPublic = (k) => ({
  id: k.id,
  keyword: k.keyword,
  geo: k.geo,
  ln: k.ln,
  cms: k.cms_type,
  status: k.status,
  schedule: k.schedule,
  volume: k.volume,
  difficulty: k.difficulty,
  article: k.article || null,
  postId: k.post_id || '',
  draftUrl: k.draft_url || '',
  publicUrl: k.public_url || '',
  postStatus: k.post_status || '',
  error: k.error || '',
  date: (k.created_at || '').slice(0, 10),
  lastRunAt: k.last_run_at,
  nextRunAt: k.next_run_at,
  source: k.source || 'manual',
  duplicateOf: k.duplicate_of || null,
  imagePrompts: k.image_prompts || (k.article && k.article.imagePrompts) || null,
  images: k.images || (k.article && k.article.images) || null,
  links: k.links || (k.article && k.article.links) || null,
  warnings: k.warnings || (k.article && k.article.warnings) || []
});
const nextRun = (schedule) => { if (schedule === 'daily') return new Date(Date.now() + 86400e3).toISOString(); if (schedule === 'weekly') return new Date(Date.now() + 7 * 86400e3).toISOString(); return null; };

app.get('/api/keywords', auth, wrap(async (req, res) => res.json({ keywords: (await db.findMany('keywords', { user_id: req.user.id }, { orderBy: 'created_at' })).map(kwPublic) })));
app.post('/api/keywords', auth, wrap(async (req, res) => {
  const b = req.body || {};
  const keyword = String(b.keyword || '').trim(); if (!keyword) throw Object.assign(new Error('Keyword wajib diisi.'), { status: 400 });
  const cms = String(b.cmsType || b.cms || 'wordpress').toLowerCase();
  const schedule = ['immediate', 'daily', 'weekly'].includes(b.schedule) ? b.schedule : 'immediate';
  if (schedule !== 'immediate' && planOf(req.user).id === 'free') throw Object.assign(new Error('Jadwal otomatis hanya untuk paket berbayar (Pro).'), { status: 402 });
  const row = await db.insert('keywords', { user_id: req.user.id, keyword, geo: String(b.geo || 'ID').toUpperCase(), ln: String(b.ln || 'id').toLowerCase(), cms_type: cms, status: 'Pending', schedule, next_run_at: nextRun(schedule) });
  res.json({ keyword: kwPublic(row) });
}));
app.patch('/api/keywords/:id', auth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Tidak ditemukan.'), { status: 404 });
  const patch = {}; const b = req.body || {};
  if (b.article) {
    patch.article = { ...(k.article || {}), ...b.article };
    if (b.article.imagePrompts) patch.image_prompts = b.article.imagePrompts;
    if (b.article.links) patch.links = b.article.links;
  }
  if (b.imagePrompts) {
    patch.image_prompts = b.imagePrompts;
    patch.article = { ...(patch.article || k.article || {}), imagePrompts: b.imagePrompts };
  }
  if (b.links) {
    patch.links = b.links;
    patch.article = { ...(patch.article || k.article || {}), links: b.links };
  }
  if (b.schedule) { patch.schedule = b.schedule; patch.next_run_at = nextRun(b.schedule); }
  if (b.status) patch.status = String(b.status);
  res.json({ keyword: kwPublic(await db.update('keywords', { id: k.id }, patch)) });
}));
app.delete('/api/keywords/:id', auth, wrap(async (req, res) => { await db.remove('keywords', { id: req.params.id, user_id: req.user.id }); res.json({ ok: true }); }));

async function generateFor(user, k) {
  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (creditsEnabled) {
    // Assert credit sebelum aksi (PRD §4.2: seo.article)
    await assertAffordable(user.id, 'seo.article', 1);
  } else {
    const plan = planOf(user);
    const used = await usageOf(user.id);
    if (used >= plan.monthlyArticles) throw Object.assign(new Error(`Kuota ${plan.name} bulan ini habis (${plan.monthlyArticles} artikel). Upgrade ke Pro untuk melanjutkan.`), { status: 402 });
  }

  await db.update('keywords', { id: k.id }, { status: 'AI Writing...', error: '' });

  const conn = k.cms_type ? await db.findOne('cms_connections', { user_id: user.id, cms_type: k.cms_type }) : null;
  const connConfig = conn ? resolveConnConfig(conn) : null;
  const artSet = conn ? normalizeArticleSettings(conn.article_settings) : normalizeArticleSettings({});

  const options = {
    duplicateCheck: artSet.duplicateCheck?.enabled !== false,
    duplicateThreshold: artSet.duplicateCheck?.threshold ?? 0.7,
    internalLinks: artSet.links?.internal !== false,
    maxInternal: artSet.links?.maxInternal ?? 4,
    siteBaseUrl: artSet.links?.siteBaseUrl || '',
    externalLinks: artSet.links?.external !== false,
    maxExternal: artSet.links?.maxExternal ?? 2,
    excludeDomains: Array.isArray(artSet.links?.excludeDomains) ? artSet.links.excludeDomains : [],
    imagePrompts: (planOf(user).images !== false) && (artSet.images?.enabled !== false),
    imageCount: artSet.images?.count ?? 3,
    imageStyle: artSet.images?.style || ''
  };

  const payload = {
    keyword: k.keyword,
    Geo: k.geo,
    Ln: k.ln,
    Client_Name: user.brand_name || 'Brand Anda',
    niche: user.niche || '',
    tone: '',
    wordCount: 900,
    requestId: k.id,
    ...(k.cms_type && connConfig ? {
      cmsType: k.cms_type,
      cms: { [k.cms_type]: connConfig }
    } : {}),
    options
  };

  try {
    const out = await callN8n(N8N_URL_RUN, payload);
    const article = out.article || {};
    const links = article.links || null;
    const imagePrompts = article.imagePrompts || null;
    const usage = out.usage || null;

    const updated = await db.update('keywords', { id: k.id }, {
      article,
      links,
      image_prompts: imagePrompts,
      volume: article.searchVolume || 0,
      difficulty: article.difficulty,
      status: 'Review Ready',
      error: '',
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun(k.schedule)
    });

    // Charge credit setelah sukses status Review Ready (PRD §4.2)
    if (creditsEnabled) {
      await charge(user.id, 'seo.article', 1, {
        type: 'keyword',
        id: k.id,
        note: `Generate artikel: ${k.keyword}`
      }, usage);
    }

    return updated;
  } catch (e) {
    const usage = e.usage || (e.n8n && e.n8n.usage) || null;
    if (creditsEnabled && usage) {
      await recordFailedUsage(user.id, 'seo.article', usage, {
        type: 'keyword',
        id: k.id,
        note: e.message
      });
    }

    if (e.isDuplicate || e.status === 409) {
      const dup = e.duplicateOf || (e.n8n && e.n8n.duplicateOf) || null;
      return await db.update('keywords', { id: k.id }, {
        status: 'Duplicate',
        duplicate_of: dup,
        error: e.message,
        next_run_at: nextRun(k.schedule)
      });
    }
    await db.update('keywords', { id: k.id }, {
      status: 'Error',
      error: e.message,
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun(k.schedule)
    });
    throw e;
  }
}

async function publishFor(user, k, action, articleOverride) {
  const conn = await db.findOne('cms_connections', { user_id: user.id, cms_type: k.cms_type });
  if (!conn) throw Object.assign(new Error(`Kredensial ${k.cms_type} belum disimpan di Pengaturan CMS.`), { status: 400 });
  const connConfig = resolveConnConfig(conn);
  const artSet = normalizeArticleSettings(conn.article_settings);
  const plan = planOf(user);

  const cmsPayload = { ...connConfig };
  if (k.cms_type === 'sanity') {
    const san = artSet.sanity || {};
    cmsPayload.authorId = san.authorId || '';
    cmsPayload.autoCreateAuthor = san.autoCreateAuthor !== false;
    cmsPayload.categoryIds = Array.isArray(san.categoryIds) ? san.categoryIds : [];
    cmsPayload.publishedAtField = san.publishedAtField || 'publishedAt';
    cmsPayload.mainImageField = san.mainImageField || 'mainImage';
    cmsPayload.excerptField = san.excerptField || 'excerpt';
  } else if (k.cms_type === 'wordpress') {
    const wp = artSet.wordpress || {};
    cmsPayload.defaultCategoryIds = Array.isArray(wp.defaultCategoryIds) ? wp.defaultCategoryIds : [];
    cmsPayload.authorId = wp.authorId || null;
  } else if (k.cms_type === 'wix') {
    const wx = artSet.wix || {};
    cmsPayload.categoryIds = Array.isArray(wx.categoryIds) ? wx.categoryIds : [];
  } else if (k.cms_type === 'shopify') {
    const sh = artSet.shopify || {};
    cmsPayload.tags = Array.isArray(sh.tags) ? sh.tags : [];
  }

  const baseArticle = articleOverride ? { ...(k.article || {}), ...articleOverride } : (k.article || {});
  if (!baseArticle.imagePrompts && k.image_prompts) baseArticle.imagePrompts = k.image_prompts;
  if (!baseArticle.links && k.links) baseArticle.links = k.links;

  const useExisting = !!k.post_id && !articleOverride; // publish draf yang sudah ada tanpa perubahan konten
  const makeImages = !useExisting && (plan.images !== false) && (artSet.images?.enabled !== false);
  const options = {
    images: makeImages,
    imageCount: artSet.images?.count ?? 3,
    imageStyle: artSet.images?.style || ''
  };

  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (creditsEnabled && makeImages && options.imageCount > 0) {
    // Assert saldo gambar sebelum publish (PRD §4.2: seo.image × jumlah imagePrompts/count)
    await assertAffordable(user.id, 'seo.image', options.imageCount);
  }

  const body = {
    cmsType: k.cms_type,
    action,
    cms: { [k.cms_type]: cmsPayload },
    article: useExisting ? undefined : baseArticle,
    postId: k.post_id || '',
    options,
    clientName: user.brand_name || 'Brand Anda',
    requestId: k.id
  };

  try {
    const out = await callN8n(N8N_URL_PUBLISH, body);
    const status = out.postStatus === 'publish' ? 'Published' : 'Draft Created';
    const newImages = (Array.isArray(out.images) && out.images.length > 0) ? out.images : (k.images || null);
    const warnings = Array.isArray(out.warnings) ? out.warnings : [];
    const updatedArticle = useExisting ? k.article : {
      ...baseArticle,
      ...(newImages ? { images: newImages } : {}),
      ...(warnings.length > 0 ? { warnings } : {})
    };

    const updated = await db.update('keywords', { id: k.id }, {
      article: updatedArticle,
      status,
      post_id: out.postId || k.post_id,
      draft_url: out.draftEditUrl || k.draft_url,
      public_url: out.publicUrl || (out.postStatus === 'publish' ? k.public_url : ''),
      post_status: out.postStatus,
      images: newImages,
      warnings,
      error: ''
    });

    // Charge credit gambar yang benar-benar ter-upload (PRD §4.2: seo.image × out.images.length)
    if (creditsEnabled && Array.isArray(out.images) && out.images.length > 0) {
      await charge(user.id, 'seo.image', out.images.length, {
        type: 'keyword_images',
        id: `${k.id}_${out.postId || k.post_id || 'post'}`,
        note: `Upload ${out.images.length} gambar artikel ${k.keyword}`
      }, out.usage || null);
    }

    return updated;
  } catch (e) {
    const usage = e.usage || (e.n8n && e.n8n.usage) || null;
    if (creditsEnabled && usage) {
      await recordFailedUsage(user.id, 'seo.image', usage, {
        type: 'keyword_images',
        id: `${k.id}_failed`,
        note: e.message
      });
    }
    await db.update('keywords', { id: k.id }, {
      article: k.article,
      status: k.article ? 'Review Ready' : k.status,
      error: e.message
    });
    throw e;
  }
}
const webApproverOn = (u) => (process.env.CREDITS_ENABLED !== 'false' ? u.web_approver !== false : (planOf(u).webApprover && u.web_approver !== false));

app.post('/api/keywords/:id/run', auth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Tidak ditemukan.'), { status: 404 });
  let row = await generateFor(req.user, k);
  if (row.status !== 'Duplicate' && !webApproverOn(req.user)) {
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

// ---------- Topik Otomatis (SEO Topic Sources) ----------
function calcNextWeeklyRun(weekday = 6, hour = 0) {
  const now = new Date();
  const wibOffsetMs = 7 * 3600 * 1000;
  const nowWib = new Date(now.getTime() + wibOffsetMs);

  const curDay = nowWib.getUTCDay();
  const curHour = nowWib.getUTCHours();

  let daysAhead = (Number(weekday) - curDay + 7) % 7;
  if (daysAhead === 0 && curHour >= Number(hour)) {
    daysAhead = 7;
  }

  const nextWib = new Date(nowWib);
  nextWib.setUTCDate(nextWib.getUTCDate() + daysAhead);
  nextWib.setUTCHours(Number(hour), 0, 0, 0);

  const nextUtc = new Date(nextWib.getTime() - wibOffsetMs);
  return nextUtc.toISOString();
}

async function runTopicSource(user, source) {
  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (creditsEnabled) {
    // Assert saldo seo.topics_run (10 credit, PRD §4.2)
    await assertAffordable(user.id, 'seo.topics_run', 1);
  } else if (user.plan === 'free') {
    throw Object.assign(new Error('Topik otomatis hanya untuk paket berbayar (Pro).'), { status: 402 });
  }

  const conn = await db.findOne('cms_connections', { user_id: user.id, cms_type: source.cms_type });
  if (!conn) {
    throw Object.assign(new Error(`Koneksi CMS ${source.cms_type} belum disimpan.`), { status: 400 });
  }
  const connConfig = resolveConnConfig(conn);
  const artSet = normalizeArticleSettings(conn.article_settings);

  const seedKeywords = Array.isArray(source.seed_keywords)
    ? source.seed_keywords
    : (typeof source.seed_keywords === 'string' ? source.seed_keywords.split(',').map(s => s.trim()).filter(Boolean) : []);

  const payload = {
    seedKeywords,
    Geo: source.geo || 'ID',
    Ln: source.ln || 'id',
    cmsType: source.cms_type,
    cms: { [source.cms_type]: connConfig },
    limit: Number(source.topics_per_run) || 3,
    minVolume: Number(source.min_volume) || 50,
    duplicateThreshold: artSet.duplicateCheck?.threshold || 0.7,
    requestId: source.id
  };

  let out;
  try {
    out = await callN8n(N8N_URL_TOPICS, payload);
  } catch (e) {
    const usage = e.usage || (e.n8n && e.n8n.usage) || null;
    if (creditsEnabled && usage) {
      await recordFailedUsage(user.id, 'seo.topics_run', usage, {
        type: 'topic_source',
        id: source.id,
        note: e.message
      });
    }
    throw e;
  }

  // Charge credit setelah n8n 200 (PRD §4.2)
  if (creditsEnabled) {
    await charge(user.id, 'seo.topics_run', 1, {
      type: 'topic_source',
      id: `${source.id}_${Date.now()}`,
      note: 'Riset topik otomatis (Trends)'
    }, out.usage || null);
  }

  const topics = Array.isArray(out.topics) ? out.topics : [];
  const createdKeywords = [];

  for (const t of topics) {
    const kwText = String(t.keyword || '').trim();
    if (!kwText) continue;

    const row = await db.insert('keywords', {
      user_id: user.id,
      keyword: kwText,
      geo: source.geo || 'ID',
      ln: source.ln || 'id',
      cms_type: source.cms_type,
      status: source.auto_generate ? 'Pending' : 'Suggested',
      schedule: 'immediate',
      source: 'auto_trends',
      volume: t.searchVolume || 0,
      difficulty: t.difficulty ?? null,
      next_run_at: null
    });

    if (source.auto_generate) {
      try {
        let genRow = await generateFor(user, row);
        if (!webApproverOn(user) && genRow.status !== 'Duplicate') {
          await publishFor(user, genRow, 'draft');
        }
      } catch (e) {
        log(`[TOPICS] auto_generate error: ${e.message}`);
      }
    }
    createdKeywords.push(row);
  }

  const nextRunAt = calcNextWeeklyRun(source.weekday ?? 6, source.hour ?? 0);
  await db.update('seo_topic_sources', { id: source.id }, {
    last_run_at: new Date().toISOString(),
    next_run_at: nextRunAt,
    updated_at: new Date().toISOString()
  });

  return {
    ok: true,
    topics,
    created: createdKeywords.length,
    skipped: out.skipped || {},
    nextRunAt
  };
}

app.get('/api/seo/topic-sources', auth, wrap(async (req, res) => {
  const sources = await db.findMany('seo_topic_sources', { user_id: req.user.id }, { orderBy: 'created_at' });
  res.json({ sources });
}));

app.put('/api/seo/topic-sources', auth, wrap(async (req, res) => {
  const b = req.body || {};
  const cmsType = String(b.cmsType || 'wordpress').toLowerCase();
  const seedKeywords = Array.isArray(b.seedKeywords)
    ? b.seedKeywords.map(s => String(s).trim()).filter(Boolean)
    : String(b.seedKeywords || '').split(',').map(s => s.trim()).filter(Boolean);
  const geo = String(b.geo || 'ID').toUpperCase();
  const ln = String(b.ln || 'id').toLowerCase();
  const weekday = Math.min(Math.max(Number(b.weekday) || 6, 0), 6);
  const hour = Math.min(Math.max(Number(b.hour) || 0, 0), 23);
  const topicsPerRun = Math.min(Math.max(Number(b.topicsPerRun) || 3, 1), 10);
  const minVolume = Math.max(Number(b.minVolume) || 50, 0);
  const autoGenerate = !!b.autoGenerate;
  const active = b.active !== false;
  const nextRunAt = calcNextWeeklyRun(weekday, hour);

  let existing = b.id ? await db.findOne('seo_topic_sources', { id: b.id, user_id: req.user.id }) : null;
  if (!existing) {
    existing = await db.findOne('seo_topic_sources', { user_id: req.user.id, cms_type: cmsType });
  }

  let source;
  if (existing) {
    source = await db.update('seo_topic_sources', { id: existing.id }, {
      cms_type: cmsType,
      seed_keywords: seedKeywords,
      geo, ln, weekday, hour,
      topics_per_run: topicsPerRun,
      min_volume: minVolume,
      auto_generate: autoGenerate,
      active,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString()
    });
  } else {
    source = await db.insert('seo_topic_sources', {
      user_id: req.user.id,
      cms_type: cmsType,
      seed_keywords: seedKeywords,
      geo, ln, weekday, hour,
      topics_per_run: topicsPerRun,
      min_volume: minVolume,
      auto_generate: autoGenerate,
      active,
      next_run_at: nextRunAt
    });
  }
  res.json({ source });
}));

app.delete('/api/seo/topic-sources/:id', auth, wrap(async (req, res) => {
  await db.remove('seo_topic_sources', { id: req.params.id, user_id: req.user.id });
  res.json({ ok: true });
}));

app.post('/api/seo/topic-sources/:id/run', auth, wrap(async (req, res) => {
  const source = await db.findOne('seo_topic_sources', { id: req.params.id, user_id: req.user.id });
  if (!source) throw Object.assign(new Error('Sumber topik tidak ditemukan.'), { status: 404 });
  const result = await runTopicSource(req.user, source);
  res.json(result);
}));

// ---------- Billing (dummy) ----------
app.get('/api/billing', auth, wrap(async (req, res) => {
  const subs = await db.findMany('subscriptions', { user_id: req.user.id }, { orderBy: 'created_at' });
  res.json({
    plans: Object.values(PLANS),
    current: planOf(req.user),
    subscription: subs[0] || null,
    history: subs.slice(0, 10),
    billingDisabled: process.env.BILLING_DUMMY !== 'true'
  });
}));
app.post('/api/billing/checkout', auth, wrap(async (req, res) => {
  if (process.env.BILLING_DUMMY !== 'true') {
    return res.status(403).json({
      error: 'Pembayaran langsung belum tersedia. Hubungi 3Our untuk aktivasi paket.',
      code: 'BILLING_DISABLED'
    });
  }
  const planKey = req.body.plan;
  const plan = PLANS[planKey] ? planKey : 'premium';
  if (plan === 'free') throw Object.assign(new Error('Pilih paket berbayar.'), { status: 400 });
  const method = String(req.body.method || 'qris');
  const planData = PLANS[plan];
  const endsAt = new Date(Date.now() + 30 * 86400e3);
  const sub = await db.insert('subscriptions', {
    user_id: req.user.id,
    plan,
    status: 'active',
    method,
    amount: planData.price,
    invoice_no: 'INV-' + Date.now().toString(36).toUpperCase(),
    started_at: new Date().toISOString(),
    ends_at: endsAt.toISOString(),
    dummy: true
  });
  const u = await db.update('accounts', { id: req.user.id }, { plan });

  // PRD §4.3: balance_sub = credit paket (reset, bukan tambah), sub_expires_at = period_end
  if (process.env.CREDITS_ENABLED !== 'false' && planData.credits > 0) {
    await grant(
      req.user.id,
      'sub',
      planData.credits,
      endsAt,
      'grant_sub',
      `Langganan ${planData.name} (${planData.credits} credit)`,
      { actionKey: 'billing.sub', refType: 'subscription', refId: sub.id }
    );
  }

  res.json({
    user: publicUser(u),
    subscription: sub,
    message: `Pembayaran simulasi berhasil. Paket ${planData.name} aktif 30 hari (${planData.credits || 0} credit).`
  });
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
  if (row.status === 'Duplicate') {
    return res.status(409).json({
      status: 'duplicate',
      id: row.id,
      duplicateOf: row.duplicate_of || null,
      message: row.error || 'Topik duplikat dengan artikel yang sudah ada di CMS.'
    });
  }
  res.json({
    status: 'ok',
    id: row.id,
    article: row.article,
    links: row.links || (row.article && row.article.links) || null,
    imagePrompts: row.image_prompts || (row.article && row.article.imagePrompts) || null
  });
}));
app.post('/api/v1/articles/:id/publish', apiKeyAuth, wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, user_id: req.user.id }); if (!k) throw Object.assign(new Error('Artikel tidak ditemukan.'), { status: 404 });
  const row = await publishFor(req.user, k, req.body.action === 'publish' ? 'publish' : 'draft', req.body.article || null);
  res.json({ status: 'ok', id: row.id, postId: row.post_id, draftEditUrl: row.draft_url, publicUrl: row.public_url, postStatus: row.post_status, warnings: row.warnings || [] });
}));
app.get('/api/v1/articles', apiKeyAuth, wrap(async (req, res) => res.json({ status: 'ok', articles: (await db.findMany('keywords', { user_id: req.user.id }, { orderBy: 'created_at' })).map(kwPublic) })));

// ---------- Cron: jadwal harian/mingguan (Vercel Cron → GET /api/cron/run-scheduled) ----------
app.get('/api/cron/run-scheduled', wrap(async (req, res) => {
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query.secret || '');
  if (!CRON_SECRET || given !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const now = new Date().toISOString();
  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';

  // 0. Bersihkan saldo bucket yang kadaluarsa & kirim peringatan harian & margin sentinel (PRD §2b & §4.3)
  let alertSummary = null;
  let marginSentinelSummary = null;
  if (creditsEnabled) {
    try { await expireBuckets(); } catch (err) { log(`[CRON] expireBuckets error: ${err.message}`); }
    try { alertSummary = await processDailyCreditAlerts(); } catch (err) { log(`[CRON] processDailyCreditAlerts error: ${err.message}`); }
    try { marginSentinelSummary = await checkMarginSentinel(); } catch (err) { log(`[CRON] checkMarginSentinel error: ${err.message}`); }
  }

  // 1. Scheduled Keywords (daily/weekly)
  const all = await db.findMany('keywords', {});
  const due = all.filter(k => ['daily', 'weekly'].includes(k.schedule) && k.next_run_at && k.next_run_at <= now).slice(0, 20);
  const results = [];
  for (const k of due) {
    const user = await db.findOne('accounts', { id: k.user_id });
    if (!user) { results.push({ id: k.id, skipped: 'no_user' }); continue; }
    if (!creditsEnabled && planOf(user).id === 'free') {
      await db.update('keywords', { id: k.id }, { next_run_at: nextRun(k.schedule) });
      results.push({ id: k.id, skipped: 'plan' });
      continue;
    }
    try {
      let row = await generateFor(user, k);
      if (row.status !== 'Duplicate' && !webApproverOn(user)) row = await publishFor(user, row, 'draft');
      results.push({ id: k.id, status: row.status });
    }
    catch (e) {
      if (e.status === 402 || e.code === 'INSUFFICIENT_CREDITS' || e.code === 'DAILY_CAP') {
        results.push({ id: k.id, skipped: 'credit_exhausted', code: e.code });
      } else {
        results.push({ id: k.id, error: e.message });
      }
    }
  }

  // 2. Scheduled Topic Sources (Google Trends mingguan)
  try {
    const allSources = await db.findMany('seo_topic_sources', {});
    const dueSources = allSources.filter(s => s.active !== false && s.next_run_at && s.next_run_at <= now);
    for (const s of dueSources) {
      const user = await db.findOne('accounts', { id: s.user_id });
      if (!user) continue;
      if (!creditsEnabled && !planOf(user).autoTopics) continue;
      try {
        const resTopics = await runTopicSource(user, s);
        results.push({ topicSourceId: s.id, status: 'ok', generated: resTopics.created });
      } catch (e) {
        results.push({ topicSourceId: s.id, error: e.message });
      }
    }
  } catch (err) {
    log(`[CRON] topic sources check error: ${err.message}`);
  }

  res.json({ ran: results.length, results, alerts: alertSummary, marginSentinel: marginSentinelSummary });
}));

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan.' }));

if (!process.env.VERCEL) app.listen(PORT, () => log(`Markimate backend di http://localhost:${PORT} (db: ${dbMode}, n8n: ${N8N_BASE_URL})`));
export default app;
