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

// (d) Usage Check: t('key') used in code vs dictionary
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

// (c) Legacy Ternary Check: lang === 'id' / lang === 'en'
console.log('\n4. Checking for Legacy lang === "id" / lang === "en" Ternaries...');
const allowedTernaryFiles = [
  path.resolve(srcDir, 'context/LanguageContext.jsx'),
  path.resolve(srcDir, 'lib/format.js')
];

let ternaryCount = 0;
const ternaryDetails = [];
const ternaryRegex = /lang\s*===\s*['"](id|en)['"]/g;

for (const file of allSrcFiles) {
  if (allowedTernaryFiles.includes(path.resolve(file))) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(srcDir, file);

  lines.forEach((line, idx) => {
    if (ternaryRegex.test(line)) {
      ternaryCount++;
      ternaryDetails.push({ file: relPath, line: idx + 1, snippet: line.trim() });
    }
  });
}

if (ternaryCount > 0) {
  console.log(`ℹ️  Found ${ternaryCount} legacy "lang === 'id' / 'en'" expressions across files:`);
  const filesMap = {};
  ternaryDetails.forEach(d => {
    filesMap[d.file] = (filesMap[d.file] || 0) + 1;
  });
  for (const [f, cnt] of Object.entries(filesMap)) {
    console.log(`   - ${f} (${cnt} occurrences) -> slated for migration in Steps 4-7`);
  }

  if (isStrict) {
    console.error(`\n❌ STRICT MODE: ${ternaryCount} unmigrated ternaries found.`);
    errorCount += ternaryCount;
  }
} else {
  console.log('   OK - Zero legacy ternaries in src/!');
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
