#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Import translations
const { en } = await import('../src/i18n/locales/en/index.js');
const { id } = await import('../src/i18n/locales/id/index.js');

const isStrict = process.argv.includes('--strict') || process.env.STRICT_I18N === 'true';

console.log('====================================================');
console.log(`RUNNING i18n VALIDATION CHECK (${isStrict ? 'STRICT MODE' : 'STANDARD MODE'})`);
console.log('====================================================\n');

let errorCount = 0;
let warningCount = 0;

// 1. Flatten dictionary & collect placeholders
function flattenObject(obj, prefix = '', placeholders = {}) {
  let res = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flattenObject(v, full, placeholders));
    } else {
      res[full] = v;
      if (typeof v === 'string') {
        const matches = [...v.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
        placeholders[full] = matches;
      }
    }
  }
  return res;
}

const enPlaceholders = {};
const idPlaceholders = {};
const flatEn = flattenObject(en, '', enPlaceholders);
const flatId = flattenObject(id, '', idPlaceholders);

const enKeys = new Set(Object.keys(flatEn));
const idKeys = new Set(Object.keys(flatId));

// (a) Key Parity Check
console.log('1. Checking Key Parity between EN and ID...');
const missingInId = [...enKeys].filter(k => !idKeys.has(k));
const missingInEn = [...idKeys].filter(k => !enKeys.has(k));

if (missingInId.length > 0) {
  console.error(`❌ Keys in EN missing in ID (${missingInId.length}):`);
  missingInId.forEach(k => console.error(`   - ${k}`));
  errorCount += missingInId.length;
}

if (missingInEn.length > 0) {
  console.error(`❌ Keys in ID missing in EN (${missingInEn.length}):`);
  missingInEn.forEach(k => console.error(`   - ${k}`));
  errorCount += missingInEn.length;
}

if (missingInId.length === 0 && missingInEn.length === 0) {
  console.log(`   OK - Perfect key parity (${enKeys.size} keys in both EN and ID).`);
}

// (b) Placeholder Mismatch Check
console.log('\n2. Checking Placeholder {x} Consistency...');
let placeholderMismatches = 0;
for (const k of enKeys) {
  if (idKeys.has(k)) {
    const pEn = (enPlaceholders[k] || []).join(',');
    const pId = (idPlaceholders[k] || []).join(',');
    if (pEn !== pId) {
      console.error(`❌ Placeholder mismatch for key "${k}":`);
      console.error(`   EN: [${pEn}]`);
      console.error(`   ID: [${pId}]`);
      placeholderMismatches++;
      errorCount++;
    }
  }
}
if (placeholderMismatches === 0) {
  console.log('   OK - All placeholders {param} match consistently across languages.');
}

// (b2) Backend Error Codes Parity Check (PRD F3 Langkah 2)
console.log('\n2b. Checking Backend ERROR_CODES Coverage in errors.js...');
const backendErrorCodesPath = path.resolve(__dirname, '../../backend/lib/error-codes.js');
if (fs.existsSync(backendErrorCodesPath)) {
  const { ERROR_CODES } = await import(backendErrorCodesPath);
  const backendCodes = Object.keys(ERROR_CODES);
  const missingInEn = backendCodes.filter(c => !enKeys.has(`errors.${c}`));
  const missingInId = backendCodes.filter(c => !idKeys.has(`errors.${c}`));

  if (missingInEn.length > 0 || missingInId.length > 0) {
    if (missingInEn.length > 0) {
      console.error(`❌ Backend error code(s) missing in EN errors.js (${missingInEn.length}):`);
      missingInEn.forEach(c => console.error(`   - ${c}`));
      errorCount += missingInEn.length;
    }
    if (missingInId.length > 0) {
      console.error(`❌ Backend error code(s) missing in ID errors.js (${missingInId.length}):`);
      missingInId.forEach(c => console.error(`   - ${c}`));
      errorCount += missingInId.length;
    }
  } else {
    console.log(`   OK - All ${backendCodes.length} backend ERROR_CODES are covered in both EN and ID dictionaries.`);
  }
} else {
  console.log('   Notice: backend/lib/error-codes.js not found, skipping backend code sync check.');
}

// Scan all JS/JSX files in src
function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allSrcFiles = getAllFiles(srcDir);

// (d) Usage Check: t("key") used in code vs dictionary
console.log('\n3. Checking t("key") Usage in Code vs Dictionary...');
const usedKeys = new Set();
let missingUsedKeys = 0;
const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(srcDir, file);
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    usedKeys.add(key);
    // Check if key exists in dictionary
    if (!enKeys.has(key)) {
      console.error(`❌ [${relPath}] Key "${key}" used in code but missing from dictionary.`);
      missingUsedKeys++;
      errorCount++;
    }
  }
}

if (missingUsedKeys === 0) {
  console.log(`   OK - All ${usedKeys.size} referenced keys exist in dictionary.`);
}

// Unused keys warning
const unusedKeys = [...enKeys].filter(k => !usedKeys.has(k) && !k.startsWith('public.') && !k.startsWith('app.'));
if (unusedKeys.length > 0) {
  console.log(`\n⚠️  Notice: ${unusedKeys.length} dictionary keys not directly referenced via static t('...') (may be dynamic or for upcoming steps):`);
  unusedKeys.slice(0, 10).forEach(k => console.log(`   - ${k}`));
  if (unusedKeys.length > 10) console.log(`   ... and ${unusedKeys.length - 10} more.`);
  warningCount += unusedKeys.length;
}

// (c) Forbidden Ternary & Language Switching Anti-pattern Check
console.log('\n4. Checking for Forbidden Ternary / Anti-pattern Expressions...');
// Alasan pengecualian per file (PRD F3 Langkah 3):
// Hanya file yang secara inheren mengelola logika runtime bahasa atau format berbasis locale yang dikecualikan.
const allowedTernaryFiles = new Set([
  // 1. LanguageContext.jsx: Modul inti provider bahasa yang mengevaluasi state lang dan melakukan fallback EN.
  path.resolve(srcDir, 'context/LanguageContext.jsx'),
  // 2. i18n/index.js: Engine terjemahan mandiri non-hook yang membaca preferensi bahasa aktif.
  path.resolve(srcDir, 'i18n/index.js'),
  // 3. format.js: Format mata uang IDR vs USD dan tanggal sesuai spesifikasi locale aktif (Intl.NumberFormat).
  path.resolve(srcDir, 'lib/format.js'),
  // 3. ads/format.js: Format angka & persentase modul ads report sesuai locale aktif.
  path.resolve(srcDir, 'ads/format.js'),
  // 4. roles.js: Metadata konfigurasi peran sistem yang membutuhkan label dwibahasa secara terstruktur.
  path.resolve(srcDir, 'config/roles.js'),
  // 5. pricing.js: Definisi paket harga berbayar yang membedakan format harga IDR/USD.
  path.resolve(srcDir, 'config/pricing.js'),
  // 6. SeoHead.jsx: Tag link kanonik & alternate hreflang SEO (en vs id) untuk crawler search engine.
  path.resolve(srcDir, 'components/common/SeoHead.jsx'),
  // 7. PrivacyPage.jsx: Komponen halaman statis kebijakan privasi dengan tanggal revisi hukum dwibahasa.
  path.resolve(srcDir, 'pages/public/PrivacyPage.jsx'),
  // 8. TermsPage.jsx: Komponen halaman statis syarat ketentuan dengan klausul hukum dwibahasa.
  path.resolve(srcDir, 'pages/public/TermsPage.jsx'),
  // 9. AccountSettingsPage.jsx: Form pemilih bahasa akun di mana perbandingan lang === 'id'|'en' diperlukan untuk dropdown select.
  path.resolve(srcDir, 'pages/app/AccountSettingsPage.jsx')
]);

let ternaryCount = 0;
const ternaryDetails = [];
const forbiddenPatterns = [
  { name: "lang ===/!== 'id'|'en'", regex: /\blang\s*(===|!==)\s*['"](id|en)['"]/ },
  { name: "lang.startsWith('id'|'en')", regex: /\blang\.startsWith\(\s*['"](id|en)['"]\s*\)/ },
  { name: "[lang] bracket indexing", regex: /\[\s*lang\s*\]/ }
];

for (const file of allSrcFiles) {
  if (allowedTernaryFiles.has(path.resolve(file))) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(srcDir, file);

  lines.forEach((line, idx) => {
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(line)) {
        ternaryCount++;
        ternaryDetails.push({ file: relPath, line: idx + 1, pattern: pattern.name, snippet: line.trim() });
        break;
      }
    }
  });
}

if (ternaryCount > 0) {
  console.error(`❌ FATAL: Found ${ternaryCount} forbidden ternary / [lang] expression(s) outside whitelisted files:`);
  ternaryDetails.forEach(d => {
    console.error(`   - [${d.file}:${d.line}] (${d.pattern}): ${d.snippet}`);
  });
  errorCount += ternaryCount;
} else {
  console.log('   OK - Zero forbidden ternaries or [lang] indexing outside whitelisted files!');
}

console.log('\n====================================================');
console.log(`SUMMARY: ${errorCount} Errors, ${warningCount} Warnings.`);
console.log('====================================================\n');

if (errorCount > 0) {
  console.error(`❌ i18n validation FAILED with ${errorCount} errors.`);
  process.exit(1);
} else {
  console.log('✓ i18n validation PASSED successfully!');
  process.exit(0);
}
