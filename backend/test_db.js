require('dotenv').config();
const pool = require('./db/pool');
async function test() {
   try {
     const [rows] = await pool.execute('SHOW TABLES LIKE "ships"');
     console.log('Ships table exist check:', rows);
     const [desc] = await pool.execute('DESCRIBE ships');
     console.log('Ships table schema:', desc);
   } catch(e) {
     console.error(e);
   }
   process.exit(0);
}
test();
