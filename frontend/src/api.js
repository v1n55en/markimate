import { storage } from './lib/storage.js';
import { t } from './i18n/index.js';

// Klien API Markimate.
// Di produksi, VITE_API_BASE_URL dikosongkan agar memanggil path relatif /api/...
// yang di-rewrite secara first-party oleh Vercel ke backend markimate-api.
export const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof import.meta !== 'undefined' && import.meta.env?.DEV ? 'http://localhost:5001' : '');

// Sesi JWT access token disimpan di memori (bukan localStorage) untuk pencegahan XSS (PRD F1 + F2)
let inMemoryAccessToken = '';

export const getToken = () => inMemoryAccessToken;
export const setToken = (tVal) => {
  inMemoryAccessToken = tVal || '';
  // Pastikan token legacy di localStorage dibersihkan jika ada
  if (!tVal) {
    try { storage.removeItem('token'); } catch {}
  }
};

export class ApiError extends Error {
  constructor(messageOrData, status = 500, extraData = null) {
    const data = (messageOrData && typeof messageOrData === 'object' && !(messageOrData instanceof Error))
      ? messageOrData
      : extraData;

    const code = data?.code;

    // Menghasilkan message dari errors.<codeKey>, fallback errors.UNKNOWN ditambah kode kecil.
    // Jangan pernah memakai data.error (Keputusan PRD F3 Langkah 2).
    let msg;
    if (code) {
      const translated = t(`errors.${code}`);
      if (translated && translated !== `errors.${code}`) {
        msg = translated;
      } else {
        const unknownText = t('errors.UNKNOWN');
        msg = `${unknownText} (${code})`;
      }
    } else if (status === 0) {
      msg = t('errors.SERVICE_UNAVAILABLE');
    } else if (status === 403) {
      msg = t('errors.FORBIDDEN');
    } else if (status === 404) {
      msg = t('errors.NOT_FOUND');
    } else if (status === 400) {
      msg = t('errors.BAD_REQUEST');
    } else if (status === 401) {
      msg = t('errors.UNAUTHORIZED');
    } else if (status === 429) {
      msg = t('errors.RATE_LIMITED');
    } else if (status === 500) {
      msg = t('errors.INTERNAL_ERROR');
    } else {
      const unknownText = t('errors.UNKNOWN');
      msg = status ? `${unknownText} (HTTP ${status})` : unknownText;
    }

    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code;
    this.email = data?.email;
  }
}

// Queue untuk menangani request paralel saat token sedang di-refresh
let isRefreshing = false;
let refreshQueue = [];

function processRefreshQueue(err, newToken = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve(newToken);
  });
  refreshQueue = [];
}

export async function refreshSession() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.accessToken) {
      throw new ApiError(data || { code: 'SESSION_EXPIRED' }, res.status);
    }

    setToken(data.accessToken);
    return data;
  } catch (err) {
    setToken('');
    window.dispatchEvent(new Event('markimate:logout'));
    window.dispatchEvent(new Event('supermat:logout'));
    throw err;
  }
}

export const getActiveWorkspaceId = () => {
  try {
    const id = storage.getItem('workspace') || '';
    // Abaikan ID mock/legacy (mis. "ws-3our-official"); backend hanya menerima UUID
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : '';
  } catch {
    return '';
  }
};

export const setActiveWorkspaceId = (id) => {
  try {
    if (id) storage.setItem('workspace', id);
    else storage.removeItem('workspace');
  } catch {}
};

export async function api(path, { method = 'GET', body, headers = {}, retryOn401 = true } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const wsId = headers['X-Workspace-Id'] || getActiveWorkspaceId();
  if (wsId && !h['X-Workspace-Id']) h['X-Workspace-Id'] = wsId;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
  } catch {
    throw new ApiError({ code: 'SERVICE_UNAVAILABLE' }, 0);
  }

  // Tangani 401 dengan auto refresh diam-diam jika bukan endpoint auth
  if (res.status === 401 && retryOn401 && !path.startsWith('/api/auth/')) {
    if (isRefreshing) {
      // Tunggu proses refresh yang sedang berjalan
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: () => api(path, { method, body, headers, retryOn401: false }).then(resolve).catch(reject),
          reject
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshed = await refreshSession();
      processRefreshQueue(null, refreshed.accessToken);
      return await api(path, { method, body, headers, retryOn401: false });
    } catch (refreshErr) {
      processRefreshQueue(refreshErr, null);
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      setToken('');
      window.dispatchEvent(new Event('markimate:logout'));
      window.dispatchEvent(new Event('supermat:logout'));
    }
    if (res.status === 402 && data && (data.code === 'INSUFFICIENT_CREDITS' || data.code === 'DAILY_CAP')) {
      window.dispatchEvent(new CustomEvent('markimate:insufficient_credits', { detail: data }));
      window.dispatchEvent(new CustomEvent('supermat:insufficient_credits', { detail: data }));
    }
    throw new ApiError(data, res.status);
  }

  return data;
}

export const getCredits = () => api('/api/credits');
export const estimateCredits = (action, qty = 1, images = 0) =>
  api(`/api/credits/estimate?action=${encodeURIComponent(action)}&qty=${qty}&images=${images}`);
export const getCreditLedger = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return api(`/api/credits/ledger${q ? `?${q}` : ''}`);
};

export const GEO_OPTIONS = [
  { value: 'ID', label: 'ID (Indonesia)' },
  { value: 'US', label: 'US (United States)' },
  { value: 'MY', label: 'MY (Malaysia)' },
  { value: 'SG', label: 'SG (Singapore)' },
  { value: 'GB', label: 'GB (United Kingdom)' },
  { value: 'AU', label: 'AU (Australia)' }
];
export const LN_OPTIONS = [
  { value: 'id', label: 'id (Bahasa Indonesia)' },
  { value: 'en', label: 'en (English)' },
  { value: 'ms', label: 'ms (Bahasa Melayu)' }
];
export const CMS_LABEL = { wordpress: 'WordPress', wix: 'Wix', sanity: 'Sanity', shopify: 'Shopify' };
export const formatIDR = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
