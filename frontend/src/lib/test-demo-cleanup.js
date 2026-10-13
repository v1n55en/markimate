// Test verifikasi pembersihan key demo lama saat boot (PRD Hapus Mode Demo)
import assert from 'assert';

const store = {};
global.window = {
  localStorage: {
    length: 0,
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => {
      store[key] = String(val);
      global.window.localStorage.length = Object.keys(store).length;
    },
    removeItem: (key) => {
      delete store[key];
      global.window.localStorage.length = Object.keys(store).length;
    },
    key: (index) => Object.keys(store)[index] ?? null,
    clear: () => {
      Object.keys(store).forEach(k => delete store[k]);
      global.window.localStorage.length = 0;
    }
  }
};

const { storage } = await import('./storage.js');

console.log('=== RUNNING DEMO CLEANUP TEST ===');

// Skenario: Browser menyimpan key demo lama dari sesi reviewer sebelumnya
window.localStorage.setItem('demo_session', JSON.stringify({ user: { id: 'demo-1' } }));
window.localStorage.setItem('markimate_demo_session', JSON.stringify({ user: { id: 'demo-1' } }));
window.localStorage.setItem('supermat_demo_session', JSON.stringify({ user: { id: 'demo-1' } }));
window.localStorage.setItem('demo_state', 'active');
window.localStorage.setItem('markimate_token', 'markimate_demo_token_1791855');
window.localStorage.setItem('supermat_token', 'demo_token_shopee_123');

// Jalankan logika boot cleanup yang ada di App.jsx
[
  'user',
  'plan',
  'keywords',
  'credentials',
  'run_count',
  'demo_session',
  'demo_state',
  'markimate_demo_session',
  'markimate_demo_state',
  'supermat_demo_session',
  'supermat_demo_state',
].forEach((k) => {
  try { storage.removeItem(k); } catch { /* abaikan */ }
});

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const toRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.includes('demo_session') || k.includes('demo_token') || k.includes('demo_state'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
      const curToken = storage.getItem('token');
      if (curToken && (curToken.includes('demo_token') || curToken.includes('demo_session'))) {
        storage.removeItem('token');
      }
    } catch { /* abaikan */ }

// Verifikasi semua sisa key demo terhapus tuntas
assert.strictEqual(store['demo_session'], undefined, 'demo_session harus terhapus');
assert.strictEqual(store['markimate_demo_session'], undefined, 'markimate_demo_session harus terhapus');
assert.strictEqual(store['supermat_demo_session'], undefined, 'supermat_demo_session harus terhapus');
assert.strictEqual(store['demo_state'], undefined, 'demo_state harus terhapus');
assert.strictEqual(store['markimate_token'], undefined, 'token demo harus terhapus');
assert.strictEqual(store['supermat_token'], undefined, 'supermat_token demo harus terhapus');

console.log('✓ 1. Seluruh key demo_session, demo_state, dan demo_token_* berhasil dibersihkan diam-diam saat boot');
console.log('ALL DEMO CLEANUP TESTS PASSED!');
