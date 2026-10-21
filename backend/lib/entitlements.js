/**
 * Module Entitlements Engine (PRD F1 + F2 Langkah 7)
 * Sumber kebenaran aktivasi modul per workspace di server.
 */
import { db } from '../db.js';
import { PLANS } from './plans.js';
import { isWorkspacePlatformAdmin, ensurePlatformAdmin, VALID_MODULES } from './admin.js';

export { VALID_MODULES, ensurePlatformAdmin };

/**
 * Mengambil daftar modul yang aktif untuk workspace tertentu.
 * Aturan PRD:
 * - Trial: modul aktif sampai ends_at (7 hari).
 * - Setelah trial lewat: ads_report & ads_spy nonaktif.
 * - Modul 'seo' selalu turun ke kuota Free (PLANS.free) jika trial/langganan habis.
 * - Langganan berbayar (subscription/admin): modul aktif sesuai paket sampai ends_at.
 * 
 * @param {string} workspaceId
 * @returns {Promise<Array<string> & { details: Record<string, object>, isSeoFree: boolean }>}
 */
export async function getModules(workspaceId) {
  if (!workspaceId) return Object.assign([], { details: {}, isSeoFree: true });

  if (await isWorkspacePlatformAdmin(workspaceId)) {
    const active = ['seo', 'ads_report', 'ads_spy'];
    const now = new Date().toISOString();
    active.details = {
      seo: { active: true, source: 'admin', starts_at: now, ends_at: null },
      ads_report: { active: true, source: 'admin', starts_at: now, ends_at: null },
      ads_spy: { active: true, source: 'admin', starts_at: now, ends_at: null }
    };
    active.isSeoFree = false;
    return active;
  }

  const now = new Date();
  const rows = await db.findMany('module_entitlements', { workspace_id: workspaceId });

  const map = {};
  for (const row of (rows || [])) {
    const isNotExpired = !row.ends_at || new Date(row.ends_at) > now;
    if (row.active && isNotExpired) {
      map[row.module] = {
        active: true,
        source: row.source || 'trial',
        starts_at: row.starts_at,
        ends_at: row.ends_at
      };
    } else {
      if (!map[row.module]) {
        map[row.module] = {
          active: false,
          source: row.source,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          expired: !isNotExpired
        };
      }
    }
  }

  const activeModules = [];
  let isSeoFree = false;

  // 1. Evaluasi Modul SEO
  if (map['seo'] && map['seo'].active) {
    activeModules.push('seo');
    isSeoFree = map['seo'].source === 'free';
  } else {
    // Fallback: SEO selalu tersedia di tingkat Free tier
    activeModules.push('seo');
    isSeoFree = true;
    if (!map['seo']) {
      map['seo'] = { active: true, source: 'free', freeTier: true };
    } else {
      map['seo'].active = true;
      map['seo'].source = 'free';
      map['seo'].freeTier = true;
    }
  }

  // 2. Evaluasi Modul Ads Report
  if (map['ads_report'] && map['ads_report'].active) {
    activeModules.push('ads_report');
  } else if (!map['ads_report']) {
    map['ads_report'] = { active: false, source: null };
  }

  // 3. Evaluasi Modul Ads Creative Spy
  if (map['ads_spy'] && map['ads_spy'].active) {
    activeModules.push('ads_spy');
  } else if (!map['ads_spy']) {
    map['ads_spy'] = { active: false, source: null };
  }

  activeModules.details = map;
  activeModules.isSeoFree = isSeoFree;
  return activeModules;
}

/**
 * Mengecek apakah suatu modul aktif pada workspace
 */
export async function isModuleActive(workspaceId, moduleName) {
  const activeModules = await getModules(workspaceId);
  return activeModules.includes(moduleName);
}

/**
 * Mengecek apakah suatu modul aktif pada workspace dengan sumber valid (lifetime, trial, admin, subscription)
 * Mengabaikan fallback free tier.
 */
export async function hasActiveModuleEntitlement(workspaceId, moduleName = 'seo') {
  if (!workspaceId) return false;
  if (await isWorkspacePlatformAdmin(workspaceId)) return true;
  const now = new Date();
  const ent = await db.findOne('module_entitlements', { workspace_id: workspaceId, module: moduleName });
  if (!ent || ent.active === false) return false;
  if (ent.ends_at && new Date(ent.ends_at) <= now) return false;
  return ['lifetime', 'trial', 'admin', 'subscription'].includes(ent.source);
}

/**
 * Middleware express untuk membatasi endpoint berdasarkan entitlement modul
 * Mengembalikan HTTP 403 { code: 'MODULE_INACTIVE', module } jika modul tidak aktif.
 */
export function requireModule(moduleName) {
  return async (req, res, next) => {
    try {
      const hdrWs = req.headers['x-workspace-id'];
      const wsId = req.workspace?.id || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hdrWs || '') ? hdrWs : null) || req.user?.id;
      if (!wsId) {
        return res.status(403).json({
          error: 'Workspace is required.',
          code: 'WORKSPACE_REQUIRED'
        });
      }

      const activeList = await getModules(wsId);
      if (!activeList.includes(moduleName)) {
        return res.status(403).json({
          error: 'This module is not active for the current workspace subscription.',
          code: 'MODULE_INACTIVE',
          module: moduleName
        });
      }

      // Sematkan info entitlement modul ke request
      req.activeModules = activeList;
      req.isSeoFree = activeList.isSeoFree;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Menonaktifkan entitlement yang tanggal ends_at nya telah lewat (dipanggil oleh cron harian).
 * @returns {Promise<number>} Jumlah baris entitlement yang dinonaktifkan
 */
export async function expireEntitlements() {
  const now = new Date().toISOString();
  const all = await db.findMany('module_entitlements', { active: true });
  let count = 0;
  for (const ent of (all || [])) {
    if (ent.ends_at && ent.ends_at <= now) {
      await db.update(
        'module_entitlements',
        { workspace_id: ent.workspace_id, module: ent.module },
        { active: false }
      );
      count++;
    }
  }
  return count;
}
