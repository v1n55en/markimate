// Test verifikasi migrasi storage frontend dari supermat_* ke markimate_*
import assert from 'assert';

// Mock localStorage in node environment
const store = {};
global.window = {
  localStorage: {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  }
};

const { storage, getItem, setItem, removeItem } = await import('./storage.js');

console.log('=== RUNNING FRONTEND STORAGE MIGRATION TEST ===');

// Skenario: User login di build lama (data disimpan dengan key supermat_*)
window.localStorage.setItem('supermat_token', 'jwt-token-lama-123');
window.localStorage.setItem('supermat_workspace', 'ws-kopi-makmur');
window.localStorage.setItem('supermat_lang', 'id');
window.localStorage.setItem('supermat_workspaces_v1', JSON.stringify([{ id: 'ws-1' }]));

// 1. Verifikasi getItem membaca key lama dan memindahkannya ke markimate_*
const token = getItem('token');
assert.strictEqual(token, 'jwt-token-lama-123', 'Token harus terbaca dari supermat_token');

// Verifikasi migrasi: key baru ada, key lama dihapus
assert.strictEqual(store['markimate_token'], 'jwt-token-lama-123', 'Key markimate_token harus ada');
assert.strictEqual(store['supermat_token'], undefined, 'Key supermat_token harus sudah dihapus');
console.log('✓ 1. Migrasi token lama berhasil & key supermat_token dibersihkan');

// 2. Verifikasi workspace
const ws = getItem('workspace');
assert.strictEqual(ws, 'ws-kopi-makmur');
assert.strictEqual(store['markimate_workspace'], 'ws-kopi-makmur');
assert.strictEqual(store['supermat_workspace'], undefined);
console.log('✓ 2. Migrasi workspace berhasil');

// 3. Verifikasi bahasa
const lang = getItem('lang');
assert.strictEqual(lang, 'id');
assert.strictEqual(store['markimate_lang'], 'id');
assert.strictEqual(store['supermat_lang'], undefined);
console.log('✓ 3. Migrasi lang berhasil');

// 4. Verifikasi setItem menyimpan langsung ke markimate_* dan menghapus sisa supermat_*
window.localStorage.setItem('supermat_test_key', 'old_val');
setItem('test_key', 'new_val');
assert.strictEqual(store['markimate_test_key'], 'new_val');
assert.strictEqual(store['supermat_test_key'], undefined);
console.log('✓ 4. setItem menyimpan ke markimate_* dan membersihkan key lama');

// 5. Verifikasi removeItem menghapus baik markimate_* maupun supermat_*
setItem('removable', 'val');
removeItem('removable');
assert.strictEqual(store['markimate_removable'], undefined);
assert.strictEqual(store['supermat_removable'], undefined);
console.log('✓ 5. removeItem membersihkan kedua key');

// 6. Migrasikan workspaces_v1
const wss = getItem('workspaces_v1');
assert.ok(wss);
assert.strictEqual(store['supermat_workspaces_v1'], undefined);
assert.ok(store['markimate_workspaces_v1']);

// 7. Verifikasi tidak ada lagi key supermat_* yang tersisa di storage
const remainingSupermatKeys = Object.keys(store).filter(k => k.startsWith('supermat_'));
assert.strictEqual(remainingSupermatKeys.length, 0, `Tidak boleh ada key supermat_* tersisa, ditemukan: ${remainingSupermatKeys}`);
console.log('✓ 6. Semua key berhasil dimigrasikan ke markimate_* (0 supermat_* tersisa)');

console.log('ALL STORAGE MIGRATION TESTS PASSED!');
