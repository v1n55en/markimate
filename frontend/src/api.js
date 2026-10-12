// Klien API Markimate (backend Express). Token sesi disimpan di localStorage.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
const TOKEN_KEY = 'supermat_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ } };

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_BASE_URL + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Tidak bisa menghubungi server Markimate. Pastikan backend berjalan.', 0, null);
  }
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/')) { setToken(''); window.dispatchEvent(new Event('supermat:logout')); }
    throw new ApiError((data && (data.error || data.message)) || `HTTP ${res.status}`, res.status, data);
  }
  return data;
}

export const GEO_OPTIONS = [
  { value: 'ID', label: 'ID (Indonesia)' }, { value: 'US', label: 'US (United States)' }, { value: 'MY', label: 'MY (Malaysia)' },
  { value: 'SG', label: 'SG (Singapore)' }, { value: 'GB', label: 'GB (United Kingdom)' }, { value: 'AU', label: 'AU (Australia)' },
];
export const LN_OPTIONS = [
  { value: 'id', label: 'id (Bahasa Indonesia)' }, { value: 'en', label: 'en (English)' }, { value: 'ms', label: 'ms (Bahasa Melayu)' },
];
export const CMS_LABEL = { wordpress: 'WordPress', wix: 'Wix', sanity: 'Sanity', shopify: 'Shopify' };
export const formatIDR = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
