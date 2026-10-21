import assert from 'node:assert';
import { SupabaseStore, JsonStore } from '../db.js';

console.log('Testing SupabaseStore & JsonStore DB Adapter Contract...');

// 1. Mock Supabase Client untuk melacak pemanggilan method PostgREST
function createMockSupabaseClient() {
  const calls = [];

  class MockQueryBuilder {
    constructor(table, action) {
      this.table = table;
      this.action = action;
      this.filters = [];
      this.selected = false;
      this.isSingle = false;
      this.limitVal = null;
    }
    select(fields = '*') {
      this.selected = true;
      calls.push({ method: 'select', table: this.table, fields });
      return this;
    }
    eq(column, value) {
      this.filters.push({ type: 'eq', column, value });
      calls.push({ method: 'eq', column, value });
      return this;
    }
    is(column, value) {
      this.filters.push({ type: 'is', column, value });
      calls.push({ method: 'is', column, value });
      return this;
    }
    order(col, opts) {
      calls.push({ method: 'order', col, opts });
      return this;
    }
    limit(n) {
      this.limitVal = n;
      calls.push({ method: 'limit', n });
      return this;
    }
    single() {
      this.isSingle = true;
      calls.push({ method: 'single' });
      return Promise.resolve({ data: { id: 'mock-1' }, error: null });
    }
    then(resolve, reject) {
      // Mock resolver untuk operasi await query
      resolve({ data: [{ id: 'mock-1', table: this.table }], error: null, count: 1 });
    }
  }

  const client = {
    from(table) {
      calls.push({ method: 'from', table });
      return {
        select(fields) {
          const qb = new MockQueryBuilder(table, 'select');
          return qb.select(fields);
        },
        update(patch) {
          calls.push({ method: 'update', table, patch });
          return new MockQueryBuilder(table, 'update');
        },
        insert(row) {
          calls.push({ method: 'insert', table, row });
          return new MockQueryBuilder(table, 'insert');
        },
        delete(opts) {
          calls.push({ method: 'delete', table, opts });
          return new MockQueryBuilder(table, 'delete');
        }
      };
    },
    rpc(name, params) {
      calls.push({ method: 'rpc', name, params });
      return Promise.resolve({ data: true, error: null });
    }
  };

  return { client, calls };
}

// TEST 1: Filter null di findOne & findMany wajib memanggil .is(col, null)
{
  const { client, calls } = createMockSupabaseClient();
  const store = new SupabaseStore(client);

  await store.findOne('payments', { id: 'pay-123', fulfilled_at: null });

  const eqCalls = calls.filter(c => c.method === 'eq');
  const isCalls = calls.filter(c => c.method === 'is');

  assert.strictEqual(eqCalls.length, 1, 'Harus ada tepat 1 panggilan .eq()');
  assert.strictEqual(eqCalls[0].column, 'id');
  assert.strictEqual(eqCalls[0].value, 'pay-123');

  assert.strictEqual(isCalls.length, 1, 'Harus ada tepat 1 panggilan .is() untuk filter null');
  assert.strictEqual(isCalls[0].column, 'fulfilled_at');
  assert.strictEqual(isCalls[0].value, null, 'Nilai yang dioper ke .is() harus null');

  // Pastikan TIDAK PERNAH memanggil eq('fulfilled_at', null)
  const forbiddenEqNull = calls.find(c => c.method === 'eq' && c.value === null);
  assert.strictEqual(forbiddenEqNull, undefined, 'DILARANG memanggil .eq() dengan nilai null (harus .is)');
  console.log('✓ Test 1: findOne dengan filter null menghasilkan .is(k, null) lolos');
}

// TEST 2: Update bersyarat dengan filter null wajib menggunakan .is(k, null)
{
  const { client, calls } = createMockSupabaseClient();
  const store = new SupabaseStore(client);

  await store.update('payments', { id: 'pay-456', fulfilled_at: null }, { status: 'paid' });

  const isCalls = calls.filter(c => c.method === 'is');
  assert.strictEqual(isCalls.length, 1, 'Update dengan filter null wajib memanggil .is()');
  assert.strictEqual(isCalls[0].column, 'fulfilled_at');
  assert.strictEqual(isCalls[0].value, null);

  const eqCalls = calls.filter(c => c.method === 'eq');
  assert.strictEqual(eqCalls.length, 1);
  assert.strictEqual(eqCalls[0].column, 'id');
  assert.strictEqual(eqCalls[0].value, 'pay-456');
  console.log('✓ Test 2: update dengan filter null menghasilkan .is(k, null) lolos');
}

// TEST 3: Method claim(table, id, patch, nullCol) memanggil .eq('id', id) dan .is(nullCol, null)
{
  const { client, calls } = createMockSupabaseClient();
  const store = new SupabaseStore(client);

  await store.claim('payments', 'pay-789', { status: 'paid', fulfilled_at: new Date().toISOString() });

  const eqCalls = calls.filter(c => c.method === 'eq');
  const isCalls = calls.filter(c => c.method === 'is');

  assert.strictEqual(eqCalls.some(c => c.column === 'id' && c.value === 'pay-789'), true);
  assert.strictEqual(isCalls.some(c => c.column === 'fulfilled_at' && c.value === null), true);
  console.log('✓ Test 3: claim() pada SupabaseStore memanggil .eq(id) dan .is(fulfilled_at, null) lolos');
}

// TEST 4: Remove dengan filter null wajib memanggil .is(k, null)
{
  const { client, calls } = createMockSupabaseClient();
  const store = new SupabaseStore(client);

  const removedCount = await store.remove('payments', { fulfilled_at: null });

  const deleteCalls = calls.filter(c => c.method === 'delete');
  assert.strictEqual(deleteCalls.length, 1);
  assert.deepStrictEqual(deleteCalls[0].opts, { count: 'exact' });
  assert.strictEqual(removedCount, 1);

  const isCalls = calls.filter(c => c.method === 'is');
  assert.strictEqual(isCalls.length, 1);
  assert.strictEqual(isCalls[0].column, 'fulfilled_at');
  assert.strictEqual(isCalls[0].value, null);
  console.log('✓ Test 4: remove dengan filter null menghasilkan .is(k, null) dan { count: \'exact\' } lolos');
}

// TEST 5: JsonStore claim() bekerja atomik dan menolak klaim kedua
{
  const { randomUUID } = await import('crypto');
  const testDbFile = '/tmp/test_claim_store_' + Date.now() + '.json';
  const jStore = new JsonStore(testDbFile);

  const p1 = await jStore.insert('payments', {
    workspace_id: randomUUID(),
    kind: 'topup',
    item_id: 'starter',
    item_name: 'Starter',
    amount: 500000,
    credits: 500,
    provider: 'doku',
    invoice_number: 'INV-TEST-CLAIM-1',
    status: 'pending',
    fulfilled_at: null
  });

  // Klaim pertama: harus sukses (mengembalikan row)
  const claim1 = await jStore.claim('payments', p1.id, {
    status: 'paid',
    fulfilled_at: new Date().toISOString()
  });
  assert.ok(claim1, 'Klaim pertama harus sukses');
  assert.strictEqual(claim1.status, 'paid');
  assert.ok(claim1.fulfilled_at);

  // Klaim kedua pada id yang sama: harus gagal (mengembalikan null)
  const claim2 = await jStore.claim('payments', p1.id, {
    status: 'paid',
    fulfilled_at: new Date().toISOString()
  });
  assert.strictEqual(claim2, null, 'Klaim kedua harus mengembalikan null karena fulfilled_at sudah tidak null');

  console.log('✓ Test 5: JsonStore claim() berhasil pertama kali dan menolak klaim ganda lolos');
}

console.log('🎉 Semua tes kontrak DB Adapter (SupabaseStore & JsonStore) lolos 100%!\n');
