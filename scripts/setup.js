import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { localDatabase } from './local-db.js';
import { readConfig } from '../server/config.js';
import { createPool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';

try {
  if (!existsSync('.env') || existsSync('.local/postgres.json')) await localDatabase('start');
  if (existsSync('.env')) loadEnvFile('.env');
  const pool = createPool(readConfig());
  try { await migrate(pool); await seed(pool); } finally { await pool.end(); }
  console.log('Setup complete. Administrator credentials are in .env. Run npm start.');
} catch (error) {
  console.error('Setup failed:', error.code || error.message);
  if (error.stderr) console.error(error.stderr.trim());
  process.exitCode = 1;
}
