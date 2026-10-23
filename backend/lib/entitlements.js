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
 * PRD F16 §3.4: Semua modul aktif gratis untuk setiap workspace yang valid (source: 'free').
 * Admin tetap source: 'admin'.
 * 
 * @param {string} workspaceId
 * @returns {Promise<Array<string> & { details: Record<string, object>, isSeoFree: boolean }>}
 */
export async function getModules(workspaceId) {
  if (!workspaceId) return Object.assign([], { details: {}, isSeoFree: false });

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

  // PRD F16 §3.4: Semua modul aktif gratis untuk setiap workspace yang valid
  const active = ['seo', 'ads_report', 'ads_spy'];
  active.details = {
    seo: { active: true, source: 'free', starts_at: null, ends_at: null },
    ads_report: { active: true, source: 'free', starts_at: null, ends_at: null },
    ads_spy: { active: true, source: 'free', starts_at: null, ends_at: null }
  };
  active.isSeoFree = false;
  return active;
}

/**
 * Mengecek apakah suatu modul aktif pada workspace
 */
export async function isModuleActive(workspaceId, moduleName) {
  const activeModules = await getModules(workspaceId);
  return activeModules.includes(moduleName);
}

/**
 * Mengecek apakah suatu modul aktif pada workspace.
 * PRD F16 §3.4: Selalu lolos (true) untuk modul yang sudah rilis (VALID_MODULES) pada workspace valid.
 * Modul coming soon / tidak tersedia mengembalikan false.
 */
export async function hasActiveModuleEntitlement(workspaceId, moduleName = 'seo') {
  if (!workspaceId) return false;
  if (!VALID_MODULES.includes(moduleName)) return false;
  return true;
}

/**
 * Middleware express untuk membatasi endpoint berdasarkan entitlement modul
 * PRD F16 §3.4: Selalu lolos untuk modul yang sudah rilis (VALID_MODULES).
 * Modul "coming soon" tetap ditolak (404/403 MODULE_NOT_AVAILABLE).
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

      if (!VALID_MODULES.includes(moduleName)) {
        return res.status(404).json({
          error: `Module '${moduleName}' is not yet available.`,
          code: 'MODULE_NOT_AVAILABLE',
          module: moduleName
        });
      }

      const activeList = await getModules(wsId);
      req.activeModules = activeList;
      req.isSeoFree = false;

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
