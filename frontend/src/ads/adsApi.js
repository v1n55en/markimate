import { api } from '../api';
import {
  PLATFORMS_META,
  REPORT_DETAILS,
  getInitialMockDataForWorkspace,
} from './mockData';
import { storage } from '../lib/storage';

// Mode Mock default false kecuali VITE_ADS_MOCK disetel ke 'true' (PRD Hapus Mode Demo)
export const isAdsMock = () => {
  const envVal = import.meta.env.VITE_ADS_MOCK;
  return envVal === 'true';
};

// Ambil ID workspace aktif saat ini
export function getActiveWsId() {
  try {
    return storage.getItem('workspace') || 'ws-3our-official';
  } catch {
    return 'ws-3our-official';
  }
}

// Key storage untuk persistensi sesi mock demo
const STORAGE_KEYS = {
  CONNECTIONS: 'ads_mock_connections_v2',
  REPORTS: 'ads_mock_reports_v2',
  SUMMARY: 'ads_mock_summary_v2',
  DETAILS: 'ads_mock_details_v2',
};

function getWsStorageKey(baseKey, wsId = getActiveWsId()) {
  return `${baseKey}_${wsId}`;
}

// Helper state storage mock
function getStoredJson(key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStoredJson(key, val) {
  try {
    storage.setItem(key, JSON.stringify(val));
  } catch {
    // abaikan jika kuota storage penuh
  }
}

export function resetMockData(targetWsId) {
  const wsId = targetWsId || getActiveWsId();
  const init = getInitialMockDataForWorkspace(wsId);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.CONNECTIONS, wsId), init.connections);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.REPORTS, wsId), init.reports);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.SUMMARY, wsId), init.summary);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.DETAILS, wsId), init.details);
}

function getMockConnections(wsId = getActiveWsId()) {
  const init = getInitialMockDataForWorkspace(wsId);
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.CONNECTIONS, wsId), init.connections);
}

function getMockReports(wsId = getActiveWsId()) {
  const init = getInitialMockDataForWorkspace(wsId);
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.REPORTS, wsId), init.reports);
}

function getMockSummary(wsId = getActiveWsId()) {
  const init = getInitialMockDataForWorkspace(wsId);
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.SUMMARY, wsId), init.summary);
}

function getMockDetails(wsId = getActiveWsId()) {
  const init = getInitialMockDataForWorkspace(wsId);
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.DETAILS, wsId), init.details);
}

// 1. Ringkasan Ads Report
export async function getAdsSummary() {
  if (isAdsMock()) {
    // Simulasi delay jaringan kecil untuk realisme UX
    await new Promise((r) => setTimeout(r, 120));
    const summary = getMockSummary();
    const connections = getMockConnections();

    // Sesuaikan status platform di ringkasan sesuai koneksi aktif
    const updatedPlatforms = summary.platforms.map((p) => {
      const conn = connections.find((c) => c.platform === p.platform);
      return {
        ...p,
        isConnected: conn?.status === 'connected',
      };
    });

    return {
      ...summary,
      platforms: updatedPlatforms,
    };
  }
  return api('/api/ads/summary');
}

// 2. Daftar Koneksi Platform
export async function listConnections() {
  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 100));
    return { connections: getMockConnections() };
  }
  return api('/api/ads/connections');
}

// 3. Mulai Alur Hubungkan Platform (OAuth Start)
export async function startConnect(platform = 'meta') {
  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 80));
    // Simulasi: redirect langsung ke halaman callback mock Markimate dengan kode demo
    return {
      authUrl: `/app/ads/connect/${platform}/callback?code=demo_token_${platform}_${Date.now()}&state=markimate_demo_state`,
    };
  }
  if (platform !== 'meta') {
    throw new Error('Platform not supported yet');
  }
  const data = await getMetaOAuthUrl();
  return { authUrl: data.url, state: data.state };
}

// 4. Selesaikan Koneksi Platform (OAuth Exchange)
export async function exchangeMetaOAuth({ code, state }) {
  return api('/api/ads/oauth/meta/exchange', {
    method: 'POST',
    body: { code, state },
  });
}

export async function finishConnect(platform, query = {}) {
  if (query.error) {
    throw new Error(query.error_description || query.error || 'Otorisasi ditolak oleh pengguna pada platform.');
  }

  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 450));

    const connections = getMockConnections();
    const meta = PLATFORMS_META[platform] || {
      name: `${platform.toUpperCase()} Ads`,
      placeholderId: `${platform}_id_123`,
    };

    let updatedConn;
    const existingIndex = connections.findIndex((c) => c.platform === platform);

    if (existingIndex >= 0) {
      updatedConn = {
        ...connections[existingIndex],
        status: 'connected',
        connectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      };
      connections[existingIndex] = updatedConn;
    } else {
      updatedConn = {
        id: `conn-${platform}-${Date.now()}`,
        platform,
        externalId: meta.placeholderId,
        name: `3Our Official Store - ${meta.name}`,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      };
      connections.push(updatedConn);
    }

    setStoredJson(getWsStorageKey(STORAGE_KEYS.CONNECTIONS), connections);
    return { ok: true, connection: updatedConn };
  }

  if (platform === 'meta') {
    return exchangeMetaOAuth({ code: query.code, state: query.state });
  }

  throw new Error('Platform not supported yet');
}

// 5. Putuskan Koneksi Platform
export async function disconnect(id) {
  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 200));
    const connections = getMockConnections();
    const updated = connections.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          status: 'disconnected',
          connectedAt: null,
          expiresAt: null,
        };
      }
      return c;
    });
    setStoredJson(getWsStorageKey(STORAGE_KEYS.CONNECTIONS), updated);
    return { ok: true };
  }
  return api(`/api/ads/connections/${id}`, { method: 'DELETE' });
}

// 6. Daftar Laporan
export async function listReports(filters = {}) {
  const { platform, year, clientId } = filters;
  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 120));
    let reports = getMockReports();

    if (platform && platform !== 'all') {
      reports = reports.filter((r) => r.platforms?.includes(platform));
    }
    if (year && year !== 'all') {
      reports = reports.filter((r) => r.period?.startsWith(String(year)));
    }
    if (clientId && clientId !== 'all') {
      reports = reports.filter((r) => r.clientName?.toLowerCase().includes(clientId.toLowerCase()));
    }

    return { reports };
  }

  const searchParams = new URLSearchParams();
  if (platform && platform !== 'all') searchParams.append('platform', platform);
  if (year && year !== 'all') searchParams.append('year', year);
  if (clientId && clientId !== 'all') searchParams.append('clientId', clientId);

  const qs = searchParams.toString();
  return api(`/api/ads/reports${qs ? `?${qs}` : ''}`);
}

// 7. Detail Laporan Lengkap
export async function getReport(id) {
  if (isAdsMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const details = getMockDetails();
    const found = details[id];

    if (!found) {
      // Jika id tidak ditemukan di dictionary detail, buat fallback dari list reports
      const reports = getMockReports();
      const meta = reports.find((r) => r.id === id);
      if (!meta) {
        throw new Error('Ad report not found.');
      }
      return {
        ...REPORT_DETAILS['rep-shopee-gmvmax-2026-09'],
        id: meta.id,
        title: `Laporan ${meta.periodLabel}`,
        clientName: meta.clientName,
        period: meta.period,
        periodLabel: meta.periodLabel,
        platforms: meta.platforms,
        status: meta.status,
      };
    }

    // Ambil status terbaru dari daftar reports
    const reports = getMockReports();
    const curr = reports.find((r) => r.id === id);
    if (curr) {
      found.status = curr.status;
    }

    return found;
  }
  return api(`/api/ads/reports/${id}`);
}

// 9. Meta Ads OAuth & Ad Accounts (PRD F5 Langkah 3)
export async function getMetaOAuthUrl() {
  return api('/api/ads/oauth/meta/url');
}

export async function getAdAccounts() {
  return api('/api/ads/accounts');
}

export async function toggleSelectAccount(id, selected) {
  return api(`/api/ads/accounts/${id}/select`, {
    method: 'PATCH',
    body: { selected }
  });
}

// 10. Template Laporan (PRD F5 Langkah 4)
export async function getTemplates() {
  return api('/api/ads/templates');
}

export async function getTemplate(id) {
  return api(`/api/ads/templates/${id}`);
}

export async function saveTemplate(data, id = null) {
  if (id) {
    return api(`/api/ads/templates/${id}`, {
      method: 'PUT',
      body: data
    });
  }
  return api('/api/ads/templates', {
    method: 'POST',
    body: data
  });
}

export async function removeTemplate(id) {
  return api(`/api/ads/templates/${id}`, { method: 'DELETE' });
}

// 11. Metrics Custom & Formula Tester (PRD F5 Langkah 4 / F5b)
export async function getCustomMetrics() {
  return api('/api/ads/metrics');
}

export async function saveCustomMetric(data) {
  return api('/api/ads/metrics', {
    method: 'POST',
    body: data
  });
}

export async function testFormula(formula) {
  return api('/api/ads/metrics/test', {
    method: 'POST',
    body: { formula }
  });
}

export async function removeCustomMetric(id) {
  return api(`/api/ads/metrics/${id}`, { method: 'DELETE' });
}

// 12. Profil Laporan & Jadwal (PRD F5 Langkah 4 & 6)
export async function getProfiles() {
  return api('/api/ads/profiles');
}

export async function saveProfile(data, id = null) {
  if (id) {
    return api(`/api/ads/profiles/${id}`, {
      method: 'PUT',
      body: data
    });
  }
  return api('/api/ads/profiles', {
    method: 'POST',
    body: data
  });
}

export async function removeProfile(id) {
  return api(`/api/ads/profiles/${id}`, { method: 'DELETE' });
}

// 13. Trigger Generate Laporan & Status Polling (PRD F5 Langkah 5)
export async function generateAdsReport(payload) {
  return api('/api/ads/reports/generate', {
    method: 'POST',
    body: payload
  });
}

export async function getAdsReportStatus(id) {
  return api(`/api/ads/reports/${id}`);
}

