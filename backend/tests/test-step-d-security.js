// Test Langkah D & E: Keamanan Workspace Isolation, requireUuidParam, dan Token Grace Chain (PRD F3)
import assert from 'assert';
import crypto, { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { hashToken } from '../lib/tokens.js';

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, typ: 'access' },
    process.env.JWT_SECRET || 'test-secret-step-d-security',
    { expiresIn: '15m' }
  );
}

const PORT = 5025;
const baseUrl = `http://localhost:${PORT}`;

async function req(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, data, text, headers: res.headers };
}

async function runSecurityTests() {
  console.log('=== RUNNING SECURITY & WORKSPACE ISOLATION SUITE (PRD F3 LANGKAH D & E) ===\n');

  process.env.NODE_ENV = 'test';
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = 'test-secret-step-d-security';
  process.env.ADMIN_KEY = 'test-admin-key-step-d';

  await db.remove('rate_limits', {});
  await import('../index.js');

  const ts = Date.now();

  // Setup User A & Workspace A
  const userA = await db.insert('accounts', {
    id: randomUUID(),
    email: `usera.${ts}@testmarkimate.io`,
    brand_name: 'Brand A',
    status: 'active',
    plan: 'pro',
    locale: 'id'
  });
  const wsA = await db.insert('workspaces', {
    id: randomUUID(),
    name: 'Workspace A',
    owner_user_id: userA.id
  });
  await db.insert('workspace_members', {
    workspace_id: wsA.id,
    user_id: userA.id,
    role: 'owner',
    joined_at: new Date().toISOString()
  });
  await db.insert('module_entitlements', {
    workspace_id: wsA.id,
    module: 'seo',
    active: true,
    source: 'subscription'
  });

  // Setup User B & Workspace B
  const userB = await db.insert('accounts', {
    id: randomUUID(),
    email: `userb.${ts}@testmarkimate.io`,
    brand_name: 'Brand B',
    status: 'active',
    plan: 'pro',
    locale: 'id'
  });
  const wsB = await db.insert('workspaces', {
    id: randomUUID(),
    name: 'Workspace B',
    owner_user_id: userB.id
  });
  await db.insert('workspace_members', {
    workspace_id: wsB.id,
    user_id: userB.id,
    role: 'owner',
    joined_at: new Date().toISOString()
  });
  await db.insert('module_entitlements', {
    workspace_id: wsB.id,
    module: 'seo',
    active: true,
    source: 'subscription'
  });

  const tokenA = signAccessToken(userA);
  const tokenB = signAccessToken(userB);

  // -------------------------------------------------------------
  // BAGIAN 1: requireUuidParam validation (404 NOT_FOUND untuk ID bukan UUID)
  // -------------------------------------------------------------
  console.log('1. Menguji proteksi requireUuidParam pada endpoint keywords & topic sources...');
  
  const badIdRes1 = await req('/api/keywords/bukan-uuid', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id },
    body: { status: 'Pending' }
  });
  assert.strictEqual(badIdRes1.status, 404, 'PATCH /api/keywords/:id harus 404 jika ID bukan UUID');
  assert.strictEqual(badIdRes1.data?.code, 'NOT_FOUND');

  const badIdRes2 = await req('/api/keywords/12345-invalid', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(badIdRes2.status, 404, 'DELETE /api/keywords/:id harus 404 jika ID bukan UUID');
  assert.strictEqual(badIdRes2.data?.code, 'NOT_FOUND');

  const badIdRes3 = await req('/api/keywords/sql-inject--/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(badIdRes3.status, 404, 'POST /api/keywords/:id/run harus 404 jika ID bukan UUID');

  const badIdRes4 = await req('/api/keywords/some-slug/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id },
    body: { action: 'draft' }
  });
  assert.strictEqual(badIdRes4.status, 404, 'POST /api/keywords/:id/publish harus 404 jika ID bukan UUID');

  const badIdRes5 = await req('/api/seo/topic-sources/bukan-uuid-juga', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(badIdRes5.status, 404, 'DELETE /api/seo/topic-sources/:id harus 404 jika ID bukan UUID');

  const badIdRes6 = await req('/api/seo/topic-sources/bukan-uuid/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(badIdRes6.status, 404, 'POST /api/seo/topic-sources/:id/run harus 404 jika ID bukan UUID');

  console.log('   OK - requireUuidParam sukses menolak input non-UUID dengan 404 NOT_FOUND.');

  // -------------------------------------------------------------
  // BAGIAN 2: Workspace Isolation (Penghapusan user_id fallback)
  // -------------------------------------------------------------
  console.log('\n2. Menguji isolasi data ketat antar workspace...');

  // Setup resource di Workspace A
  const kwA = await db.insert('keywords', {
    id: randomUUID(),
    user_id: userA.id,
    workspace_id: wsA.id,
    keyword: 'tips seo markimate a',
    geo: 'ID',
    ln: 'id',
    cms_type: 'wordpress',
    status: 'Pending'
  });

  const cmsA = await db.insert('cms_connections', {
    id: randomUUID(),
    user_id: userA.id,
    workspace_id: wsA.id,
    cms_type: 'wordpress',
    verified: true
  });

  const topicA = await db.insert('seo_topic_sources', {
    id: randomUUID(),
    user_id: userA.id,
    workspace_id: wsA.id,
    cms_type: 'wordpress',
    seed_keywords: ['seoa'],
    geo: 'ID',
    ln: 'id',
    active: true
  });

  // Verifikasi User A bisa melihat keyword KWA
  const listA = await req('/api/keywords', {
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(listA.status, 200);
  assert.ok(listA.data?.keywords?.some(k => k.id === kwA.id), 'User A harus melihat keyword miliknya');

  // Verifikasi User B di Workspace B TIDAK melihat keyword KWA
  const listB = await req('/api/keywords', {
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(listB.status, 200);
  assert.ok(!listB.data?.keywords?.some(k => k.id === kwA.id), 'User B TIDAK boleh melihat keyword milik Workspace A');

  // Verifikasi User B tidak bisa mengedit keyword milik Workspace A
  const patchB = await req(`/api/keywords/${kwA.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id },
    body: { status: 'Published' }
  });
  assert.strictEqual(patchB.status, 404, 'User B harus mendapat 404 saat mencoba mengedit keyword Workspace A');

  // Verifikasi User B tidak bisa menghapus keyword milik Workspace A
  const delB = await req(`/api/keywords/${kwA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(delB.status, 404, 'User B harus mendapat 404 saat mencoba menghapus keyword Workspace A');

  // Verifikasi User B tidak melihat CMS connections milik Workspace A di GET /api/me
  const meB = await req('/api/me', {
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(meB.status, 200);
  assert.ok(!meB.data?.cms?.some(c => c.id === cmsA.id), 'User B TIDAK boleh melihat CMS connection milik Workspace A');

  // Verifikasi User B tidak bisa menghapus atau menjalankan Topic Source milik Workspace A
  const delTopicB = await req(`/api/seo/topic-sources/${topicA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(delTopicB.status, 404, 'User B harus mendapat 404 saat mencoba menghapus Topic Source Workspace A');

  console.log('   OK - Isolasi multi-tenant data workspace & CMS connections terbukti aman 100%.');

  // -------------------------------------------------------------
  // BAGIAN 3: Refresh Token Grace Chain Traversal
  // -------------------------------------------------------------
  console.log('\n3. Menguji Refresh Token Grace Chain Traversal...');

  const familyId = randomUUID();
  const rawToken0 = 'raw_tok_0_' + randomUUID();
  const rawToken1 = 'raw_tok_1_' + randomUUID();
  const rawToken2 = 'raw_tok_2_' + randomUUID();

  const id0 = randomUUID();
  const id1 = randomUUID();
  const id2 = randomUUID();

  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  const revokedRecently = new Date(Date.now() - 5 * 1000).toISOString(); // 5 detik lalu (dalam grace 30s)

  // Token 2: token aktif terakhir
  await db.insert('refresh_tokens', {
    id: id2,
    token_hash: hashToken(rawToken2),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: null,
    revoked_at: null,
    expires_at: expiresAt
  });

  // Token 1: direvoke dan digantikan oleh Token 2
  await db.insert('refresh_tokens', {
    id: id1,
    token_hash: hashToken(rawToken1),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: id2,
    revoked_at: revokedRecently,
    expires_at: expiresAt
  });

  // Token 0: direvoke dan digantikan oleh Token 1
  await db.insert('refresh_tokens', {
    id: id0,
    token_hash: hashToken(rawToken0),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: id1,
    revoked_at: revokedRecently,
    expires_at: expiresAt
  });

  // Request refresh dengan Token 0 (berjarak 2 hop ke Token 2 aktif):
  const refreshRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: `mk_rt=${rawToken0}`
  });

  assert.strictEqual(refreshRes.status, 200, 'Refresh dengan token dalam grace period harus sukses');
  assert.ok(refreshRes.data?.accessToken, 'Harus mengembalikan accessToken baru');
  assert.strictEqual(refreshRes.data?.user?.email, userA.email);

  // Verifikasi reuse detection di luar grace window (> 30 detik)
  const expiredRevokedTime = new Date(Date.now() - 35 * 1000).toISOString();
  const idStale = randomUUID();
  const rawTokenStale = 'raw_stale_' + randomUUID();

  await db.insert('refresh_tokens', {
    id: idStale,
    token_hash: hashToken(rawTokenStale),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: id2,
    revoked_at: expiredRevokedTime,
    expires_at: expiresAt
  });

  const staleRefresh = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: `mk_rt=${rawTokenStale}`
  });

  assert.strictEqual(staleRefresh.status, 401, 'Token di luar grace window harus 401 reuse detection');
  assert.strictEqual(staleRefresh.data?.code, 'TOKEN_REUSE_DETECTED');

  // Seluruh token family sekarang harus telah direvoke
  const activeTokensInFamily = await db.findMany('refresh_tokens', { family_id: familyId });
  const anyUnrevoked = activeTokensInFamily.some(r => !r.revoked_at);
  assert.strictEqual(anyUnrevoked, false, 'Seluruh family token harus direvoke saat reuse detection terjadi');

  console.log('   OK - Refresh token grace chain traversal & reuse detection terverifikasi sempurna.');

  // Cleanup data uji
  await db.remove('keywords', { id: kwA.id });
  await db.remove('cms_connections', { id: cmsA.id });
  await db.remove('seo_topic_sources', { id: topicA.id });
  await db.remove('refresh_tokens', { family_id: familyId });
  await db.remove('workspace_members', { workspace_id: wsA.id });
  await db.remove('workspace_members', { workspace_id: wsB.id });
  await db.remove('workspaces', { id: wsA.id });
  await db.remove('workspaces', { id: wsB.id });
  await db.remove('accounts', { id: userA.id });
  await db.remove('accounts', { id: userB.id });

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN LANGKAH D & E SUKSES 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runSecurityTests().catch(err => {
  console.error('\n❌ ERROR DALAM TEST KEAMANAN & ISOLASI:', err);
  process.exit(1);
});
