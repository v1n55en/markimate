import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { newToken, hashToken } from './tokens.js';
import { getClientIp } from './ratelimit.js';

/**
 * Ekstraksi cookie dari header HTTP request
 */
export function parseCookies(req) {
  const list = {};
  const header = req.headers?.cookie;
  if (!header) return list;

  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

export function getRefreshTokenFromReq(req) {
  const cookies = parseCookies(req);
  return cookies['mk_rt'] || req.headers?.['x-refresh-token'] || req.body?.refreshToken || null;
}

export function setRefreshTokenCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
  const maxAge = days * 86400 * 1000;

  if (typeof res.cookie === 'function') {
    res.cookie('mk_rt', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge
    });
  } else {
    res.setHeader('Set-Cookie', `mk_rt=${encodeURIComponent(token)}; Path=/api/auth; Max-Age=${maxAge / 1000}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`);
  }
}

export function clearRefreshTokenCookie(res) {
  if (typeof res.clearCookie === 'function') {
    res.clearCookie('mk_rt', {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax'
    });
  } else {
    res.setHeader('Set-Cookie', 'mk_rt=; Path=/api/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  }
}

export function signAccessToken(user) {
  const ttlMin = Number(process.env.ACCESS_TOKEN_TTL_MIN) || 15;
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('[FATAL] In production environment, JWT_SECRET is required and must be at least 32 characters.');
    }
  }
  const jwtSecret = process.env.JWT_SECRET || 'ganti-di-env-JWT_SECRET';
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      typ: 'access'
    },
    jwtSecret,
    { expiresIn: `${ttlMin}m` }
  );
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    brandName: row.brand_name || row.name || '',
    locale: row.locale || 'id',
    isPlatformAdmin: Boolean(row.is_platform_admin)
  };
}

/**
 * Menerbitkan sesi baru (refresh token di cookie + access token di memori)
 */
export async function issueSession(res, user, req, existingFamilyId = null) {
  const plainRefreshToken = newToken();
  const tokenHash = hashToken(plainRefreshToken);
  const familyId = existingFamilyId || randomUUID();
  const userAgent = req.headers?.['user-agent'] || '';
  const ip = getClientIp(req);
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();

  const sessionRecord = await db.insert('refresh_tokens', {
    user_id: user.id,
    token_hash: tokenHash,
    family_id: familyId,
    user_agent: userAgent,
    ip: ip,
    expires_at: expiresAt,
    last_used_at: new Date().toISOString()
  });

  setRefreshTokenCookie(res, plainRefreshToken);
  const accessToken = signAccessToken(user);
  const ttlSec = (Number(process.env.ACCESS_TOKEN_TTL_MIN) || 15) * 60;

  return {
    accessToken,
    expiresIn: ttlSec,
    sessionId: sessionRecord.id,
    user: publicUser(user)
  };
}

