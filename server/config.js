export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  const origin = env.APP_ORIGIN || `http://localhost:${port}`;
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Run npm run setup, or configure .env.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port.');
  if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
  if (production && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS.');
  const timezone = env.APP_TIMEZONE || 'Africa/Tunis';
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  return {
    port, origin, timezone, production,
    host: env.HOST || '127.0.0.1',
    databaseUrl: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    trustProxy: Number(env.TRUST_PROXY || 0),
    sessionDays: 7,
    authLimit: 20,
    apiLimit: 300
  };
}

export function today(timezone = 'Africa/Tunis') {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
