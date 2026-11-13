import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createPool } from '../server/db.js';
import { readConfig } from '../server/config.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';

export const testAdmin = { email: 'admin@example.test', password: 'Test-Admin-Password-2026!', name: 'Test Admin' };

// Each run owns a fresh schema. The development tables and accounts are untouched.
export async function startFixture() {
  if (process.env.NODE_ENV === 'production' && !process.env.TEST_DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL to a separate development database before running tests in production mode.');
  }
  const env = process.env.TEST_DATABASE_URL ? { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } : process.env;
  const config = { ...readConfig(env), production: false, trustProxy: 0, apiLimit: 10000, authLimit: 1000 };
  const schema = `vellum_test_${randomUUID().replaceAll('-', '')}`;
  const control = createPool(config);
  let pool, server;
  try {
    await control.query(`CREATE SCHEMA "${schema}"`);
    pool = createPool({ ...config, schema });
    await migrate(pool);
    await seed(pool, { ADMIN_EMAIL: testAdmin.email, ADMIN_PASSWORD: testAdmin.password, ADMIN_NAME: testAdmin.name });
    const app = await createApp(pool, config);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    config.origin = `http://127.0.0.1:${server.address().port}`;
    return {
      pool, config, base: config.origin,
      async close() {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await pool.end();
        await control.query(`DROP SCHEMA "${schema}" CASCADE`);
        await control.end();
      }
    };
  } catch (error) {
    if (server) server.close();
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await control.end();
    throw error;
  }
}

export function client(base) {
  let cookie = '', csrf = null;
  return {
    get cookie() { return cookie; },
    async request(path, { method = 'GET', body, headers = {} } = {}) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: base,
          ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const session = response.headers.getSetCookie().find(value => value.startsWith('vellum_session='));
      if (session) cookie = session.split(';')[0];
      const data = response.status === 204 ? null : await response.json();
      return { status: response.status, data, response };
    },
    async bootstrap() {
      const result = await this.request('/bootstrap');
      csrf = result.data.csrfToken;
      return result.data;
    },
    async register(name = 'Test Member') {
      const email = `${randomUUID()}@example.test`, password = 'Good-Password-2026!';
      const result = await this.request('/auth/register', { method: 'POST', body: { name, email, password } });
      if (result.status !== 201) throw new Error(JSON.stringify(result));
      await this.bootstrap();
      return { ...result.data.user, password };
    },
    async login(email = testAdmin.email, password = testAdmin.password, admin = false) {
      const result = await this.request('/auth/login', { method: 'POST', body: { email, password, admin } });
      if (result.status === 200) await this.bootstrap();
      return result;
    }
  };
}

export function futureDate(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
