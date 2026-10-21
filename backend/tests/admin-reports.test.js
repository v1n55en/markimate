// Test Suite: Admin Lifetime Liability Report & Revenue Mix (PRD F15 Langkah 8)
import assert from 'assert';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-admin-reports-${randomUUID()}.json`);
  fs.writeFileSync(
    standaloneTmp,
    JSON.stringify(
      {
        accounts: [],
        credit_wallets: [],
        credit_ledger: [],
        credit_prices: [],
        credit_cost_rates: [],
        credit_alerts: [],
        workspaces: [],
        workspace_members: [],
        workspace_invites: [],
        module_entitlements: [],
        rate_limits: [],
        refresh_tokens: [],
        workspace_api_keys: [],
        keywords: [],
        audit_logs: [],
        payments: [],
        monthly_grants: [],
        subscriptions: [],
        webhook_events: []
      },
      null,
      2
    )
  );
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { getLifetimeLiability, getRevenueMix, getAdminLifetimeReport } = await import(
  '../lib/admin-reports.js'
);
const { calculateUsageAndMargin } = await import('../lib/margin.js');

let baseUrl;
const TEST_ADMIN_KEY = 'admin-reports-secret-key-32-chars!!';
const ADMIN_EMAIL = 'admin.report.tester@testmarkimate.id';
const NORMAL_EMAIL = 'user.regular@testmarkimate.id';

async function req(apiPath, options = {}) {
  const url = `${baseUrl}${apiPath}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : undefined
  });

  const data = await res.json().catch(() => null);
  return {
    status: res.status,
    ok: res.ok,
    data
  };
}

async function runAdminReportsTests() {
  console.log('=== RUNNING ADMIN LIFETIME LIABILITY & REVENUE MIX TEST (PRD F15 Langkah 8) ===');

  process.env.JWT_SECRET = 'test-secret-key-admin-reports-32ch!';
  process.env.PORT = '5028';
  process.env.ADMIN_KEY = TEST_ADMIN_KEY;
  process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
  process.env.CREDITS_ENABLED = 'true';

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  try {
    // 1. Setup akun admin & akun regular
    const adminAccount = await db.insert('accounts', {
      email: ADMIN_EMAIL,
      email_verified_at: new Date().toISOString(),
      is_platform_admin: true
    });
    const adminWs = await db.insert('workspaces', {
      name: 'Admin 3Our Workspace',
      owner_user_id: adminAccount.id
    });

    const userAccountA = await db.insert('accounts', {
      email: 'user.a@testmarkimate.id',
      email_verified_at: new Date().toISOString(),
      is_platform_admin: false
    });
    const wsA = await db.insert('workspaces', {
      name: 'Client Workspace A',
      owner_user_id: userAccountA.id
    });

    const userAccountB = await db.insert('accounts', {
      email: 'user.b@testmarkimate.id',
      email_verified_at: new Date().toISOString(),
      is_platform_admin: false
    });
    const wsB = await db.insert('workspaces', {
      name: 'Client Workspace B',
      owner_user_id: userAccountB.id
    });

    // 2. Setup Entitlements Lifetime
    // Workspace A: memiliki modul 'seo' dan 'ads_report'
    await db.insert('module_entitlements', {
      workspace_id: wsA.id,
      module: 'seo',
      active: true,
      source: 'lifetime',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: null
    });
    await db.insert('module_entitlements', {
      workspace_id: wsA.id,
      module: 'ads_report',
      active: true,
      source: 'lifetime',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: null
    });

    // Workspace B: memiliki modul 'ads_spy'
    await db.insert('module_entitlements', {
      workspace_id: wsB.id,
      module: 'ads_spy',
      active: true,
      source: 'lifetime',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: null
    });

    // Admin Workspace: memiliki semua modul lifetime (internal 3Our, bypass liability)
    await db.insert('module_entitlements', {
      workspace_id: adminWs.id,
      module: 'seo',
      active: true,
      source: 'lifetime',
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: null
    });

    // 3. Setup Aktivitas: Workspace A aktif di periode 2026-10 (menerima monthly_grant), Workspace B tidak aktif
    await db.insert('monthly_grants', {
      workspace_id: wsA.id,
      period: '2026-10',
      credits: 500, // 100 SEO + 400 Ads Report
      granted_at: '2026-10-05T08:00:00Z'
    });

    console.log('Case 1: Hitung Liabilitas Kredit Bulanan (getLifetimeLiability)');
    const liability = await getLifetimeLiability('2026-10');
    assert.strictEqual(liability.period, '2026-10', 'Periode harus 2026-10');
    assert.strictEqual(liability.summary.total_lifetime_owners, 2, 'Total non-admin owners adalah 2 (A & B)');
    assert.strictEqual(liability.summary.active_lifetime_owners, 1, 'Active lifetime owners hanya 1 (A)');
    assert.strictEqual(liability.summary.internal_admin_workspaces, 1, 'Admin workspace terdeteksi 1');

    // Cek detail modul SEO
    const seoMod = liability.by_module.seo;
    assert.strictEqual(seoMod.total_owners, 1);
    assert.strictEqual(seoMod.active_owners, 1);
    assert.strictEqual(seoMod.monthly_credits_per_owner, 100);
    assert.strictEqual(seoMod.cogs_per_credit_real, 56);
    assert.strictEqual(seoMod.active_committed_credits, 100);
    assert.strictEqual(seoMod.liability_real_idr, 5600); // 100 * Rp56
    assert.strictEqual(seoMod.liability_buffer_idr, 10000); // 100 * Rp100

    // Cek detail modul Ads Report
    const adsRepMod = liability.by_module.ads_report;
    assert.strictEqual(adsRepMod.total_owners, 1);
    assert.strictEqual(adsRepMod.active_owners, 1);
    assert.strictEqual(adsRepMod.monthly_credits_per_owner, 400);
    assert.strictEqual(adsRepMod.cogs_per_credit_real, 4);
    assert.strictEqual(adsRepMod.active_committed_credits, 400);
    assert.strictEqual(adsRepMod.liability_real_idr, 1600); // 400 * Rp4
    assert.strictEqual(adsRepMod.liability_buffer_idr, 40000); // 400 * Rp100

    // Cek detail modul Ads Spy (Workspace B tidak aktif bulan ini)
    const adsSpyMod = liability.by_module.ads_spy;
    assert.strictEqual(adsSpyMod.total_owners, 1);
    assert.strictEqual(adsSpyMod.active_owners, 0);
    assert.strictEqual(adsSpyMod.active_committed_credits, 0);
    assert.strictEqual(adsSpyMod.liability_real_idr, 0);
    assert.strictEqual(adsSpyMod.total_committed_credits, 100);
    assert.strictEqual(adsSpyMod.max_liability_real_idr, 6200); // 100 * Rp62
    assert.strictEqual(adsSpyMod.max_liability_buffer_idr, 10000); // 100 * Rp100

    // Cek Summary
    assert.strictEqual(liability.summary.total_active_committed_credits, 500); // 100 + 400
    assert.strictEqual(liability.summary.total_max_committed_credits, 600); // 100 + 400 + 100
    assert.strictEqual(liability.summary.total_liability_real_idr, 7200); // 5.600 + 1.600
    assert.strictEqual(liability.summary.total_liability_buffer_idr, 50000); // 500 * 100
    assert.strictEqual(liability.summary.actual_granted_credits_this_month, 500);
    console.log('✓ Liabilitas kredit bulanan berhasil dihitung akurat!');

    console.log('Case 2: Hitung Bauran Pendapatan (getRevenueMix)');
    // Masukkan data payments
    await db.insert('payments', {
      workspace_id: wsA.id,
      kind: 'module',
      item_id: 'focus3',
      item_name: 'Bundle Fokus 3',
      amount: 4490000,
      provider: 'doku',
      invoice_number: 'MKM-M-261010-001',
      status: 'paid',
      paid_at: '2026-10-10T12:00:00Z',
      created_at: '2026-10-10T12:00:00Z'
    });

    await db.insert('payments', {
      workspace_id: wsA.id,
      kind: 'topup',
      item_id: 'custom_topup',
      item_name: 'Custom Topup (1000 Credits)',
      amount: 950000,
      credits: 1000,
      provider: 'doku',
      invoice_number: 'MKM-T-261015-002',
      status: 'paid',
      paid_at: '2026-10-15T15:00:00Z',
      created_at: '2026-10-15T15:00:00Z'
    });

    await db.insert('payments', {
      workspace_id: wsB.id,
      kind: 'topup',
      item_id: 'custom_topup',
      item_name: 'Failed Custom Topup',
      amount: 50000,
      credits: 50,
      provider: 'doku',
      invoice_number: 'MKM-T-261016-003',
      status: 'failed', // Harusnya diabaikan karena failed
      created_at: '2026-10-16T10:00:00Z'
    });

    // Payment historis bulan sebelumnya (September)
    await db.insert('payments', {
      workspace_id: wsB.id,
      kind: 'subscription',
      item_id: 'growth',
      item_name: 'Growth Subscription',
      amount: 799000,
      provider: 'doku',
      invoice_number: 'MKM-S-260920-004',
      status: 'paid',
      paid_at: '2026-09-20T10:00:00Z',
      created_at: '2026-09-20T10:00:00Z'
    });

    const revMix = await getRevenueMix('2026-10');
    assert.strictEqual(revMix.period, '2026-10');

    // Bulan berjalan: 4.490.000 (module) + 950.000 (topup) = 5.440.000
    assert.strictEqual(revMix.this_month.total_revenue_idr, 5440000);
    assert.strictEqual(revMix.this_month.module.revenue_idr, 4490000);
    assert.strictEqual(revMix.this_month.topup.revenue_idr, 950000);
    assert.strictEqual(revMix.this_month.subscription.revenue_idr, 0);
    assert.strictEqual(revMix.this_month.module.pct, 82.5); // 4490000 / 5440000 = 82.5%
    assert.strictEqual(revMix.this_month.topup.pct, 17.5); // 950000 / 5440000 = 17.5%

    // All-time: 5.440.000 + 799.000 = 6.239.000
    assert.strictEqual(revMix.all_time.total_revenue_idr, 6239000);
    assert.strictEqual(revMix.all_time.module.revenue_idr, 4490000);
    assert.strictEqual(revMix.all_time.topup.revenue_idr, 950000);
    assert.strictEqual(revMix.all_time.subscription.revenue_idr, 799000);
    assert.strictEqual(revMix.all_time.module.pct, 72.0); // 4490000 / 6239000 = 71.96% -> 72%
    assert.strictEqual(revMix.all_time.topup.pct, 15.2);
    assert.strictEqual(revMix.all_time.subscription.pct, 12.8);

    assert(revMix.monthly_history.length >= 2, 'History harus berisi minimal 2 bulan (2026-10 dan 2026-09)');
    console.log('✓ Bauran pendapatan (Revenue Mix) berhasil dihitung akurat!');

    console.log('Case 3: Integrasi calculateUsageAndMargin menyertakan liabilitas & revenue mix');
    const marginResult = await calculateUsageAndMargin('2026-10');
    assert(marginResult.lifetime_liability, 'Margin result harus menyertakan lifetime_liability');
    assert(marginResult.revenue_mix, 'Margin result harus menyertakan revenue_mix');
    assert.strictEqual(marginResult.lifetime_liability.summary.total_liability_real_idr, 7200);
    assert.strictEqual(marginResult.revenue_mix.this_month.total_revenue_idr, 5440000);
    console.log('✓ calculateUsageAndMargin terintegrasi sempurna!');

    console.log('Case 4: HTTP API endpoint /api/admin/reports/lifetime-liability');
    // Non-admin request ditolak 401
    const unauthRes = await req('/api/admin/reports/lifetime-liability');
    assert.strictEqual(unauthRes.status, 401, 'Unauthorized request harus 401');

    // Admin request dengan X-Admin-Key berhasil 200
    const adminRes = await req('/api/admin/reports/lifetime-liability?month=2026-10', {
      headers: {
        'x-admin-key': TEST_ADMIN_KEY
      }
    });
    assert.strictEqual(adminRes.status, 200, 'Admin request harus 200 OK');
    assert.strictEqual(adminRes.data.period, '2026-10');
    assert(adminRes.data.liability);
    assert(adminRes.data.revenue_mix);
    assert.strictEqual(adminRes.data.liability.summary.active_lifetime_owners, 1);
    assert.strictEqual(adminRes.data.revenue_mix.this_month.module.revenue_idr, 4490000);
    console.log('✓ HTTP endpoint GET /api/admin/reports/lifetime-liability lolos 100%!');

    console.log('\n🎉 SELURUH TEST ADMIN LIFETIME REPORTS LOLOS 100%!\n');
    process.exit(0);
  } finally {
    if (standaloneTmp && fs.existsSync(standaloneTmp)) {
      try {
        fs.unlinkSync(standaloneTmp);
      } catch (_) {}
    }
  }
}

runAdminReportsTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
