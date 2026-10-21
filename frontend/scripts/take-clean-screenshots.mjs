import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../../docs/reports/img');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('1. Starting Backend server on port 5001...');
  const backendProc = spawn('node', ['index.js'], {
    cwd: path.resolve(__dirname, '../../backend'),
    env: { ...process.env, PORT: '5001', FORCE_LOCAL_DB: 'true', NODE_ENV: 'development' },
    stdio: 'ignore'
  });

  console.log('2. Starting Vite preview server on port 4173...');
  const previewProc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore'
  });

  // Tunggu backend dan preview server siap
  await sleep(3000);

  const pages = [
    { name: 'landing-en-390.png', url: 'http://localhost:4173/' },
    { name: 'landing-id-390.png', url: 'http://localhost:4173/id' },
    { name: 'pricing-en-390.png', url: 'http://localhost:4173/pricing' },
    { name: 'pricing-id-390.png', url: 'http://localhost:4173/id/pricing' },
    { name: 'role-detail-en-390.png', url: 'http://localhost:4173/roles/seo' },
    { name: 'role-detail-id-390.png', url: 'http://localhost:4173/id/roles/seo' },
    { name: 'verify-en-390.png', url: 'http://localhost:4173/verify?token=demo' },
    { name: 'verify-id-390.png', url: 'http://localhost:4173/id/verify?token=demo' }
  ];

  console.log('3. Capturing 390px screenshots via Chrome headless...');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const p of pages) {
    const target = path.join(outDir, p.name);
    console.log(`Taking screenshot for ${p.name} (${p.url})...`);
    try {
      execSync(
        `"${chromePath}" --headless --disable-gpu --virtual-time-budget=3000 --window-size=390,844 --screenshot="${target}" "${p.url}"`,
        { stdio: 'ignore' }
      );
      const stat = fs.statSync(target);
      console.log(`✓ Saved ${p.name} (${stat.size} bytes)`);
    } catch (err) {
      console.error(`Failed ${p.name}:`, err.message);
    }
  }

  backendProc.kill();
  previewProc.kill();
  console.log('\n🎉 All screenshots captured successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Screenshot run failed:', err);
  process.exit(1);
});
