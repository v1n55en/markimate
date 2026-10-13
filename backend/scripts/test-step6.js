// Test Langkah 6: Midtrans Snap Top-up Sandbox & Webhook Verification (PRD §4.3 & §6)
import assert from 'assert';
import crypto from 'crypto';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

let baseUrl;
const TEST_SERVER_KEY = 'test-midtrans-server-key-step6';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

function computeSignature(orderId, statusCode, grossAmount, serverKey) {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(raw).digest('hex');
}

async function runStep6Tests() {
  console.log('=== RUNNING TEST STEP 6 (Midtrans Snap Top-up & Webhook) ===');

  process.env.NODE_ENV = 'production'; // so signature verification is strictly enforced
  process.env.JWT_SECRET = 'test-secret-key-for-step6';
  process.env.PORT = '5006';
  process.env.CREDITS_ENABLED = 'true';
  process.env.MIDTRANS_SERVER_KEY = TEST_SERVER_KEY;
  process.env.MIDTRANS_CLIENT_KEY = 'test-midtrans-client-key';

  await seedCreditPricesAndRates();

  await import('../index.js');
  baseUrl = `http://localhost:${process.env.PORT}`;

  const testEmail = `step6-${Date.now()}@example.com`;
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: 'password123', name: 'Step 6 Tester' })
  });
  assert.strictEqual(regRes.status, 200, 'Register should succeed');
  const token = regRes.data.token;
  const userId = regRes.data.user.id;
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('1. User registered with 300 trial credits');

  // Test 1: Inisiasi Top-up Paket Growth (Rp1.000.000 / 1.050 credit)
  const topupRes = await request('/api/credits/topup', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ packageId: 'growth' })
  });
  assert.strictEqual(topupRes.status, 200, 'Topup initiation should succeed');
  assert.ok(topupRes.data.orderId, 'Order ID must be returned');
  assert.ok(topupRes.data.token, 'Snap token must be returned');
  const orderId = topupRes.data.orderId;

  // Verifikasi pesanan tercatat di database dengan status 'pending'
  const savedOrder = await db.findOne('credit_orders', { order_id: orderId });
  assert.ok(savedOrder, 'Order should be saved in database');
  assert.strictEqual(savedOrder.status, 'pending', 'Initial status must be pending');
  assert.strictEqual(savedOrder.credits, 1050, 'Package credits must be 1050');
  console.log(`✓ 1. Transaksi Snap dibuat: ${orderId} (pending, 1.050 credit)`);

  // Test 2: Webhook dengan signature PALSU -> Wajib Ditolak 403 Forbidden
  const fakeWebhookRes = await request('/api/webhooks/midtrans', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      status_code: '200',
      gross_amount: '1000000.00',
      transaction_status: 'settlement',
      signature_key: 'invalid-fake-signature-hash'
    })
  });
  assert.strictEqual(fakeWebhookRes.status, 403, 'Webhook with invalid signature must return 403');
  console.log('✓ 2. Webhook dengan signature palsu berhasil ditolak (403 Forbidden)');

  // Test 3: Webhook dengan signature ASLI (SHA512) -> Berhasil Grant +1.050 credit topup
  const grossAmount = '1000000.00';
  const validSignature = computeSignature(orderId, '200', grossAmount, TEST_SERVER_KEY);

  const realWebhookRes = await request('/api/webhooks/midtrans', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      status_code: '200',
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      payment_type: 'qris',
      signature_key: validSignature
    })
  });
  assert.strictEqual(realWebhookRes.status, 200, 'Webhook with valid signature must return 200');
  assert.strictEqual(realWebhookRes.data.paid, true);
  assert.strictEqual(realWebhookRes.data.creditsGranted, 1050);

  // Verifikasi saldo dompet
  const creditsAfterTopup = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditsAfterTopup.status, 200);
  assert.strictEqual(creditsAfterTopup.data.balance.topup, 1050, 'balance_topup should now be 1050');
  assert.strictEqual(creditsAfterTopup.data.balance.total, 1350, 'total balance should be 1350 (300 trial + 1050 topup)');
  assert.ok(creditsAfterTopup.data.expires.topup, 'topup_expires_at must be populated');

  // Verifikasi masa berlaku 365 hari (toleransi +- 2 hari)
  const expDate = new Date(creditsAfterTopup.data.expires.topup);
  const diffDays = Math.round((expDate - Date.now()) / (1000 * 86400));
  assert.ok(diffDays >= 363 && diffDays <= 366, `Top-up must expire in 365 days (got ${diffDays} days)`);
  console.log(`✓ 3. Webhook berhasil: +1.050 credit topup masuk, berlaku 365 hari`);

  // Test 4: Idempotensi Webhook (Retry pengiriman notifikasi dari Midtrans)
  const retryWebhookRes = await request('/api/webhooks/midtrans', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      status_code: '200',
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      payment_type: 'qris',
      signature_key: validSignature
    })
  });
  assert.strictEqual(retryWebhookRes.status, 200);
  assert.strictEqual(retryWebhookRes.data.alreadyPaid, true, 'Retry must return alreadyPaid true');

  // Pastikan saldo TIDAK bertambah dua kali (tetap 1050)
  const creditsAfterRetry = await request('/api/credits', { headers: authHeaders });
  assert.strictEqual(creditsAfterRetry.data.balance.topup, 1050, 'Saldo topup tidak boleh bertambah dua kali');
  console.log('✓ 4. Idempotensi webhook terverifikasi (tidak ada double-grant credit)');

  // Test 5: Verifikasi Ledger mencatat mutasi top-up
  const ledgerRes = await request('/api/credits/ledger', { headers: authHeaders });
  assert.strictEqual(ledgerRes.status, 200);
  const topupEntry = ledgerRes.data.ledger.find(l => l.kind === 'topup' && l.ref_id === orderId);
  assert.ok(topupEntry, 'Ledger must have an entry for the topup order');
  assert.strictEqual(topupEntry.delta, 1050, 'Ledger delta must be +1050');
  assert.strictEqual(topupEntry.bucket, 'topup');
  console.log('✓ 5. Ledger berhasil mencatat mutasi top-up (+1050 cr, bucket topup)');

  console.log('ALL STEP 6 TESTS PASSED!');
  process.exit(0);
}

runStep6Tests().catch(err => {
  console.error('Test Step 6 Failed:', err);
  process.exit(1);
});
