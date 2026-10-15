// Unit Test Hosts Helper (PRD Domain + Subdomain App)
import assert from 'assert';
import { isProdDomain, appUrl, siteUrl } from '../src/lib/hosts.js';

console.log('=== RUNNING UNIT TEST: src/lib/hosts.js ===\n');

// 1. Pengujian isProdDomain
assert.strictEqual(isProdDomain('markimate.com'), true, 'markimate.com harus dianggap domain produksi');
assert.strictEqual(isProdDomain('app.markimate.com'), true, 'app.markimate.com harus dianggap domain produksi');
assert.strictEqual(isProdDomain('www.markimate.com'), true, 'www.markimate.com harus dianggap domain produksi');
assert.strictEqual(isProdDomain('markimate-three.vercel.app'), false, 'vercel.app BUKAN domain produksi');
assert.strictEqual(isProdDomain('localhost'), false, 'localhost BUKAN domain produksi');
assert.strictEqual(isProdDomain('127.0.0.1'), false, '127.0.0.1 BUKAN domain produksi');
console.log('✓ 1. isProdDomain terverifikasi akurat');

// 2. Pengujian appUrl & siteUrl di Localhost / Non-Prod (Path Relatif)
assert.strictEqual(appUrl('/login', 'localhost'), '/login');
assert.strictEqual(appUrl('register', 'localhost'), '/register');
assert.strictEqual(siteUrl('/', 'localhost'), '/');
assert.strictEqual(siteUrl('/privacy', 'localhost'), '/privacy');

assert.strictEqual(appUrl('/login', 'markimate-three.vercel.app'), '/login');
assert.strictEqual(siteUrl('/id', 'markimate-three.vercel.app'), '/id');
console.log('✓ 2. Localhost & Vercel.app menghasilkan path relatif');

// 3. Pengujian appUrl & siteUrl di Domain Produksi
assert.strictEqual(appUrl('/login', 'markimate.com'), 'https://app.markimate.com/login');
assert.strictEqual(appUrl('/register', 'markimate.com'), 'https://app.markimate.com/register');
assert.strictEqual(siteUrl('/', 'app.markimate.com'), 'https://markimate.com/');
assert.strictEqual(siteUrl('/privacy', 'app.markimate.com'), 'https://markimate.com/privacy');
assert.strictEqual(siteUrl('/id', 'app.markimate.com'), 'https://markimate.com/id');
console.log('✓ 3. Domain produksi menghasilkan URL absolut lintas host');

console.log('\n====================================================');
console.log('SEMUA PENGUJIAN HOSTS.JS LULUS 100%!');
console.log('====================================================\n');
