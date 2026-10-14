// Modul Workspace & Multi-tenancy Isolation (PRD F1 + F2 Langkah 5)
import crypto from 'crypto';
import { db } from '../db.js';
import { hashToken } from './tokens.js';
import { getModules } from './entitlements.js';

export const ROLE_LEVELS = {
  viewer: 1,
  admin: 2,
  owner: 3
};

/**
 * Mendapatkan atau menyelesaikan workspace yang aktif untuk user
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

export function requireUuidParam(paramName = 'id') {
  return (req, res, next) => {
    const val = req.params?.[paramName];
    if (!val || !isUuid(val)) {
      return res.status(404).json({
        error: 'Data tidak ditemukan.',
        code: 'NOT_FOUND'
      });
    }
    next();
  };
}

export async function resolveWorkspaceForUser(userId, requestedWsId) {
  // ID workspace legacy/mock (mis. "ws-3our-official") bukan UUID: abaikan & pakai workspace default
  if (requestedWsId && !isUuid(requestedWsId)) requestedWsId = null;
  if (requestedWsId) {
    const member = await db.findOne('workspace_members', {
      workspace_id: requestedWsId,
      user_id: userId
    });

    if (!member) return null;

    const workspace = await db.findOne('workspaces', { id: requestedWsId });
    if (!workspace || workspace.deleted_at) return null;

    return { workspace, member };
  }

  // Fallback: cari workspace pertama di mana user terdaftar sebagai member
  const members = await db.findMany('workspace_members', { user_id: userId }, {
    orderBy: 'joined_at',
    ascending: true
  });

  for (const m of (members || [])) {
    const ws = await db.findOne('workspaces', { id: m.workspace_id });
    if (ws && !ws.deleted_at) {
      return { workspace: ws, member: m };
    }
  }

  // Self-healing: jika akun lama/baru belum memiliki record workspace, buat default (id = userId)
  const user = await db.findOne('accounts', { id: userId });
  const brandName = (user && (user.brand_name || user.name)) || 'Workspace Utama';
  const niche = (user && user.niche) || 'Other';

  let defaultWs = await db.findOne('workspaces', { id: userId });
  if (!defaultWs) {
    defaultWs = await db.insert('workspaces', {
      id: userId,
      name: brandName,
      niche,
      owner_user_id: userId
    });
  }

  let defaultMember = await db.findOne('workspace_members', { workspace_id: userId, user_id: userId });
  if (!defaultMember) {
    defaultMember = await db.insert('workspace_members', {
      workspace_id: userId,
      user_id: userId,
      role: 'owner'
    });
  }

  return { workspace: defaultWs, member: defaultMember };
}

/**
 * Membuat workspace default baru untuk user
 */
export async function createDefaultWorkspace(userId, name = 'Workspace Utama', niche = 'Other') {
  const ws = await db.insert('workspaces', {
    name: name || 'Workspace Utama',
    niche: niche || 'Other',
    owner_user_id: userId
  });

  await db.insert('workspace_members', {
    workspace_id: ws.id,
    user_id: userId,
    role: 'owner'
  });

  return ws;
}

/**
 * Middleware untuk menegakkan isolasi workspace dan verifikasi role anggota
 */
export function requireWorkspace(minRole = 'viewer') {
  const minLevel = ROLE_LEVELS[minRole] || 1;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Belum login.', code: 'UNAUTHORIZED' });
      }

      const isWorkspaceRoute = req.params?.workspaceId !== undefined || (req.params?.id !== undefined && /^\/api\/workspaces\//.test(req.originalUrl || req.baseUrl || req.path));
      let requestedWsId;

      if (isWorkspaceRoute) {
        const routeWsId = req.params?.workspaceId || req.params?.id;
        if (!isUuid(routeWsId)) {
          return res.status(404).json({
            error: 'Workspace tidak ditemukan atau Anda tidak memiliki akses.',
            code: 'WORKSPACE_NOT_FOUND'
          });
        }
        requestedWsId = routeWsId;
      } else {
        requestedWsId = req.headers['x-workspace-id'] || req.query?.workspaceId || req.body?.workspaceId;
      }

      const resolved = await resolveWorkspaceForUser(req.user.id, requestedWsId);

      // Keamanan: Jika workspace tidak ditemukan atau user bukan anggota, kembalikan 404 (bukan 403)
      // agar penyerang tidak bisa menebak ID workspace lain
      if (!resolved) {
        return res.status(404).json({
          error: 'Workspace tidak ditemukan atau Anda tidak memiliki akses.',
          code: 'WORKSPACE_NOT_FOUND'
        });
      }

      const { workspace, member } = resolved;
      const userLevel = ROLE_LEVELS[member.role] || 1;

      if (userLevel < minLevel) {
        return res.status(403).json({
          error: `Akses ditolak: tindakan ini memerlukan peran minimal ${minRole}.`,
          code: 'FORBIDDEN_ROLE',
          requiredRole: minRole,
          currentRole: member.role
        });
      }

      req.workspace = workspace;
      req.member = member;
      next();
    } catch (err) {
      console.error('[WORKSPACE-MIDDLEWARE-ERR]', err);
      res.status(500).json({ error: 'Gagal memverifikasi akses workspace.', details: err.message });
    }
  };
}

/**
 * Mengambil seluruh workspace di mana user menjadi anggota beserta modul aktif
 */
export async function getUserWorkspaces(userId) {
  const members = await db.findMany('workspace_members', { user_id: userId }, {
    orderBy: 'joined_at',
    ascending: true
  });

  const list = [];
  for (const m of (members || [])) {
    const ws = await db.findOne('workspaces', { id: m.workspace_id });
    if (ws && !ws.deleted_at) {
      // Ambil entitlements & active modules terverifikasi
      const activeModules = await getModules(ws.id);

      list.push({
        id: ws.id,
        name: ws.name,
        niche: ws.niche,
        website: ws.website || '',
        role: m.role,
        modules: [...activeModules],
        entitlements: activeModules.details,
        createdAt: ws.created_at,
        isOwner: m.role === 'owner'
      });
    }
  }

  return list;
}

/**
 * Menghasilkan API key baru untuk workspace
 */
export async function createWorkspaceApiKey({ workspaceId, userId, label }) {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `mkm_live_${randomBytes}`;
  const keyHash = hashToken(rawKey);
  const prefix = rawKey.slice(0, 12);

  const row = await db.insert('workspace_api_keys', {
    workspace_id: workspaceId,
    key_hash: keyHash,
    prefix,
    label: String(label || 'API Key').trim(),
    created_by: userId
  });

  return {
    id: row.id,
    key: rawKey,
    rawKey,
    prefix,
    keyPrefix: prefix,
    label: row.label,
    createdAt: row.created_at
  };
}
