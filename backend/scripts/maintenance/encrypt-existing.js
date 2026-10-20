// Script migrasi massal: Enkripsi kredensial config yang ada di cms_connections ke config_enc & config_iv
import { db, dbMode } from '../../db.js';
import { encrypt } from '../../lib/crypto.js';

async function main() {
  console.log(`[Migrasi] Memulai enkripsi cms_connections (Mode DB: ${dbMode})...`);
  const rows = await db.findMany('cms_connections', {});
  console.log(`[Migrasi] Ditemukan ${rows.length} total baris koneksi CMS.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of rows) {
    try {
      const hasPlain = r.config && typeof r.config === 'object' && Object.keys(r.config).length > 0;
      const alreadyEnc = !!r.config_enc && !!r.config_iv;

      if (hasPlain && !alreadyEnc) {
        const { enc, iv } = encrypt(r.config);
        await db.update('cms_connections', { id: r.id }, {
          config_enc: enc,
          config_iv: iv,
          config: {},
        });
        console.log(`[Migrasi] Berhasil enkripsi id: ${r.id} (${r.cms_type})`);
        migrated++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`[Migrasi] Gagal enkripsi id: ${r.id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`[Migrasi] Selesai: ${migrated} dimigrasi, ${skipped} dilewati, ${errors} error.`);
}

main().catch((err) => {
  console.error('[Migrasi] Fatal error:', err);
  process.exit(1);
});
