// PRD F6b — Susun prompt Gemini Text untuk merumuskan prompt gambar bahasa Inggris dari sectionTitle + sectionText
const body = $json.body || {};
const sectionTitle = String(body.sectionTitle || '').trim();
const sectionText = String(body.sectionText || '').trim();
const style = String(body.style || 'foto editorial realistis, pencahayaan natural, warna hangat, tanpa teks atau logo di dalam gambar').trim();
const aspect = ['16:9', '4:3', '1:1'].includes(String(body.aspect).trim()) ? String(body.aspect).trim() : '4:3';
const alt = String(body.alt || sectionTitle || 'Ilustrasi artikel').trim();
const requestId = String(body.requestId || ('img_' + Date.now().toString(36)));

const sysPrompt = `Kamu editor visual dan prompt engineer text-to-image AI profesional.
Tugasmu: Tulis satu deskripsi prompt gambar dalam bahasa Inggris yang konkret, detail, dan fotorealistik berdasarkan JUDUL BAGIAN dan ISI BAGIAN artikel.

Aturan prompt:
- Bahasa Inggris, 30–60 kata.
- Deskripsikan subjek konkret, latar/setting tempat, pencahayaan alami, komposisi kamera, dan suasana (mood) yang mencerminkan inti materi bagian tersebut.
- Gaya visual: ${style}.
- Dilarang menambahkan teks, tulisan, huruf, angka, kata-kata, watermark, logo, atau wajah tokoh nyata di dalam gambar.
- Hindari konsep abstrak atau metafora yang ambigu. Buat pemandangan nyata yang logis.
- Sesuaikan konteks Indonesia bila relevan.
- Kembalikan HANYA teks prompt bahasa Inggris tersebut tanpa pengantar, tanpa tanda kutip, tanpa markdown.`;

const userContent = `Judul Bagian: ${sectionTitle || '(tanpa judul)'}\nIsi / Ringkasan Bagian: ${sectionText || '(tanpa teks penjelasan)'}`;

return [{ json: {
  sectionTitle,
  sectionText,
  style,
  aspect,
  alt,
  requestId,
  geminiBody: {
    contents: [{
      parts: [
        { text: sysPrompt + '\n\n' + userContent }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 256
    }
  }
} }];
