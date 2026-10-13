// Test Langkah 2: Trial Grant saat Register + GET /api/credits + Estimasi
import assert from 'assert';
import { db } from '../db.js';
import { seedCreditPricesAndRates } from './seed-credit-prices.js';

async function testStep2() {
  console.log('--- [TEST] Memulai Uji Langkah 2 ---');
  await seedCreditPricesAndRates();

  // Load app (akan start di PORT jika belum)
  process.env.PORT = '5002';
  await import('../index.js');
  const port = process.env.PORT || '5002';
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server terhubung ke ${baseUrl}`);

  try {
    const testEmail = `test-trial-${Date.now()}@example.com`;
    const testPassword = 'Password123!';

    // 1. Registrasi user baru
    console.log(`1. Registrasi user baru: ${testEmail}...`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        brandName: 'Test Brand',
        niche: 'Fashion'
      })
    });

    assert.strictEqual(regRes.status, 200, 'Registrasi harus berhasil (HTTP 200)');
    const regData = await regRes.json();
    assert(regData.token, 'Token JWT harus dikembalikan');
    const token = regData.token;
    const userId = regData.user.id;

    // 2. Verifikasi credit_trials tercatat
    const trialRecord = await db.findOne('credit_trials', { email: testEmail });
    assert(trialRecord, 'Email harus tercatat di credit_trials');
    assert.strictEqual(trialRecord.workspace_id, userId);
    console.log('✅ 1. Registrasi berhasil dan tercatat di credit_trials');

    // 3. Verifikasi wallet dan ledger
    const wallet = await db.findOne('credit_wallets', { workspace_id: userId });
    assert(wallet, 'Wallet harus otomatis dibuat');
    assert.strictEqual(wallet.balance_trial, 300, 'Saldo trial harus 300 credit');
    assert(wallet.trial_expires_at, 'trial_expires_at harus ada');
    const daysUntilExp = (new Date(wallet.trial_expires_at) - Date.now()) / (24 * 3600 * 1000);
    assert(daysUntilExp >= 6.9 && daysUntilExp <= 7.1, 'Masa berlaku trial harus ~7 hari');

    const ledger = await db.findMany('credit_ledger', { workspace_id: userId, kind: 'grant_trial' });
    assert.strictEqual(ledger.length, 1, 'Harus ada 1 transaksi grant_trial di ledger');
    assert.strictEqual(ledger[0].delta, 300);
    console.log('✅ 2. Wallet mendapatkan 300 credit trial dengan masa berlaku 7 hari');

    // 4. Test GET /api/credits
    const credRes = await fetch(`${baseUrl}/api/credits`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(credRes.status, 200, 'GET /api/credits harus HTTP 200');
    const credData = await credRes.json();
    assert.strictEqual(credData.balance.total, 300);
    assert.strictEqual(credData.balance.trial, 300);
    assert.strictEqual(credData.trial.active, true);
    assert.strictEqual(credData.trial.daysLeft, 7);
    assert.strictEqual(credData.dailyCap, 500);
    assert(credData.prices['seo.article'].credits === 60);
    console.log('✅ 3. GET /api/credits mengembalikan data balance, expires, dailyCap, dan status trial');

    // 5. Test GET /api/credits/estimate
    const estRes = await fetch(`${baseUrl}/api/credits/estimate?action=seo.article&images=3`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(estRes.status, 200, 'GET /api/credits/estimate harus HTTP 200');
    const estData = await estRes.json();
    assert.strictEqual(estData.credits, 75, 'Estimasi seo.article + 3 gambar harus 75 credit');
    console.log('✅ 4. GET /api/credits/estimate mengembalikan estimasi credit komposit (75 credit)');

    // 6. Test proteksi trial duplicate untuk email yang sama
    const { grantTrialIfEligible } = await import('../lib/credits.js');
    const secondClaim = await grantTrialIfEligible('other-user-id', testEmail);
    assert.strictEqual(secondClaim.granted, false, 'Email yang sama tidak boleh menerima trial kedua');
    console.log('✅ 5. Proteksi 1 trial per email terverifikasi berhasil');

    // Cleanup
    await db.remove('accounts', { id: userId });
    await db.remove('credit_wallets', { workspace_id: userId });
    await db.remove('credit_ledger', { workspace_id: userId });
    await db.remove('credit_trials', { email: testEmail });

    console.log('--- SEMUA UJI LANGKAH 2 BERHASIL (5/5) ---');
  } finally {
    // Selesai
  }
}

testStep2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Langkah 2 Gagal:', err);
    process.exit(1);
  });
