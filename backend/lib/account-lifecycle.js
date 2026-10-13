/**
 * Account Lifecycle, Purge, Export, Meta Data Deletion & Audit Log Engine
 * (PRD F1 + F2 Langkah 8)
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import {
  sendAccountDeletionScheduledEmail,
  sendAccountPurgedEmail
} from './mailer.js';

/**
 * Mencatat peristiwa ke tabel audit_logs
 */
export async function logAuditEvent({
  userId = null,
  workspaceId = null,
  action,
  target = null,
  ip = null,
  userAgent = null,
  meta = {}
}) {
  try {
    return await db.insert('audit_logs', {
      user_id: userId,
      workspace_id: workspaceId,
      action,
      target,
      ip,
      user_agent: userAgent,
      meta,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn(`[AUDIT] Gagal mencatat audit log (${action}):`, err.message);
    return null;
  }
}

/**
 * Mengambil daftar audit log untuk workspace tertentu (maks 100 terakhir)
 */
export async function getWorkspaceAuditLogs(workspaceId, limit = 100) {
  const logs = await db.findMany('audit_logs', { workspace_id: workspaceId }, {
    orderBy: 'created_at',
    ascending: false,
    limit: Math.min(limit, 100)
  });
  return logs || [];
}

/**
 * Meminta penghapusan akun (pending_deletion selama 30 hari)
 */
export async function requestAccountDeletion({ userId, password, confirm, ip, userAgent }) {
  if (confirm !== 'HAPUS') {
    throw Object.assign(new Error('Konfirmasi harus berupa kata "HAPUS".'), { status: 400, code: 'CONFIRM_MISMATCH' });
  }

  const user = await db.findOne('accounts', { id: userId });
  if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { status: 404 });

  const isPasswordValid = await bcrypt.compare(String(password || ''), user.password_hash || '');
  if (!isPasswordValid) {
    throw Object.assign(new Error('Kata sandi yang Anda masukkan salah.'), { status: 400, code: 'INVALID_PASSWORD' });
  }

  // Cek apakah user masih merupakan owner di workspace yang memiliki anggota lain
  const ownedMemberships = await db.findMany('workspace_members', { user_id: userId, role: 'owner' });
  const blockedWorkspaces = [];

  for (const m of (ownedMemberships || [])) {
    const otherMembers = await db.findMany('workspace_members', { workspace_id: m.workspace_id });
    const hasOther = (otherMembers || []).some(mem => mem.user_id !== userId);
    if (hasOther) {
      const ws = await db.findOne('workspaces', { id: m.workspace_id });
      blockedWorkspaces.push({
        id: m.workspace_id,
        name: ws ? ws.name : 'Workspace'
      });
    }
  }

  if (blockedWorkspaces.length > 0) {
    throw Object.assign(new Error('Anda harus mentransfer kepemilikan workspace terlebih dahulu sebelum menghapus akun.'), {
      status: 409,
      code: 'TRANSFER_OWNERSHIP_FIRST',
      workspaces: blockedWorkspaces
    });
  }

  const now = new Date();
  const scheduledDateObj = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const scheduledDateIso = scheduledDateObj.toISOString();
  const scheduledDateFormatted = scheduledDateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // 1. Update status akun menjadi pending_deletion
  await db.update('accounts', { id: userId }, {
    status: 'pending_deletion',
    deleted_requested_at: now.toISOString()
  });

  // 2. Cabut semua sesi aktif
  await db.remove('refresh_tokens', { user_id: userId });

  // 3. Hentikan seluruh jadwal otomatis pada workspace milik user
  for (const m of (ownedMemberships || [])) {
    // Matikan jadwal keyword
    const kws = await db.findMany('keywords', { workspace_id: m.workspace_id });
    for (const kw of (kws || [])) {
      if (kw.schedule !== 'immediate' || kw.next_run_at) {
        await db.update('keywords', { id: kw.id }, {
          schedule: 'immediate',
          next_run_at: null
        });
      }
    }
    // Nonaktifkan topic sources
    const sources = await db.findMany('seo_topic_sources', { workspace_id: m.workspace_id });
    for (const src of (sources || [])) {
      if (src.active !== false) {
        await db.update('seo_topic_sources', { id: src.id }, { active: false });
      }
    }
  }

  // 4. Kirim email pemberitahuan jadwal penghapusan
  await sendAccountDeletionScheduledEmail({
    to: user.email,
    scheduledDate: scheduledDateFormatted
  });

  // 5. Catat audit log
  await logAuditEvent({
    userId,
    action: 'account_deletion_requested',
    ip,
    userAgent,
    meta: { scheduled_at: scheduledDateIso }
  });

  return {
    success: true,
    scheduledAt: scheduledDateIso,
    scheduledDateFormatted
  };
}

/**
 * Membatalkan permintaan penghapusan akun
 */
export async function cancelAccountDeletion({ userId, email, password, ip, userAgent }) {
  let user = null;
  if (userId) {
    user = await db.findOne('accounts', { id: userId });
  } else if (email) {
    const em = String(email || '').trim().toLowerCase();
    user = await db.findOne('accounts', { email: em });
  }

  if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { status: 404 });

  if (password) {
    const isPasswordValid = await bcrypt.compare(String(password), user.password_hash || '');
    if (!isPasswordValid) {
      throw Object.assign(new Error('Kata sandi salah.'), { status: 400, code: 'INVALID_PASSWORD' });
    }
  }

  await db.update('accounts', { id: user.id }, {
    status: 'active',
    deleted_requested_at: null
  });

  await logAuditEvent({
    userId: user.id,
    action: 'account_deletion_cancelled',
    ip,
    userAgent,
    meta: { email: user.email }
  });

  return { success: true, user };
}

/**
 * Mengekspor seluruh data akun dan workspace miliknya dalam bentuk JSON (PRD §4 Langkah 8)
 */
export async function exportAccountData(userId) {
  const user = await db.findOne('accounts', { id: userId });
  if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { status: 404 });

  // 1. Profil pengguna (tanpa password_hash)
  const profile = {
    id: user.id,
    email: user.email,
    name: user.name,
    brandName: user.brand_name,
    niche: user.niche,
    plan: user.plan,
    status: user.status,
    createdAt: user.created_at
  };

  // 2. Workspace milik pengguna
  const memberships = await db.findMany('workspace_members', { user_id: userId, role: 'owner' });
  const workspacesData = [];

  for (const m of (memberships || [])) {
    const ws = await db.findOne('workspaces', { id: m.workspace_id });
    if (!ws || ws.deleted_at) continue;

    // Keywords dan artikel
    const keywords = await db.findMany('keywords', { workspace_id: ws.id });
    const cleanKeywords = (keywords || []).map(k => ({
      id: k.id,
      keyword: k.keyword,
      geo: k.geo,
      ln: k.ln,
      cmsType: k.cms_type,
      status: k.status,
      schedule: k.schedule,
      article: k.article,
      postId: k.post_id,
      publicUrl: k.public_url,
      createdAt: k.created_at
    }));

    // Pengaturan CMS TANPA KREDENSIAL / SECRET
    const cmsList = await db.findMany('cms_connections', { workspace_id: ws.id });
    const cleanCms = (cmsList || []).map(c => ({
      cmsType: c.cms_type,
      verified: c.verified,
      verifiedAt: c.verified_at,
      articleSettings: c.article_settings || {}
    }));

    // SEO Topic Sources
    const topicSources = await db.findMany('seo_topic_sources', { workspace_id: ws.id });

    // Saldo Credit & Ledger
    const wallet = await db.findOne('credit_wallets', { workspace_id: ws.id });
    const ledger = await db.findMany('credit_ledger', { workspace_id: ws.id });

    workspacesData.push({
      id: ws.id,
      name: ws.name,
      niche: ws.niche,
      website: ws.website,
      createdAt: ws.created_at,
      keywords: cleanKeywords,
      cmsConnections: cleanCms,
      topicSources: topicSources || [],
      creditWallet: wallet ? { balance: wallet.balance, buckets: wallet.buckets } : null,
      creditLedger: (ledger || []).slice(0, 200)
    });
  }

  // Catat audit log ekspor
  await logAuditEvent({
    userId,
    action: 'account_exported',
    meta: { workspacesCount: workspacesData.length }
  });

  return {
    exportDate: new Date().toISOString(),
    profile,
    workspaces: workspacesData
  };
}

/**
 * Menghapus permanen (purge) akun yang berada dalam status pending_deletion > 30 hari.
 * Dijalankan oleh cron harian (/api/cron/run-scheduled).
 */
export async function purgeDeletedAccounts() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 3600 * 1000;
  const accounts = await db.findMany('accounts', { status: 'pending_deletion' });
  let purgedCount = 0;

  for (const user of (accounts || [])) {
    if (!user.deleted_requested_at) continue;
    const requestedTime = new Date(user.deleted_requested_at).getTime();

    // Periksa apakah sudah lewat dari 30 hari
    if (now - requestedTime >= thirtyDaysMs) {
      console.log(`[PURGE] Menghapus akun permanen: ${user.email} (${user.id})`);

      // 1. Cari workspace yang dimiliki oleh user
      const ownedMemberships = await db.findMany('workspace_members', { user_id: user.id, role: 'owner' });
      for (const m of (ownedMemberships || [])) {
        const members = await db.findMany('workspace_members', { workspace_id: m.workspace_id });
        const otherMembers = (members || []).filter(mem => mem.user_id !== user.id);

        // Jika workspace ini hanya dimiliki oleh user ini, hapus seluruh data workspace
        if (otherMembers.length === 0) {
          await db.remove('keywords', { workspace_id: m.workspace_id });
          await db.remove('cms_connections', { workspace_id: m.workspace_id });
          await db.remove('seo_topic_sources', { workspace_id: m.workspace_id });
          await db.remove('module_entitlements', { workspace_id: m.workspace_id });
          await db.remove('workspace_api_keys', { workspace_id: m.workspace_id });
          await db.remove('workspace_invites', { workspace_id: m.workspace_id });
          await db.remove('workspace_members', { workspace_id: m.workspace_id });
          await db.remove('workspaces', { id: m.workspace_id });
        }
      }

      // 2. Hapus membership user di workspace lain
      await db.remove('workspace_members', { user_id: user.id });
      await db.remove('workspace_invites', { inviter_user_id: user.id });

      // 3. Anonimkan audit_logs (user_id -> null, email -> sha256)
      const userLogs = await db.findMany('audit_logs', { user_id: user.id });
      for (const log of (userLogs || [])) {
        const nextMeta = { ...(log.meta || {}) };
        if (nextMeta.email) {
          nextMeta.email = crypto.createHash('sha256').update(String(nextMeta.email)).digest('hex');
        }
        await db.update('audit_logs', { id: log.id }, {
          user_id: null,
          meta: nextMeta
        });
      }

      // 4. Simpan riwayat transaksi tanpa data pribadi (kewajiban pajak)
      const orders = await db.findMany('credit_orders', { user_id: user.id });
      for (const ord of (orders || [])) {
        await db.update('credit_orders', { id: ord.id }, {
          user_id: null,
          meta: { ...(ord.meta || {}), user_anonymized: true }
        });
      }

      const subs = await db.findMany('subscriptions', { user_id: user.id });
      for (const s of (subs || [])) {
        await db.update('subscriptions', { id: s.id }, {
          user_id: null
        });
      }

      // 5. Pastikan credit_trials menyimpan hanya hash email
      const trials = await db.findMany('credit_trials', { user_id: user.id });
      for (const tr of (trials || [])) {
        await db.update('credit_trials', { id: tr.id }, {
          user_id: null,
          email_hash: tr.email_hash || crypto.createHash('sha256').update(user.email.toLowerCase().trim()).digest('hex')
        });
      }

      // 6. Hapus sesi dan token verifikasi tersisa
      await db.remove('refresh_tokens', { user_id: user.id });
      await db.remove('email_verifications', { user_id: user.id });
      await db.remove('password_resets', { user_id: user.id });

      // 7. Kirim email pemberitahuan penghapusan permanen selesai
      try {
        await sendAccountPurgedEmail({ to: user.email });
      } catch (err) {
        console.warn('[PURGE] Gagal mengirim email purged:', err.message);
      }

      // 8. Hapus user dari accounts
      await db.remove('accounts', { id: user.id });
      purgedCount++;
    }
  }

  return purgedCount;
}

/**
 * Memverifikasi Meta signed_request HMAC-SHA256
 */
export function verifyMetaSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    return null;
  }

  const [encodedSig, payloadStr] = signedRequest.split('.', 2);
  const secret = appSecret || process.env.META_APP_SECRET || 'test_meta_app_secret';

  // Decode base64url sig
  const sigBuffer = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  // Hitung HMAC-SHA256 dari payload
  const expectedHmac = crypto.createHmac('sha256', secret).update(payloadStr).digest();

  if (sigBuffer.length !== expectedHmac.length || !crypto.timingSafeEqual(sigBuffer, expectedHmac)) {
    return null;
  }

  try {
    const rawPayload = Buffer.from(payloadStr.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
}

/**
 * Menangani Webhook Meta Data Deletion Callback (PRD §4 Langkah 8)
 */
export async function handleMetaDataDeletion(signedRequest, appUrl) {
  const secret = process.env.META_APP_SECRET || 'test_meta_app_secret';
  const payload = verifyMetaSignedRequest(signedRequest, secret);
  if (!payload) {
    throw Object.assign(new Error('Invalid signed_request signature.'), { status: 400, code: 'INVALID_SIGNATURE' });
  }

  const confirmationCode = 'del_' + crypto.randomBytes(12).toString('hex');
  const metaUserId = payload.user_id || 'unknown';

  await db.insert('webhook_events', {
    source: 'meta_data_deletion',
    event_id: confirmationCode,
    payload: {
      platform: 'meta',
      platform_user_id: metaUserId,
      confirmation_code: confirmationCode,
      status: 'completed',
      requested_at: new Date().toISOString()
    }
  });

  const baseUrl = (appUrl || process.env.APP_URL || 'https://markimate-three.vercel.app').replace(/\/+$/, '');
  return {
    url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode
  };
}

/**
 * Mengambil status penghapusan data Meta dari confirmation code
 */
export async function getMetaDataDeletionStatus(code) {
  if (!code) return null;
  const event = await db.findOne('webhook_events', { source: 'meta_data_deletion', event_id: code });
  if (!event) return null;

  return {
    status: event.payload?.status || 'completed',
    confirmationCode: code,
    requestedAt: event.payload?.requested_at || event.created_at
  };
}
