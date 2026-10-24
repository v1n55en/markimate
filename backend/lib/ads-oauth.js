// backend/lib/ads-oauth.js
// Logika OAuth Meta Ads, enkripsi token, sinkronisasi akun iklan, dan pemutusan koneksi (PRD F5)

import crypto from 'crypto';
import { db } from '../db.js';
import { encrypt, decrypt } from './crypto.js';
import { getAppUrl } from './config.js';

const DEFAULT_GRAPH_VERSION = 'v21.0';

export function getMetaGraphVersion() {
  return process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

export function isMetaOAuthConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_LOGIN_CONFIG_ID);
}

// Tanpa fallback: ID config Facebook Login for Business wajib dari env META_LOGIN_CONFIG_ID.
export function getMetaLoginConfigId() {
  return process.env.META_LOGIN_CONFIG_ID || '';
}

export function getMetaRedirectUri() {
  const base = (process.env.APP_URL || getAppUrl()).replace(/\/+$/, '');
  return `${base}/app/ads/connect/meta/callback`;
}

function getHmacSecret() {
  return process.env.JWT_SECRET || process.env.CMS_CRED_KEY || 'meta-oauth-state-secret-fallback';
}

/**
 * Generate anti-CSRF state token yang ditandatangani HMAC (berlaku 10 menit).
 */
export function generateMetaOAuthState({ workspaceId, userId }) {
  if (!workspaceId || !userId) {
    throw new Error('workspaceId and userId are required to generate OAuth state');
  }
  const payload = {
    workspaceId,
    userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getHmacSecret()).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

/**
 * Verifikasi anti-CSRF state token.
 */
export function verifyMetaOAuthState(stateStr) {
  if (!stateStr || typeof stateStr !== 'string') {
    return { valid: false, error: 'State string is required' };
  }
  const parts = stateStr.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid state format' };
  }
  const [dataB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getHmacSecret()).update(dataB64).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'State signature mismatch' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Failed to parse state payload' };
  }

  const ageMs = Date.now() - payload.ts;
  if (ageMs > 10 * 60 * 1000) {
    return { valid: false, error: 'State expired (exceeded 10 minutes limit)' };
  }

  return {
    valid: true,
    workspaceId: payload.workspaceId,
    userId: payload.userId
  };
}

/**
 * Buat URL Dialog OAuth Facebook (Facebook Login for Business dengan config_id, tanpa scope).
 */
export function getMetaOAuthUrl(state) {
  if (!isMetaOAuthConfigured()) {
    return null;
  }
  const version = getMetaGraphVersion();
  const appId = process.env.META_APP_ID;
  const configId = getMetaLoginConfigId();
  const redirectUri = getMetaRedirectUri();

  const params = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state
  });

  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

/**
 * Tukar kode otorisasi Facebook ke token jangka panjang (±60 hari).
 */
export function exchangeMetaCode(code, redirectUri) {
  const version = getMetaGraphVersion();
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const finalRedirectUri = redirectUri || getMetaRedirectUri();

  return async function doExchange() {
    // 1. Tukar code -> short-lived access token
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', finalRedirectUri);
    tokenUrl.searchParams.set('code', code);

    const res1 = await fetch(tokenUrl.toString());
    const data1 = await res1.json();
    if (!res1.ok || !data1.access_token) {
      throw new Error(data1.error?.message || `Failed to exchange code: HTTP ${res1.status}`);
    }

    const shortLivedToken = data1.access_token;

    // 2. Tukar short-lived token -> long-lived token (±60 hari)
    const exchangeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
    exchangeUrl.searchParams.set('client_id', appId);
    exchangeUrl.searchParams.set('client_secret', appSecret);
    exchangeUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const res2 = await fetch(exchangeUrl.toString());
    const data2 = await res2.json();
    if (!res2.ok || !data2.access_token) {
      // Fallback jika fb_exchange_token gagal tapi short-lived token ada
      return {
        accessToken: shortLivedToken,
        expiresIn: data1.expires_in || 5184000 // default 60 hari
      };
    }

    return {
      accessToken: data2.access_token,
      expiresIn: data2.expires_in || 5184000
    };
  };
}

/**
 * Ambil profil pengguna Meta (/me) via Authorization Bearer header
 */
export async function fetchMetaProfile(accessToken) {
  const version = getMetaGraphVersion();
  const url = `https://graph.facebook.com/${version}/me?fields=id,name`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Meta profile');
  }
  return data;
}

/**
 * Ambil daftar akun iklan Meta (/me/adaccounts) via Authorization Bearer header
 */
export async function fetchMetaAdAccounts(accessToken) {
  const version = getMetaGraphVersion();
  const url = `https://graph.facebook.com/${version}/me/adaccounts?fields=id,name,currency,timezone_name,account_status&limit=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Meta ad accounts');
  }
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Simpan / perbarui koneksi Meta dan akun-akun iklannya di database.
 */
export async function saveMetaConnection({
  workspaceId,
  userId,
  externalUserId,
  displayName,
  accessToken,
  expiresInSeconds,
  scopes = ['ads_read', 'business_management'],
  adAccounts = []
}) {
  const { enc: token_enc, iv: token_iv } = encrypt(accessToken);
  const tokenExpiresAt = new Date(Date.now() + (Number(expiresInSeconds) || 5184000) * 1000).toISOString();

  // Cari koneksi yang sudah ada untuk workspace + platform + external_user_id
  const existingConn = await db.findOne('ad_connections', {
    workspace_id: workspaceId,
    platform: 'meta',
    external_user_id: externalUserId
  });

  let connectionId;

  if (existingConn) {
    connectionId = existingConn.id;
    await db.update('ad_connections', { id: connectionId }, {
      display_name: displayName || existingConn.display_name,
      token_enc,
      token_iv,
      token_expires_at: tokenExpiresAt,
      scopes,
      status: 'active',
      revoked_at: null,
      updated_at: new Date().toISOString()
    });
  } else {
    connectionId = crypto.randomUUID();
    await db.insert('ad_connections', {
      id: connectionId,
      workspace_id: workspaceId,
      platform: 'meta',
      external_user_id: externalUserId,
      display_name: displayName || 'Meta Ads User',
      token_enc,
      token_iv,
      token_expires_at: tokenExpiresAt,
      scopes,
      status: 'active',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // Simpan / upsert ad_accounts
  const savedAccounts = [];
  for (let idx = 0; idx < adAccounts.length; idx++) {
    const acc = adAccounts[idx];
    const externalId = String(acc.id);
    const existingAcc = await db.findOne('ad_accounts', {
      workspace_id: workspaceId,
      platform: 'meta',
      external_id: externalId
    });

    if (existingAcc) {
      await db.update('ad_accounts', { id: existingAcc.id }, {
        connection_id: connectionId,
        name: acc.name || existingAcc.name,
        currency: acc.currency || existingAcc.currency || 'IDR',
        timezone: acc.timezone_name || existingAcc.timezone || 'Asia/Jakarta',
        updated_at: new Date().toISOString()
      });
      savedAccounts.push({ ...existingAcc, connection_id: connectionId });
    } else {
      const newAccId = crypto.randomUUID();
      const newAcc = {
        id: newAccId,
        workspace_id: workspaceId,
        connection_id: connectionId,
        platform: 'meta',
        external_id: externalId,
        name: acc.name || `Account ${externalId}`,
        currency: acc.currency || 'IDR',
        timezone: acc.timezone_name || 'Asia/Jakarta',
        is_manager: false,
        selected: idx === 0, // Akun pertama otomatis terpilih
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await db.insert('ad_accounts', newAcc);
      savedAccounts.push(newAcc);
    }
  }

  return {
    connectionId,
    adAccounts: savedAccounts
  };
}

/**
 * Putuskan koneksi Meta Ads (memanggil revoke permission Facebook + menghapus token).
 */
export async function disconnectAdConnection(connectionId, workspaceId, { fetchFn = fetch } = {}) {
  const conn = await db.findOne('ad_connections', {
    id: connectionId,
    workspace_id: workspaceId
  });

  if (!conn) {
    return { ok: false, code: 'ADS_CONNECTION_NOT_FOUND' };
  }

  // Jika masih ada token aktif, lakukan panggilan revoke ke Graph API Meta
  if (conn.token_enc && conn.token_iv && conn.platform === 'meta') {
    try {
      const token = decrypt(conn.token_enc, conn.token_iv);
      if (token && conn.external_user_id) {
        const version = getMetaGraphVersion();
        const revokeUrl = `https://graph.facebook.com/${version}/${conn.external_user_id}/permissions`;
        await fetchFn(revokeUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      // Abaikan error revoke eksternal jika token memang sudah kedaluwarsa atau dicabut pengguna
      console.warn('[AdsOAuth] Error revoking Meta permission:', err.message);
    }
  }

  // Kosongkan token dan tandai revoked
  await db.update('ad_connections', { id: connectionId }, {
    token_enc: null,
    token_iv: null,
    refresh_enc: null,
    refresh_iv: null,
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  return { ok: true };
}

/**
 * Ambil daftar koneksi untuk suatu workspace (tanpa membuka rahasia token).
 */
export async function listAdConnections(workspaceId) {
  const allConns = await db.findMany('ad_connections', { workspace_id: workspaceId });
  const allAccounts = await db.findMany('ad_accounts', { workspace_id: workspaceId });

  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const connections = allConns.map((conn) => {
    let expiresSoon = false;
    if (conn.token_expires_at && conn.status === 'active') {
      const expiresAtMs = Date.parse(conn.token_expires_at);
      if (!isNaN(expiresAtMs) && expiresAtMs - now < TEN_DAYS_MS && expiresAtMs > now) {
        expiresSoon = true;
      }
    }

    const accountsCount = allAccounts.filter((a) => a.connection_id === conn.id).length;

    // Bersihkan field rahasia sebelum dikirim ke frontend
    const { token_enc, token_iv, refresh_enc, refresh_iv, ...safeConn } = conn;

    return {
      ...safeConn,
      expiresSoon,
      accountsCount
    };
  });

  return {
    connections,
    platforms: {
      meta: {
        configured: isMetaOAuthConfigured(),
        status: isMetaOAuthConfigured() ? 'available' : 'unconfigured'
      },
      google: {
        configured: false,
        status: 'coming_soon'
      }
    }
  };
}

/**
 * Ambil dekripsi access token aktif untuk job n8n (hanya di backend / job executor).
 */
export async function getDecryptedAccessToken(connectionId, workspaceId) {
  const conn = await db.findOne('ad_connections', {
    id: connectionId,
    workspace_id: workspaceId
  });

  if (!conn || conn.status !== 'active') {
    return null;
  }

  if (conn.token_expires_at && Date.parse(conn.token_expires_at) < Date.now()) {
    return null;
  }

  if (!conn.token_enc || !conn.token_iv) {
    return null;
  }

  return decrypt(conn.token_enc, conn.token_iv);
}
