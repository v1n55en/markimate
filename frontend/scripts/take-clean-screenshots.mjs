import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../../docs/reports/img');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9222;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function md5(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

async function run() {
  console.log('1. Starting Vite preview server on port 4173...');
  const previewProc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore'
  });

  // Tunggu preview server siap
  await sleep(2500);

  console.log('2. Starting Chrome headless with remote debugging port 9222...');
  const tmpProfile = '/tmp/chrome_profile_' + Date.now();
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=390,844'
  ], { stdio: 'ignore' });

  await sleep(2500);

  // Ambil WebSocket debugger URL via PUT /json/new
  let targetWsUrl = null;
  try {
    const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new`, { method: 'PUT' });
    const target = await listRes.json();
    targetWsUrl = target.webSocketDebuggerUrl;
  } catch (err) {
    console.error('Failed to connect to Chrome debug port:', err.message);
    previewProc.kill();
    chromeProc.kill();
    process.exit(1);
  }

  console.log('3. Connecting WebSocket to Chrome CDP...');
  const ws = new WebSocket(targetWsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    }
  };

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  const tasks = [
    {
      name: 'landing-en-390.png',
      url: 'http://localhost:4173/',
      action: async () => {
        await sleep(1500);
      }
    },
    {
      name: 'landing-id-390.png',
      url: 'http://localhost:4173/id',
      action: async () => {
        await sleep(1500);
      }
    },
    {
      name: 'pricing-en-390.png',
      url: 'http://localhost:4173/',
      action: async () => {
        await sleep(1000);
        await send('Runtime.evaluate', {
          expression: `
            const el = document.getElementById('pricing');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
          `
        });
        await sleep(1000);
      }
    },
    {
      name: 'pricing-id-390.png',
      url: 'http://localhost:4173/id',
      action: async () => {
        await sleep(1000);
        await send('Runtime.evaluate', {
          expression: `
            const el = document.getElementById('pricing');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
          `
        });
        await sleep(1000);
      }
    },
    {
      name: 'role-detail-en-390.png',
      url: 'http://localhost:4173/roles/seo',
      action: async () => {
        await sleep(1500);
      }
    },
    {
      name: 'role-detail-id-390.png',
      url: 'http://localhost:4173/id/roles/seo',
      action: async () => {
        await sleep(1500);
      }
    },
    {
      name: 'verify-en-390.png',
      url: 'http://localhost:4173/verify?token=demo',
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            localStorage.setItem('markimate_lang', 'en');
            document.cookie = 'mk_lang=en; path=/';
          `
        });
        await send('Page.navigate', { url: 'http://localhost:4173/verify?token=demo' });
        await sleep(1500);
      }
    },
    {
      name: 'verify-id-390.png',
      url: 'http://localhost:4173/verify?token=demo',
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            localStorage.setItem('markimate_lang', 'id');
            document.cookie = 'mk_lang=id; path=/';
          `
        });
        await send('Page.navigate', { url: 'http://localhost:4173/verify?token=demo' });
        await sleep(1500);
      }
    }
  ];

  console.log(`4. Capturing ${tasks.length} distinct 390px screenshots...`);
  for (const t of tasks) {
    console.log(`Capturing ${t.name}...`);
    await send('Page.navigate', { url: t.url });
    if (t.action) await t.action();
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const dest = path.join(outDir, t.name);
    fs.writeFileSync(dest, buffer);
    console.log(`✓ Saved ${t.name} (${buffer.length} bytes, MD5: ${md5(dest)})`);
  }

  ws.close();
  previewProc.kill();
  chromeProc.kill();
  console.log('\n🎉 All screenshots captured successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Screenshot run failed:', err);
  process.exit(1);
});
