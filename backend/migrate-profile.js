require("dotenv").config();
const pool = require("./db/pool");

const COLUMNS = [
  { name: "display_name",      ddl: "VARCHAR(255) NULL AFTER username" },
  { name: "profile_photo_url", ddl: "VARCHAR(1000) NULL" },
  { name: "org_logo_url",      ddl: "VARCHAR(1000) NULL" },
  { name: "org_name",          ddl: "VARCHAR(255) NULL" },
];

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = ?
        AND COLUMN_NAME  = ?`,
    [table, column],
  );
  return rows[0].cnt > 0;
}

async function ensureColumn(table, name, ddl) {
  if (await columnExists(table, name)) {
    console.log(`  • ${table}.${name} already exists — skipping`);
    return;
  }
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${ddl}`);
  console.log(`  ✓ added ${table}.${name}`);
}

(async () => {
  try {
    console.log("[migrate-profile] adding profile columns to maritime_admin...");
    for (const c of COLUMNS) {
      await ensureColumn("maritime_admin", c.name, c.ddl);
    }
    // Backfill display_name from username on rows where it's null,
    // so existing users don't see an empty greeting after the upgrade.
    const [r] = await pool.query(
      `UPDATE maritime_admin
          SET display_name = username
        WHERE display_name IS NULL OR display_name = ''`,
    );
    if (r.affectedRows) {
      console.log(`  ✓ backfilled display_name for ${r.affectedRows} row(s)`);
    }
    console.log("[migrate-profile] done.");
    process.exit(0);
  } catch (err) {
    console.error("[migrate-profile] failed:", err.message);
    process.exit(1);
  }
})();