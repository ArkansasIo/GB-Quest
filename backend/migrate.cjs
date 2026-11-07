'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
(async () => {
  const file = path.join(__dirname, 'migrations', '001_mmorpg_schema.sql');
  await pool.query(fs.readFileSync(file, 'utf8'));
  console.log('GB Quest MMORPG schema is up to date.');
})().catch(error => { console.error('MMORPG migration failed:', error.message); process.exitCode = 1; }).finally(() => pool.end());
