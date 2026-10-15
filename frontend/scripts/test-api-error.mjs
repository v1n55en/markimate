import assert from 'assert';
import { ApiError } from '../src/api.js';
import { en } from '../src/i18n/locales/en/index.js';
import { id } from '../src/i18n/locales/id/index.js';

console.log('=== RUNNING UNIT TEST: ApiError & i18n Centralized Translation ===\n');

// Mock document for EN
global.document = { documentElement: { lang: 'en' } };

const errEn = new ApiError({ code: 'INVALID_CREDENTIALS', error: 'Backend english fallback' }, 401);
assert.strictEqual(errEn.message, en.errors.INVALID_CREDENTIALS, 'EN error message harus cocok dengan kamus EN');
assert.strictEqual(errEn.code, 'INVALID_CREDENTIALS');
console.log('✓ 1. EN ApiError menghasilkan kamus errors.INVALID_CREDENTIALS:', errEn.message);

// Mock document for ID
global.document.documentElement.lang = 'id';

const errId = new ApiError({ code: 'INVALID_CREDENTIALS', error: 'Backend english fallback' }, 401);
assert.strictEqual(errId.message, id.errors.INVALID_CREDENTIALS, 'ID error message harus cocok dengan kamus ID');
assert.strictEqual(errId.code, 'INVALID_CREDENTIALS');
console.log('✓ 2. ID ApiError menghasilkan kamus errors.INVALID_CREDENTIALS:', errId.message);

// Test unknown code fallback
const errUnknown = new ApiError({ code: 'NON_EXISTENT_CODE_XYZ', error: 'Ignored backend message' }, 400);
assert.ok(errUnknown.message.includes(id.errors.UNKNOWN) && errUnknown.message.includes('NON_EXISTENT_CODE_XYZ'), 'Unknown code harus memuat errors.UNKNOWN + code');
console.log('✓ 3. Fallback unknown code memuat kamus UNKNOWN + kode kecil:', errUnknown.message);

// Test standard codes FORBIDDEN & BAD_REQUEST
const errForbidden = new ApiError({ code: 'FORBIDDEN' }, 403);
assert.strictEqual(errForbidden.message, id.errors.FORBIDDEN);
const errBadRequest = new ApiError({ code: 'BAD_REQUEST' }, 400);
assert.strictEqual(errBadRequest.message, id.errors.BAD_REQUEST);
console.log('✓ 4. Kode baru FORBIDDEN & BAD_REQUEST terverifikasi:', errForbidden.message, '|', errBadRequest.message);

console.log('\n====================================================');
console.log('SEMUA PENGUJIAN API ERROR I18N LULUS 100%!');
console.log('====================================================\n');
