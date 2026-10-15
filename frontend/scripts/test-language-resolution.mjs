import assert from 'assert';
import { resolveLanguage } from '../src/lib/resolve-language.js';

console.log('=== RUNNING UNIT TEST: src/lib/resolve-language.js ===\n');

// 1. Prefix URL /id/* selalu menang (prioritas 1)
assert.strictEqual(
  resolveLanguage({ path: '/id', accountLocale: 'en', cookie: 'en', storage: 'en' }),
  'id',
  'Path /id harus selalu menghasilkan id'
);
assert.strictEqual(
  resolveLanguage({ path: '/id/', accountLocale: 'en', cookie: 'en', storage: 'en' }),
  'id',
  'Path /id/ harus selalu menghasilkan id'
);
assert.strictEqual(
  resolveLanguage({ path: '/id/privacy', accountLocale: 'en', cookie: 'en', storage: 'en' }),
  'id',
  'Path /id/privacy harus selalu menghasilkan id'
);
assert.strictEqual(
  resolveLanguage({ path: '/id/roles/seo-specialist', accountLocale: 'en', cookie: 'en', storage: 'en' }),
  'id',
  'Path /id/roles/... harus selalu menghasilkan id'
);
console.log('✓ 1. Prioritas 1: Prefix /id/* terverifikasi selalu menghasilkan id');

// 2. accounts.locale setelah login (prioritas 2)
assert.strictEqual(
  resolveLanguage({ path: '/privacy', accountLocale: 'id', cookie: 'en', storage: 'en' }),
  'id',
  'accountLocale id harus mengalahkan cookie & storage'
);
assert.strictEqual(
  resolveLanguage({ path: '/app', accountLocale: 'en', cookie: 'id', storage: 'id' }),
  'en',
  'accountLocale en harus mengalahkan cookie & storage id'
);
console.log('✓ 2. Prioritas 2: accounts.locale terverifikasi mengalahkan cookie dan storage');

// 3. Cookie mk_lang (prioritas 3)
assert.strictEqual(
  resolveLanguage({ path: '/privacy', accountLocale: null, cookie: 'id', storage: 'en' }),
  'id',
  'cookie id harus mengalahkan storage en'
);
assert.strictEqual(
  resolveLanguage({ path: '/login', accountLocale: null, cookie: 'en', storage: 'id' }),
  'en',
  'cookie en harus mengalahkan storage id'
);
console.log('✓ 3. Prioritas 3: Cookie mk_lang terverifikasi mengalahkan localStorage');

// 4. localStorage markimate_lang (prioritas 4)
assert.strictEqual(
  resolveLanguage({ path: '/terms', accountLocale: null, cookie: null, storage: 'id' }),
  'id',
  'storage id harus menghasilkan id'
);
assert.strictEqual(
  resolveLanguage({ path: '/login', accountLocale: null, cookie: null, storage: 'en' }),
  'en',
  'storage en harus menghasilkan en'
);
console.log('✓ 4. Prioritas 4: localStorage markimate_lang terverifikasi dihormati');

// 5. Default en jika tidak ada preferensi (prioritas 5 - tanpa deteksi browser)
assert.strictEqual(
  resolveLanguage({ path: '/', accountLocale: null, cookie: null, storage: null }),
  'en',
  'Kunjungan pertama tanpa preferensi harus default ke en'
);
assert.strictEqual(
  resolveLanguage({ path: '/login', accountLocale: null, cookie: null, storage: null }),
  'en',
  'Halaman auth tanpa preferensi harus default ke en'
);
assert.strictEqual(
  resolveLanguage({ path: '/app', accountLocale: null, cookie: 'unknown', storage: 'es' }),
  'en',
  'Nilai bahasa tidak valid harus fallback ke en'
);
assert.strictEqual(
  resolveLanguage(),
  'en',
  'Panggilan tanpa argumen harus default ke en'
);
console.log('✓ 5. Prioritas 5: Default en terverifikasi tanpa deteksi browser');

console.log('\n====================================================');
console.log('SEMUA PENGUJIAN RESOLVE-LANGUAGE LULUS 100%!');
console.log('====================================================\n');
