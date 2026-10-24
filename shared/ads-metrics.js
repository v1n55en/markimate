// shared/ads-metrics.js
// Pustaka metrics iklan (Meta Ads & rancangan Google Ads).
// Modul JS murni, tanpa dependensi eksternal, digunakan oleh backend, frontend, dan n8n.

export const BASE_METRICS = {
  spend: {
    id: 'spend',
    unit: 'currency',
    agg: 'sum',
    sources: { meta: 'spend', google: 'metrics.cost_micros / 1e6' },
    labels: { en: 'Amount Spent', id: 'Biaya Iklan' }
  },
  impressions: {
    id: 'impressions',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'impressions', google: 'metrics.impressions' },
    labels: { en: 'Impressions', id: 'Impresi' }
  },
  reach: {
    id: 'reach',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'reach', google: null },
    labels: { en: 'Reach', id: 'Jangkauan' }
  },
  clicks: {
    id: 'clicks',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'clicks', google: 'metrics.clicks' },
    labels: { en: 'Clicks (All)', id: 'Klik (Semua)' }
  },
  link_clicks: {
    id: 'link_clicks',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'inline_link_clicks', google: 'metrics.clicks' },
    labels: { en: 'Link Clicks', id: 'Klik Tautan' }
  },
  conversions: {
    id: 'conversions',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'actions', google: 'metrics.conversions' },
    labels: { en: 'Conversions', id: 'Konversi' }
  },
  conversion_value: {
    id: 'conversion_value',
    unit: 'currency',
    agg: 'sum',
    sources: { meta: 'action_values', google: 'metrics.conversions_value' },
    labels: { en: 'Conversion Value', id: 'Nilai Konversi' }
  },
  leads: {
    id: 'leads',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'actions.lead', google: null },
    labels: { en: 'Leads', id: 'Prospek (Leads)' }
  },
  purchases: {
    id: 'purchases',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'actions.purchase', google: null },
    labels: { en: 'Purchases', id: 'Pembelian' }
  },
  video_views: {
    id: 'video_views',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'video_play_actions', google: 'metrics.video_views' },
    labels: { en: 'Video Views', id: 'Penayangan Video' }
  },
  results: {
    id: 'results',
    unit: 'number',
    agg: 'sum',
    sources: { meta: 'results', google: 'metrics.conversions' },
    labels: { en: 'Results', id: 'Hasil' }
  },
  purchase_value: {
    id: 'purchase_value',
    unit: 'currency',
    agg: 'sum',
    sources: { meta: 'action_values.purchase', google: null },
    labels: { en: 'Purchase Value', id: 'Nilai Pembelian' }
  }
};

export const DERIVED_METRICS = {
  cost_per_result: {
    id: 'cost_per_result',
    unit: 'currency',
    formula: 'spend / results',
    calculate: (m) => safeDivide(m.spend, m.results),
    labels: { en: 'Cost per Result', id: 'Biaya per Hasil' }
  },
  cost_per_purchase: {
    id: 'cost_per_purchase',
    unit: 'currency',
    formula: 'spend / purchases',
    calculate: (m) => safeDivide(m.spend, m.purchases),
    labels: { en: 'Cost per Purchase', id: 'Biaya per Pembelian' }
  },
  ctr: {
    id: 'ctr',
    unit: 'percent',
    formula: 'clicks / impressions',
    calculate: (m) => safeDivide(m.clicks, m.impressions),
    labels: { en: 'CTR (All)', id: 'CTR' }
  },
  cpc: {
    id: 'cpc',
    unit: 'currency',
    formula: 'spend / clicks',
    calculate: (m) => safeDivide(m.spend, m.clicks),
    labels: { en: 'CPC (All)', id: 'CPC' }
  },
  cpm: {
    id: 'cpm',
    unit: 'currency',
    formula: '(spend / impressions) * 1000',
    calculate: (m) => {
      const res = safeDivide(m.spend, m.impressions);
      return res !== null ? res * 1000 : null;
    },
    labels: { en: 'CPM', id: 'CPM' }
  },
  cpa: {
    id: 'cpa',
    unit: 'currency',
    formula: 'spend / conversions',
    calculate: (m) => safeDivide(m.spend, m.conversions),
    labels: { en: 'CPA', id: 'CPA (Biaya per Konversi)' }
  },
  roas: {
    id: 'roas',
    unit: 'ratio',
    formula: 'conversion_value / spend',
    calculate: (m) => safeDivide(m.conversion_value, m.spend),
    labels: { en: 'ROAS', id: 'ROAS' }
  },
  frequency: {
    id: 'frequency',
    unit: 'ratio',
    platform: 'meta',
    formula: 'impressions / reach',
    calculate: (m) => (m.reach ? safeDivide(m.impressions, m.reach) : null),
    labels: { en: 'Frequency', id: 'Frekuensi' }
  },
  conv_rate: {
    id: 'conv_rate',
    unit: 'percent',
    formula: 'conversions / clicks',
    calculate: (m) => safeDivide(m.conversions, m.clicks),
    labels: { en: 'Conversion Rate', id: 'Tingkat Konversi' }
  }
};

export const ALL_METRICS = { ...BASE_METRICS, ...DERIVED_METRICS };

export function isKnownMetric(id) {
  return Boolean(ALL_METRICS[id]);
}

export function safeDivide(numerator, denominator) {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) {
    return null;
  }
  const num = Number(numerator);
  const den = Number(denominator);
  if (isNaN(num) || isNaN(den) || den === 0) {
    return null;
  }
  return num / den;
}

/**
 * Agregasi baris data mentah ke metrics terhitung.
 * Menghitung base metrics dari SUM baris, lalu menghitung derived metrics dari SUM tersebut
 * (bukan rata-rata rasio per baris).
 */
export function aggregateRows(rows = [], { customMetrics = [] } = {}) {
  const sums = {};
  for (const key of Object.keys(BASE_METRICS)) {
    sums[key] = 0;
  }

  let rowCount = 0;
  for (const row of rows) {
    if (!row) continue;
    rowCount++;
    for (const key of Object.keys(BASE_METRICS)) {
      const val = row[key];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        sums[key] += Number(val);
      }
    }
  }

  // Jika tidak ada data sama sekali
  const result = {};
  for (const key of Object.keys(BASE_METRICS)) {
    result[key] = rowCount > 0 ? sums[key] : null;
  }

  // Hitung derived metrics dari jumlah agregat
  for (const [key, def] of Object.entries(DERIVED_METRICS)) {
    result[key] = def.calculate(result);
  }

  // Hitung custom metrics jika ada
  if (Array.isArray(customMetrics)) {
    for (const cm of customMetrics) {
      if (!cm || !cm.id || !cm.formula) continue;
      const customKey = cm.id.startsWith('custom:') ? cm.id : `custom:${cm.id}`;
      try {
        result[customKey] = evaluateFormula(cm.formula, result);
      } catch {
        result[customKey] = null;
      }
    }
  }

  return result;
}

// =====================================================================
// FORMULA PARSER & EVALUATOR (Shunting-Yard, tanpa eval / new Function)
// =====================================================================

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN'
};

const OPERATORS = {
  '+': { precedence: 1, assoc: 'L', fn: (a, b) => a + b },
  '-': { precedence: 1, assoc: 'L', fn: (a, b) => a - b },
  '*': { precedence: 2, assoc: 'L', fn: (a, b) => a * b },
  '/': { precedence: 2, assoc: 'L', fn: (a, b) => safeDivide(a, b) }
};

/**
 * Tokenize string formula
 */
export function tokenizeFormula(formula) {
  if (typeof formula !== 'string') {
    throw { message: 'Formula must be a string', position: 0 };
  }
  if (formula.length > 200) {
    throw { message: 'Formula exceeds maximum length of 200 characters', position: 200 };
  }

  const tokens = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(', position: i });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')', position: i });
      i++;
      continue;
    }

    if (ch in OPERATORS) {
      // Penanganan unari minus: jika '-' berada di awal atau setelah '(' atau operator lain
      const prev = tokens[tokens.length - 1];
      if (ch === '-' && (!prev || prev.type === TOKEN_TYPES.LPAREN || prev.type === TOKEN_TYPES.OPERATOR)) {
        // Anggap sebagai 0 - x dengan menyisipkan token 0 dan minus
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: 0, position: i });
      }
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: ch, position: i });
      i++;
      continue;
    }

    // Number literal (integer atau float)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(formula[i + 1] || ''))) {
      const start = i;
      let numStr = '';
      let hasDot = false;
      while (i < formula.length) {
        const c = formula[i];
        if (/[0-9]/.test(c)) {
          numStr += c;
          i++;
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          numStr += c;
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(numStr), position: start });
      continue;
    }

    // Identifier (nama metric dasar atau turunan)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      let ident = '';
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        ident += formula[i];
        i++;
      }

      // Tolak referensi custom: lain untuk mencegah siklus
      if (ident.toLowerCase().startsWith('custom')) {
        throw { message: 'Custom metrics cannot reference other custom metrics', position: start };
      }

      tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: ident, position: start });
      continue;
    }

    // Karakter ilegal (misal: ;, &, $, dsb)
    throw { message: `Unexpected character: '${ch}'`, position: i };
  }

  return tokens;
}

/**
 * Validasi sintaks formula dan identifier yang dipakai.
 */
export function validateFormula(formula) {
  if (!formula || typeof formula !== 'string' || !formula.trim()) {
    return { valid: false, error: 'Formula cannot be empty', position: 0 };
  }
  if (formula.length > 200) {
    return { valid: false, error: 'Formula exceeds maximum length of 200 characters', position: 200 };
  }

  let tokens;
  try {
    tokens = tokenizeFormula(formula);
  } catch (err) {
    return { valid: false, error: err.message, position: err.position };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Formula contains no tokens', position: 0 };
  }

  // Validasi identifier adalah metric dasar / turunan yang valid
  for (const t of tokens) {
    if (t.type === TOKEN_TYPES.IDENTIFIER) {
      if (!isKnownMetric(t.value)) {
        return {
          valid: false,
          error: `Unknown metric '${t.value}' in formula`,
          position: t.position
        };
      }
    }
  }

  // Validasi grammar Shunting-Yard
  try {
    const rpn = parseToRPN(tokens);
    if (rpn.length === 0) {
      return { valid: false, error: 'Empty expression', position: 0 };
    }
  } catch (err) {
    return { valid: false, error: err.message, position: err.position };
  }

  return { valid: true };
}

/**
 * Konversi daftar token ke Reverse Polish Notation (RPN) via Shunting-Yard
 */
export function parseToRPN(tokens) {
  const outputQueue = [];
  const operatorStack = [];
  let expectOperand = true;

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];

    if (token.type === TOKEN_TYPES.NUMBER || token.type === TOKEN_TYPES.IDENTIFIER) {
      if (!expectOperand) {
        throw { message: `Unexpected operand '${token.value}'`, position: token.position };
      }
      outputQueue.push(token);
      expectOperand = false;
    } else if (token.type === TOKEN_TYPES.OPERATOR) {
      if (expectOperand) {
        throw { message: `Unexpected operator '${token.value}'`, position: token.position };
      }
      const op1 = token.value;
      const o1 = OPERATORS[op1];

      while (operatorStack.length > 0) {
        const top = operatorStack[operatorStack.length - 1];
        if (top.type === TOKEN_TYPES.OPERATOR) {
          const o2 = OPERATORS[top.value];
          if ((o1.assoc === 'L' && o1.precedence <= o2.precedence) ||
              (o1.assoc === 'R' && o1.precedence < o2.precedence)) {
            outputQueue.push(operatorStack.pop());
            continue;
          }
        }
        break;
      }
      operatorStack.push(token);
      expectOperand = true;
    } else if (token.type === TOKEN_TYPES.LPAREN) {
      operatorStack.push(token);
      expectOperand = true;
    } else if (token.type === TOKEN_TYPES.RPAREN) {
      if (expectOperand) {
        throw { message: "Unexpected ')' before operand", position: token.position };
      }
      let foundMatching = false;
      while (operatorStack.length > 0) {
        const top = operatorStack.pop();
        if (top.type === TOKEN_TYPES.LPAREN) {
          foundMatching = true;
          break;
        }
        outputQueue.push(top);
      }
      if (!foundMatching) {
        throw { message: 'Mismatched parentheses: missing opening bracket', position: token.position };
      }
      expectOperand = false;
    }
  }

  if (expectOperand) {
    const lastPos = tokens.length > 0 ? tokens[tokens.length - 1].position + 1 : 0;
    throw { message: 'Formula ends prematurely with dangling operator or empty bracket', position: lastPos };
  }

  while (operatorStack.length > 0) {
    const top = operatorStack.pop();
    if (top.type === TOKEN_TYPES.LPAREN || top.type === TOKEN_TYPES.RPAREN) {
      throw { message: 'Mismatched parentheses: unclosed bracket', position: top.position };
    }
    outputQueue.push(top);
  }

  return outputQueue;
}

/**
 * Evaluasi formula dengan nilai metric yang diberikan.
 * Mengembalikan number atau null (misal pembagian dengan nol atau nilai metric null).
 */
export function evaluateFormula(formula, metricValues = {}) {
  const validation = validateFormula(formula);
  if (!validation.valid) {
    throw new Error(`Invalid formula: ${validation.error} at position ${validation.position}`);
  }

  const tokens = tokenizeFormula(formula);
  const rpn = parseToRPN(tokens);
  const evalStack = [];

  for (const token of rpn) {
    if (token.type === TOKEN_TYPES.NUMBER) {
      evalStack.push(token.value);
    } else if (token.type === TOKEN_TYPES.IDENTIFIER) {
      const rawVal = metricValues[token.value];
      if (rawVal === null || rawVal === undefined) {
        // Jika operand tidak tersedia / null, hasil formula adalah null
        return null;
      }
      const val = Number(rawVal);
      if (isNaN(val)) return null;
      evalStack.push(val);
    } else if (token.type === TOKEN_TYPES.OPERATOR) {
      if (evalStack.length < 2) {
        return null;
      }
      const b = evalStack.pop();
      const a = evalStack.pop();
      if (a === null || b === null) return null;

      const opDef = OPERATORS[token.value];
      const res = opDef.fn(a, b);
      if (res === null || isNaN(res)) {
        return null;
      }
      evalStack.push(res);
    }
  }

  if (evalStack.length !== 1) {
    return null;
  }
  const finalVal = evalStack[0];
  return finalVal === null || isNaN(finalVal) ? null : finalVal;
}
