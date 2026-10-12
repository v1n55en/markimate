// Helper enkripsi kredensial CMS: AES-256-GCM dengan authTag di akhir ciphertext.
import crypto from 'crypto';

function getKey() {
  const envKey = process.env.CMS_CRED_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, 'base64');
    if (buf.length === 32) return buf;
    // Fallback bila key diset string biasa bukan base64 32-byte
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Fallback dev lokal jika CMS_CRED_KEY belum diset
  const fallback = process.env.JWT_SECRET || 'markimate-dev-key-fallback-32b!';
  return crypto.createHash('sha256').update(fallback).digest();
}

/**
 * Enkripsi object JSON ke AES-256-GCM.
 * authTag (16 byte) ditempel di akhir ciphertext.
 * @param {object|any} obj
 * @returns {{ enc: string, iv: string }} enc & iv dalam format base64
 */
export function encrypt(obj) {
  if (obj === undefined || obj === null) return { enc: null, iv: null };
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const cipherWithTag = Buffer.concat([enc, authTag]);
  return {
    enc: cipherWithTag.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Dekripsi string base64 AES-256-GCM kembali ke object.
 * @param {string} enc base64 ciphertext + authTag (16 byte terakhir)
 * @param {string} iv base64 IV
 * @returns {object|any}
 */
export function decrypt(enc, iv) {
  if (!enc || !iv) return null;
  const key = getKey();
  const ivBuf = Buffer.from(iv, 'base64');
  const buf = Buffer.from(enc, 'base64');
  if (buf.length < 16) throw new Error('Ciphertext terlalu pendek untuk authTag AES-GCM');
  const authTag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const text = decrypted.toString('utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}
