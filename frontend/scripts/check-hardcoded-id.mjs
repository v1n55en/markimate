import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_ROOT, 'src');

// Kata-kata khas Bahasa Indonesia yang tidak boleh muncul sebagai user-facing text tanpa t(...)
// Termasuk daftar lengkap dari PRD F3 Penutup
const INDONESIAN_KEYWORDS = [
  'anda',
  'belum',
  'sudah',
  'tidak',
  'batal',
  'pilih',
  'tambah',
  'masukkan',
  'berhasil',
  'gagal',
  'simpan',
  'ubah',
  'hapus',
  'unduh',
  'undangan',
  'sandi',
  'kredit',
  'anggota',
  'draf',
  'terbit',
  'pembayaran',
  'saldo',
  'paling\\s+populer',
  'cukup\\s+untuk',
  'belum\\s+ada\\s+data',
  'link\\s+luar',
  'terkirim',
  'menunggu\\s+persetujuan',
  'perlu\\s+dihubungkan'
];

const ID_REGEX = new RegExp(`\\b(${INDONESIAN_KEYWORDS.join('|')})\\b`, 'i');

// Token teknis yang sah
const ALLOWED_TOKENS = [
  "confirmWord !== 'HAPUS'",
  "text=Halo",
  "console."
];

// Strip komentar JavaScript / JSX menggunakan @babel/parser AST
// Menjaga nomor baris dan posisi karakter tetap presisi
function stripComments(source) {
  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    if (!ast.comments || ast.comments.length === 0) return source;
    const chars = source.split('');
    for (const comment of ast.comments) {
      for (let i = comment.start; i < comment.end; i++) {
        if (chars[i] !== '\n') {
          chars[i] = ' ';
        }
      }
    }
    return chars.join('');
  } catch {
    return source;
  }
}

// Scan seluruh file js dan jsx di src kecuali i18n/locales dan data kamus statis dwibahasa terpusat.
// Alasan pengecualian per file (PRD F3 Poin 6 & F14 Tahap 2 Poin 6):
// 1. src/i18n/locales: Merupakan direktori kamus terjemahan resmi aplikasi (ID & EN).
// 2. src/config/roles.js: Single Source of Truth (SSOT) katalog 16 peran AI dwibahasa
//    yang menyimpan metadata EN dan ID berdampingan (misal name & name_id, description & description_id)
//    untuk konsumsi dinamis helper getLocalizedRoles(lang) tanpa hardcoding di komponen UI.
// 3. src/content/legal-content.js: Dokumen hukum resmi statis dwibahasa (Kebijakan Privasi & Syarat Ketentuan)
//    yang memiliki klausul hukum mengikat: "In the event of discrepancy, the Indonesian version shall prevail"
//    dan dikonsumsi oleh PrivacyPage & TermsPage via helper bahasa terpusat.
const EXCLUDED_DATA_FILES = [
  path.join('src', 'i18n', 'locales'),
  path.join('src', 'content', 'legal-content.js'),
  path.join('src', 'config', 'roles.js')
];

function getFilesToScan(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (EXCLUDED_DATA_FILES.some(ex => full.includes(ex))) {
      continue;
    }
    if (entry.isDirectory()) {
      results = results.concat(getFilesToScan(full));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = getFilesToScan(SRC_DIR);
let totalViolations = 0;

console.log('====================================================');
console.log(`SCANNING ${files.length} FILES IN src/**/*.{js,jsx} FOR HARDCODED INDONESIAN TEXT`);
console.log('====================================================\n');

for (const absPath of files) {
  const relPath = path.relative(FRONTEND_ROOT, absPath);
  const rawContent = fs.readFileSync(absPath, 'utf8');
  const cleanContent = stripComments(rawContent);
  const lines = cleanContent.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (ALLOWED_TOKENS.some(token => line.includes(token))) {
      return;
    }

    if (ID_REGEX.test(line)) {
      // Hanya strip panggilan t('key') atau t('key', { params }).
      // String fallback literal (argumen kedua/ketiga berupa string) TIDAK di-strip
      // agar fallback berbahasa Indonesia di dalam t() tetap terdeteksi sebagai pelanggaran.
      const withoutTranslations = line
        .replace(/t\(\s*['"][a-zA-Z0-9_.]+['"]\s*\)/g, '')
        .replace(/t\(\s*['"][a-zA-Z0-9_.]+['"]\s*,\s*\{[^}]*\}\s*\)/g, '')
        .replace(/<Trans\b[^>]*\/>/g, '');

      if (ID_REGEX.test(withoutTranslations)) {
        const match = withoutTranslations.match(ID_REGEX);
        console.error(`❌ [${relPath}:${idx + 1}] Hardcoded Indonesian word "${match[0]}" detected:\n   ${trimmed}`);
        totalViolations++;
      }
    }
  });
}

console.log('----------------------------------------------------');
if (totalViolations > 0) {
  console.error(`FAILED: Found ${totalViolations} hardcoded Indonesian string violation(s) across src/**/*.{js,jsx}.`);
  process.exit(1);
} else {
  console.log(`✓ PASSED: All ${files.length} src files are completely clean of untranslated Indonesian strings!`);
  process.exit(0);
}
