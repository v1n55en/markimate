// backend/tests/ads-callback-unconfigured.test.js
// Callback laporan iklan harus ditutup (503) bila MARKIMATE_API_KEY / SUPERMAT_API_KEY tidak diset.

import assert from 'node:assert';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.NODE_ENV = 'test';
process.env.FORCE_LOCAL_DB = 'true';
process.env.JWT_SECRET = 'test-secret-key-ads-cb-unconf-32c!';
process.env.PORT = '5039';
process.env.APP_URL = 'http://localhost:5039';
delete process.env.MARKIMATE_API_KEY;
delete process.env.SUPERMAT_API_KEY;

let standaloneTmp = null;
if (!process.env.DB_JSON_PATH) {
  standaloneTmp = path.join(os.tmpdir(), `markimate-test-ads-cb-${crypto.randomUUID()}.json`);
  fs.writeFileSync(standaloneTmp, JSON.stringify({ accounts: [], ad_reports: [], credit_wallets: [], credit_ledger: [] }));
  process.env.DB_JSON_PATH = standaloneTmp;
}

await import('../index.js');

console.log('=== RUNNING TESTS: callback Ads Report tanpa key server ===');
for (const headers of [{}, { 'X-Supermat-Key': '' }, { 'X-Supermat-Key': 'apa-saja' }]) {
  const res = await fetch(`http://localhost:${process.env.PORT}/api/ads/reports/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ requestId: 'req_x', status: 'ready', slidesUrl: 'https://evil.example' })
  });
  assert.strictEqual(res.status, 503, `Tanpa key server callback harus 503 (header: ${JSON.stringify(headers)})`);
}
console.log('   OK - callback 503 saat key server kosong.');
if (standaloneTmp) fs.rmSync(standaloneTmp, { force: true });
process.exit(0);
