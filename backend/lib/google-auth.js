import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { parseCookies, issueSession, publicUser } from './session.js';
import { createDefaultWorkspace, resolveWorkspaceForUser } from './workspaces.js';
import { grantTrialIfEligible } from './credits.js';
import { logAuditEvent } from './account-lifecycle.js';
import { newToken, hashToken } from './tokens.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';

import { getAppUrl } from './config.js';

/**
 * Menentukan redirect URI yang valid menggunakan allowlist exact match (Langkah 1.8).
 */
export function getGoogleRedirectUri(req) {
  const appUrl = getAppUrl();
  const allowed = new Set([
    `${appUrl}/auth/google/callback`,
    'http://localhost:5173/auth/google/callback'
  ]);

  const customRedirect = req?.query?.redirect_uri;
  if (customRedirect && allowed.has(customRedirect)) {
    return customRedirect;
  }

  const origin = (req?.headers?.origin || req?.headers?.referer || '').replace(/\/+$/, '');
  const originCallback = `${origin}/auth/google/callback`;
  if (allowed.has(originCallback)) {
    return originCallback;
  }

  return `${appUrl}/auth/google/callback`;
}

/**
 * Membuat authorization URL dengan PKCE (code_verifier & code_challenge) dan state acak.
 * Menyimpan state & code_verifier ke cookie httpOnly 'mk_g_oauth' selama 10 menit.
 */
export function generateGoogleAuthUrl(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID belum dikonfigurasi di environment server.');
  }

  const state = randomBytes(24).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const redirectUri = getGoogleRedirectUri(req);

  // Simpan state, codeVerifier, dan redirectUri di cookie httpOnly mk_g_oauth (10 menit)
  const oauthCookiePayload = JSON.stringify({ state, codeVerifier, redirectUri });
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 10 * 60 * 1000; // 10 menit

  if (typeof res.cookie === 'function') {
    res.cookie('mk_g_oauth', oauthCookiePayload, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge
    });
  } else {
    res.setHeader('Set-Cookie', `mk_g_oauth=${encodeURIComponent(oauthCookiePayload)}; Path=/api/auth/google; Max-Age=600; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account'
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export function parseGoogleOAuthCookie(req) {
  const cookies = parseCookies(req);
  const raw = cookies['mk_g_oauth'];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGoogleOAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  if (typeof res.clearCookie === 'function') {
    res.clearCookie('mk_g_oauth', {
      path: '/api/auth/google',
      httpOnly: true,
      sameSite: 'lax'
    });
  } else {
    res.setHeader('Set-Cookie', `mk_g_oauth=; Path=/api/auth/google; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`);
  }
}

/**
 * Menukar authorization code ke Google token
 */
export async function exchangeGoogleCode(code, codeVerifier, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Kredensial OAuth Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) belum lengkap.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });

  const resp = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error_description || data.error || 'Gagal menukarkan kode otorisasi dengan Google token');
  }

  return data;
}

/**
 * Memverifikasi id_token Google
 */
export async function verifyGoogleIdToken(idToken) {
  if (!idToken) throw new Error('Google ID Token tidak ditemukan');

  const resp = await fetch(`${GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(idToken)}`);
  const data = await resp.json();

  if (!resp.ok || data.error_description || data.error) {
    throw new Error(data.error_description || data.error || 'ID Token Google tidak valid atau sudah kedaluwarsa');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && data.aud !== clientId) {
    throw new Error('ID Token aud mismatch (token tidak ditujukan untuk aplikasi Markimate ini)');
  }

  const isEmailVerified = data.email_verified === 'true' || data.email_verified === true;
  if (!isEmailVerified) {
    throw new Error('Alamat email Google Anda belum terverifikasi oleh Google.');
  }

  return {
    sub: data.sub,
    email: String(data.email).toLowerCase(),
    name: data.name || data.email?.split('@')[0] || 'Pengguna Google',
    picture: data.picture || null,
    emailVerified: true
  };
}

/**
 * Menangani alur login/register/link Google di database:
 * 1. google_sub sudah ada -> login langsung
 * 2. Akun unverified dengan email yang sama -> klaim akun (hapus password lama, tautkan, verifikasi)
 * 3. Akun active ber-password -> buat pendingToken dan kembalikan 409 LINK_PASSWORD_REQUIRED
 * 4. User baru -> buat akun active, workspace, trial credit & entitlement seo free
 */
export async function processGoogleAuth({ googleProfile, req, res }) {
  const { sub, email, name } = googleProfile;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Cek berdasarkan google_sub
  const existingBySub = await db.findOne('accounts', { google_sub: sub });
  if (existingBySub) {
    if (existingBySub.status === 'pending_deletion') {
      const err = new Error('Akun sedang dalam proses penghapusan. Batalkan penghapusan terlebih dahulu.');
      err.status = 403;
      err.code = 'ACCOUNT_PENDING_DELETION';
      throw err;
    }

    // Update last_login_at
    await db.update('accounts', { id: existingBySub.id }, {
      last_login_at: new Date().toISOString()
    });

    const session = await issueSession(res, existingBySub, req);
    await logAuditEvent({
      userId: existingBySub.id,
      action: 'login_google',
      target: existingBySub.email,
      req,
      meta: { sub, provider: 'google' }
    });

    // Langkah 1.3: Jangan spread session, return hanya accessToken, expiresIn, user (publicUser)
    return {
      status: 'success',
      action: 'login',
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(existingBySub)
    };
  }

  // 2. Cek berdasarkan email
  const existingByEmail = await db.findOne('accounts', { email: normalizedEmail });
  if (existingByEmail) {
    if (existingByEmail.status === 'pending_deletion') {
      const err = new Error('Akun sedang dalam proses penghapusan. Batalkan penghapusan terlebih dahulu.');
      err.status = 403;
      err.code = 'ACCOUNT_PENDING_DELETION';
      throw err;
    }

    // Langkah 1.6: Akun unverified milik orang lain diklaim oleh pemilik email Google terverifikasi
    if (existingByEmail.status === 'unverified') {
      const updated = await db.update('accounts', { id: existingByEmail.id }, {
        password_hash: null,
        google_sub: sub,
        status: 'active',
        email_verified_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      });

      const wsResolved = await resolveWorkspaceForUser(updated.id);
      const wsId = wsResolved?.workspace?.id || updated.id;

      // Berikan trial jika memenuhi syarat
      const trialRes = await grantTrialIfEligible(wsId, updated.email);
      if (trialRes && trialRes.granted) {
        const endsAt = trialRes.expiresAt ? new Date(trialRes.expiresAt).toISOString() : new Date(Date.now() + 7 * 86400 * 1000).toISOString();
        for (const mod of ['ads_report', 'ads_spy']) {
          await db.upsert('module_entitlements', { workspace_id: wsId, module: mod }, {
            active: true,
            source: 'trial',
            starts_at: new Date().toISOString(),
            ends_at: endsAt
          });
        }
      }

      // Entitlement seo dengan source free selalu aktif
      await db.upsert('module_entitlements', { workspace_id: wsId, module: 'seo' }, {
        active: true,
        source: 'free',
        starts_at: new Date().toISOString(),
        ends_at: null
      });

      const session = await issueSession(res, updated, req);
      await logAuditEvent({
        userId: updated.id,
        action: 'google_claimed_unverified',
        target: updated.email,
        req,
        meta: { sub, provider: 'google', workspaceId: wsId }
      });

      return {
        status: 'success',
        action: 'claim_unverified',
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        user: publicUser(updated)
      };
    }

    // Langkah 1.4: Akun active ber-password belum ditautkan -> buat pending link token
    if (existingByEmail.password_hash) {
      const plainPendingToken = newToken();
      const tokenHash = hashToken(plainPendingToken);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await db.insert('oauth_pending_links', {
        token_hash: tokenHash,
        user_id: existingByEmail.id,
        email: normalizedEmail,
        google_sub: sub,
        expires_at: expiresAt
      });

      const err = new Error('Akun dengan email ini sudah terdaftar. Masukkan kata sandi Markimate untuk menautkan akun Google Anda.');
      err.status = 409;
      err.code = 'LINK_PASSWORD_REQUIRED';
      err.email = normalizedEmail;
      err.pendingToken = plainPendingToken;
      throw err;
    }

    // Jika akun tidak punya password_hash (misal dari legacy OAuth): tautkan langsung
    const updated = await db.update('accounts', { id: existingByEmail.id }, {
      google_sub: sub,
      status: 'active',
      email_verified_at: existingByEmail.email_verified_at || new Date().toISOString(),
      last_login_at: new Date().toISOString()
    });

    const session = await issueSession(res, updated, req);
    await logAuditEvent({
      userId: updated.id,
      action: 'link_google',
      target: updated.email,
      req,
      meta: { sub, provider: 'google' }
    });

    return {
      status: 'success',
      action: 'link',
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(updated)
    };
  }

  // 3. User Baru (Register via Google)
  // Langkah 1.1: password_hash null diizinkan
  const newAccount = await db.insert('accounts', {
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    brand_name: name || 'Workspace Utama',
    google_sub: sub,
    password_hash: null,
    status: 'active',
    locale: 'id',
    email_verified_at: new Date().toISOString(),
    plan: 'free',
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString()
  });

  // Buatkan Workspace default
  const defaultWs = await createDefaultWorkspace(newAccount.id, newAccount.brand_name || 'Workspace Utama');

  // Berikan trial credit (300 credit + 7 hari module entitlements)
  const trialRes = await grantTrialIfEligible(defaultWs.id, newAccount.email);
  if (trialRes && trialRes.granted) {
    const endsAt = trialRes.expiresAt ? new Date(trialRes.expiresAt).toISOString() : new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    for (const mod of ['ads_report', 'ads_spy']) {
      await db.upsert('module_entitlements', { workspace_id: defaultWs.id, module: mod }, {
        active: true,
        source: 'trial',
        starts_at: new Date().toISOString(),
        ends_at: endsAt
      });
    }
  }

  // Entitlement seo dengan source free selalu aktif
  await db.upsert('module_entitlements', { workspace_id: defaultWs.id, module: 'seo' }, {
    active: true,
    source: 'free',
    starts_at: new Date().toISOString(),
    ends_at: null
  });

  const session = await issueSession(res, newAccount, req);
  await logAuditEvent({
    userId: newAccount.id,
    action: 'register_google',
    target: newAccount.email,
    req,
    meta: { sub, provider: 'google', workspaceId: defaultWs.id }
  });

  // Langkah 1.3: Jangan spread session
  return {
    status: 'success',
    action: 'register',
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: publicUser(newAccount)
  };
}
