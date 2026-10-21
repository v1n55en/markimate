import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const dbJsonPath = path.join(backendDir, 'database.json');

function computeMd5(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

// 1. Dynamic discovery *.test.js
const allFiles = fs.readdirSync(__dirname);
const TEST_FILES = allFiles
  .filter(f => f.endsWith('.test.js'))
  .sort((a, b) => a.localeCompare(b));

console.log(`\n======================================================`);
console.log(`🧪 MENJALANKAN TEST SUITE BACKEND DENGAN ISOLASI DATABASE`);
console.log(`Ditemukan ${TEST_FILES.length} file test (*.test.js)`);
console.log(`======================================================\n`);

// 2. Simpan hash awal database.json
const initialDbMd5 = computeMd5(dbJsonPath);

const results = [];
let hasFailure = false;

for (let i = 0; i < TEST_FILES.length; i++) {
  const file = TEST_FILES[i];
  const filePath = path.join(__dirname, file);
  const start = Date.now();

  console.log(`[${i + 1}/${TEST_FILES.length}] Menjalankan tests/${file}...`);

  // 3. Buat file temporary DB terisolasi di os.tmpdir() dengan skema bersih
  const tmpDbPath = path.join(os.tmpdir(), `markimate-runner-${crypto.randomUUID()}.json`);
  fs.writeFileSync(tmpDbPath, JSON.stringify({
    accounts: [], credit_wallets: [], credit_ledger: [], credit_prices: [],
    credit_cost_rates: [], credit_alerts: [], workspaces: [], workspace_members: [],
    workspace_invites: [], module_entitlements: [], rate_limits: [], refresh_tokens: [],
    workspace_api_keys: [], keywords: [], audit_logs: [], credit_orders: [],
    cms_connections: [], seo_topic_sources: [], credit_trials: [], payments: [], monthly_grants: [],
    subscriptions: [], webhook_events: []
  }, null, 2));

  const proc = spawnSync('node', [filePath], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FORCE_LOCAL_DB: 'true',
      SCHEMA_CONTRACT_VALIDATION: 'true',
      DB_JSON_PATH: tmpDbPath
    },
    stdio: 'inherit'
  });

  // Hapus temporary DB setelah test selesai
  if (fs.existsSync(tmpDbPath)) {
    try { fs.unlinkSync(tmpDbPath); } catch {}
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  if (proc.status === 0) {
    console.log(`✅ tests/${file} PASSED (${duration}s)\n`);
    results.push({ file, passed: true, duration });
  } else {
    console.error(`❌ tests/${file} FAILED with code ${proc.status} (${duration}s)\n`);
    results.push({ file, passed: false, duration });
    hasFailure = true;
  }
}

// 4. Verifikasi md5 database.json tidak berubah
const finalDbMd5 = computeMd5(dbJsonPath);
let dbTampered = false;
if (initialDbMd5 !== finalDbMd5) {
  console.error(`\n❌ ERROR: database.json telah termodifikasi selama pengujian!`);
  console.error(`MD5 Awal  : ${initialDbMd5}`);
  console.error(`MD5 Akhir : ${finalDbMd5}`);
  dbTampered = true;
} else {
  console.log(`🔒 Verifikasi Integritas DB: database.json tidak tersentuh (MD5: ${initialDbMd5})`);
}

console.log(`\n======================================================`);
console.log(`📊 RINGKASAN HASIL TEST BACKEND`);
console.log(`======================================================`);
for (const res of results) {
  const icon = res.passed ? '✅' : '❌';
  console.log(`${icon} tests/${res.file.padEnd(35)} (${res.duration}s)`);
}

const passedCount = results.filter(r => r.passed).length;
console.log(`\nTotal: ${passedCount}/${TEST_FILES.length} lolos.`);

if (hasFailure || dbTampered) {
  console.error('\n❌ Ada test yang gagal atau database terkontaminasi. Silakan periksa log di atas.\n');
  process.exit(1);
} else {
  console.log('\n🎉 SEMUA TEST BACKEND LOLOS 100% TANPA MENGOTORI DATABASE!\n');
  process.exit(0);
}
