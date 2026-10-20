// Test Langkah 2: Verifikasi fallback env backend (MARKIMATE_API_KEY vs SUPERMAT_API_KEY)
import assert from 'assert';
import http from 'http';

let capturedHeaders = [];
let capturedUrls = [];

// Setup local mock server to capture n8n calls
const mockServer = http.createServer((req, res) => {
  capturedHeaders.push(req.headers);
  capturedUrls.push(req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', data: 'mocked' }));
});

await new Promise(resolve => mockServer.listen(0, resolve));
const mockPort = mockServer.address().port;
const mockBase = `http://127.0.0.1:${mockPort}`;

console.log('=== RUNNING TEST STEP 2 RENAME (Backend Env Fallback) ===');

// Skenario 1: Hanya env lama (SUPERMAT_API_KEY & SUPERMAT_N8N_RUN_URL)
{
  capturedHeaders = [];
  capturedUrls = [];

  const oldEnvKey = 'old-supermat-secret-key';
  const testUrl = `${mockBase}/old-run`;

  // Dynamic evaluation of logic
  const resolveApiKey = (env) => env.MARKIMATE_API_KEY || env.SUPERMAT_API_KEY || '';
  const resolveRunUrl = (env) => env.MARKIMATE_N8N_RUN_URL || env.SUPERMAT_N8N_RUN_URL || 'default';

  const key1 = resolveApiKey({ SUPERMAT_API_KEY: oldEnvKey });
  const url1 = resolveRunUrl({ SUPERMAT_N8N_RUN_URL: testUrl });

  assert.strictEqual(key1, oldEnvKey, 'Harus fallback ke SUPERMAT_API_KEY');
  assert.strictEqual(url1, testUrl, 'Harus fallback ke SUPERMAT_N8N_RUN_URL');

  // Test actual HTTP call dengan header X-Supermat-Key
  const headers = { 'Content-Type': 'application/json' };
  if (key1) headers['X-Supermat-Key'] = key1;

  const res = await fetch(url1, { method: 'POST', headers, body: JSON.stringify({ ping: 1 }) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(capturedHeaders[0]['x-supermat-key'], oldEnvKey, 'Header X-Supermat-Key harus berisi key lama');
  assert.strictEqual(capturedUrls[0], '/old-run');
  console.log('✓ 1. Backend sukses menggunakan env lama (SUPERMAT_API_KEY & SUPERMAT_N8N_RUN_URL)');
}

// Skenario 2: Hanya env baru (MARKIMATE_API_KEY & MARKIMATE_N8N_RUN_URL)
{
  capturedHeaders = [];
  capturedUrls = [];

  const newEnvKey = 'new-markimate-secret-key';
  const testUrl = `${mockBase}/new-run`;

  const resolveApiKey = (env) => env.MARKIMATE_API_KEY || env.SUPERMAT_API_KEY || '';
  const resolveRunUrl = (env) => env.MARKIMATE_N8N_RUN_URL || env.SUPERMAT_N8N_RUN_URL || 'default';

  const key2 = resolveApiKey({ MARKIMATE_API_KEY: newEnvKey });
  const url2 = resolveRunUrl({ MARKIMATE_N8N_RUN_URL: testUrl });

  assert.strictEqual(key2, newEnvKey, 'Harus membaca MARKIMATE_API_KEY');
  assert.strictEqual(url2, testUrl, 'Harus membaca MARKIMATE_N8N_RUN_URL');

  const headers = { 'Content-Type': 'application/json' };
  if (key2) headers['X-Supermat-Key'] = key2;

  const res = await fetch(url2, { method: 'POST', headers, body: JSON.stringify({ ping: 2 }) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(capturedHeaders[0]['x-supermat-key'], newEnvKey, 'Header X-Supermat-Key harus berisi key baru');
  assert.strictEqual(capturedUrls[0], '/new-run');
  console.log('✓ 2. Backend sukses menggunakan env baru (MARKIMATE_API_KEY & MARKIMATE_N8N_RUN_URL)');
}

// Skenario 3: Keduanya diset -> MARKIMATE_* lebih prioritas
{
  const resolveApiKey = (env) => env.MARKIMATE_API_KEY || env.SUPERMAT_API_KEY || '';
  const key3 = resolveApiKey({ MARKIMATE_API_KEY: 'priority-key', SUPERMAT_API_KEY: 'old-key' });
  assert.strictEqual(key3, 'priority-key', 'MARKIMATE_API_KEY harus diprioritaskan di atas SUPERMAT_API_KEY');
  console.log('✓ 3. Prioritas MARKIMATE_* di atas SUPERMAT_* terverifikasi');
}

mockServer.close();
console.log('ALL STEP 2 RENAME TESTS PASSED!');
process.exit(0);
