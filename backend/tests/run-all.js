import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  'test-schema-contract.js',
  'test-auth.js',
  'test-credits.js',
  'test-step-d-security.js',
  'test-step1-billing-leak.js',
  'test-step1-migration.js',
  'test-step2.js',
  'test-step2-auth.js',
  'test-step2-rename.js',
  'test-step3.js',
  'test-step3-session.js',
  'test-step4.js',
  'test-step4-account.js',
  'test-step5.js',
  'test-step5-workspace.js',
  'test-step6.js',
  'test-step6-members.js',
  'test-step7.js',
  'test-step7-entitlements.js',
  'test-step8.js',
  'test-step8-account-lifecycle.js',
  'test-step9-google-auth.js',
  'test-step12-locale-mailer.js'
];

console.log(`\n======================================================`);
console.log(`🧪 MENJALANKAN SELURUH TEST SUITE BACKEND (${TEST_FILES.length} TESTS)`);
console.log(`======================================================\n`);

const results = [];
let hasFailure = false;

for (let i = 0; i < TEST_FILES.length; i++) {
  const file = TEST_FILES[i];
  const filePath = path.join(__dirname, file);
  const start = Date.now();

  console.log(`[${i + 1}/${TEST_FILES.length}] Menjalankan tests/${file}...`);

  const proc = spawnSync('node', [filePath], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FORCE_LOCAL_DB: 'true',
      SCHEMA_CONTRACT_VALIDATION: 'true'
    },
    stdio: 'inherit'
  });

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

console.log(`\n======================================================`);
console.log(`📊 RINGKASAN HASIL TEST BACKEND`);
console.log(`======================================================`);
for (const res of results) {
  const icon = res.passed ? '✅' : '❌';
  console.log(`${icon} tests/${res.file.padEnd(35)} (${res.duration}s)`);
}

const passedCount = results.filter(r => r.passed).length;
console.log(`\nTotal: ${passedCount}/${TEST_FILES.length} lolos.`);

if (hasFailure) {
  console.error('\n❌ Ada test yang gagal. Silakan periksa log di atas.\n');
  process.exit(1);
} else {
  console.log('\n🎉 SEMUA TEST BACKEND LOLOS 100%!\n');
  process.exit(0);
}
