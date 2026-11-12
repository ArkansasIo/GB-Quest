'use strict';
// Applies every backend/migrations/*.sql file in name order. Each file is idempotent, so running this
// again (for example after an update adds 002_regions_realms.sql) only adds what is missing.
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
(async () => {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log('applied ' + file);
  }
  console.log('GB Quest MMORPG schema is up to date.');
})().catch(error => { console.error('MMORPG migration failed:', error.message); process.exitCode = 1; }).finally(() => pool.end());
