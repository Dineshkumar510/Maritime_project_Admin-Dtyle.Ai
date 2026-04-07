const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host            : process.env.DB_HOST || 'localhost',
  port            : Number(process.env.DB_PORT) || 3306,
  user            : process.env.DB_USER || 'root',
  password        : process.env.DB_PASS || '',
  database        : process.env.DB_NAME || 'maritime_admin',
  waitForConnections: true,
  connectionLimit : 10,
  queueLimit      : 0,
  timezone        : '+00:00',           // always UTC
  charset         : 'utf8mb4',
});

// Verify connectivity at startup
pool.getConnection()
  .then(conn => { console.log('✅  MySQL connected'); conn.release(); })
  .catch(err  => { console.error('❌  MySQL connection failed:', err.message); process.exit(1); });

module.exports = pool;
