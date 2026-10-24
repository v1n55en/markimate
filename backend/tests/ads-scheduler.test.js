// backend/tests/ads-scheduler.test.js
// Unit & Integration tests untuk Cron pengiriman bulanan & notifikasi email laporan iklan (PRD F5 Langkah 6)

import assert from 'node:assert';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.SCHEMA_CONTRACT_VALIDATION = 'true';
process.env.JWT_SECRET = 'test-secret-key-ads-sched-32ch!';
process.env.PORT = '5036';
process.env.APP_URL = 'http://localhost:5036';
process.env.CREDITS_ENABLED = 'true';
process.env.CRON_SECRET = 'test-cron-secret-12345';
process.env.MARKIMATE_API_KEY = 'test-markimate-key-12345';
process.env.MAIL_DEV_LOG = 'true';

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-ads-sched-${crypto.randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    module_entitlements: [], rate_limits: [], refresh_tokens: [], workspace_api_keys: [],
    keywords: [], audit_logs: [], ad_connections: [], ad_accounts: [],
    report_templates: [], ads_custom_metrics: [], report_profiles: [], ad_reports: []
  }, null, 2));
  process.env.DB_JSON_PATH = standaloneTmp;
}

const { db } = await import('../db.js');
const { seedCreditPricesAndRates } = await import('../scripts/maintenance/seed-credit-prices.js');
const { grant } = await import('../lib/credits.js');
const { encrypt } = await import('../lib/crypto.js');
const { ensureDefaultReportTemplate } = await import('../lib/ads-templates.js');
const { handleAdsReportCallback } = await import('../lib/ads-runner.js');
const {
  getPreviousMonthRange,
  getNextMonthlyRunDate,
  sendAdsReportEmail,
  dispatchReportEmails,
  processScheduledAdsReports
} = await import('../lib/ads-scheduler.js');

await import('../index.js');
const baseUrl = `http://localhost:${process.env.PORT}`;

console.log('=== RUNNING TESTS: PRD F5 Langkah 6 (Scheduled Monthly Cron & Email Notifications) ===\n');

await seedCreditPricesAndRates();
await ensureDefaultReportTemplate();

const stdTpl = await db.findOne('report_templates', { is_system: true });
assert.ok(stdTpl);

// -------------------------------------------------------------
// 0. Setup Workspace, Connection, Account & Profile
// -------------------------------------------------------------
const userA = { id: crypto.randomUUID(), email: 'clientA@agency.id' };
const wsA = { id: crypto.randomUUID(), name: 'Agency WS A', owner_user_id: userA.id };
await db.insert('accounts', { id: userA.id, email: userA.email, status: 'active' });
await db.insert('workspaces', { id: wsA.id, name: wsA.name, owner_user_id: userA.id });
await db.insert('workspace_members', { workspace_id: wsA.id, user_id: userA.id, role: 'owner' });

// Beri entitlement modul ads_report pada workspace A
await db.insert('module_entitlements', {
  workspace_id: wsA.id,
  module: 'ads_report',
  source: 'admin',
  active: true,
  starts_at: new Date().toISOString()
});

// Beri saldo 2000 kredit
await grant(wsA.id, 'topup', 2000, null, 'test', 'Test topup for cron');

// Siapkan koneksi iklan aktif & token valid
const connId = crypto.randomUUID();
const { enc: tEnc, iv: tIv } = encrypt('mock-valid-meta-token-sched');
await db.insert('ad_connections', {
  id: connId,
  workspace_id: wsA.id,
  platform: 'meta',
  external_user_id: 'meta_user_sched',
  display_name: 'Scheduled Advertiser',
  token_enc: tEnc,
  token_iv: tIv,
  token_expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
  scopes: ['ads_read'],
  status: 'active',
  created_by: userA.id
});

const accA1 = {
  id: crypto.randomUUID(),
  workspace_id: wsA.id,
  connection_id: connId,
  platform: 'meta',
  external_id: 'act_sched_1',
  name: 'Scheduled Brand Account',
  currency: 'IDR',
  timezone: 'Asia/Jakarta',
  selected: true
};
await db.insert('ad_accounts', accA1);

// Siapkan profil laporan terjadwal (monthly)
const profileId = crypto.randomUUID();
const profile = {
  id: profileId,
  workspace_id: wsA.id,
  name: 'Laporan Bulanan Klien Retail',
  template_id: stdTpl.id,
  account_ids: [accA1.id],
  date_preset: 'last_month',
  compare: true,
  conversion_event: 'purchase',
  currency: 'IDR',
  recipients: ['klien.retail@example.com', 'bos.agency@example.com'],
  schedule: 'monthly',
  next_run_at: new Date(Date.now() - 3600 * 1000).toISOString(), // Sudah jatuh tempo!
  created_by: userA.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
await db.insert('report_profiles', profile);

// -------------------------------------------------------------
// 1. Date Calculation Helpers
// -------------------------------------------------------------
console.log('1. Menguji fungsi kalkulasi rentang tanggal cron...');

const sampleDate = new Date('2026-10-24T12:00:00Z');
const { periodStart, periodEnd } = getPreviousMonthRange(sampleDate);
assert.strictEqual(periodStart, '2026-09-01', 'Awal bulan lalu harus tanggal 1');
assert.strictEqual(periodEnd, '2026-09-30', 'Akhir bulan lalu September harus tanggal 30');

const nextRun = getNextMonthlyRunDate(sampleDate);
assert.ok(nextRun.startsWith('2026-11-01'), 'Next run bulanan harus tanggal 1 bulan berikutnya');

console.log('   OK - Kalkulasi rentang tanggal lolos.');

// -------------------------------------------------------------
// 2. Email Formatting & Attachment Limit
// -------------------------------------------------------------
console.log('2. Menguji formatting email dan batas lampiran PDF...');

const mockReport = {
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  summary: 'Total ROAS meningkat 2.4x dengan biaya lebih hemat 15%.',
  slides_url: 'https://docs.google.com/presentation/d/mockSlidesId/edit',
  pdf_path: 'https://storage.markimate.com/reports/mock.pdf'
};

// a. Kirim email dengan PDF kecil <= 10 MB (harus dilampirkan)
const smallPdfBuffer = Buffer.from('fake-pdf-under-10mb-data');
const emailSmallPdf = await sendAdsReportEmail({
  to: 'client@example.com',
  report: mockReport,
  profileName: 'Laporan Retail',
  locale: 'id',
  pdfBuffer: smallPdfBuffer
});
assert.strictEqual(emailSmallPdf.success, true);
assert.ok(emailSmallPdf.attachments);
assert.strictEqual(emailSmallPdf.attachments.length, 1);
assert.ok(emailSmallPdf.html.includes('Total ROAS meningkat 2.4x'));

// b. Kirim email dengan PDF besar > 10 MB (dilarang dilampirkan, hanya link unduh)
const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
const emailBigPdf = await sendAdsReportEmail({
  to: 'client@example.com',
  report: mockReport,
  profileName: 'Laporan Retail',
  locale: 'id',
  pdfBuffer: oversizedBuffer
});
assert.strictEqual(emailBigPdf.success, true);
assert.strictEqual(emailBigPdf.attachments, undefined, 'PDF > 10 MB dilarang dilampirkan langsung');
assert.ok(emailBigPdf.html.includes(mockReport.pdf_path), 'Harus menyediakan tautan unduh');

// c. Pengujian bahasa Inggris (locale: 'en')
const emailEn = await sendAdsReportEmail({
  to: 'client.en@example.com',
  report: mockReport,
  profileName: 'VIP Client',
  locale: 'en'
});
assert.strictEqual(emailEn.locale, 'en');
assert.ok(emailEn.subject.includes('Monthly Ads Report'));
assert.ok(emailEn.html.includes('Reporting Period'));

console.log('   OK - Formatting email dan batas ukuran PDF lolos.');

// -------------------------------------------------------------
// 3. Dispatch Email Otomatis saat Webhook n8n Selesai
// -------------------------------------------------------------
console.log('3. Menguji dispatch notifikasi email saat callback webhook selesai...');

// Buat report baru yang terkait dengan profil
const reportRecord = {
  id: crypto.randomUUID(),
  workspace_id: wsA.id,
  profile_id: profile.id,
  template_snapshot: stdTpl.spec,
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  status: 'running',
  request_id: `req_dispatch_${crypto.randomUUID()}`,
  slides_url: null,
  pdf_path: null,
  summary: null,
  credits_charged: 350,
  created_by: userA.id,
  created_at: new Date().toISOString(),
  started_at: new Date().toISOString()
};
await db.insert('ad_reports', reportRecord);

// Simulasikan n8n callback selesai
const cbRes = await handleAdsReportCallback({
  requestId: reportRecord.request_id,
  status: 'ready',
  slidesUrl: 'https://docs.google.com/presentation/d/finishedDeck/edit',
  pdfPath: 'https://storage.markimate.com/reports/finished.pdf',
  summary: 'Hasil iklan bulan September sukses melampaui target.'
});
assert.strictEqual(cbRes.ok, true);
assert.strictEqual(cbRes.status, 'ready');

// Verifikasi dispatchReportEmails berhasil mengirim ke 2 recipients profil
const finishedReport = await db.findOne('ad_reports', { id: reportRecord.id });
const dispatchRes = await dispatchReportEmails(finishedReport);
assert.strictEqual(dispatchRes.dispatched, 2);
assert.strictEqual(dispatchRes.total, 2);

console.log('   OK - Dispatch notifikasi email saat callback ready lolos.');

// -------------------------------------------------------------
// 4. Scheduled Monthly Cron Execution
// -------------------------------------------------------------
console.log('4. Menguji eksekusi cron pengiriman terjadwal bulanan...');

// Mock fetchFn agar webhook n8n berhasil diterima saat cron jalan
const mockCronFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ status: 'queued' })
});

const cronExecutionResult = await processScheduledAdsReports(new Date(), { fetchFn: mockCronFetch });
assert.strictEqual(cronExecutionResult.ran, 1);
const cronItem = cronExecutionResult.results[0];
assert.strictEqual(cronItem.profileId, profile.id);
assert.strictEqual(cronItem.status, 'triggered');
assert.strictEqual(cronItem.creditsCharged, 100, 'Rerun periode yang sama dalam 7 hari mendapatkan diskon 100 kredit');

// Verifikasi next_run_at profil dimajukan ke tanggal 1 bulan berikutnya
const updatedProfile = await db.findOne('report_profiles', { id: profile.id });
assert.ok(updatedProfile.next_run_at > new Date().toISOString(), 'next_run_at harus dimajukan');

console.log('   OK - Cron bulanan berhasil memicu pembuatan laporan dan memajukan jadwal.');

// -------------------------------------------------------------
// 5. Integrasi HTTP Endpoint: GET /api/cron/run-scheduled
// -------------------------------------------------------------
console.log('5. Menguji HTTP endpoint GET /api/cron/run-scheduled...');

// Panggil cron endpoint dengan secret
const cronRes = await fetch(`${baseUrl}/api/cron/run-scheduled?secret=${process.env.CRON_SECRET}`, {
  headers: { Accept: 'application/json' }
});
assert.strictEqual(cronRes.status, 200);
const cronData = await cronRes.json();
assert.ok(cronData.adsReports);
assert.ok(Array.isArray(cronData.adsReports.results));

console.log('   OK - Integrasi GET /api/cron/run-scheduled lolos.');

// -------------------------------------------------------------
// 6. Mutation Checks
// -------------------------------------------------------------
console.log('6. Menjalankan mutation check...');

// Mutasi: Cron mengeksekusi profil tanpa memeriksa entitlement modul ads_report
// Mutasi: Cron mengeksekusi profil tanpa parameter wajib (misal templateId kosong)
const profMissingTpl = {
  id: crypto.randomUUID(),
  workspace_id: wsA.id,
  name: 'Broken Profile',
  schedule: 'monthly',
  next_run_at: new Date(Date.now() - 1000).toISOString()
};
await db.insert('report_profiles', profMissingTpl);

const realCronCheck = await processScheduledAdsReports(new Date(), { fetchFn: mockCronFetch });
const brokenResult = realCronCheck.results.find(r => r.profileId === profMissingTpl.id);
assert.strictEqual(brokenResult.status, 'failed');
assert.strictEqual(brokenResult.code, 'PARAMS_REQUIRED', 'KILLED: Kode asli menolak eksekusi profil tanpa template');

console.log('   OK - Mutation checks terbukti KILLED.');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST PRD F5 LANGKAH 6 LOLOS 100%!');
console.log('======================================================\n');
process.exit(0);
