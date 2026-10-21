// Test Suite: Validasi Penempatan Gambar Kontekstual & Fallback (PRD F6b Bagian 5)
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const terapkanCode = fs.readFileSync(path.resolve(__dirname, '../../automation/src/main-terapkan-link.js'), 'utf8');

function runTerapkanLink(article, options, parsedGemini) {
  const context = {
    $: (nodeName) => {
      if (nodeName === 'Susun Artikel') return { first: () => ({ json: { article: JSON.parse(JSON.stringify(article)) } }) };
      if (nodeName === 'Siapkan Prompt Link') return { first: () => ({ json: { wantImages: options.imageCount, internalCandidates: [], externalCandidates: [] } }) };
      if (nodeName === 'Cek Duplikat') return { first: () => ({ json: { options } }) };
      throw new Error('Unknown node: ' + nodeName);
    },
    $input: {
      first: () => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(parsedGemini) }] } }] } })
    },
    console
  };

  const wrapped = `(function() {\n${terapkanCode}\n})()`;
  const script = new vm.Script(wrapped);
  const vmContext = vm.createContext(context);
  const result = script.runInContext(vmContext);
  return JSON.parse(JSON.stringify(result[0].json));
}

async function runPlacementTests() {
  console.log('=== RUNNING N8N CONTEXTUAL IMAGE PLACEMENT TESTS (PRD F6b Bagian 5) ===\n');

  // Kasus 1: mode none -> 0 gambar, tanpa placeholder
  console.log('1. Menguji mode none (0 gambar)...');
  const article1 = {
    title: 'Panduan SEO Pemula',
    bodyMarkdown: '# Judul\n\nIntro paragraf 1.\n\nIntro paragraf 2.\n\n## Bagian Satu\n\nIsi bagian satu.\n\n## Bagian Dua\n\nIsi bagian dua.'
  };
  const options1 = { imageMode: 'none', imageCount: 0, imageHero: false };
  const gemini1 = {
    internal: [],
    external: [],
    imagePrompts: [{ idx: 0, placement: 'h2:1', prompt: 'Deskripsi gambar', alt: 'Alt 1' }]
  };
  const res1 = runTerapkanLink(article1, options1, gemini1);
  assert.strictEqual(res1.article.imagePrompts.length, 0, 'Mode none harus menghasilkan 0 image prompts');
  assert.ok(!res1.article.bodyMarkdown.includes('markimate:image:'), 'Body markdown tidak boleh memiliki placeholder');
  console.log('   ✓ Mode none berhasil diverifikasi (0 gambar).\n');

  // Kasus 2: artikel dengan 2 H2 dan count 5 -> hero + 2 H2 + fallback intro + warning (tanpa crash)
  console.log('2. Menguji artikel dengan 2 H2 dan permintaan count 5 (fallback intro & warning)...');
  const article2 = {
    title: 'Strategi Konten B2B',
    bodyMarkdown: '# Judul\n\nIntro kalimat 1.\n\nIntro kalimat 2.\n\n## Riset Pasar\n\nPenjelasan riset pasar.\n\n## Eksekusi Kampanye\n\nPenjelasan eksekusi.'
  };
  const options2 = { imageMode: 'auto', imageCount: 5, imageHero: true };
  const gemini2 = {
    internal: [],
    external: [],
    imagePrompts: [
      { idx: 0, placement: 'hero', prompt: 'Hero image', alt: 'Hero' },
      { idx: 1, placement: 'h2:1', prompt: 'Image H2 1', alt: 'Riset' },
      { idx: 2, placement: 'h2:2', prompt: 'Image H2 2', alt: 'Eksekusi' },
      { idx: 3, placement: 'h2:3', prompt: 'Image H2 3', alt: 'Kelebihan slot' },
      { idx: 4, placement: 'h2:4', prompt: 'Image H2 4', alt: 'Kelebihan slot lagi' }
    ]
  };
  const res2 = runTerapkanLink(article2, options2, gemini2);
  // Total gambar yang berhasil: hero (idx 0) + h2:1 + h2:2 + intro (fallback) = 4 gambar (gambar ke-5 dilewati karena slot habis)
  assert.strictEqual(res2.article.imagePrompts.length, 4, 'Harus terbentuk tepat 4 gambar (hero, 2 H2, 1 intro fallback)');
  assert.strictEqual(res2.article.imagePrompts[0].placement, 'hero');
  assert.strictEqual(res2.article.imagePrompts[0].aspect, '16:9');
  assert.strictEqual(res2.article.imagePrompts[1].placement, 'h2:1');
  assert.strictEqual(res2.article.imagePrompts[1].aspect, '4:3');
  assert.strictEqual(res2.article.imagePrompts[2].placement, 'h2:2');
  assert.strictEqual(res2.article.imagePrompts[3].placement, 'intro');
  assert.ok(res2.warnings.some(w => w.includes('lebih sedikit')), 'Harus memuat warning H2 lebih sedikit');
  assert.ok(res2.warnings.some(w => w.includes('dilewati')), 'Harus memuat warning gambar dilewati');
  console.log('   ✓ Fallback intro dan pencegahan crash 100% bekerja.\n');

  // Kasus 3: placement duplikat -> otomatis dipindah ke H2 kosong terdekat
  console.log('3. Menguji koreksi placement duplikat...');
  const article3 = {
    title: 'Tips Produktivitas',
    bodyMarkdown: '# Tips\n\nIntro.\n\n## Perencanaan\n\nIsi rencana.\n\n## Prioritas\n\nIsi prioritas.\n\n## Evaluasi\n\nIsi evaluasi.'
  };
  const options3 = { imageMode: 'auto', imageCount: 3, imageHero: false };
  const gemini3 = {
    internal: [],
    external: [],
    imagePrompts: [
      { idx: 0, placement: 'h2:1', prompt: 'Rencana', alt: 'Alt 1' },
      { idx: 1, placement: 'h2:1', prompt: 'Duplikat rencana', alt: 'Alt 2' }, // duplikat h2:1
      { idx: 2, placement: 'h2:3', prompt: 'Evaluasi', alt: 'Alt 3' }
    ]
  };
  const res3 = runTerapkanLink(article3, options3, gemini3);
  assert.strictEqual(res3.article.imagePrompts.length, 3);
  const placements = res3.article.imagePrompts.map(p => p.placement);
  assert.deepStrictEqual(placements, ['h2:1', 'h2:2', 'h2:3'], 'Placement duplikat h2:1 harus dialihkan ke h2:2 yang kosong');
  assert.ok(res3.warnings.some(w => w.includes('dialihkan')), 'Harus mencatat warning pengalihan');
  console.log('   ✓ Placement duplikat berhasil dipindahkan ke H2 kosong terdekat.\n');

  console.log('🎉 SEMUA PENGUJIAN PENEMPATAN GAMBAR N8N LOLOS 100%!\n');
  process.exit(0);
}

runPlacementTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
