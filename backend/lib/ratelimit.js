import { db } from '../db.js';

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Memeriksa apakah key telah melampaui ambang batas rate limit di database
 * @returns {Promise<boolean>} true jika diizinkan, false jika melebihi batas
 */
export async function checkRateLimit(key, windowSec, max) {
  try {
    const allowed = await db.rpc('hit_rate_limit', {
      p_key: key,
      p_window_seconds: windowSec,
      p_max: max
    });
    return allowed !== false;
  } catch (err) {
    console.error(`[RATELIMIT-ERR] Gagal mengecek rate limit untuk ${key}:`, err.message);
    // Fail-open jika terjadi kendala DB agar tidak memblokir user secara salah
    return true;
  }
}

/**
 * Enforce rate limit langsung pada request handler.
 * Mengembalikan true jika rate limit terlampaui dan response 429 telah dikirimkan ke klien.
 */
export async function enforceRateLimit(res, key, windowSec, max, customMessage = null) {
  const allowed = await checkRateLimit(key, windowSec, max);
  if (!allowed) {
    res.status(429).json({
      error: customMessage || 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.',
      code: 'RATE_LIMITED'
    });
    return true;
  }
  return false;
}
