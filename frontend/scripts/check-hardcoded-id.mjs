import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = [
  'src/pages/app/AccountSettingsPage.jsx',
  'src/pages/app/MembersSettingsPage.jsx',
  'src/components/KeywordManager.jsx',
  'src/components/CmsSettings.jsx',
  'src/pages/billing/CreditWalletPage.jsx',
  'src/components/ads/DataTable.jsx',
  'src/components/ads/StatusChip.jsx',
];

// Kata-kata khas Bahasa Indonesia yang tidak boleh muncul sebagai user-facing text tanpa t(...)
const SUSPICIOUS_ID_PATTERNS = [
  /\b(berhasil|gagal|simpan|ubah|hapus|unduh|undangan|sandi|kredit|anggota|draf|terbit|pembayaran|saldo|paling\s+populer|cukup\s+untuk)\b/i,
  /\b(belum\s+ada\s+data|link\s+luar|terkirim|menunggu\s+persetujuan|perlu\s+dihubungkan)\b/i
];

// String/token yang diperbolehkan karena merupakan key teknis, nama mock status legacy, atau url query
const ALLOWED_MATCHES = [
  "'Diproses':",
  "'Menunggu approve 3Our':",
  "'Terkirim':",
  "'Gagal':",
  "'Dilewati – tidak ada iklan':",
  "confirmWord !== 'HAPUS'",
  "text=Halo",
  "//",
  "/*",
  "*",
  "console."
];

let totalViolations = 0;

console.log('====================================================');
console.log('SCANNING FOR HARDCODED INDONESIAN STRINGS IN TARGET FILES');
console.log('====================================================');

for (const relPath of TARGET_FILES) {
  const absPath = path.join(FRONTEND_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Target file not found: ${relPath}`);
    totalViolations++;
    continue;
  }

  const lines = fs.readFileSync(absPath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // Periksa apakah baris mengandung string yang di-exclude secara sah
    if (ALLOWED_MATCHES.some(m => line.includes(m))) {
      return;
    }

    for (const pattern of SUSPICIOUS_ID_PATTERNS) {
      if (pattern.test(line)) {
        // Cek apakah string ini berada di dalam fungsi t(...) atau t('...', '...')
        // Jika seluruh kemunculan berada di t('...') atau t("..."), abaikan
        const withoutTranslations = line.replace(/t\([^)]*\)/g, '');
        if (pattern.test(withoutTranslations)) {
          console.error(`❌ [${relPath}:${idx + 1}] Hardcoded Indonesian phrase detected:\n   ${trimmed}`);
          totalViolations++;
          break;
        }
      }
    }
  });
}

console.log('----------------------------------------------------');
if (totalViolations > 0) {
  console.error(`FAILED: Found ${totalViolations} hardcoded Indonesian string violation(s).`);
  process.exit(1);
} else {
  console.log(`PASSED: All 7 target frontend files are clean of untranslated Indonesian strings!`);
  process.exit(0);
}
