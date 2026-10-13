import { randomBytes, createHash } from 'crypto';

/**
 * Membuat token acak 32-byte berkode base64url (43 karakter, URL-safe)
 */
export function newToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Menghasilkan hash SHA-256 dari string token untuk penyimpanan aman di database
 */
export function hashToken(token) {
  if (!token) return '';
  return createHash('sha256').update(String(token)).digest('hex');
}
