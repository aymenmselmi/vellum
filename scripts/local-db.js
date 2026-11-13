import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const local = path.join(root, '.local');
const data = path.join(local, 'postgres');
const credentialsFile = path.join(local, 'postgres.json');
const envFile = path.join(root, '.env');

async function findBinaries() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (process.platform === 'win32') {
    const base = path.join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL');
    const versions = await readdir(base).catch(() => []);
    for (const version of versions.sort((a, b) => Number(b) - Number(a))) {
      const bin = path.join(base, version, 'bin');
      if (existsSync(path.join(bin, 'initdb.exe'))) return bin;
    }
  }
  return '';
}

export async function localDatabase(action = 'start') {
  const bin = await findBinaries();
  const executable = name => bin ? path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
  const command = (name, args) => {
    // On Windows the background postgres process can inherit a pipe. Wait for
    // pg_ctl itself with ignored stdio so starting it cannot keep setup hanging.
    if (name === 'pg_ctl') return new Promise((resolve, reject) => {
      const child = spawn(executable(name), args, { windowsHide: true, stdio: 'ignore', cwd: root });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl exited with code ${code}. See .local/postgres.log.`)));
    });
    return run(executable(name), args, { windowsHide: true, maxBuffer: 1024 * 1024, cwd: root });
  };
  if (action === 'stop') {
    if (!existsSync(credentialsFile)) throw new Error('No project-local PostgreSQL instance has been created.');
    await command('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('Project PostgreSQL stopped.');
    return;
  }
  await mkdir(local, { recursive: true });
  let credentials;
  if (existsSync(credentialsFile)) {
    credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  } else {
    const port = Number(process.env.VELLUM_DB_PORT || 55432);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('VELLUM_DB_PORT must be an integer between 1024 and 65535.');
    credentials = { port, adminPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex') };
    await writeFile(credentialsFile, JSON.stringify(credentials), { mode: 0o600, flag: 'wx' });
  }
  if (!existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(local, 'initdb-password');
    await writeFile(passwordFile, credentials.adminPassword, { mode: 0o600 });
    try {
      await command('initdb', ['-D', data, '-U', 'postgres', '--encoding=UTF8', '--locale=C',
        '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', `--pwfile=${passwordFile}`]);
    } finally {
      await unlink(passwordFile).catch(() => {});
    }
  }
  const status = await command('pg_ctl', ['-D', data, 'status']).then(() => true, () => false);
  if (!status) await command('pg_ctl', ['-D', data, '-l', path.join(local, 'postgres.log'),
    '-o', `-h 127.0.0.1 -p ${credentials.port}`, '-w', 'start']);

  const client = new pg.Client({ host: '127.0.0.1', port: credentials.port, user: 'postgres',
    database: 'postgres', password: credentials.adminPassword, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    if (!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='vellum_app'")).rowCount) {
      // Passwords are generated hex strings, never user-controlled SQL fragments.
      await client.query(`CREATE ROLE vellum_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${credentials.appPassword}'`);
    }
    if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='vellum'")).rowCount) {
      await client.query('CREATE DATABASE vellum OWNER vellum_app');
    }
  } finally { await client.end(); }

  if (!existsSync(envFile)) {
    const adminPassword = randomBytes(18).toString('base64url');
    await writeFile(envFile, [
      `DATABASE_URL=postgresql://vellum_app:${credentials.appPassword}@127.0.0.1:${credentials.port}/vellum`,
      'HOST=127.0.0.1', 'PORT=3000', 'APP_ORIGIN=http://localhost:3000', 'APP_TIMEZONE=Africa/Tunis',
      'NODE_ENV=development', 'DATABASE_SSL=false', 'ADMIN_EMAIL=admin@vellum.local',
      'ADMIN_NAME="Vellum Admin"', `ADMIN_PASSWORD=${adminPassword}`, 'TRUST_PROXY=0', ''
    ].join('\n'), { flag: 'wx', mode: 0o600 });
    console.log('Created .env with generated database and administrator credentials.');
  }
  console.log(`Project PostgreSQL is running on 127.0.0.1:${credentials.port}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await localDatabase(process.argv[2] || 'start'); }
  catch (error) {
    console.error('Local database setup failed:', error.code || error.message);
    if (error.stderr) console.error(error.stderr.trim());
    console.error('Install PostgreSQL tools or set PG_BIN. See README.md for an existing database or Docker setup.');
    process.exitCode = 1;
  }
}
