// Test Security & Workspace Isolation: requireUuidParam, Cross-tenant Guard & Token Grace Chain
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto, { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-security-${randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], cms_connections: [], seo_topic_sources: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { hashToken } = await import('../lib/tokens.js');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, typ: 'access' },
    process.env.JWT_SECRET || 'test-secret-step-d-security',
    { expiresIn: '15m' }
  );
}

const PORT = 5018;
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
  console.log('=== RUNNING SECURITY & WORKSPACE ISOLATION SUITE ===\n');

  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = 'test-secret-step-d-security';
  process.env.ADMIN_KEY = 'test-admin-key-step-d';

  await seedCreditPricesAndRates();
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

  // 1. requireUuidParam validation (404 NOT_FOUND untuk ID bukan UUID)
  console.log('1. Menguji proteksi requireUuidParam pada endpoint keywords & topic sources...');
  const badIdRes1 = await req('/api/keywords/bukan-uuid', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id },
    body: { status: 'Pending' }
  });
  assert.strictEqual(badIdRes1.status, 404);
  assert.strictEqual(badIdRes1.data?.code, 'NOT_FOUND');

  const badIdRes2 = await req('/api/keywords/12345-invalid', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(badIdRes2.status, 404);
  assert.strictEqual(badIdRes2.data?.code, 'NOT_FOUND');

  // 2. Workspace Isolation
  console.log('2. Menguji isolasi data ketat antar workspace...');
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

  // User A bisa melihat keyword miliknya
  const listA = await req('/api/keywords', {
    headers: { Authorization: `Bearer ${tokenA}`, 'x-workspace-id': wsA.id }
  });
  assert.strictEqual(listA.status, 200);
  assert.ok(listA.data?.keywords?.some(k => k.id === kwA.id));

  // User B TIDAK boleh melihat keyword milik Workspace A
  const listB = await req('/api/keywords', {
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(listB.status, 200);
  assert.ok(!listB.data?.keywords?.some(k => k.id === kwA.id));

  // User B tidak bisa mengedit atau menghapus keyword milik Workspace A
  const patchB = await req(`/api/keywords/${kwA.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id },
    body: { status: 'Published' }
  });
  assert.strictEqual(patchB.status, 404);

  const delB = await req(`/api/keywords/${kwA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': wsB.id }
  });
  assert.strictEqual(delB.status, 404);

  // 3. Refresh Token Grace Chain Traversal & Reuse Detection
  console.log('3. Menguji Refresh Token Grace Chain Traversal...');
  const familyId = randomUUID();
  const rawToken0 = 'raw_tok_0_' + randomUUID();
  const rawToken1 = 'raw_tok_1_' + randomUUID();
  const rawToken2 = 'raw_tok_2_' + randomUUID();

  const id0 = randomUUID();
  const id1 = randomUUID();
  const id2 = randomUUID();

  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  const revokedRecently = new Date(Date.now() - 5 * 1000).toISOString();

  await db.insert('refresh_tokens', {
    id: id2,
    token_hash: hashToken(rawToken2),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: null,
    revoked_at: null,
    expires_at: expiresAt
  });

  await db.insert('refresh_tokens', {
    id: id1,
    token_hash: hashToken(rawToken1),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: id2,
    revoked_at: revokedRecently,
    expires_at: expiresAt
  });

  await db.insert('refresh_tokens', {
    id: id0,
    token_hash: hashToken(rawToken0),
    user_id: userA.id,
    family_id: familyId,
    replaced_by: id1,
    revoked_at: revokedRecently,
    expires_at: expiresAt
  });

  const refreshRes = await req('/api/auth/refresh', {
    method: 'POST',
    cookie: `mk_rt=${rawToken0}`
  });
  assert.strictEqual(refreshRes.status, 200);
  assert.ok(refreshRes.data?.accessToken);
  assert.strictEqual(refreshRes.data?.user?.email, userA.email);

  // Reuse Detection (> 30s)
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
  assert.strictEqual(staleRefresh.status, 401);
  assert.strictEqual(staleRefresh.data?.code, 'TOKEN_REUSE_DETECTED');

  const activeTokensInFamily = await db.findMany('refresh_tokens', { family_id: familyId });
  const anyUnrevoked = activeTokensInFamily.some(r => !r.revoked_at);
  assert.strictEqual(anyUnrevoked, false);

  console.log('✅ ALL SECURITY & ISOLATION TESTS PASSED!');
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(0);
}

runSecurityTests().catch(err => {
  console.error('❌ Security Test Failed:', err);
  if (standaloneTmp && fs.existsSync(standaloneTmp)) {
    try { fs.unlinkSync(standaloneTmp); } catch {}
  }
  process.exit(1);
});
