import { db } from '../db.js';

export const VALID_MODULES = ['seo', 'ads_report', 'ads_spy'];

/**
 * Memeriksa apakah suatu email terdaftar di env PLATFORM_ADMIN_EMAILS
 */
export function isPlatformAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  const envList = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return envList.includes(normalized);
}

/**
 * Memeriksa apakah objek akun memiliki status platform admin
 */
export function isPlatformAdmin(account) {
  return Boolean(account && account.is_platform_admin);
}

/**
 * Memeriksa apakah pemilik suatu workspace adalah platform admin
 */
export async function isWorkspacePlatformAdmin(workspaceId) {
  if (!workspaceId) return false;
  const ws = await db.findOne('workspaces', { id: workspaceId });
  const ownerUserId = ws?.owner_user_id || workspaceId;
  const owner = await db.findOne('accounts', { id: ownerUserId });
  return Boolean(owner && owner.is_platform_admin);
}

/**
 * Memastikan akun yang terverifikasi dan ada di PLATFORM_ADMIN_EMAILS mendapatkan flag admin & entitlement
 * PENTING: Fungsi ini TIDAK PERNAH mengisi email_verified_at.
 */
export async function ensurePlatformAdmin(account) {
  if (!account || !account.id || !account.email) return false;

  // Hanya proses jika email terdaftar di PLATFORM_ADMIN_EMAILS
  if (!isPlatformAdminEmail(account.email)) {
    return false;
  }

  // Wajib sudah terverifikasi (email_verified_at tidak null)
  if (!account.email_verified_at) {
    return false;
  }

  // Set flag is_platform_admin = true jika belum
  if (!account.is_platform_admin) {
    await db.update('accounts', { id: account.id }, {
      is_platform_admin: true
    });
    account.is_platform_admin = true;
  }

  // Cari semua workspace milik akun ini
  const workspaces = await db.findMany('workspaces', { owner_user_id: account.id });
  const targets = (workspaces && workspaces.length > 0) ? workspaces : [{ id: account.id }];

  const now = new Date().toISOString();
  for (const ws of targets) {
    for (const mod of VALID_MODULES) {
      await db.upsert('module_entitlements', { workspace_id: ws.id, module: mod }, {
        active: true,
        source: 'admin',
        starts_at: now,
        ends_at: null
      });
    }
  }

  return true;
}
