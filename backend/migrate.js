require('dotenv').config();
const pool = require('./db/pool');

async function setup() {
  try {
    console.log('Ensuring ships table exists...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image_url VARCHAR(1000),
        redirect_url VARCHAR(1000) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ ships table created/verified successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create table:', err);
    process.exit(1);
  }
}

setup();
