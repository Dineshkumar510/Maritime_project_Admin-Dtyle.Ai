require('dotenv').config();
const pool = require('./db/pool');
const { encrypt, decrypt } = require('./utils/crypto');

async function run() {
  console.log('\n🔐  Maritime URL Encryption Migration\n' + '─'.repeat(42));

  const [rows] = await pool.execute('SELECT id, redirect_url FROM ships');
  console.log(`Found ${rows.length} ship(s) in the database.\n`);

  let skipped  = 0;
  let migrated = 0;
  let failed   = 0;

  for (const row of rows) {
    const { id, redirect_url } = row;
    if (isAlreadyEncrypted(redirect_url)) {
      console.log(`  [SKIP]  id=${id}  (already encrypted)`);
      skipped++;
      continue;
    }

    try {
      const encrypted = encrypt(redirect_url);
      await pool.execute('UPDATE ships SET redirect_url = ? WHERE id = ?', [encrypted, id]);
      console.log(`[OK] id=${id}  ${redirect_url.slice(0, 48)}...`);
      migrated++;
    } catch (err) {
      console.error(`[FAIL] id=${id}  ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(42));
  console.log(`Done. Migrated: ${migrated} Skipped: ${skipped} Failed: ${failed}\n`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

function isAlreadyEncrypted(value) {
  if (!value || !value.includes(':')) return false;
  const [ivPart] = value.split(':');
  return ivPart.length === 32 && /^[0-9a-f]+$/i.test(ivPart);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
