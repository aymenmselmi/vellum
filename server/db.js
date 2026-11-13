import pg from 'pg';

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.ssl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    options: config.schema ? `-c search_path=${config.schema},public` : undefined
  });
  pool.on('error', error => console.error('Idle database connection error:', error.code || error.name));
  return pool;
}

export async function transaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
