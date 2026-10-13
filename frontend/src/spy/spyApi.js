// Klien API Modul Ads Creative Spy Markimate (PRD Bagian 7.4)
import { api } from '../api';
import {
  INITIAL_COMPETITORS,
  INITIAL_CREATIVES,
  INITIAL_SPY_INSIGHTS,
} from './mockData';
import { storage } from '../lib/storage';

export const isSpyMock = () => {
  const envVal = import.meta.env.VITE_SPY_MOCK;
  if (envVal === 'false') return false;
  return true; // Default aktif untuk preview reviewer & mode demo
};

export function getActiveWsId() {
  try {
    return storage.getItem('workspace') || 'ws-3our-official';
  } catch {
    return 'ws-3our-official';
  }
}

const STORAGE_KEYS = {
  COMPETITORS: 'spy_competitors_v1',
  CREATIVES: 'spy_creatives_v1',
  INSIGHTS: 'spy_insights_v1',
};

function getWsStorageKey(baseKey, wsId = getActiveWsId()) {
  return `${baseKey}_${wsId}`;
}

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

function getMockCompetitors(wsId = getActiveWsId()) {
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.COMPETITORS, wsId), INITIAL_COMPETITORS);
}

function getMockCreatives(wsId = getActiveWsId()) {
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.CREATIVES, wsId), INITIAL_CREATIVES);
}

function getMockInsights(wsId = getActiveWsId()) {
  return getStoredJson(getWsStorageKey(STORAGE_KEYS.INSIGHTS, wsId), INITIAL_SPY_INSIGHTS);
}

export function resetSpyMockData(targetWsId) {
  const wsId = targetWsId || getActiveWsId();
  setStoredJson(getWsStorageKey(STORAGE_KEYS.COMPETITORS, wsId), INITIAL_COMPETITORS);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.CREATIVES, wsId), INITIAL_CREATIVES);
  setStoredJson(getWsStorageKey(STORAGE_KEYS.INSIGHTS, wsId), INITIAL_SPY_INSIGHTS);
}

// 1. listCompetitors() -> GET /api/spy/competitors
export async function listCompetitors() {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 100));
    return { competitors: getMockCompetitors() };
  }
  return api('/api/spy/competitors');
}

// 2. addCompetitor(data) -> POST /api/spy/competitors
export async function addCompetitor(data) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 300));
    const competitors = getMockCompetitors();
    const newComp = {
      id: `comp-${Date.now()}`,
      name: data.name?.trim() || 'Brand Kompetitor',
      handle: data.handle?.trim() || `@${data.name?.toLowerCase().replace(/\s+/g, '')}`,
      platform: data.platform || 'meta',
      platformLabel: data.platform === 'tiktok' ? 'TikTok Creative Center' : 'Meta Ad Library',
      pageUrl: data.pageUrl || `https://facebook.com/${encodeURIComponent(data.name || '')}`,
      country: data.country || 'ID',
      schedule: data.schedule || 'weekly',
      activeAdsCount: Math.floor(Math.random() * 8) + 5,
      newAdsThisWeek: Math.floor(Math.random() * 4) + 1,
      winningAdsCount: Math.floor(Math.random() * 3) + 1,
      lastScannedAt: new Date().toISOString(),
      status: 'active',
    };
    competitors.unshift(newComp);
    setStoredJson(getWsStorageKey(STORAGE_KEYS.COMPETITORS), competitors);
    return { ok: true, competitor: newComp };
  }
  return api('/api/spy/competitors', { method: 'POST', body: data });
}

// 3. removeCompetitor(id) -> DELETE /api/spy/competitors/:id
export async function removeCompetitor(id) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const competitors = getMockCompetitors();
    const updated = competitors.filter((c) => c.id !== id);
    setStoredJson(getWsStorageKey(STORAGE_KEYS.COMPETITORS), updated);
    return { ok: true };
  }
  return api(`/api/spy/competitors/${id}`, { method: 'DELETE' });
}

// 4. scanNow(id) -> POST /api/spy/competitors/:id/scan
export async function scanNow(id) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 600));
    const competitors = getMockCompetitors();
    const updated = competitors.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          lastScannedAt: new Date().toISOString(),
          newAdsThisWeek: c.newAdsThisWeek + 1,
        };
      }
      return c;
    });
    setStoredJson(getWsStorageKey(STORAGE_KEYS.COMPETITORS), updated);
    return { ok: true, message: 'Pemindaian iklan Meta Ad Library selesai!' };
  }
  return api(`/api/spy/competitors/${id}/scan`, { method: 'POST' });
}

// 5. listCreatives(filters) -> GET /api/spy/creatives
export async function listCreatives(filters = {}) {
  const { competitorId, format, q, isWinning, isNew, onlySwipe } = filters;
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 120));
    let creatives = getMockCreatives();

    if (competitorId && competitorId !== 'all') {
      creatives = creatives.filter((c) => c.competitorId === competitorId);
    }
    if (format && format !== 'all') {
      creatives = creatives.filter((c) => c.format === format);
    }
    if (isWinning) {
      creatives = creatives.filter((c) => c.isWinning);
    }
    if (isNew) {
      creatives = creatives.filter((c) => c.isNew);
    }
    if (onlySwipe) {
      creatives = creatives.filter((c) => c.isSavedToSwipe);
    }
    if (q && q.trim()) {
      const query = q.toLowerCase();
      creatives = creatives.filter(
        (c) =>
          c.headline?.toLowerCase().includes(query) ||
          c.bodyText?.toLowerCase().includes(query) ||
          c.competitorName?.toLowerCase().includes(query)
      );
    }

    return { creatives, total: creatives.length };
  }

  const searchParams = new URLSearchParams();
  if (competitorId && competitorId !== 'all') searchParams.append('competitorId', competitorId);
  if (format && format !== 'all') searchParams.append('format', format);
  if (q) searchParams.append('q', q);
  if (isWinning) searchParams.append('winning', 'true');
  if (isNew) searchParams.append('new', 'true');
  const qs = searchParams.toString();
  return api(`/api/spy/creatives${qs ? `?${qs}` : ''}`);
}

// 6. getCreative(id) -> GET /api/spy/creatives/:id
export async function getCreative(id) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 100));
    const creatives = getMockCreatives();
    const found = creatives.find((c) => c.id === id);
    if (!found) {
      throw new Error('Creative iklan tidak ditemukan.');
    }
    return { creative: found };
  }
  return api(`/api/spy/creatives/${id}`);
}

// 7. saveToSwipe(id) -> POST /api/spy/swipe/:id
export async function saveToSwipe(id) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 180));
    const creatives = getMockCreatives();
    let currentSaved = false;
    const updated = creatives.map((c) => {
      if (c.id === id) {
        currentSaved = !c.isSavedToSwipe;
        return { ...c, isSavedToSwipe: currentSaved };
      }
      return c;
    });
    setStoredJson(getWsStorageKey(STORAGE_KEYS.CREATIVES), updated);
    return { ok: true, isSavedToSwipe: currentSaved };
  }
  return api(`/api/spy/swipe/${id}`, { method: 'POST' });
}

// 8. getInsights(week) -> GET /api/spy/insights?week=YYYY-Www
export async function getInsights(week) {
  if (isSpyMock()) {
    await new Promise((r) => setTimeout(r, 140));
    const insights = getMockInsights();
    return { insights: { ...insights, week: week || insights.week } };
  }
  return api(`/api/spy/insights${week ? `?week=${week}` : ''}`);
}
