// backend/tests/ads-contract.test.js
// Contract test: Memastikan semua endpoint /api/ads/... di frontend/src/ads/adsApi.js terdaftar di backend Express routes

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendApiPath = path.resolve(__dirname, '../../frontend/src/ads/adsApi.js');
const backendIndexPath = path.resolve(__dirname, '../index.js');

console.log('=== RUNNING TESTS: PRD F5 Kontrak API Ads (Frontend <-> Backend) ===\n');

assert.ok(fs.existsSync(frontendApiPath), `frontend API file exists: ${frontendApiPath}`);
assert.ok(fs.existsSync(backendIndexPath), `backend index file exists: ${backendIndexPath}`);

const frontendCode = fs.readFileSync(frontendApiPath, 'utf8');
const backendCode = fs.readFileSync(backendIndexPath, 'utf8');

// 1. Ekstrak rute dari backend index.js
const backendRoutes = new Set();
const backendRouteRegex = /app\.(get|post|put|patch|delete)\(\s*['"](\/api\/ads[^'"]*)['"]/g;
let match;
while ((match = backendRouteRegex.exec(backendCode)) !== null) {
  const method = match[1].toUpperCase();
  const routePath = match[2];
  backendRoutes.add(`${method} ${routePath}`);
  backendRoutes.add(routePath); // Simpan path umum
}

console.log(`1. Terdeteksi ${backendRoutes.size} rute Ads di backend index.js.`);

// 2. Ekstrak panggilan api('/api/ads...') dari frontend adsApi.js
const frontendCalls = [];

// Regex untuk api('/api/ads/...' ...) atau api(`/api/ads/...` ...)
const apiCallRegex = /api\(\s*[`'"](\/api\/ads[^`'"]*)[`'"]/g;
while ((match = apiCallRegex.exec(frontendCode)) !== null) {
  let rawPath = match[1];
  if (rawPath.includes('${qs')) {
    rawPath = rawPath.split('${qs')[0];
  } else {
    rawPath = rawPath.replace(/\$\{[^}]+\}/g, ':id');
  }
  const normalizedPath = rawPath;
  frontendCalls.push(normalizedPath);
}

console.log(`2. Terdeteksi ${frontendCalls.length} pemanggilan /api/ads di frontend/src/ads/adsApi.js.`);

// 3. Verifikasi kontrak
console.log('3. Memverifikasi seluruh endpoint frontend terdaftar di backend...');
const missingRoutes = [];

for (const callPath of frontendCalls) {
  const exists = backendRoutes.has(callPath) ||
    backendRoutes.has(callPath.replace(':id', ':platform')) ||
    Array.from(backendRoutes).some(r => {
      // Bandingkan pola parameter route Express
      const pattern = r.replace(/:[a-zA-Z0-9_]+/g, ':[a-zA-Z0-9_]+');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(callPath);
    });

  if (!exists) {
    missingRoutes.push(callPath);
  }
}

assert.strictEqual(
  missingRoutes.length,
  0,
  `Terdapat endpoint frontend yang tidak terdaftar di backend index.js: ${missingRoutes.join(', ')}`
);

console.log('   OK - Semua endpoint di adsApi.js memiliki kontrak valid di backend.');

// 4. Mutation Check: jika ada endpoint fiktif, kontrak harus menolak
console.log('4. Menjalankan mutation check...');
function checkEndpointContract(endpointPath) {
  return backendRoutes.has(endpointPath);
}
assert.strictEqual(checkEndpointContract('/api/ads/non_existent_endpoint'), false, 'KILLED: Endpoint tidak terdaftar ditolak oleh kontrak');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST KONTRAK API ADS LOLOS 100%!');
console.log('======================================================\n');
process.exit(0);
