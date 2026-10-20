import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const vercelIgnorePath = path.join(backendDir, '.vercelignore');

console.log('Testing deploy bundle isolation (verifying no missing runtime imports without ignored files)...');

// 1. Baca aturan di .vercelignore
const ignorePatterns = fs.readFileSync(vercelIgnorePath, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

// 2. Buat direktori tmp
const tmpDir = path.join(os.tmpdir(), `markimate-bundle-${crypto.randomUUID()}`);
fs.mkdirSync(tmpDir, { recursive: true });

try {
  // Salin file/folder dari backend ke tmpDir kecuali node_modules dan file besar
  // Untuk node_modules, kita buat symlink agar import dependencies tetap bekerja cepat
  const entries = fs.readdirSync(backendDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(backendDir, entry.name);
    const destPath = path.join(tmpDir, entry.name);
    if (entry.name === 'node_modules') {
      fs.symlinkSync(srcPath, destPath, 'dir');
    } else if (entry.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // 3. Hapus semua path yang sesuai dengan .vercelignore di tmpDir
  for (const pattern of ignorePatterns) {
    const cleanPattern = pattern.replace(/\/+$/, '');
    if (cleanPattern.includes('*')) {
      // Handle wildcard seperti *.md atau .git*
      const regex = new RegExp('^' + cleanPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      const filesInTmp = fs.readdirSync(tmpDir);
      for (const f of filesInTmp) {
        if (regex.test(f)) {
          fs.rmSync(path.join(tmpDir, f), { recursive: true, force: true });
        }
      }
    } else {
      const target = path.join(tmpDir, cleanPattern);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  }

  // Verifikasi bahwa folder scripts, tests, migrations benar-benar terhapus
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'scripts')), false, 'Folder scripts harus terhapus di bundle');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'tests')), false, 'Folder tests harus terhapus di bundle');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'migrations')), false, 'Folder migrations harus terhapus di bundle');

  // 4. Jalankan import('./api/index.js') dari bundle tmp tersebut
  const entryUrl = pathToFileURL(path.join(tmpDir, 'api/index.js')).href;
  
  // Set DB_JSON_PATH ke file temporary baru di luar tmpDir
  process.env.DB_JSON_PATH = path.join(os.tmpdir(), `tmp-deploy-db-${crypto.randomUUID()}.json`);
  fs.writeFileSync(process.env.DB_JSON_PATH, JSON.stringify({}));
  process.env.NODE_ENV = 'test';
  process.env.FORCE_LOCAL_DB = 'true';
  process.env.VERCEL = '1';

  let importError = null;
  let exportedApp = null;
  try {
    const mod = await import(entryUrl);
    exportedApp = mod.default;
  } catch (err) {
    importError = err;
  }

  if (importError) {
    console.error('Bundle import failed:', importError);
    assert.fail(`Bundle import gagal dengan error: ${importError.code || importError.message}`);
  }

  assert.ok(exportedApp, 'api/index.js harus berhasil mengekspor express app tanpa runtime dependencies ke scripts/tests/migrations');
  console.log('✅ Deploy bundle test PASSED: Runtime bundle mandiri dan bebas dari file yang di-ignore!');

} finally {
  // Cleanup tmpDir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
  if (process.env.DB_JSON_PATH && fs.existsSync(process.env.DB_JSON_PATH)) {
    try { fs.unlinkSync(process.env.DB_JSON_PATH); } catch {}
  }
}
