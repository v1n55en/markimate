/**
 * Konfigurasi Resmi Opsi Artikel SEO Frontend (PRD F6b)
 * Sumber tunggal untuk Tone, Panjang Artikel, Mode Gambar, dan Estimasi Kredit.
 * Wajib identik dengan backend/lib/article-options.js.
 */

export const TONE_PRESETS = {
  professional: {
    id: 'professional',
    labelKey: 'toneProfessional',
    prompts: {
      id: 'Profesional, otoritatif, berbasis data dan fakta, objektif, dengan struktur logis dan teratur.',
      en: 'Professional, authoritative, data-driven and factual, objective, with a logical and structured flow.'
    }
  },
  casual: {
    id: 'casual',
    labelKey: 'toneCasual',
    prompts: {
      id: 'Santai, bersahabat, seperti mengobrol dengan rekan, mudah dipahami, gunakan analogi sehari-hari yang dekat dengan pembaca.',
      en: 'Casual, conversational, friendly like chatting with a colleague, approachable, using relatable everyday analogies.'
    }
  },
  educational: {
    id: 'educational',
    labelKey: 'toneEducational',
    prompts: {
      id: 'Edukatif dan jelas, menjelaskan langkah demi langkah dengan contoh praktis, kalimat aktif, hindari jargon tanpa penjelasan.',
      en: 'Educational and clear, explaining step-by-step with practical examples, active voice, avoiding unexplained jargon.'
    }
  },
  persuasive: {
    id: 'persuasive',
    labelKey: 'tonePersuasive',
    prompts: {
      id: 'Persuasif, menggugah aksi, fokus pada manfaat dan solusi masalah pembaca, dengan sentuhan ajakan bertindak (call-to-action) yang natural.',
      en: 'Persuasive, compelling and action-oriented, focusing on user benefits and problem-solving, with natural calls-to-action.'
    }
  },
  storytelling: {
    id: 'storytelling',
    labelKey: 'toneStorytelling',
    prompts: {
      id: 'Naratif bercerita, menyertakan pembuka studi kasus atau anekdot relevan, alur mengalir emosional namun tetap sarat insight berbobot.',
      en: 'Narrative storytelling, opening with relevant case studies or anecdotes, fluid narrative flow while delivering insightful substance.'
    }
  },
  custom: {
    id: 'custom',
    labelKey: 'toneCustom',
    prompts: {
      id: '',
      en: ''
    }
  }
};

export const ARTICLE_LENGTHS = {
  short: {
    id: 'short',
    words: 600,
    credits: 45,
    actionKey: 'seo.article.short',
    costEstIdr: 2100,
    labelKey: 'lengthShort'
  },
  standard: {
    id: 'standard',
    words: 900,
    credits: 60,
    actionKey: 'seo.article',
    costEstIdr: 2600,
    labelKey: 'lengthStandard'
  },
  long: {
    id: 'long',
    words: 1500,
    credits: 80,
    actionKey: 'seo.article.long',
    costEstIdr: 3400,
    labelKey: 'lengthLong'
  },
  pillar: {
    id: 'pillar',
    words: 2500,
    credits: 110,
    actionKey: 'seo.article.pillar',
    costEstIdr: 4800,
    labelKey: 'lengthPillar'
  }
};

export const IMAGE_MODES = {
  none: { id: 'none', labelKey: 'imageModeNone' },
  auto: { id: 'auto', labelKey: 'imageModeAuto' },
  manual: { id: 'manual', labelKey: 'imageModeManual' }
};

export const CREDIT_PER_IMAGE = 5;

export const DEFAULT_ARTICLE_OPTIONS = {
  tone: {
    preset: 'professional',
    custom: ''
  },
  length: 'standard',
  images: {
    mode: 'auto',
    count: 3,
    hero: true,
    style: 'foto editorial, warna hangat, tanpa teks di gambar'
  }
};

/**
 * Sanitasi dan validasi tone custom di frontend
 */
const FORBIDDEN_TONE_PATTERNS = [
  /\{\{/,
  /\}\}/,
  /`/,
  /https?:\/\//i,
  /ftp:\/\//i,
  /www\./i,
  /\bignore\s+(?:previous|all|the)\b/i,
  /\babaikan\s+(?:instruksi|perintah|semua)\b/i,
  /\bdisregard\b/i,
  /\bforget\s+all\b/i,
  /\bsystem\s+prompt\b/i,
  /\bjailbreak\b/i,
  /\bas\s+an?\s+ai\b/i,
  /^\s*(?:system|assistant|user|prompt)\s*:/i
];

export function sanitizeCustomTone(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);

  if (/[\r\n]/.test(str)) {
    throw Object.assign(new Error('Custom tone cannot contain newlines'), {
      status: 400,
      code: 'INVALID_TONE'
    });
  }

  const trimmed = str.trim();
  if (trimmed.length > 120) {
    throw Object.assign(new Error('Custom tone must be 120 characters or less'), {
      status: 400,
      code: 'INVALID_TONE'
    });
  }

  for (const pattern of FORBIDDEN_TONE_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw Object.assign(
        new Error('Custom tone contains forbidden patterns or keywords'),
        { status: 400, code: 'INVALID_TONE' }
      );
    }
  }

  return trimmed;
}

export function estimateArticleCredits(options = {}) {
  const lenKey = options.length || 'standard';
  const lenConfig = ARTICLE_LENGTHS[lenKey] || ARTICLE_LENGTHS.standard;
  const articleCredits = lenConfig.credits;

  let imageCredits = 0;
  let imageCount = 0;
  const imgMode = options.images?.mode || (options.images?.enabled === false ? 'none' : 'auto');

  if (imgMode !== 'none') {
    imageCount = Math.min(Math.max(Number(options.images?.count) || 3, 1), 6);
    imageCredits = imageCount * CREDIT_PER_IMAGE;
  }

  return {
    length: lenConfig.id,
    words: lenConfig.words,
    articleCredits,
    imageMode: imgMode,
    imageCount,
    imageCredits,
    totalCredits: articleCredits + imageCredits,
    actionKey: lenConfig.actionKey
  };
}

/**
 * Normalisasi opsi artikel per keyword (PRD F6b §3.6)
 */
export function normalizeKeywordArticleOptions(raw = null) {
  if (!raw || typeof raw !== 'object') return null;

  const res = {};

  if (raw.tone && typeof raw.tone === 'object') {
    const preset = TONE_PRESETS[raw.tone.preset] ? raw.tone.preset : 'professional';
    let custom = '';
    if (preset === 'custom') {
      custom = sanitizeCustomTone(raw.tone.custom || '');
    }
    res.tone = { preset, custom };
  }

  if (raw.length) {
    res.length = ARTICLE_LENGTHS[raw.length] ? raw.length : 'standard';
  }

  if (raw.images && typeof raw.images === 'object') {
    const mode = ['none', 'auto', 'manual'].includes(raw.images.mode)
      ? raw.images.mode
      : (raw.images.enabled === false ? 'none' : 'auto');

    const hero = raw.images.hero !== undefined ? !!raw.images.hero : true;
    const count = mode === 'none'
      ? 0
      : Math.min(Math.max(Number(raw.images.count) || 3, 1), 6);
    const style = typeof raw.images.style === 'string' ? raw.images.style.trim() : DEFAULT_ARTICLE_OPTIONS.images.style;

    res.images = {
      mode,
      count,
      hero,
      style
    };
  }

  return Object.keys(res).length > 0 ? res : null;
}

/**
 * Menghasilkan opsi artikel efektif dengan menggabungkan opsi spesifik keyword
 * di atas pengaturan default workspace (PRD F6b §3.6).
 */
export function resolveEffectiveArticleOptions(keywordOptions = null, workspaceArtSet = {}) {
  const wsImages = workspaceArtSet.images || {};
  const wsTone = workspaceArtSet.tone || {};
  const wsLength = workspaceArtSet.length || 'standard';

  const tonePreset = keywordOptions?.tone?.preset || wsTone.preset || DEFAULT_ARTICLE_OPTIONS.tone.preset;
  let toneCustom = '';
  if (tonePreset === 'custom') {
    toneCustom = sanitizeCustomTone(keywordOptions?.tone?.custom ?? wsTone.custom ?? '');
  }
  const tone = { preset: tonePreset, custom: toneCustom };

  const lengthKey = keywordOptions?.length || wsLength;
  const length = ARTICLE_LENGTHS[lengthKey] ? lengthKey : 'standard';

  let mode = keywordOptions?.images?.mode;
  if (!mode) {
    if (wsImages.mode) {
      mode = wsImages.mode;
    } else {
      mode = wsImages.enabled === false ? 'none' : 'auto';
    }
  }
  if (!['none', 'auto', 'manual'].includes(mode)) mode = 'auto';

  const hero = keywordOptions?.images?.hero !== undefined
    ? !!keywordOptions.images.hero
    : (wsImages.hero !== undefined ? !!wsImages.hero : true);

  const rawCount = keywordOptions?.images?.count !== undefined
    ? Number(keywordOptions.images.count)
    : (wsImages.count !== undefined ? Number(wsImages.count) : 3);

  const count = mode === 'none' ? 0 : Math.min(Math.max(rawCount || 3, 1), 6);

  const style = (keywordOptions?.images?.style || wsImages.style || DEFAULT_ARTICLE_OPTIONS.images.style).trim();

  return {
    tone,
    length,
    images: {
      mode,
      count,
      hero,
      style
    }
  };
}

