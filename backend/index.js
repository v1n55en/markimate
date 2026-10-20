// Markimate Backend — API web app + "3Our API" publik untuk klien.
// Alur: user daftar → simpan kredensial CMS (WordPress/Wix) → jalankan keyword → n8n (3Our) riset + tulis artikel
// → (Premium) review di web → publish ke CMS user lewat n8n adapter. Billing masih dummy.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto, { randomBytes, timingSafeEqual } from 'crypto';
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
import { getCatalog } from './lib/catalog.js';
import { createCheckout, handleNotification, reconcile } from './lib/payments/service.js';
import { calculateUsageAndMargin, checkMarginSentinel } from './lib/margin.js';
import {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
  sendEmailChangeVerification,
  sendEmailChangeNoticeToOldEmail,
  sendWorkspaceInviteEmail
} from './lib/mailer.js';
import { newToken, hashToken } from './lib/tokens.js';
import { enforceRateLimit, getClientIp } from './lib/ratelimit.js';
import {
  issueSession,
  getRefreshTokenFromReq,
  clearRefreshTokenCookie,
  signAccessToken
} from './lib/session.js';
import { getAppUrl, TRIAL_CONFIG } from './lib/config.js';
import {
  requireWorkspace,
  resolveWorkspaceForUser,
  getUserWorkspaces,
  createWorkspaceApiKey,
  requireUuidParam,
  isUuid
} from './lib/workspaces.js';
import {
  getModules,
  requireModule,
  expireEntitlements
} from './lib/entitlements.js';
import {
  ensurePlatformAdmin,
  isWorkspacePlatformAdmin
} from './lib/admin.js';
import {
  logAuditEvent,
  getWorkspaceAuditLogs,
  requestAccountDeletion,
  cancelAccountDeletion,
  exportAccountData,
  purgeDeletedAccounts,
  handleMetaDataDeletion,
  getMetaDataDeletionStatus
} from './lib/account-lifecycle.js';
import {
  generateGoogleAuthUrl,
  parseGoogleOAuthCookie,
  clearGoogleOAuthCookie,
  exchangeGoogleCode,
  verifyGoogleIdToken,
  processGoogleAuth
} from './lib/google-auth.js';

export { PLANS };

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] In production environment, JWT_SECRET is mandatory and must be at least 32 characters.');
    process.exit(1);
  }
  if (!process.env.CMS_CRED_KEY || process.env.CMS_CRED_KEY.trim().length === 0) {
    console.error('[FATAL] In production environment, CMS_CRED_KEY is mandatory for credential encryption.');
    process.exit(1);
  }
  if (process.env.ADMIN_KEY && process.env.ADMIN_KEY.length < 32) {
    console.error('[FATAL] In production environment, ADMIN_KEY must be at least 32 characters if set.');
    process.exit(1);
  }
  if ((process.env.PAYMENT_PROVIDER || 'doku').toLowerCase() === 'doku') {
    if (!process.env.DOKU_CLIENT_ID || !process.env.DOKU_SECRET_KEY) {
      console.error('[FATAL] In production environment, DOKU_CLIENT_ID and DOKU_SECRET_KEY are mandatory when PAYMENT_PROVIDER=doku.');
      process.exit(1);
    }
  }
}
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
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

// ---------- Helpers ----------
const genApiKey = () => 'spm_live_' + randomBytes(18).toString('base64url');
const publicUser = (u) => u && ({
  id: u.id,
  email: u.email,
  name: u.name,
  brandName: u.brand_name,
  niche: u.niche,
  plan: u.plan || 'free',
  webApprover: u.web_approver !== false,
  status: u.status || 'active',
  locale: u.locale || 'id',
  isPlatformAdmin: Boolean(u.is_platform_admin),
  emailVerifiedAt: u.email_verified_at,
  createdAt: u.created_at
});
const signToken = (u) => jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '30d' });
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
const mask = (s) => { s = String(s || ''); return s.length <= 6 ? (s ? '••••' : '') : s.slice(0, 3) + '••••' + s.slice(-3); };

async function usageOf(workspaceId) {
  const rows = await db.findMany('keywords', { workspace_id: workspaceId });
  const since = monthStart();
  const countedStatuses = new Set(['Review Ready', 'Draft Created', 'Published']);
  return (rows || []).filter(k => k.last_run_at && k.last_run_at >= since && countedStatuses.has(k.status)).length;
}
const planOf = (u) => PLANS[u.plan] || PLANS.free;

function friendlyN8nError(status, text) {
  let parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
  const msg = parsed && (parsed.message || parsed.error);
  if (status === 404 || /not registered/i.test(text)) return 'n8n endpoint not active (404). Ensure n8n workflow is published.';
  if (status === 401) return 'Backend rejected by n8n (401): API key mismatch with n8n workflow.';
  if (status === 409 || (parsed && parsed.status === 'duplicate')) return (parsed && parsed.message) || 'Similar topic already exists in CMS.';
  if (/Error in workflow/i.test(text)) return 'Error in n8n workflow execution. Check n8n execution history.';
  return msg || `n8n HTTP ${status}`;
}

async function callN8n(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (MARKIMATE_API_KEY) headers['X-Supermat-Key'] = MARKIMATE_API_KEY;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (res.status === 409 || (json && json.status === 'duplicate')) {
    const err = new Error((json && json.message) || 'A similar topic already exists in CMS.');
    err.status = 409;
    err.code = 'SIMILAR_TOPIC_EXISTS';
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

// ---------- Auth middleware (F1 & F2) ----------
async function auth(req, res, next) {
  try {
    const h = String(req.headers.authorization || '');
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ error: 'Session is invalid or has expired.', code: 'TOKEN_EXPIRED' });
    }

    // Jika token baru (typ: 'access'), izinkan.
    // Jika token legacy 30 hari (tanpa typ), izinkan sampai LEGACY_JWT_ACCEPT_UNTIL (transisi).
    if (!payload.typ || payload.typ !== 'access') {
      const defaultUntil = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
      const legacyUntil = new Date(process.env.LEGACY_JWT_ACCEPT_UNTIL || defaultUntil);
      if (new Date() > legacyUntil) {
        return res.status(401).json({
          error: 'Session format is outdated. Please sign in again.',
          code: 'LEGACY_SESSION_EXPIRED'
        });
      }
      req.isLegacySession = true;
    }

    const userId = payload.sub || payload.userId || payload.id;
    const user = await db.findOne('accounts', { id: userId });
    if (!user || user.status === 'pending_deletion') {
      return res.status(401).json({ error: 'Account not found or inactive.', code: 'ACCOUNT_INACTIVE' });
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session is invalid. Please sign in again.', code: 'UNAUTHORIZED' });
  }
}
async function apiKeyAuth(req, res, next) {
  const key = String(req.headers['x-api-key'] || '').trim() || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!key) return res.status(401).json({ status: 'error', error: 'Missing X-API-Key header.', message: 'Missing X-API-Key header.', code: 'UNAUTHORIZED' });

  // 1. Coba cari di workspace_api_keys (SHA-256 hash)
  const keyHash = hashToken(key);
  const apiKeyRecord = await db.findOne('workspace_api_keys', { key_hash: keyHash });

  if (apiKeyRecord && !apiKeyRecord.revoked_at) {
    const ws = await db.findOne('workspaces', { id: apiKeyRecord.workspace_id });
    if (!ws || ws.deleted_at) {
      return res.status(401).json({ status: 'error', error: 'Workspace API key is inactive.', message: 'Workspace API key is inactive.', code: 'UNAUTHORIZED' });
    }
    const owner = await db.findOne('accounts', { id: ws.owner_user_id });
    req.user = owner || { id: ws.owner_user_id, plan: 'free' };
    req.workspace = ws;
    req.apiKey = apiKeyRecord;
    // Update last_used_at secara asynchronous
    db.update('workspace_api_keys', { id: apiKeyRecord.id }, { last_used_at: new Date().toISOString() }).catch(() => {});
    return next();
  }

  // 2. Fallback backward compatibility: cari di accounts.api_key lama
  const user = await db.findOne('accounts', { api_key: key });
  if (!user) return res.status(401).json({ status: 'error', error: 'Invalid API key.', message: 'Invalid API key.', code: 'UNAUTHORIZED' });

  req.user = user;
  const resolved = await resolveWorkspaceForUser(user.id);
  req.workspace = resolved?.workspace || { id: user.id };
  next();
}
const wrap = (fn) => (req, res) => fn(req, res).catch(e => {
  log(`[ERR] ${req.method} ${req.path}: ${e.message}`);
  const status = e.status || 500;
  const defaultCode = status === 500 ? 'INTERNAL_ERROR' : (status === 401 ? 'UNAUTHORIZED' : (status === 403 ? 'FORBIDDEN' : (status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST')));
  res.status(status).json({
    error: e.message,
    code: e.code || defaultCode,
    n8n: e.n8n || undefined,
    ...(e.email ? { email: e.email } : {}),
    ...(e.pendingToken ? { pendingToken: e.pendingToken } : {}),
    ...(e.workspaces ? { workspaces: e.workspaces } : {}),
    ...(e.module ? { module: e.module } : {}),
    ...(e.need !== undefined ? { need: e.need } : {}),
    ...(e.have !== undefined ? { have: e.have } : {}),
    ...(e.topupUrl ? { topupUrl: e.topupUrl } : {}),
    ...(e.dailyUsed !== undefined ? { dailyUsed: e.dailyUsed } : {}),
    ...(e.dailyCap !== undefined ? { dailyCap: e.dailyCap } : {})
  });
});

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: dbMode, n8n: N8N_BASE_URL, time: new Date().toISOString() }));

// ---------- Auth (F1 & F2) ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password, brandName, niche, name, acceptTerms, locale } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  const clientIp = getClientIp(req);
  const targetLocale = (locale === 'en' || locale === 'id') ? locale : 'id';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
    throw Object.assign(new Error('Please provide a valid email address.'), { status: 400, code: 'INVALID_EMAIL' });
  }
  if (String(password || '').length < 10) {
    throw Object.assign(new Error('Password must be at least 10 characters.'), { status: 400, code: 'PASSWORD_TOO_SHORT' });
  }
  if (acceptTerms !== true) {
    throw Object.assign(new Error('You must agree to the Terms of Service and Privacy Policy.'), { status: 400, code: 'TERMS_REQUIRED' });
  }

  // Rate limit: 5 registrasi per 15 menit per IP
  if (await enforceRateLimit(res, `register:ip:${clientIp}`, 900, 5, 'Too many registration attempts from this IP address. Please try again in 15 minutes.')) {
    return;
  }

  // Jika email sudah terdaftar, kembalikan respons sukses yang identik tanpa membocorkan eksistensi akun
  const existing = await db.findOne('accounts', { email: em });
  if (existing) {
    // Jika belum diverifikasi, kirimkan email verifikasi baru
    if (existing.status === 'unverified' || !existing.email_verified_at) {
      const verifyToken = newToken();
      const tokenHash = hashToken(verifyToken);
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      await db.insert('email_verifications', {
        user_id: existing.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      });
      await sendVerificationEmail({
        to: em,
        token: verifyToken,
        locale: targetLocale || existing.locale || 'id'
      });
    }
    return res.json({ status: 'verification_sent', email: em });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const brand = String(brandName || '').trim() || em.split('@')[0];
  const userName = String(name || '').trim() || brand;

  // 1. Akun baru dengan status unverified
  const user = await db.insert('accounts', {
    email: em,
    name: userName,
    password_hash: passwordHash,
    brand_name: brand,
    niche: String(niche || 'Other'),
    plan: 'free',
    api_key: genApiKey(),
    web_approver: true,
    status: 'unverified',
    locale: targetLocale,
    email_verified_at: null,
    failed_login_count: 0
  });

  // 2. Buat workspace default dengan id = user.id
  await db.insert('workspaces', {
    id: user.id,
    name: brand,
    niche: user.niche,
    owner_user_id: user.id
  });

  // 3. Masukkan owner ke workspace_members
  await db.insert('workspace_members', {
    workspace_id: user.id,
    user_id: user.id,
    role: 'owner'
  });

  // 4. Entitlements trial dari config untuk 3 modul utama
  const trialEnds = new Date(Date.now() + TRIAL_CONFIG.days * 24 * 3600 * 1000).toISOString();
  for (const mod of ['seo', 'ads_report', 'ads_spy']) {
    await db.insert('module_entitlements', {
      workspace_id: user.id,
      module: mod,
      active: true,
      source: 'trial',
      starts_at: new Date().toISOString(),
      ends_at: trialEnds
    });
  }

  // 5. Buat token verifikasi email (32 byte base64url, disimpan hash SHA-256)
  const verifyToken = newToken();
  const tokenHash = hashToken(verifyToken);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await db.insert('email_verifications', {
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  // 6. Kirim email verifikasi bilingual
  await sendVerificationEmail({
    to: em,
    token: verifyToken,
    locale: targetLocale
  });

  // Catat audit log pendaftaran
  await db.insert('audit_logs', {
    user_id: user.id,
    workspace_id: user.id,
    action: 'account_registered',
    ip: clientIp,
    meta: { email: em, locale: targetLocale }
  });

  // TIDAK ada token sesi dan TIDAK ada trial credit di langkah ini
  res.json({ status: 'verification_sent', email: em });
}));

app.post('/api/auth/verify', wrap(async (req, res) => {
  const { token } = req.body || {};
  const clientIp = getClientIp(req);
  if (!token) {
    throw Object.assign(new Error('Verification token is required.'), { status: 400, code: 'TOKEN_REQUIRED' });
  }

  const tokenHash = hashToken(token);
  const record = await db.findOne('email_verifications', { token_hash: tokenHash });

  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw Object.assign(new Error('Invalid or expired verification token.'), {
      status: 400,
      code: 'INVALID_TOKEN'
    });
  }

  // Tandai token sudah digunakan
  const now = new Date().toISOString();
  await db.update('email_verifications', { id: record.id }, { used_at: now });

  const user = await db.findOne('accounts', { id: record.user_id });
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404, code: 'NOT_FOUND' });

  // 1. Kasus Perubahan Alamat Email Akun
  if (record.new_email) {
    const newEmail = record.new_email.toLowerCase();
    const existingOther = await db.findOne('accounts', { email: newEmail });
    if (existingOther && existingOther.id !== user.id) {
      throw Object.assign(new Error('New email address is already in use.'), { status: 400, code: 'EMAIL_EXISTS' });
    }

    await db.update('accounts', { id: user.id }, {
      email: newEmail,
      email_verified_at: now
    });
    user.email = newEmail;
    user.email_verified_at = now;

    // Cabut sesi lain milik user demi keamanan
    const userSessions = await db.findMany('refresh_tokens', { user_id: user.id });
    for (const s of (userSessions || [])) {
      if (!s.revoked_at) {
        await db.update('refresh_tokens', { id: s.id }, { revoked_at: now });
      }
    }

    await db.insert('audit_logs', {
      user_id: user.id,
      workspace_id: user.id,
      action: 'email_changed',
      ip: clientIp,
      meta: { newEmail }
    });

    const session = await issueSession(res, user, req);
    return res.json({
      status: 'verified',
      emailChanged: true,
      token: session.accessToken,
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(user)
    });
  }

  // 2. Kasus Verifikasi Akun Baru
  // Update status akun menjadi aktif dan terverifikasi
  await db.update('accounts', { id: user.id }, {
    email_verified_at: now,
    status: 'active'
  });
  user.email_verified_at = now;
  user.status = 'active';

  // Alokasikan 300 free trial credits (7 hari) HANYA setelah email terverifikasi
  await grantTrialIfEligible(user.id, user.email);
  await ensurePlatformAdmin(user);

  // Catat audit log
  await db.insert('audit_logs', {
    user_id: user.id,
    workspace_id: user.id,
    action: 'email_verified',
    ip: clientIp,
    meta: { email: user.email }
  });

  // Terbitkan sesi baru (refresh token di cookie httpOnly + access token di memori)
  const session = await issueSession(res, user, req);

  res.json({
    status: 'verified',
    token: session.accessToken,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: publicUser(user)
  });
}));

app.post('/api/auth/resend-verification', wrap(async (req, res) => {
  const { email, locale } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  const clientIp = getClientIp(req);
  if (!em) throw Object.assign(new Error('Email address is required.'), { status: 400, code: 'EMAIL_REQUIRED' });

  // Rate limit: maks 3 per jam per email
  if (await enforceRateLimit(res, `resend_verify:${em}`, 3600, 3, 'Resend verification limit reached. Please try again in 1 hour.')) {
    return;
  }

  const user = await db.findOne('accounts', { email: em });
  if (user && (user.status === 'unverified' || !user.email_verified_at)) {
    const verifyToken = newToken();
    const tokenHash = hashToken(verifyToken);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await db.insert('email_verifications', {
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });
    const targetLocale = (locale === 'en' || locale === 'id') ? locale : (user.locale || 'id');
    await sendVerificationEmail({
      to: em,
      token: verifyToken,
      locale: targetLocale
    });
  }

  // Respons konsisten untuk mencegah enumeration
  res.json({
    message: 'If the email is registered and unverified, a verification link has been sent.',
    status: 'sent'
  });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const em = String((req.body || {}).email || '').trim().toLowerCase();
  const password = String((req.body || {}).password || '');
  const clientIp = getClientIp(req);

  const user = await db.findOne('accounts', { email: em });

  // Periksa apakah akun terkunci sementara (prioritas respon 423 sebelum 429)
  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMin = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: `Account is temporarily locked due to too many failed attempts. Try again in ${remainingMin} minutes.`,
      code: 'ACCOUNT_LOCKED'
    });
  }

  // Rate limit: 10 per 15 menit per IP + email
  if (await enforceRateLimit(res, `login:${clientIp}:${em}`, 900, 10, 'Too many failed sign in attempts. Please try again in 15 minutes.')) {
    return;
  }

  // Jika akun terdaftar lewat Google (tidak memiliki password)
  if (user && !user.password_hash) {
    return res.status(401).json({
      error: 'This account was registered via Google. Sign in with Google or reset password via Forgot Password.',
      code: 'PASSWORD_NOT_SET'
    });
  }

  const passwordValid = user && (await bcrypt.compare(password, user.password_hash));

  if (!passwordValid) {
    if (user) {
      const failed = (user.failed_login_count || 0) + 1;
      const patch = { failed_login_count: failed };
      if (failed >= 10) {
        patch.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await db.update('accounts', { id: user.id }, patch);
      await db.insert('audit_logs', {
        user_id: user.id,
        action: 'login_failed',
        ip: clientIp,
        meta: { email: em, reason: 'wrong_password', attempts: failed }
      });
    }
    throw Object.assign(new Error('Invalid email or password.'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  // Password benar: reset percobaan gagal & perbarui last_login_at
  await db.update('accounts', { id: user.id }, {
    failed_login_count: 0,
    locked_until: null,
    last_login_at: new Date().toISOString()
  });

  // Periksa apakah akun sedang dijadwalkan untuk dihapus (PRD F1+F2 Langkah 8)
  if (user.status === 'pending_deletion') {
    return res.status(403).json({
      error: 'Account is scheduled for deletion. Please cancel deletion first to sign in.',
      code: 'ACCOUNT_PENDING_DELETION',
      email: user.email,
      deletedRequestedAt: user.deleted_requested_at
    });
  }

  // Periksa status email verified
  if (user.status === 'unverified' || !user.email_verified_at) {
    return res.status(403).json({
      error: 'Please verify your email address before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email
    });
  }

  // Rehash otomatis dari cost 10 ke cost 12 jika akun lama
  if (user.password_hash && (user.password_hash.startsWith('$2a$10$') || user.password_hash.startsWith('$2b$10$'))) {
    try {
      const newHash = await bcrypt.hash(password, 12);
      await db.update('accounts', { id: user.id }, { password_hash: newHash });
    } catch (err) {
      console.error('[AUTH] Gagal merehash password:', err.message);
    }
  }

  // Catat audit log login sukses
  await db.insert('audit_logs', {
    user_id: user.id,
    action: 'login_success',
    ip: clientIp,
    meta: { email: user.email }
  });

  // Pastikan akun admin platform memiliki status dan modul aktif
  await ensurePlatformAdmin(user);

  // Terbitkan sesi baru (refresh token di cookie httpOnly + access token di memori)
  const session = await issueSession(res, user, req);

  res.json({
    token: session.accessToken,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: publicUser(user)
  });
}));

// Refresh Sesi & Rotasi Token (PRD F1 + F2 Langkah 3)
app.post('/api/auth/refresh', wrap(async (req, res) => {
  const rawToken = getRefreshTokenFromReq(req);
  const clientIp = getClientIp(req);
  if (!rawToken) {
    return res.status(401).json({
      error: 'No refresh token provided.',
      code: 'NO_REFRESH_TOKEN'
    });
  }

  const tokenHash = hashToken(rawToken);
  const record = await db.findOne('refresh_tokens', { token_hash: tokenHash });

  if (!record) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({
      error: 'Invalid or expired session.',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }

  // Reuse Detection: Token yang sudah direvoke dicoba dipakai lagi
  if (record.revoked_at) {
    const revokedAtTime = new Date(record.revoked_at).getTime();
    const isWithinGrace = (Date.now() - revokedAtTime) <= 30 * 1000; // grace window 30 detik

    // Langkah 2.3: Jika masih dalam grace window 30 detik dan memiliki penerus aktif, kembalikan sesi penerus
    if (isWithinGrace && record.replaced_by) {
      let successor = await db.findOne('refresh_tokens', { id: record.replaced_by });
      let depth = 0;
      while (successor && successor.revoked_at && successor.replaced_by && depth < 5) {
        successor = await db.findOne('refresh_tokens', { id: successor.replaced_by });
        depth++;
      }
      if (successor && !successor.revoked_at && new Date(successor.expires_at) > new Date()) {
        const user = await db.findOne('accounts', { id: record.user_id });
        if (user && user.status === 'active') {
          const accessToken = signAccessToken(user);
          const ttlSec = (Number(process.env.ACCESS_TOKEN_TTL_MIN) || 15) * 60;
          return res.json({
            token: accessToken,
            accessToken,
            expiresIn: ttlSec,
            user: publicUser(user)
          });
        }
      }
    }

    // Reuse Detection di luar grace window 30 detik: indikasi pencurian sesi / replay attack
    const familyRecords = await db.findMany('refresh_tokens', { family_id: record.family_id });
    for (const r of familyRecords) {
      if (!r.revoked_at) {
        await db.update('refresh_tokens', { id: r.id }, { revoked_at: new Date().toISOString() });
      }
    }
    clearRefreshTokenCookie(res);
    await db.insert('audit_logs', {
      user_id: record.user_id,
      action: 'refresh_reuse',
      ip: clientIp,
      meta: { familyId: record.family_id, attemptedTokenHash: tokenHash }
    });
    return res.status(401).json({
      error: 'Refresh token reuse detected. All sessions have been revoked.',
      code: 'TOKEN_REUSE_DETECTED'
    });
  }

  // Periksa apakah token kadaluarsa
  if (new Date(record.expires_at) < new Date()) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({
      error: 'Session has expired. Please sign in again.',
      code: 'SESSION_EXPIRED'
    });
  }

  const user = await db.findOne('accounts', { id: record.user_id });
  if (!user || user.status !== 'active') {
    clearRefreshTokenCookie(res);
    return res.status(401).json({
      error: 'Account not found or inactive.',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  // Rotasi Token: Terbitkan token baru dalam family yang sama
  const newSession = await issueSession(res, user, req, record.family_id);

  // Tandai token lama sebagai revoked & replaced_by
  const now = new Date().toISOString();
  await db.update('refresh_tokens', { id: record.id }, {
    revoked_at: now,
    replaced_by: newSession.sessionId,
    last_used_at: now
  });

  res.json({
    token: newSession.accessToken,
    accessToken: newSession.accessToken,
    expiresIn: newSession.expiresIn,
    user: publicUser(user)
  });
}));

// Logout Sesi Tunggal
app.post('/api/auth/logout', wrap(async (req, res) => {
  const rawToken = getRefreshTokenFromReq(req);
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const record = await db.findOne('refresh_tokens', { token_hash: tokenHash });
    if (record && !record.revoked_at) {
      await db.update('refresh_tokens', { id: record.id }, { revoked_at: new Date().toISOString() });
    }
  }
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'Signed out successfully.' });
}));

// Logout Semua Perangkat (Revoke Semua Sesi User)
app.post('/api/auth/logout-all', auth, wrap(async (req, res) => {
  const userSessions = await db.findMany('refresh_tokens', { user_id: req.user.id });
  const now = new Date().toISOString();
  for (const s of userSessions) {
    if (!s.revoked_at) {
      await db.update('refresh_tokens', { id: s.id }, { revoked_at: now });
    }
  }
  clearRefreshTokenCookie(res);
  await db.insert('audit_logs', {
    user_id: req.user.id,
    action: 'logout_all',
    ip: getClientIp(req)
  });
  res.json({ success: true, message: 'All device sessions revoked.' });
}));

// Upgrade Sesi Legacy (Bearer JWT 30 hari -> Access Token 15m + Cookie Refresh Token)
app.post('/api/auth/upgrade-session', wrap(async (req, res) => {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Legacy session token not found.', code: 'UNAUTHORIZED' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Legacy session token is invalid or has expired.', code: 'TOKEN_EXPIRED' });
  }

  const userId = payload.sub || payload.userId || payload.id;
  const user = await db.findOne('accounts', { id: userId });
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Account not found or inactive.', code: 'ACCOUNT_INACTIVE' });
  }

  const session = await issueSession(res, user, req);
  res.json({
    success: true,
    token: session.accessToken,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: publicUser(user)
  });
}));

// Daftar Sesi Perangkat Aktif
app.get('/api/sessions', auth, wrap(async (req, res) => {
  const rawToken = getRefreshTokenFromReq(req);
  const currentHash = rawToken ? hashToken(rawToken) : null;
  const records = await db.findMany('refresh_tokens', { user_id: req.user.id }, {
    orderBy: 'created_at',
    ascending: false
  });

  const now = new Date();
  const activeSessions = (records || [])
    .filter(r => !r.revoked_at && new Date(r.expires_at) > now)
    .map(r => ({
      id: r.id,
      ip: r.ip || '127.0.0.1',
      userAgent: r.user_agent || 'Unknown Device',
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      current: Boolean(currentHash && r.token_hash === currentHash)
    }));

  res.json({ sessions: activeSessions });
}));

// Cabut Sesi Perangkat Tertentu
app.delete('/api/sessions/:id', auth, requireUuidParam('id'), wrap(async (req, res) => {
  const record = await db.findOne('refresh_tokens', { id: req.params.id, user_id: req.user.id });
  if (!record) return res.status(404).json({ error: 'Session not found.', code: 'SESSION_NOT_FOUND' });

  await db.update('refresh_tokens', { id: record.id }, { revoked_at: new Date().toISOString() });

  const rawToken = getRefreshTokenFromReq(req);
  if (rawToken && hashToken(rawToken) === record.token_hash) {
    clearRefreshTokenCookie(res);
  }

  await db.insert('audit_logs', {
    user_id: req.user.id,
    action: 'session_revoked',
    ip: getClientIp(req),
    meta: { sessionId: record.id }
  });

  res.json({ success: true, message: 'Session revoked successfully.' });
}));

// ==========================================
// Siklus Akun: Lupa & Reset Password (PRD F1 + F2 Langkah 4)
// ==========================================
app.post('/api/auth/forgot', wrap(async (req, res) => {
  const { email, locale } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  const clientIp = getClientIp(req);
  if (!em) {
    return res.status(400).json({ error: 'Email address is required.', code: 'EMAIL_REQUIRED' });
  }

  // Rate limit: 3/jam per email & 10/jam per IP
  if (await enforceRateLimit(res, `forgot_ip:${clientIp}`, 3600, 10, 'Too many password reset requests from your network. Please try again in 1 hour.')) return;
  if (await enforceRateLimit(res, `forgot_email:${em}`, 3600, 3, 'Too many password reset requests for this email. Please try again in 1 hour.')) return;

  const user = await db.findOne('accounts', { email: em });
  if (user && user.status === 'active') {
    const rawToken = newToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 menit

    await db.insert('password_resets', {
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip: clientIp
    });

    const targetLocale = (locale === 'en' || locale === 'id') ? locale : (user.locale || 'id');
    await sendPasswordResetEmail({ to: user.email, token: rawToken, locale: targetLocale });

    await db.insert('audit_logs', {
      user_id: user.id,
      action: 'password_reset_requested',
      ip: clientIp,
      meta: { email: user.email }
    });
  }

  // Respons konsisten untuk mencegah email enumeration
  res.json({
    success: true,
    message: 'If the email address is registered with Markimate, we have sent a password reset link.'
  });
}));

app.post('/api/auth/reset', wrap(async (req, res) => {
  const { token, password } = req.body || {};
  const rawToken = String(token || '').trim();
  const newPassword = String(password || '').trim();
  const clientIp = getClientIp(req);

  if (!rawToken) {
    return res.status(400).json({ error: 'Reset link is invalid.', code: 'INVALID_TOKEN' });
  }
  if (!newPassword || newPassword.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters.', code: 'PASSWORD_TOO_SHORT' });
  }

  const tokenHash = hashToken(rawToken);
  const resetRecord = await db.findOne('password_resets', { token_hash: tokenHash });

  if (!resetRecord || resetRecord.used_at || new Date(resetRecord.expires_at) < new Date()) {
    return res.status(400).json({
      error: 'Password reset link is invalid or has expired.',
      code: 'INVALID_TOKEN'
    });
  }

  const user = await db.findOne('accounts', { id: resetRecord.user_id });
  if (!user || user.status !== 'active') {
    return res.status(400).json({ error: 'Account not found or inactive.', code: 'ACCOUNT_INACTIVE' });
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update hash kata sandi & password_changed_at
  await db.update('accounts', { id: user.id }, {
    password_hash: passwordHash,
    password_changed_at: now,
    failed_login_count: 0,
    locked_until: null
  });

  // Tandai token reset telah digunakan
  await db.update('password_resets', { id: resetRecord.id }, { used_at: now });

  // Cabut SEMUA refresh token user demi keamanan
  const allSessions = await db.findMany('refresh_tokens', { user_id: user.id });
  for (const s of (allSessions || [])) {
    if (!s.revoked_at) {
      await db.update('refresh_tokens', { id: s.id }, { revoked_at: now });
    }
  }
  clearRefreshTokenCookie(res);

  // Kirim email konfirmasi ke user (tanpa link)
  await sendPasswordChangedNotice({ to: user.email, locale: user.locale || 'id' });

  // Catat audit log
  await db.insert('audit_logs', {
    user_id: user.id,
    action: 'password_reset_success',
    ip: clientIp,
    meta: { email: user.email }
  });

  res.json({
    success: true,
    message: 'Your password has been reset successfully. Please sign in with your new password.'
  });
}));

// ==========================================
// GOOGLE OAUTH 2.0 + PKCE (PRD F1 Langkah 9)
// ==========================================

app.get('/api/auth/google/start', wrap(async (req, res) => {
  const authUrl = generateGoogleAuthUrl(req, res);
  if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
    return res.json({ authUrl });
  }
  res.redirect(authUrl);
}));

app.post('/api/auth/google/callback', wrap(async (req, res) => {
  const { code, state } = req.body || {};
  if (!code || !state) {
    const err = new Error('Authorization code and state parameters are required.');
    err.status = 400;
    err.code = 'INVALID_CALLBACK_PARAMS';
    throw err;
  }

  // 1. Verifikasi cookie mk_g_oauth
  const cookieData = parseGoogleOAuthCookie(req);
  if (!cookieData || cookieData.state !== state) {
    clearGoogleOAuthCookie(res);
    const err = new Error('Authentication session expired or state mismatch. Please sign in again.');
    err.status = 400;
    err.code = 'INVALID_STATE';
    throw err;
  }

  const { codeVerifier, redirectUri } = cookieData;

  // 2. Mock mode hook untuk pengujian integrasi otomatis (hanya aktif jika GOOGLE_AUTH_MOCK=true di non-production)
  let googleProfile;
  if (process.env.NODE_ENV !== 'production' && process.env.GOOGLE_AUTH_MOCK === 'true' && req.headers['x-google-mock-profile']) {
    try {
      googleProfile = JSON.parse(req.headers['x-google-mock-profile']);
    } catch {
      throw new Error('Invalid x-google-mock-profile header.');
    }
  } else {
    const tokenData = await exchangeGoogleCode(code, codeVerifier, redirectUri);
    googleProfile = await verifyGoogleIdToken(tokenData.id_token);
  }

  // Bersihkan cookie OAuth Google setelah dipakai
  clearGoogleOAuthCookie(res);

  // 3. Proses login / registrasi / penautan akun
  const result = await processGoogleAuth({
    googleProfile,
    req,
    res
  });

  res.json(result);
}));

app.post('/api/auth/google/link', wrap(async (req, res) => {
  const { pendingToken, password } = req.body || {};
  if (!pendingToken || !password) {
    return res.status(400).json({
      error: 'Pending token and password are required.',
      code: 'PARAMS_REQUIRED'
    });
  }

  const tokenHash = hashToken(pendingToken);
  const linkRecord = await db.findOne('oauth_pending_links', { token_hash: tokenHash });

  if (!linkRecord || linkRecord.used_at || new Date(linkRecord.expires_at) < new Date()) {
    return res.status(400).json({
      error: 'Account linking session expired or invalid. Please sign in with Google again.',
      code: 'INVALID_PENDING_TOKEN'
    });
  }

  const user = await db.findOne('accounts', { id: linkRecord.user_id });
  if (!user) {
    return res.status(404).json({ error: 'User not found.', code: 'USER_NOT_FOUND' });
  }

  const passwordMatch = user.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!passwordMatch) {
    return res.status(400).json({
      error: 'Incorrect password.',
      code: 'INVALID_PASSWORD'
    });
  }

  // Tandai pending link sudah digunakan (1x pakai)
  await db.update('oauth_pending_links', { id: linkRecord.id }, { used_at: new Date().toISOString() });

  // Tautkan akun ke Google
  const updated = await db.update('accounts', { id: user.id }, {
    google_sub: linkRecord.google_sub,
    status: 'active',
    email_verified_at: user.email_verified_at || new Date().toISOString(),
    last_login_at: new Date().toISOString()
  });

  const session = await issueSession(res, updated, req);
  await logAuditEvent({
    userId: updated.id,
    action: 'link_google',
    target: updated.email,
    req,
    meta: { sub: linkRecord.google_sub, provider: 'google' }
  });

  res.json({
    status: 'success',
    action: 'link',
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: publicUser(updated)
  });
}));

// ==========================================
// Pengaturan Akun: Ganti Password, Ganti Email, Edit Profil (PRD F1 + F2 Langkah 4)
// ==========================================
app.post('/api/account/password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const curPass = String(currentPassword || '');
  const newPass = String(newPassword || '');
  const clientIp = getClientIp(req);

  if (!curPass || !newPass) {
    return res.status(400).json({ error: 'Current password and new password are required.', code: 'PARAMS_REQUIRED' });
  }
  if (newPass.length < 10) {
    return res.status(400).json({ error: 'New password must be at least 10 characters.', code: 'PASSWORD_TOO_SHORT' });
  }

  const ok = await bcrypt.compare(curPass, req.user.password_hash || '');
  if (!ok) {
    return res.status(400).json({ error: 'Current password is incorrect.', code: 'INVALID_PASSWORD' });
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(newPass, 12);

  await db.update('accounts', { id: req.user.id }, {
    password_hash: passwordHash,
    password_changed_at: now
  });

  // Cabut semua sesi lain KECUALI sesi saat ini
  const rawToken = getRefreshTokenFromReq(req);
  const currentHash = rawToken ? hashToken(rawToken) : null;
  const allSessions = await db.findMany('refresh_tokens', { user_id: req.user.id });
  for (const s of (allSessions || [])) {
    if (!s.revoked_at && (!currentHash || s.token_hash !== currentHash)) {
      await db.update('refresh_tokens', { id: s.id }, { revoked_at: now });
    }
  }

  await sendPasswordChangedNotice({ to: req.user.email, locale: req.user.locale || 'id' });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    action: 'password_change',
    ip: clientIp,
    meta: { email: req.user.email }
  });

  res.json({ success: true, message: 'Password updated successfully.' });
}));

app.post('/api/account/email', auth, wrap(async (req, res) => {
  const { newEmail, password } = req.body || {};
  const newEm = String(newEmail || '').trim().toLowerCase();
  const pass = String(password || '');
  const clientIp = getClientIp(req);

  if (!newEm || !newEm.includes('@') || !newEm.includes('.')) {
    return res.status(400).json({ error: 'Please provide a valid new email address.', code: 'INVALID_EMAIL' });
  }
  if (newEm === req.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'New email address must be different from current email.', code: 'EMAIL_SAME' });
  }
  if (!pass) {
    return res.status(400).json({ error: 'Current password is required.', code: 'PARAMS_REQUIRED' });
  }

  const ok = await bcrypt.compare(pass, req.user.password_hash || '');
  if (!ok) {
    return res.status(400).json({ error: 'Incorrect password.', code: 'INVALID_PASSWORD' });
  }

  // Rate limit: maks 3 permintaan ubah email per jam
  if (await enforceRateLimit(res, `email_change:${req.user.id}`, 3600, 3, 'Too many email change requests. Please try again in 1 hour.')) return;

  // Cek apakah email baru sudah terdaftar
  const existing = await db.findOne('accounts', { email: newEm });
  if (existing) {
    return res.status(400).json({ error: 'This email address is already in use.', code: 'EMAIL_EXISTS' });
  }

  const rawToken = newToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // 24 jam

  await db.insert('email_verifications', {
    user_id: req.user.id,
    new_email: newEm,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  // Kirim email verifikasi ke alamat baru & kirim notifikasi ke alamat lama
  const userLocale = req.user.locale || 'id';
  await sendEmailChangeVerification({ to: newEm, token: rawToken, locale: userLocale });
  await sendEmailChangeNoticeToOldEmail({ to: req.user.email, newEmail: newEm, locale: userLocale });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    action: 'email_change_requested',
    ip: clientIp,
    meta: { oldEmail: req.user.email, newEmail: newEm }
  });

  res.json({
    success: true,
    message: 'A confirmation link has been sent to your new email address. Please check your inbox to complete the change.'
  });
}));

// ==========================================
// Account Deletion, Cancel & Export (PRD F1 + F2 Langkah 8)
// ==========================================
app.post('/api/account/delete', auth, wrap(async (req, res) => {
  const { password, confirm } = req.body || {};
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  const result = await requestAccountDeletion({
    userId: req.user.id,
    password,
    confirm,
    ip: clientIp,
    userAgent
  });

  clearRefreshTokenCookie(res);
  res.json({
    success: true,
    code: 'ACCOUNT_DELETION_SCHEDULED',
    message: `Your account is scheduled for permanent deletion on ${result.scheduledDateFormatted}. You can cancel it anytime by logging back in within 30 days.`,
    scheduledAt: result.scheduledAt
  });
}));

app.post('/api/account/delete/cancel', wrap(async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      userId = decoded.id;
    } catch {}
  }

  const { email, password } = req.body || {};
  const result = await cancelAccountDeletion({
    userId,
    email,
    password,
    ip: clientIp,
    userAgent
  });

  const session = await issueSession(res, result.user, req);
  res.json({
    success: true,
    code: 'ACCOUNT_DELETION_CANCELLED',
    message: 'Account deletion schedule has been cancelled. Your account is now active again.',
    token: session.accessToken,
    accessToken: session.accessToken,
    user: publicUser(result.user)
  });
}));

app.get('/api/account/export', auth, wrap(async (req, res) => {
  const exportData = await exportAccountData(req.user.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="markimate-account-export-${Date.now()}.json"`);
  res.send(JSON.stringify(exportData, null, 2));
}));

// ==========================================
// Meta Data Deletion Callback (PRD F1 + F2 Langkah 8)
// ==========================================
app.post('/api/data-deletion/meta', express.urlencoded({ extended: false }), wrap(async (req, res) => {
  if (!process.env.META_APP_SECRET) {
    return res.status(503).json({
      error: 'Meta data deletion service is not configured (META_APP_SECRET is not set).',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  const signedRequest = req.body?.signed_request || req.body?.signedRequest;
  if (!signedRequest) {
    return res.status(400).json({ error: 'signed_request parameter is required.', code: 'SIGNED_REQUEST_REQUIRED' });
  }

  const result = await handleMetaDataDeletion(signedRequest, process.env.APP_URL);
  res.json(result);
}));

app.get('/api/data-deletion/status', wrap(async (req, res) => {
  const code = String(req.query.code || '').trim();
  if (!code) {
    return res.status(400).json({ error: 'Confirmation code is required.', code: 'CODE_REQUIRED' });
  }

  const status = await getMetaDataDeletionStatus(code);
  if (!status) {
    return res.status(404).json({ error: 'Confirmation code not found.', code: 'NOT_FOUND' });
  }

  res.json(status);
}));

app.patch('/api/me', auth, wrap(async (req, res) => {
  const { name, brandName, niche, webApprover, locale } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name || '').trim();
  if (brandName !== undefined) patch.brand_name = String(brandName || '').trim();
  if (niche !== undefined) patch.niche = String(niche || '').trim();
  if (webApprover !== undefined) patch.web_approver = !!webApprover;
  if (locale !== undefined) {
    const loc = String(locale || '').trim().toLowerCase();
    if (!['id', 'en'].includes(loc)) {
      return res.status(400).json({
        error: 'Locale must be either id or en.',
        code: 'INVALID_LOCALE'
      });
    }
    patch.locale = loc;
  }

  if (Object.keys(patch).length === 0) {
    return res.json({ success: true, user: publicUser(req.user) });
  }

  const updated = await db.update('accounts', { id: req.user.id }, patch);
  req.user = updated || { ...req.user, ...patch };

  res.json({
    success: true,
    user: publicUser(req.user)
  });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const workspaces = await getUserWorkspaces(req.user.id);
  const resolved = await resolveWorkspaceForUser(req.user.id, req.headers['x-workspace-id']);
  const activeWorkspace = resolved?.workspace || (workspaces[0] ? { id: workspaces[0].id } : { id: req.user.id });
  const activeWsId = activeWorkspace.id;

  const conns = await db.findMany('cms_connections', { workspace_id: activeWsId });

  const runs = await usageOf(activeWsId);
  const currentWs = workspaces.find(w => w.id === activeWsId) || workspaces[0] || null;
  res.json({
    user: publicUser(req.user),
    workspaces,
    activeWorkspaceId: activeWsId,
    activeWorkspace: currentWs,
    modules: currentWs ? currentWs.modules : ['seo'],
    entitlements: currentWs ? currentWs.entitlements : { seo: { active: true, source: 'free' } },
    plan: planOf(req.user),
    usage: { runsThisMonth: runs, limit: planOf(req.user).monthlyArticles },
    cms: (conns || []).map(maskConn)
  });
}));

// ==========================================
// Workspace Management & API Keys (PRD F1 + F2 Langkah 5)
// ==========================================
app.get('/api/workspaces', auth, wrap(async (req, res) => {
  const list = await getUserWorkspaces(req.user.id);
  res.json({ workspaces: list });
}));

app.post('/api/workspaces', auth, wrap(async (req, res) => {
  const { name, niche, website } = req.body || {};
  const wsName = String(name || '').trim();
  if (!wsName) {
    return res.status(400).json({ error: 'Workspace name is required.', code: 'NAME_REQUIRED' });
  }

  // Cek batas maksimal 5 workspace untuk paket Free
  const currentWorkspaces = await getUserWorkspaces(req.user.id);
  const isPaid = req.user.plan && req.user.plan !== 'free';
  if (!isPaid && currentWorkspaces.length >= 5) {
    return res.status(403).json({
      error: 'Maximum workspace limit reached. Please upgrade to add more workspaces.',
      code: 'WORKSPACE_LIMIT_REACHED'
    });
  }

  const newId = crypto.randomUUID();
  const ws = await db.insert('workspaces', {
    id: newId,
    name: wsName,
    niche: String(niche || 'Other').trim(),
    website: String(website || '').trim(),
    owner_user_id: req.user.id
  });

  await db.insert('workspace_members', {
    workspace_id: newId,
    user_id: req.user.id,
    role: 'owner'
  });

  // Entitlement default (modul SEO aktif)
  await db.insert('module_entitlements', {
    workspace_id: newId,
    module: 'seo',
    active: true,
    source: isPaid ? 'subscription' : 'trial',
    starts_at: new Date().toISOString()
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: newId,
    action: 'workspace_created',
    ip: getClientIp(req),
    meta: { name: wsName }
  });

  res.json({
    success: true,
    workspace: {
      id: ws.id,
      name: ws.name,
      niche: ws.niche,
      website: ws.website,
      role: 'owner',
      modules: ['seo']
    }
  });
}));

app.patch('/api/workspaces/:id', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const { name, niche, website } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name || '').trim();
  if (niche !== undefined) patch.niche = String(niche || '').trim();
  if (website !== undefined) patch.website = String(website || '').trim();

  const updated = await db.update('workspaces', { id: req.workspace.id }, patch);

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'workspace_updated',
    ip: getClientIp(req),
    meta: patch
  });

  res.json({ success: true, workspace: updated });
}));

app.delete('/api/workspaces/:id', auth, requireWorkspace('owner'), wrap(async (req, res) => {
  const userWorkspaces = await getUserWorkspaces(req.user.id);
  if (userWorkspaces.length <= 1) {
    return res.status(400).json({
      error: 'You cannot delete your only workspace.',
      code: 'CANNOT_DELETE_LAST_WORKSPACE'
    });
  }

  await db.update('workspaces', { id: req.workspace.id }, {
    deleted_at: new Date().toISOString()
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'workspace_deleted',
    ip: getClientIp(req)
  });

  res.json({ success: true, message: 'Workspace deleted successfully.' });
}));

// Workspace API Keys
app.get('/api/workspaces/:id/api-keys', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const keys = await db.findMany('workspace_api_keys', { workspace_id: req.workspace.id }, {
    orderBy: 'created_at',
    ascending: false
  });

  const activeKeys = (keys || [])
    .filter(k => !k.revoked_at)
    .map(k => ({
      id: k.id,
      prefix: k.prefix,
      label: k.label,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at
    }));

  res.json({ apiKeys: activeKeys });
}));

app.post('/api/workspaces/:id/api-keys', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const { label } = req.body || {};
  const created = await createWorkspaceApiKey({
    workspaceId: req.workspace.id,
    userId: req.user.id,
    label: label || 'Default API Key'
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'api_key_created',
    ip: getClientIp(req),
    meta: { prefix: created.prefix, label: created.label }
  });

  res.json({
    success: true,
    apiKey: created
  });
}));

app.delete('/api/workspaces/:id/api-keys/:keyId', auth, requireWorkspace('admin'), requireUuidParam('keyId'), wrap(async (req, res) => {
  const existingKey = await db.findOne('workspace_api_keys', {
    id: req.params.keyId,
    workspace_id: req.workspace.id
  });

  if (!existingKey) {
    return res.status(404).json({ error: 'API key not found.', code: 'NOT_FOUND' });
  }

  await db.update('workspace_api_keys', { id: existingKey.id }, {
    revoked_at: new Date().toISOString()
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'api_key_revoked',
    ip: getClientIp(req),
    meta: { prefix: existingKey.prefix }
  });

  res.json({ success: true, message: 'API key revoked successfully.' });
}));

// ---------- Anggota & Undangan Workspace (Langkah 6) ----------
const splitEmail = (em) => (em ? em.split('@')[0] : '');

app.get('/api/workspaces/:id/members', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const members = await db.findMany('workspace_members', { workspace_id: req.workspace.id }, {
    orderBy: 'joined_at',
    ascending: true
  });

  const enriched = [];
  for (const m of (members || [])) {
    const acc = await db.findOne('accounts', { id: m.user_id });
    enriched.push({
      userId: m.user_id,
      name: acc?.name || acc?.brand_name || splitEmail(acc?.email),
      email: acc?.email || '',
      role: m.role,
      joinedAt: m.joined_at,
      isCurrentUser: m.user_id === req.user.id
    });
  }

  res.json({ members: enriched });
}));

app.patch('/api/workspaces/:id/members/:userId', auth, requireWorkspace('admin'), requireUuidParam('userId'), wrap(async (req, res) => {
  const targetUserId = req.params.userId;
  const { role } = req.body || {};

  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or viewer.', code: 'INVALID_ROLE' });
  }

  const targetMember = await db.findOne('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: targetUserId
  });

  if (!targetMember) {
    return res.status(404).json({ error: 'Member not found in this workspace.', code: 'NOT_FOUND' });
  }

  // Role owner tidak bisa diubah lewat endpoint ini
  if (targetMember.role === 'owner') {
    return res.status(400).json({
      error: 'The workspace owner cannot be demoted. Please transfer ownership first.',
      code: 'CANNOT_DEMOTE_OWNER'
    });
  }

  // Admin tidak bisa mengubah sesama admin jika bukan owner
  if (req.member.role === 'admin' && targetMember.role === 'admin') {
    return res.status(403).json({
      error: 'Only workspace owner can change role of another admin.',
      code: 'FORBIDDEN_ROLE'
    });
  }

  await db.update('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: targetUserId
  }, { role });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'member_role_updated',
    target: targetUserId,
    ip: getClientIp(req),
    meta: { oldRole: targetMember.role, newRole: role }
  });

  res.json({ success: true, member: { userId: targetUserId, role } });
}));

app.delete('/api/workspaces/:id/members/:userId', auth, requireWorkspace('viewer'), requireUuidParam('userId'), wrap(async (req, res) => {
  const targetUserId = req.params.userId;
  const isSelf = targetUserId === req.user.id;

  const targetMember = await db.findOne('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: targetUserId
  });

  if (!targetMember) {
    return res.status(404).json({ error: 'Member not found in this workspace.', code: 'NOT_FOUND' });
  }

  if (targetMember.role === 'owner') {
    return res.status(400).json({
      error: 'Owner cannot leave workspace before transferring ownership.',
      code: 'TRANSFER_OWNERSHIP_FIRST'
    });
  }

  // Jika bukan keluar sendiri, harus memiliki hak admin/owner
  if (!isSelf) {
    if (!['owner', 'admin'].includes(req.member.role)) {
      return res.status(403).json({
        error: 'Only admin or owner can remove members.',
        code: 'FORBIDDEN_ROLE'
      });
    }

    // Admin tidak bisa mengeluarkan sesama admin atau owner
    if (req.member.role === 'admin' && ['admin', 'owner'].includes(targetMember.role)) {
      return res.status(403).json({
        error: 'Admin cannot remove another admin or owner.',
        code: 'FORBIDDEN_ROLE'
      });
    }
  }

  await db.remove('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: targetUserId
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: isSelf ? 'member_left' : 'member_removed',
    target: targetUserId,
    ip: getClientIp(req),
    meta: { removedRole: targetMember.role, isSelf }
  });

  res.json({
    success: true,
    message: isSelf ? 'Anda telah keluar dari workspace.' : 'Anggota telah dikeluarkan dari workspace.'
  });
}));

// Undangan Workspace
app.get('/api/workspaces/:id/invites', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const allInvites = await db.findMany('workspace_invites', { workspace_id: req.workspace.id }, {
    orderBy: 'created_at',
    ascending: false
  });

  const now = new Date();
  const activeInvites = (allInvites || [])
    .filter(inv => !inv.accepted_at && !inv.revoked_at && new Date(inv.expires_at) > now)
    .map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at
    }));

  res.json({ invites: activeInvites });
}));

app.post('/api/workspaces/:id/invites', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const { email, role } = req.body || {};
  const targetEmail = String(email || '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.', code: 'INVALID_EMAIL' });
  }

  const assignedRole = role === 'admin' ? 'admin' : 'viewer';

  // Rate limit: 10 undangan per jam per workspace
  if (await enforceRateLimit(res, `invite:ws:${req.workspace.id}`, 3600, 10, 'Invite rate limit exceeded (maximum 10 per hour). Please try again later.')) {
    return;
  }

  // Maksimal 20 undangan aktif per workspace
  const now = new Date();
  const existingInvites = await db.findMany('workspace_invites', { workspace_id: req.workspace.id });
  const activeCount = (existingInvites || []).filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > now).length;
  if (activeCount >= 20) {
    return res.status(400).json({
      error: 'Maximum active invitations (20) for this workspace reached.',
      code: 'MAX_INVITES_REACHED'
    });
  }

  // Periksa apakah user sudah menjadi anggota
  const targetAccount = await db.findOne('accounts', { email: targetEmail });
  if (targetAccount) {
    const isMember = await db.findOne('workspace_members', {
      workspace_id: req.workspace.id,
      user_id: targetAccount.id
    });
    if (isMember) {
      return res.status(400).json({
        error: 'A user with this email is already a member of this workspace.',
        code: 'ALREADY_MEMBER'
      });
    }
  }

  const rawToken = newToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 86400e3).toISOString();

  const inviteRow = await db.insert('workspace_invites', {
    workspace_id: req.workspace.id,
    email: targetEmail,
    role: assignedRole,
    token_hash: tokenHash,
    invited_by: req.user.id,
    expires_at: expiresAt
  });

  const appUrl = getAppUrl();
  const inviteLink = `${appUrl}/invite?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendWorkspaceInviteEmail({
      to: targetEmail,
      workspaceName: req.workspace.name,
      inviterName: req.user.name || req.user.brand_name || splitEmail(req.user.email),
      inviteLink,
      role: assignedRole,
      locale: targetAccount?.locale || req.body?.locale || req.user.locale || 'id'
    });
  } catch (err) {
    console.error('[INVITE-MAIL-ERR]', err.message);
  }

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'invite_created',
    target: targetEmail,
    ip: getClientIp(req),
    meta: { role: assignedRole, expiresAt }
  });

  res.json({
    success: true,
    invite: {
      id: inviteRow.id,
      email: targetEmail,
      role: assignedRole,
      expiresAt,
      inviteLink
    }
  });
}));

app.delete('/api/workspaces/:id/invites/:inviteId', auth, requireWorkspace('admin'), requireUuidParam('inviteId'), wrap(async (req, res) => {
  const inv = await db.findOne('workspace_invites', {
    id: req.params.inviteId,
    workspace_id: req.workspace.id
  });

  if (!inv) {
    return res.status(404).json({ error: 'Invitation not found.', code: 'NOT_FOUND' });
  }

  await db.update('workspace_invites', { id: inv.id }, {
    revoked_at: new Date().toISOString()
  });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'invite_revoked',
    target: inv.email,
    ip: getClientIp(req)
  });

  res.json({ success: true, message: 'Invitation revoked successfully.' });
}));

// Endpoint publik info undangan
app.get('/api/invites/info', wrap(async (req, res) => {
  const rawToken = String(req.query.token || '').trim();
  if (!rawToken) {
    return res.status(400).json({ valid: false, error: 'Invitation token is required.', message: 'Invitation token is required.', code: 'TOKEN_REQUIRED' });
  }

  const tokenHash = hashToken(rawToken);
  const inv = await db.findOne('workspace_invites', { token_hash: tokenHash });

  if (!inv || inv.revoked_at || inv.accepted_at || new Date(inv.expires_at) <= new Date()) {
    return res.json({
      valid: false,
      error: 'This invitation is invalid, already used, or expired.',
      message: 'This invitation is invalid, already used, or expired.',
      code: 'INVALID_TOKEN'
    });
  }

  const ws = await db.findOne('workspaces', { id: inv.workspace_id });
  const inviter = await db.findOne('accounts', { id: inv.invited_by });

  res.json({
    valid: true,
    invite: {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      workspaceName: ws?.name || 'Workspace',
      inviterName: inviter?.name || inviter?.brand_name || splitEmail(inviter?.email) || 'Team Member',
      expiresAt: inv.expires_at
    }
  });
}));

// Endpoint menerima undangan
app.post('/api/invites/accept', auth, wrap(async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Invitation token is required.', code: 'TOKEN_REQUIRED' });
  }

  const tokenHash = hashToken(token);
  const inv = await db.findOne('workspace_invites', { token_hash: tokenHash });

  if (!inv || inv.revoked_at || inv.accepted_at || new Date(inv.expires_at) <= new Date()) {
    return res.status(400).json({ error: 'Invitation is invalid or has expired.', code: 'INVALID_TOKEN' });
  }

  // Verifikasi kesesuaian email pengguna yang login dengan email undangan
  if (req.user.email.toLowerCase() !== inv.email.toLowerCase()) {
    return res.status(403).json({
      error: `This invitation is for ${inv.email}. You are currently signed in as ${req.user.email}.`,
      code: 'EMAIL_MISMATCH'
    });
  }

  // Tambahkan sebagai anggota jika belum terdaftar
  const existingMember = await db.findOne('workspace_members', {
    workspace_id: inv.workspace_id,
    user_id: req.user.id
  });

  if (!existingMember) {
    await db.insert('workspace_members', {
      workspace_id: inv.workspace_id,
      user_id: req.user.id,
      role: inv.role,
      invited_by: inv.invited_by,
      joined_at: new Date().toISOString()
    });
  }

  await db.update('workspace_invites', { id: inv.id }, {
    accepted_at: new Date().toISOString()
  });

  const ws = await db.findOne('workspaces', { id: inv.workspace_id });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: inv.workspace_id,
    action: 'invite_accepted',
    ip: getClientIp(req),
    meta: { role: inv.role }
  });

  res.json({
    success: true,
    message: `Joined workspace "${ws?.name || 'Workspace'}" successfully.`,
    workspace: {
      id: ws?.id,
      name: ws?.name,
      role: inv.role
    }
  });
}));

// Transfer ownership
app.post('/api/workspaces/:id/transfer-ownership', auth, requireWorkspace('owner'), wrap(async (req, res) => {
  const { userId, password } = req.body || {};

  if (!userId || !password) {
    return res.status(400).json({ error: 'Target user ID and password are required.', code: 'PARAMS_REQUIRED' });
  }

  const passOk = await bcrypt.compare(password, req.user.password_hash || '');
  if (!passOk) {
    return res.status(400).json({ error: 'Incorrect password.', code: 'INVALID_PASSWORD' });
  }

  const targetMember = await db.findOne('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: userId
  });

  if (!targetMember) {
    return res.status(404).json({ error: 'Target user is not a member of this workspace.', code: 'NOT_FOUND' });
  }

  if (targetMember.user_id === req.user.id) {
    return res.status(400).json({ error: 'You are already the owner of this workspace.', code: 'ALREADY_OWNER' });
  }

  // Update owner di tabel workspaces
  await db.update('workspaces', { id: req.workspace.id }, {
    owner_user_id: userId,
    updated_at: new Date().toISOString()
  });

  // Update role di tabel workspace_members
  await db.update('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: userId
  }, { role: 'owner' });

  await db.update('workspace_members', {
    workspace_id: req.workspace.id,
    user_id: req.user.id
  }, { role: 'admin' });

  await db.insert('audit_logs', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    action: 'ownership_transferred',
    target: userId,
    ip: getClientIp(req)
  });

  res.json({
    success: true,
    code: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
    message: 'Workspace ownership successfully transferred.'
  });
}));

// Audit Log Workspace (PRD F1 + F2 Langkah 8)
app.get('/api/workspaces/:id/audit', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const logs = await getWorkspaceAuditLogs(req.workspace.id, 100);
  res.json({ logs });
}));

// ---------- Credits & Dompet Workspace ----------
app.get('/api/credits', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const workspaceId = req.workspace.id;
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
    isUnlimited: await isWorkspacePlatformAdmin(workspaceId),
  });
}));

app.get('/api/credits/estimate', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const { action, qty, images } = req.query;
  const est = await estimate(action || 'seo.article', Number(qty || 1), { images: Number(images || 0) });
  res.json(est);
}));

app.get('/api/credits/ledger', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = await db.findMany('credit_ledger', { workspace_id: req.workspace.id }, {
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

// Webhook notifikasi Provider Pembayaran (DOKU Checkout, dsb) (PRD F14 §2.7 & §4.6)
app.post('/api/webhooks/:provider', wrap(async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const activeProvider = (process.env.PAYMENT_PROVIDER || 'doku').toLowerCase();

  // Tolak jika bukan active provider atau mock di mode production
  if (provider !== activeProvider || (process.env.NODE_ENV === 'production' && provider === 'mock')) {
    return res.status(404).json({ error: 'Webhook provider not found or inactive', code: 'NOT_FOUND' });
  }

  const result = await handleNotification(provider, req);
  res.json(result);
}));

// ---------- Admin Auth & Endpoints (PRD §2b & §4.4) ----------
const adminAuth = async (req, res, next) => {
  // 1. Header x-admin-key (hanya jika ADMIN_KEY diisi dan cocok via timingSafeEqual)
  const adminKey = process.env.ADMIN_KEY ? String(process.env.ADMIN_KEY).trim() : '';
  const given = req.headers['x-admin-key'] ? String(req.headers['x-admin-key']).trim() : '';
  if (adminKey && given) {
    const adminKeyBuf = Buffer.from(adminKey);
    const givenBuf = Buffer.from(given);
    if (adminKeyBuf.length === givenBuf.length && crypto.timingSafeEqual(adminKeyBuf, givenBuf)) {
      return next();
    }
  }

  // 2. Sesi user dengan flag is_platform_admin
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const userId = payload.sub || payload.userId || payload.id;
      const user = await db.findOne('accounts', { id: userId });
      if (user && Boolean(user.is_platform_admin)) {
        req.user = user;
        return next();
      }
    } catch (_) {}
  }

  return res.status(401).json({ error: 'Unauthorized: Admin access required', code: 'UNAUTHORIZED' });
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

// Admin manual subscription activation (PRD §3.2 & F1+F2 Langkah 7)
app.post('/api/admin/subscriptions', adminAuth, wrap(async (req, res) => {
  const { workspaceId, email, plan, months, durationDays } = req.body || {};
  let targetWs = null;
  let user = null;

  if (workspaceId) {
    targetWs = await db.findOne('workspaces', { id: String(workspaceId).trim() });
    if (!targetWs) throw Object.assign(new Error('Workspace not found.'), { status: 404, code: 'WORKSPACE_NOT_FOUND' });
    user = targetWs.owner_user_id ? await db.findOne('accounts', { id: targetWs.owner_user_id }) : null;
  } else if (email) {
    const em = String(email || '').trim().toLowerCase();
    user = await db.findOne('accounts', { email: em });
    if (!user) throw Object.assign(new Error('User not found.'), { status: 404, code: 'USER_NOT_FOUND' });
    const resolved = await resolveWorkspaceForUser(user.id);
    targetWs = resolved?.workspace || await db.findOne('workspaces', { id: user.id });
    if (!targetWs) {
      targetWs = { id: user.id, name: user.name || 'Workspace Default' };
    }
  } else {
    throw Object.assign(new Error('workspaceId or email is required.'), { status: 400, code: 'PARAMS_REQUIRED' });
  }

  const planKey = String(plan || '').trim().toLowerCase();
  const planData = PLANS[planKey];
  if (!planData || planKey === 'free') {
    throw Object.assign(new Error('Invalid paid plan selection. Please choose an active paid plan.'), { status: 400, code: 'BAD_REQUEST' });
  }

  const numMonths = Math.max(1, parseInt(months, 10) || 1);
  const days = durationDays ? Math.max(1, parseInt(durationDays, 10)) : (numMonths * 30);
  const endsAt = new Date(Date.now() + days * 86400e3);

  const sub = await db.insert('subscriptions', {
    user_id: user ? user.id : (targetWs.owner_user_id || targetWs.id),
    workspace_id: targetWs.id,
    plan: planKey,
    status: 'active',
    method: 'manual',
    amount: planData.price * Math.ceil(days / 30),
    invoice_no: 'INV-MANUAL-' + Date.now().toString(36).toUpperCase(),
    started_at: new Date().toISOString(),
    ends_at: endsAt.toISOString(),
    dummy: false
  });

  if (user) {
    await db.update('accounts', { id: user.id }, { plan: planKey });
  }

  // Menulis module_entitlements (source='subscription') untuk semua modul dalam paket
  const targetModules = planData.modules || ['seo'];
  for (const mod of targetModules) {
    const existingEnt = await db.findOne('module_entitlements', {
      workspace_id: targetWs.id,
      module: mod
    });
    if (existingEnt) {
      await db.update('module_entitlements', { workspace_id: targetWs.id, module: mod }, {
        active: true,
        source: 'subscription',
        starts_at: new Date().toISOString(),
        ends_at: endsAt.toISOString()
      });
    } else {
      await db.insert('module_entitlements', {
        workspace_id: targetWs.id,
        module: mod,
        active: true,
        source: 'subscription',
        starts_at: new Date().toISOString(),
        ends_at: endsAt.toISOString()
      });
    }
  }

  const credits = (planData.credits || 0) * Math.ceil(days / 30);
  if (process.env.CREDITS_ENABLED !== 'false' && credits > 0) {
    await grant(
      targetWs.id,
      'sub',
      credits,
      endsAt,
      'grant_sub',
      `Aktivasi manual paket ${planData.name} oleh admin`,
      { actionKey: 'billing.sub', refType: 'subscription', refId: sub.id, note: 'Aktivasi manual oleh admin' }
    );
  }

  res.json({
    status: 'ok',
    user: user ? publicUser(user) : null,
    workspace: { id: targetWs.id, name: targetWs.name },
    modules: targetModules,
    subscription: sub,
    creditsGranted: credits
  });
}));

// Admin manual credits grant (PRD §3.4)
app.post('/api/admin/credits/grant', adminAuth, wrap(async (req, res) => {
  const { email, bucket = 'topup', amount, days, note } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!em) throw Object.assign(new Error('Email address is required.'), { status: 400, code: 'EMAIL_REQUIRED' });

  const user = await db.findOne('accounts', { email: em });
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404, code: 'USER_NOT_FOUND' });

  const targetBucket = String(bucket || 'topup').trim().toLowerCase();
  if (!['topup', 'sub'].includes(targetBucket)) {
    throw Object.assign(new Error("Invalid bucket. Must be 'topup' or 'sub'."), { status: 400, code: 'BAD_REQUEST' });
  }

  const amt = Number(amount || 0);
  if (!amt || amt <= 0) {
    throw Object.assign(new Error('Credit amount must be a positive number.'), { status: 400, code: 'BAD_REQUEST' });
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

// Admin manual user verification (PRD §3 & §4 Langkah 2)
app.post('/api/admin/users/:id/verify', adminAuth, wrap(async (req, res) => {
  const user = await db.findOne('accounts', { id: req.params.id });
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404, code: 'USER_NOT_FOUND' });

  const now = new Date().toISOString();
  await db.update('accounts', { id: user.id }, {
    email_verified_at: now,
    status: 'active'
  });
  user.email_verified_at = now;
  user.status = 'active';

  // Alokasikan trial jika eligible
  await grantTrialIfEligible(user.id, user.email);
  await ensurePlatformAdmin(user);

  await db.insert('audit_logs', {
    user_id: user.id,
    workspace_id: user.id,
    action: 'admin_manual_verify',
    ip: getClientIp(req),
    meta: { admin: true, email: user.email }
  });

  res.json({ success: true, user: publicUser(user) });
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
  catch (e) {
    return {
      ok: false,
      code: 'CMS_CONNECTION_FAILED',
      params: { platform: CMS_NAME[type] || type, error: e.message },
      message: 'Cannot reach ' + (CMS_NAME[type] || type) + ': ' + e.message
    };
  }
}
async function testConnectionInner(type, cfg) {
  if (type === 'wordpress') {
    if (!cfg.url || !cfg.user || !cfg.appPassword) {
      return { ok: false, code: 'WP_MISSING_FIELDS', message: 'Enter site URL, username, and Application Password.' };
    }
    const r = await fetch(cfg.url + '/wp-json/wp/v2/users/me?context=edit', {
      headers: { Authorization: 'Basic ' + Buffer.from(cfg.user + ':' + cfg.appPassword.replace(/\s+/g, '')).toString('base64'), 'User-Agent': 'Markimate/1.0' }
    });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (r.ok && j && j.id) {
      const caps = j.capabilities || {};
      const canWrite = caps.edit_posts !== false;
      const userName = j.name || j.slug || 'User';
      return {
        ok: true,
        code: canWrite ? 'WP_CONNECTED' : 'WP_CONNECTED_NO_WRITE',
        params: { name: userName },
        message: `Connected as ${userName}${canWrite ? '' : ' (no permission to write posts)'}`,
        meta: { userId: j.id, name: j.name }
      };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, code: 'WP_AUTH_FAILED', params: { status: r.status }, message: `WordPress authentication failed (${r.status}). Verify Application Password.` };
    }
    if (r.status === 404) {
      return { ok: false, code: 'WP_REST_NOT_FOUND', message: 'REST API not found. Verify URL and ensure /wp-json is enabled.' };
    }
    return { ok: false, code: 'WP_ERROR', params: { status: r.status, details: j && j.message ? j.message : '' }, message: 'Failed: HTTP ' + r.status + ' ' + (j && j.message ? j.message : '') };
  }
  if (type === 'sanity') return testSanity(cfg);
  if (type === 'shopify') return testShopify(cfg);
  if (!cfg.siteId || !cfg.apiKey) {
    return { ok: false, code: 'WIX_MISSING_FIELDS', message: 'Enter Wix Site ID and API Key.' };
  }
  const r = await fetch('https://www.wixapis.com/blog/v3/posts?paging.limit=1', {
    headers: { Authorization: cfg.apiKey, 'wix-site-id': cfg.siteId }
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.ok) {
    const hasPosts = j && j.posts && j.posts.length > 0;
    const lastPost = hasPosts ? j.posts[0].title : '';
    return {
      ok: true,
      code: hasPosts ? 'WIX_CONNECTED_WITH_POST' : 'WIX_CONNECTED',
      params: { lastPost },
      message: 'Connected to Wix Blog' + (hasPosts ? ' (latest post: ' + lastPost + ')' : ' (no posts yet)'),
      meta: { memberId: j && j.posts && j.posts[0] ? j.posts[0].memberId : '' }
    };
  }
  if (r.status === 401 || r.status === 403) {
    return { ok: false, code: 'WIX_AUTH_FAILED', params: { status: r.status }, message: `Wix rejected API key / Site ID (${r.status}).` };
  }
  return { ok: false, code: 'WIX_ERROR', params: { status: r.status, details: j && j.message ? j.message : '' }, message: 'Failed: HTTP ' + r.status + ' ' + (j && j.message ? j.message : '') };
}
// Sanity: baca jumlah dokumen (cek project/dataset/token) + dry-run mutation (cek izin tulis, tidak menyimpan apa pun)
async function testSanity(cfg) {
  if (!cfg.projectId || !cfg.token) return { ok: false, code: 'SANITY_MISSING_FIELDS', message: 'Enter Sanity Project ID and API Token.' };
  if (!/^[a-z0-9]+$/.test(cfg.projectId) || !/^[a-z0-9_-]+$/i.test(cfg.dataset)) {
    return { ok: false, code: 'SANITY_INVALID_ID', message: 'Invalid Project ID or dataset format.' };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(cfg.docType) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cfg.bodyField)) {
    return { ok: false, code: 'SANITY_INVALID_DOCTYPE', message: 'Invalid document type or content field name.' };
  }
  const api = `https://${cfg.projectId}.api.sanity.io/v2025-02-19/data`;
  const headers = { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' };
  const q = await fetch(`${api}/query/${encodeURIComponent(cfg.dataset)}`, { method: 'POST', headers, body: JSON.stringify({ query: 'count(*[_type == $t])', params: { t: cfg.docType } }) });
  const qj = await q.json().catch(() => ({}));
  if (q.status === 401) return { ok: false, code: 'SANITY_INVALID_TOKEN', message: 'Sanity token is invalid (401).' };
  if (q.status === 404) return { ok: false, code: 'SANITY_NOT_FOUND', message: 'Project ID or dataset not found (404).' };
  if (!q.ok) return { ok: false, code: 'SANITY_QUERY_FAILED', params: { status: q.status, details: (qj.error && (qj.error.description || qj.error)) || '' }, message: 'Failed to read Sanity: HTTP ' + q.status };
  const m = await fetch(`${api}/mutate/${encodeURIComponent(cfg.dataset)}?dryRun=true`, { method: 'POST', headers, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'drafts.markimate-connection-test', _type: cfg.docType, title: 'Markimate connection test' } }] }) });
  if (m.status === 401 || m.status === 403) return { ok: false, code: 'SANITY_READ_ONLY_TOKEN', params: { status: m.status }, message: `Sanity token has read-only access (${m.status}).` };
  if (!m.ok) {
    const mj = await m.json().catch(() => ({}));
    return { ok: false, code: 'SANITY_MUTATE_FAILED', params: { status: m.status, details: (mj.error && (mj.error.description || mj.error)) || '' }, message: 'Sanity write test failed: HTTP ' + m.status };
  }
  return {
    ok: true,
    code: 'SANITY_CONNECTED',
    params: { projectId: cfg.projectId, dataset: cfg.dataset, count: qj.result ?? 0, docType: cfg.docType },
    message: `Connected to Sanity (${cfg.projectId}/${cfg.dataset}) — ${qj.result ?? 0} "${cfg.docType}" documents, write permissions OK`
  };
}
// Shopify: (tukar Client ID/Secret → token 24 jam bila perlu) lalu baca toko, blog, dan scope app
async function testShopify(cfg) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cfg.shop || '')) {
    return { ok: false, code: 'SHOPIFY_INVALID_DOMAIN', message: 'Store domain must follow storename.myshopify.com format.' };
  }
  let token = cfg.accessToken;
  if (!token) {
    if (!cfg.clientId || !cfg.clientSecret) return { ok: false, code: 'SHOPIFY_MISSING_CREDS', message: 'Enter Admin API access token, or Client ID + Client Secret.' };
    const t = await fetch(`https://${cfg.shop}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret }) });
    const tj = await t.json().catch(() => ({}));
    if (!t.ok || !tj.access_token) return { ok: false, code: 'SHOPIFY_OAUTH_FAILED', params: { status: t.status, details: tj.error_description || tj.error || '' }, message: 'Client ID/Secret rejected (' + t.status + ')' };
    token = tj.access_token;
  }
  const r = await fetch(`https://${cfg.shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ shop { name } blogs(first: 20) { nodes { id handle title } } currentAppInstallation { accessScopes { handle } } }' }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) return { ok: false, code: 'SHOPIFY_INVALID_TOKEN', message: 'Shopify token is invalid (401).' };
  if (r.status === 403) return { ok: false, code: 'SHOPIFY_INSUFFICIENT_SCOPE', message: 'Shopify token lacks permissions (403). Add read_content & write_content scopes.' };
  if (r.status === 404) return { ok: false, code: 'SHOPIFY_STORE_NOT_FOUND', message: 'Store not found (404).' };
  if (!r.ok || !j.data) return { ok: false, code: 'SHOPIFY_READ_FAILED', params: { details: j.errors ? JSON.stringify(j.errors).slice(0, 160) : 'HTTP ' + r.status }, message: 'Failed to read store: HTTP ' + r.status };
  const scopes = ((j.data.currentAppInstallation || {}).accessScopes || []).map(x => x.handle);
  if (scopes.length && !scopes.some(x => x === 'write_content' || x === 'write_online_store_pages')) {
    return { ok: false, code: 'SHOPIFY_WRITE_SCOPE_MISSING', message: 'App lacks write_content scope.' };
  }
  const blogs = (j.data.blogs && j.data.blogs.nodes) || [];
  if (!blogs.length) return { ok: false, code: 'SHOPIFY_NO_BLOGS', params: { shopName: j.data.shop.name }, message: 'Connected to ' + j.data.shop.name + ', but store has no blogs.' };
  const chosen = cfg.blogId ? blogs.find(b => b.id === cfg.blogId || b.id.endsWith('/' + cfg.blogId) || b.handle === cfg.blogId) : blogs[0];
  if (!chosen) return { ok: false, code: 'SHOPIFY_BLOG_NOT_FOUND', params: { blogId: cfg.blogId, available: blogs.map(b => b.handle).join(', ') }, message: 'Blog "' + cfg.blogId + '" not found.' };
  return {
    ok: true,
    code: 'SHOPIFY_CONNECTED',
    params: { shopName: j.data.shop.name, blogTitle: chosen.title, blogCount: blogs.length, blogs: blogs.map(b => b.handle).join(', ') },
    message: `Connected to ${j.data.shop.name} — articles saved to "${chosen.title}"`,
    meta: { blogs }
  };
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

app.get('/api/cms', auth, requireWorkspace('viewer'), requireModule('seo'), wrap(async (req, res) => {
  const conns = await db.findMany('cms_connections', { workspace_id: req.workspace.id });
  res.json({ cms: (conns || []).map(maskConn) });
}));
app.get('/api/cms/:type/options', auth, requireWorkspace('viewer'), requireModule('seo'), wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  const c = await db.findOne('cms_connections', { workspace_id: req.workspace.id, cms_type: type });
  if (!c) return res.json({ options: {} });
  const cfg = resolveConnConfig(c);
  const options = await fetchCmsOptions(type, cfg);
  res.json({ options });
}));
app.put('/api/cms/:type', auth, requireWorkspace('admin'), requireModule('seo'), wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  if (!CMS_TYPES.includes(type)) throw Object.assign(new Error('Unsupported CMS type: ' + type), { status: 400, code: 'UNSUPPORTED_CMS' });
  const existing = await db.findOne('cms_connections', { workspace_id: req.workspace.id, cms_type: type });
  const existingConfig = existing ? resolveConnConfig(existing) : {};
  
  const hasConfig = req.body.config !== undefined || (!req.body.articleSettings && Object.keys(req.body).length > 0);
  const incoming = hasConfig ? normalizeConfig(type, req.body.config || req.body) : existingConfig;
  
  if (existing && hasConfig) {
    for (const k of ['appPassword', 'apiKey', 'token', 'accessToken', 'clientSecret']) {
      if (incoming[k] && incoming[k].includes('••••')) incoming[k] = existingConfig[k];
    }
  }

  const shouldTest = hasConfig && req.body.test !== false;
  const test = shouldTest ? await testConnection(type, incoming) : { ok: existing?.verified ?? false, message: existing?.verified ? 'Connected' : 'Not tested' };
  const { enc, iv } = encrypt(incoming);
  
  const articleSettings = req.body.articleSettings !== undefined
    ? normalizeArticleSettings(req.body.articleSettings)
    : (existing?.article_settings ? normalizeArticleSettings(existing.article_settings) : normalizeArticleSettings({}));

  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (!creditsEnabled && articleSettings.images?.enabled && !planOf(req.user).images) {
    throw Object.assign(new Error('AI image generation is only available on paid plans. Please upgrade.'), { status: 402, code: 'UPGRADE_REQUIRED' });
  }

  const row = await db.upsert('cms_connections', { workspace_id: req.workspace.id, cms_type: type }, {
    workspace_id: req.workspace.id,
    user_id: req.user.id,
    cms_type: type,
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
app.post('/api/cms/:type/test', auth, requireWorkspace('admin'), requireModule('seo'), wrap(async (req, res) => {
  const type = String(req.params.type).toLowerCase();
  const c = await db.findOne('cms_connections', { workspace_id: req.workspace.id, cms_type: type });
  if (!c) throw Object.assign(new Error('CMS credentials have not been configured yet.'), { status: 404, code: 'CMS_NOT_CONFIGURED' });
  const cfg = resolveConnConfig(c);
  const test = await testConnection(type, cfg);
  await db.update('cms_connections', { id: c.id }, { verified: test.ok, verified_at: test.ok ? new Date().toISOString() : null });
  res.json({ test });
}));
app.delete('/api/cms/:type', auth, requireWorkspace('admin'), requireModule('seo'), wrap(async (req, res) => {
  await db.remove('cms_connections', { workspace_id: req.workspace.id, cms_type: String(req.params.type).toLowerCase() });
  res.json({ ok: true });
}));

// ---------- Keywords & automation ----------
const kwPublic = (k) => ({
  id: k.id,
  workspaceId: k.workspace_id,
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

app.get('/api/keywords', auth, requireWorkspace('viewer'), requireModule('seo'), wrap(async (req, res) => {
  const list = await db.findMany('keywords', { workspace_id: req.workspace.id }, { orderBy: 'created_at' });
  res.json({ keywords: list.map(kwPublic) });
}));
app.post('/api/keywords', auth, requireWorkspace('admin'), requireModule('seo'), wrap(async (req, res) => {
  const b = req.body || {};
  const keyword = String(b.keyword || '').trim(); if (!keyword) throw Object.assign(new Error('Keyword is required.'), { status: 400, code: 'KEYWORD_REQUIRED' });
  const cms = String(b.cmsType || b.cms || 'wordpress').toLowerCase();
  const schedule = ['immediate', 'daily', 'weekly'].includes(b.schedule) ? b.schedule : 'immediate';
  if (schedule !== 'immediate' && planOf(req.user).id === 'free') throw Object.assign(new Error('Automated scheduling is only available on paid plans.'), { status: 402, code: 'UPGRADE_REQUIRED' });
  const row = await db.insert('keywords', {
    user_id: req.user.id,
    workspace_id: req.workspace.id,
    keyword,
    geo: String(b.geo || 'ID').toUpperCase(),
    ln: String(b.ln || 'id').toLowerCase(),
    cms_type: cms,
    status: 'Pending',
    schedule,
    next_run_at: nextRun(schedule)
  });
  res.json({ keyword: kwPublic(row) });
}));
app.patch('/api/keywords/:id', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, workspace_id: req.workspace.id });
  if (!k) throw Object.assign(new Error('Keyword not found.'), { status: 404, code: 'NOT_FOUND' });
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
app.delete('/api/keywords/:id', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, workspace_id: req.workspace.id });
  if (!k) throw Object.assign(new Error('Keyword not found.'), { status: 404, code: 'NOT_FOUND' });
  await db.remove('keywords', { id: k.id });
  res.json({ ok: true });
}));

async function generateFor(user, k) {
  const wsId = k.workspace_id || user.id;
  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (creditsEnabled) {
    // Assert credit sebelum aksi (PRD §4.2: seo.article)
    await assertAffordable(wsId, 'seo.article', 1);
  } else {
    const plan = planOf(user);
    const used = await usageOf(wsId);
    if (used >= plan.monthlyArticles) throw Object.assign(new Error(`Kuota ${plan.name} bulan ini habis (${plan.monthlyArticles} artikel). Upgrade ke Pro untuk melanjutkan.`), { status: 402 });
  }

  await db.update('keywords', { id: k.id }, { status: 'AI Writing...', error: '' });

  const conn = k.cms_type ? await db.findOne('cms_connections', { workspace_id: wsId, cms_type: k.cms_type }) : null;
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
      await charge(wsId, 'seo.article', 1, {
        type: 'keyword',
        id: k.id,
        note: `Generate artikel: ${k.keyword}`
      }, usage);
    }

    return updated;
  } catch (e) {
    const usage = e.usage || (e.n8n && e.n8n.usage) || null;
    if (creditsEnabled && usage) {
      await recordFailedUsage(wsId, 'seo.article', usage, {
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
  const wsId = k.workspace_id || user.id;
  const conn = await db.findOne('cms_connections', { workspace_id: wsId, cms_type: k.cms_type });
  if (!conn) throw Object.assign(new Error(`CMS credentials for ${k.cms_type} have not been configured yet.`), { status: 400, code: 'CMS_NOT_CONFIGURED' });
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
    await assertAffordable(wsId, 'seo.image', options.imageCount);
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
      await charge(wsId, 'seo.image', out.images.length, {
        type: 'keyword_images',
        id: `${k.id}_${out.postId || k.post_id || 'post'}`,
        note: `Upload ${out.images.length} gambar artikel ${k.keyword}`
      }, out.usage || null);
    }

    return updated;
  } catch (e) {
    const usage = e.usage || (e.n8n && e.n8n.usage) || null;
    if (creditsEnabled && usage) {
      await recordFailedUsage(wsId, 'seo.image', usage, {
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

app.post('/api/keywords/:id/run', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, workspace_id: req.workspace.id });
  if (!k) throw Object.assign(new Error('Keyword not found.'), { status: 404, code: 'NOT_FOUND' });
  let row = await generateFor(req.user, k);
  if (row.status !== 'Duplicate' && !webApproverOn(req.user)) {
    // Free (atau Web Approver mati): langsung simpan sebagai DRAF di CMS, tanpa review
    try { row = await publishFor(req.user, row, 'draft'); } catch (e) { row = await db.findOne('keywords', { id: k.id }); row.error = e.message; }
  }
  res.json({ keyword: kwPublic(row) });
}));
app.post('/api/keywords/:id/publish', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const k = await db.findOne('keywords', { id: req.params.id, workspace_id: req.workspace.id });
  if (!k) throw Object.assign(new Error('Keyword not found.'), { status: 404, code: 'NOT_FOUND' });
  if (!k.article && !k.post_id) throw Object.assign(new Error('Article has not been generated yet. Please run the keyword first.'), { status: 400, code: 'BAD_REQUEST' });
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
  const wsId = source.workspace_id || user.id;
  const creditsEnabled = process.env.CREDITS_ENABLED !== 'false';
  if (creditsEnabled) {
    // Assert saldo seo.topics_run (10 credit, PRD §4.2)
    await assertAffordable(wsId, 'seo.topics_run', 1);
  } else if (user.plan === 'free') {
    throw Object.assign(new Error('Auto topics is only available on paid plans.'), { status: 402, code: 'UPGRADE_REQUIRED' });
  }

  const conn = await db.findOne('cms_connections', { workspace_id: wsId, cms_type: source.cms_type });
  if (!conn) {
    throw Object.assign(new Error(`CMS connection for ${source.cms_type} is not configured.`), { status: 400, code: 'CMS_NOT_CONFIGURED' });
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
      await recordFailedUsage(wsId, 'seo.topics_run', usage, {
        type: 'topic_source',
        id: source.id,
        note: e.message
      });
    }
    throw e;
  }

  // Charge credit setelah n8n 200 (PRD §4.2)
  if (creditsEnabled) {
    await charge(wsId, 'seo.topics_run', 1, {
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
      workspace_id: wsId,
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

app.get('/api/seo/topic-sources', auth, requireWorkspace('viewer'), requireModule('seo'), wrap(async (req, res) => {
  const sources = await db.findMany('seo_topic_sources', { workspace_id: req.workspace.id }, { orderBy: 'created_at' });
  res.json({ sources });
}));

app.put('/api/seo/topic-sources', auth, requireWorkspace('admin'), requireModule('seo'), wrap(async (req, res) => {
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

  let existing = b.id ? await db.findOne('seo_topic_sources', { id: b.id, workspace_id: req.workspace.id }) : null;
  if (!existing) {
    existing = await db.findOne('seo_topic_sources', { workspace_id: req.workspace.id, cms_type: cmsType });
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
      workspace_id: req.workspace.id,
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

app.delete('/api/seo/topic-sources/:id', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const source = await db.findOne('seo_topic_sources', { id: req.params.id, workspace_id: req.workspace.id });
  if (!source) throw Object.assign(new Error('Topic source not found.'), { status: 404, code: 'NOT_FOUND' });
  await db.remove('seo_topic_sources', { id: source.id });
  res.json({ ok: true });
}));

app.post('/api/seo/topic-sources/:id/run', auth, requireWorkspace('admin'), requireModule('seo'), requireUuidParam('id'), wrap(async (req, res) => {
  const source = await db.findOne('seo_topic_sources', { id: req.params.id, workspace_id: req.workspace.id });
  if (!source) throw Object.assign(new Error('Topic source not found.'), { status: 404, code: 'NOT_FOUND' });
  const result = await runTopicSource(req.user, source);
  res.json(result);
}));

// ---------- Billing & Payments (PRD F14) ----------
app.get('/api/billing/catalog', wrap(async (_req, res) => {
  res.json(getCatalog());
}));

app.get('/api/billing', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const subs = await db.findMany('subscriptions', { workspace_id: req.workspace.id }, { orderBy: 'created_at desc' });
  const payments = await db.findMany('payments', { workspace_id: req.workspace.id }, { orderBy: 'created_at desc' });
  res.json({
    plans: Object.values(PLANS),
    current: planOf(req.user),
    subscription: subs[0] || null,
    history: subs.slice(0, 10),
    payments: payments.slice(0, 20),
    billingDisabled: false
  });
}));

app.post('/api/billing/topup', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const { packageId } = req.body || {};
  const checkout = await createCheckout({
    kind: 'topup',
    itemId: packageId || 'starter',
    workspaceId: req.workspace.id,
    userId: req.user.id
  });
  res.json(checkout);
}));

app.post('/api/billing/checkout', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const { plan } = req.body || {};
  const checkout = await createCheckout({
    kind: 'subscription',
    itemId: plan || 'seo',
    workspaceId: req.workspace.id,
    userId: req.user.id
  });
  res.json(checkout);
}));

app.get('/api/billing/payments/:invoice', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const invoice = String(req.params.invoice || '').trim();
  const payment = await db.findOne('payments', { invoice_number: invoice, workspace_id: req.workspace.id });
  if (!payment) {
    throw Object.assign(new Error('Payment not found.'), { status: 404, code: 'PAYMENT_NOT_FOUND' });
  }
  res.json({
    id: payment.id,
    invoiceNumber: payment.invoice_number,
    kind: payment.kind,
    itemId: payment.item_id,
    itemName: payment.item_name,
    amount: payment.amount,
    currency: payment.currency,
    credits: payment.credits,
    periodDays: payment.period_days,
    provider: payment.provider,
    status: payment.status,
    method: payment.method,
    paidAt: payment.paid_at,
    expiresAt: payment.expires_at,
    checkoutUrl: payment.checkout_url,
    createdAt: payment.created_at
  });
}));

app.get('/api/billing/payments', auth, requireWorkspace('viewer'), wrap(async (req, res) => {
  const payments = await db.findMany('payments', { workspace_id: req.workspace.id }, { orderBy: 'created_at desc' });
  res.json({
    payments: payments.map(p => ({
      id: p.id,
      invoiceNumber: p.invoice_number,
      kind: p.kind,
      itemId: p.item_id,
      itemName: p.item_name,
      amount: p.amount,
      currency: p.currency,
      credits: p.credits,
      periodDays: p.period_days,
      provider: p.provider,
      status: p.status,
      method: p.method,
      paidAt: p.paid_at,
      expiresAt: p.expires_at,
      createdAt: p.created_at
    }))
  });
}));

app.post('/api/billing/cancel', auth, requireWorkspace('admin'), wrap(async (req, res) => {
  const subs = await db.findMany('subscriptions', { workspace_id: req.workspace.id, status: 'active' });
  for (const s of subs) await db.update('subscriptions', { id: s.id }, { status: 'cancelled' });
  const u = await db.update('accounts', { id: req.user.id }, { plan: 'free' });
  res.json({ user: publicUser(u) });
}));

// Cron rekonsiliasi pembayaran DOKU / provider (PRD F14 §2.8 & §4.6)
app.get('/api/cron/payments-reconcile', wrap(async (req, res) => {
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query.secret || '');
  if (!CRON_SECRET || given !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized cron request.', code: 'UNAUTHORIZED' });
  }
  const result = await reconcile();
  res.json({ status: 'ok', result });
}));

// ---------- 3Our Public API (API key per workspace/user) ----------
app.post('/api/v1/articles/generate', apiKeyAuth, requireModule('seo'), wrap(async (req, res) => {
  const b = req.body || {}; const keyword = String(b.keyword || '').trim();
  if (!keyword) throw Object.assign(new Error('Keyword is required.'), { status: 400, code: 'KEYWORD_REQUIRED' });
  const wsId = req.workspace ? req.workspace.id : req.user.id;
  const k = await db.insert('keywords', {
    user_id: req.user.id,
    workspace_id: wsId,
    keyword,
    geo: String(b.geo || 'ID').toUpperCase(),
    ln: String(b.ln || 'id').toLowerCase(),
    cms_type: String(b.cmsType || 'wordpress').toLowerCase(),
    status: 'Pending',
    schedule: 'immediate',
    source: 'api'
  });
  const row = await generateFor(req.user, k);
  if (row.status === 'Duplicate') {
    return res.status(409).json({
      status: 'duplicate',
      id: row.id,
      duplicateOf: row.duplicate_of || null,
      message: row.error || 'Duplicate topic with existing CMS article.'
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
app.post('/api/v1/articles/:id/publish', apiKeyAuth, requireModule('seo'), wrap(async (req, res) => {
  const wsId = req.workspace ? req.workspace.id : req.user.id;
  const k = await db.findOne('keywords', { id: req.params.id, workspace_id: wsId });
  if (!k) throw Object.assign(new Error('Article not found.'), { status: 404, code: 'NOT_FOUND' });
  const row = await publishFor(req.user, k, req.body.action === 'publish' ? 'publish' : 'draft', req.body.article || null);
  res.json({ status: 'ok', id: row.id, postId: row.post_id, draftEditUrl: row.draft_url, publicUrl: row.public_url, postStatus: row.post_status, warnings: row.warnings || [] });
}));
app.get('/api/v1/articles', apiKeyAuth, requireModule('seo'), wrap(async (req, res) => {
  const wsId = req.workspace ? req.workspace.id : req.user.id;
  const articles = await db.findMany('keywords', { workspace_id: wsId }, { orderBy: 'created_at' });
  res.json({ status: 'ok', articles: articles.map(kwPublic) });
}));

// ---------- Module Entitlements: Ads Report & Ads Spy Ready Endpoints (PRD F1+F2 Langkah 7) ----------
app.get('/api/ads/reports', auth, requireWorkspace('viewer'), requireModule('ads_report'), wrap(async (req, res) => {
  res.json({ status: 'ok', module: 'ads_report', reports: [] });
}));
app.get('/api/ads/spy', auth, requireWorkspace('viewer'), requireModule('ads_spy'), wrap(async (req, res) => {
  res.json({ status: 'ok', module: 'ads_spy', competitors: [] });
}));

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

  // 0b. Matikan module_entitlements yang ends_at telah lewat (PRD F1+F2 Langkah 7)
  let expiredEntitlementsCount = 0;
  try {
    expiredEntitlementsCount = await expireEntitlements();
    if (expiredEntitlementsCount > 0) log(`[CRON] expireEntitlements: ${expiredEntitlementsCount} dinonaktifkan`);
  } catch (err) {
    log(`[CRON] expireEntitlements error: ${err.message}`);
  }

  // 0c. Purge akun pending_deletion > 30 hari (PRD F1+F2 Langkah 8)
  let purgedAccountsCount = 0;
  try {
    purgedAccountsCount = await purgeDeletedAccounts();
    if (purgedAccountsCount > 0) log(`[CRON] purgeDeletedAccounts: ${purgedAccountsCount} akun dihapus permanen`);
  } catch (err) {
    log(`[CRON] purgeDeletedAccounts error: ${err.message}`);
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

  // 0d. Pengingat perpanjangan langganan H-7 dan H-1 (PRD F14 Poin 16)
  let renewalReminderSummary = null;
  try {
    const { processSubscriptionRenewalReminders } = await import('./lib/payments/service.js');
    renewalReminderSummary = await processSubscriptionRenewalReminders();
  } catch (err) {
    log(`[CRON] processSubscriptionRenewalReminders error: ${err.message}`);
  }

  res.json({
    ran: results.length,
    results,
    alerts: alertSummary,
    marginSentinel: marginSentinelSummary,
    renewalReminders: renewalReminderSummary
  });
}));

app.use((req, res) => res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' }));

if (!process.env.VERCEL) app.listen(PORT, () => log(`Markimate backend di http://localhost:${PORT} (db: ${dbMode}, n8n: ${N8N_BASE_URL})`));
export default app;
