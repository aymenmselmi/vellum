import { readConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const config = readConfig();
const pool = createPool(config);
try {
  await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
  const app = await createApp(pool, config);
  const server = app.listen(config.port, config.host, () => console.log(`Vellum is running at ${config.origin}`));
  server.on('error', error => { console.error('Server failed:', error.code || error.name); pool.end().finally(() => process.exit(1)); });
  function shutdown() {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Startup failed. Check .env and run npm run db:migrate. Details:', error.code || error.name);
  await pool.end();
  process.exitCode = 1;
}
