import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/**
 * Membaca dan mem-parse seluruh migrasi SQL untuk membuat kontrak skema database
 */
export function buildSchemaContract() {
  const schemaContract = {};

  const migrationsDir = path.join(ROOT_DIR, 'migrations');
  const migrationFiles = [path.join(ROOT_DIR, 'supabase.sql')];
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      migrationFiles.push(path.join(migrationsDir, f));
    }
  }

  function ensureTable(tableName) {
    if (!schemaContract[tableName]) {
      schemaContract[tableName] = {
        columns: new Set(),
        notNullNoDefault: new Set(),
        uuidColumns: new Set()
      };
    }
    return schemaContract[tableName];
  }

  for (const filePath of migrationFiles) {
    if (!fs.existsSync(filePath)) continue;
    const sql = fs.readFileSync(filePath, 'utf8');

    // 1. Parse CREATE TABLE
    const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:markimate\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
    let match;
    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const body = match[2];
      const tableDef = ensureTable(tableName);

      const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
      for (const line of lines) {
        if (/^(unique|primary\s+key|constraint|check|foreign\s+key)/i.test(line)) continue;
        const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\(\s*\d+\s*\))?(?:\[\])?)([\s\S]*)/i);
        if (!colMatch) continue;

        const colName = colMatch[1];
        const colType = colMatch[2].toLowerCase();
        const colRest = colMatch[3] || '';

        tableDef.columns.add(colName);
        if (colType === 'uuid') {
          tableDef.uuidColumns.add(colName);
        }

        const isNotNull = /not\s+null/i.test(colRest) || /primary\s+key/i.test(colRest);
        const hasDefault = /default/i.test(colRest) || /gen_random_uuid/i.test(colRest) || /now\(\)/i.test(colRest);
        if (isNotNull && !hasDefault) {
          tableDef.notNullNoDefault.add(colName);
        }
      }
    }

    // 2. Parse ALTER TABLE ... ADD COLUMN
    const alterAddColRegex = /alter\s+table\s+(?:markimate\.)?([a-zA-Z0-9_]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\(\s*\d+\s*\))?(?:\[\])?)([\s\S]*?)(?:;|$)/gi;
    let alterMatch;
    while ((alterMatch = alterAddColRegex.exec(sql)) !== null) {
      const tableName = alterMatch[1];
      const colName = alterMatch[2];
      const colType = alterMatch[3].toLowerCase();
      const colRest = alterMatch[4] || '';

      const tableDef = ensureTable(tableName);
      tableDef.columns.add(colName);
      if (colType === 'uuid') {
        tableDef.uuidColumns.add(colName);
      }

      const isNotNull = /not\s+null/i.test(colRest);
      const hasDefault = /default/i.test(colRest);
      if (isNotNull && !hasDefault) {
        tableDef.notNullNoDefault.add(colName);
      }
    }

    // 3. Parse ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL
    const dropNotNullRegex = /alter\s+table\s+(?:markimate\.)?([a-zA-Z0-9_]+)\s+alter\s+column\s+([a-zA-Z0-9_]+)\s+drop\s+not\s+null/gi;
    let dropMatch;
    while ((dropMatch = dropNotNullRegex.exec(sql)) !== null) {
      const tableName = dropMatch[1];
      const colName = dropMatch[2];
      const tableDef = ensureTable(tableName);
      tableDef.notNullNoDefault.delete(colName);
    }
  }

  // 4. Migrasi 010 menambahkan updated_at ke semua tabel
  for (const table of Object.keys(schemaContract)) {
    schemaContract[table].columns.add('updated_at');
  }

  // Baseline tambahan yang terstandar
  if (schemaContract.accounts) {
    schemaContract.accounts.columns.add('name');
    schemaContract.accounts.columns.add('status');
    schemaContract.accounts.columns.add('email_verified_at');
    schemaContract.accounts.columns.add('password_changed_at');
    schemaContract.accounts.columns.add('failed_login_count');
    schemaContract.accounts.columns.add('locked_until');
    schemaContract.accounts.columns.add('deleted_requested_at');
    schemaContract.accounts.columns.add('google_sub');
    schemaContract.accounts.columns.add('last_login_at');
    schemaContract.accounts.notNullNoDefault.delete('password_hash'); // Migrasi 011
  }

  return schemaContract;
}

let cachedContract = null;
export function getSchemaContract() {
  if (!cachedContract) {
    cachedContract = buildSchemaContract();
  }
  return cachedContract;
}

/**
 * Validasi kontrak skema ketat untuk operasi insert/update
 */
export function validateRowContract(table, row, isInsert = true) {
  const contract = getSchemaContract();
  const tableDef = contract[table];

  // Jika tabel tidak didefinisikan dalam skema SQL
  if (!tableDef) {
    throw new Error(`[SCHEMA CONTRACT] Table "${table}" does not exist in SQL schema.`);
  }

  // (a) Menolak kolom yang tidak ada dalam skema
  for (const col of Object.keys(row)) {
    if (!tableDef.columns.has(col)) {
      throw new Error(`[SCHEMA CONTRACT] Column "${col}" does not exist in table "${table}".`);
    }
  }

  // (b) Menolak insert jika kolom NOT NULL tanpa default tidak diisi
  if (isInsert) {
    for (const requiredCol of tableDef.notNullNoDefault) {
      const val = row[requiredCol];
      if (val === undefined || val === null) {
        throw new Error(`[SCHEMA CONTRACT] Column "${requiredCol}" in table "${table}" is NOT NULL and has no default value.`);
      }
    }
  }

  // (c) Menolak kolom bertipe uuid dengan nilai bukan UUID
  for (const [col, val] of Object.entries(row)) {
    if (tableDef.uuidColumns.has(col) && val !== null && val !== undefined) {
      if (!isUuid(val)) {
        throw new Error(`[SCHEMA CONTRACT] Column "${col}" in table "${table}" is type UUID, but received invalid value: "${val}".`);
      }
    }
  }

  return true;
}
