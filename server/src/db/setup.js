// Usage: npm run db:setup   - creates all tables (safe to re-run)
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database schema is ready.');
  } catch (err) {
    console.error('Schema setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
