import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './validation.js';

const deriveKey = promisify(scrypt);
const cookieName = 'vellum_session';
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64, scryptOptions);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !/^[0-9a-f]{128}$/.test(hash || '')) return false;
  const key = await deriveKey(password, salt, 64, scryptOptions);
  return timingSafeEqual(Buffer.from(hash, 'hex'), key);
}

export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const memberFields = 'id, name, email, role, suspended';
export const publicMember = row => ({ id: row.id, name: row.name, email: row.email, role: row.role, suspended: row.suspended });

function cookieOptions(config) {
  return { httpOnly: true, sameSite: 'strict', secure: config.production, path: '/' };
}

export async function issueSession(pool, res, memberId, config) {
  const token = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await pool.query(`INSERT INTO sessions(token_hash, member_id, csrf_token, expires_at)
    VALUES ($1, $2, $3, now() + $4 * interval '1 day')`, [tokenHash(token), memberId, csrfToken, config.sessionDays]);
  res.cookie(cookieName, token, { ...cookieOptions(config), maxAge: config.sessionDays * 86400000 });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(cookieName, cookieOptions(config));
}

export function sessionMiddleware(pool) {
  return async (req, res, next) => {
    const cookies = (req.headers.cookie || '').split(';').map(item => item.trim());
    const token = cookies.find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    req.user = null;
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      const result = await pool.query(`SELECT m.id, m.name, m.email, m.role, m.suspended, s.csrf_token, s.token_hash
        FROM sessions s JOIN members m ON m.id = s.member_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT m.suspended AND m.deleted_at IS NULL`, [tokenHash(token)]);
      if (result.rowCount) {
        req.user = publicMember(result.rows[0]);
        req.session = { csrfToken: result.rows[0].csrf_token, hash: result.rows[0].token_hash };
      }
    }
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Veuillez vous connecter pour continuer.');
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Veuillez vous connecter pour continuer.');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Un accès administrateur est nécessaire.');
  next();
}

export function mutationProtection(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if ((req.headers.origin && req.headers.origin !== config.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
      throw new HttpError(403, 'Les demandes doivent provenir de ce site.');
    }
    const contentType = req.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') throw new HttpError(415, 'La requête doit être envoyée au format JSON.');
    const authEntry = ['/auth/login', '/auth/register'].includes(req.path);
    if (req.user && !authEntry && req.headers['x-csrf-token'] !== req.session.csrfToken) {
      throw new HttpError(403, 'Votre session est absente ou a expiré. Actualisez la page et réessayez.');
    }
    next();
  };
}

// Recheck the current role under a lock, so suspension/deletion cannot race a booking.
export async function lockActor(client, memberId, admin = false) {
  const result = await client.query(`SELECT ${memberFields} FROM members
    WHERE id = $1 AND NOT suspended AND deleted_at IS NULL FOR UPDATE`, [memberId]);
  if (!result.rowCount) throw new HttpError(401, 'Votre compte n’est plus actif.');
  if (admin && result.rows[0].role !== 'admin') throw new HttpError(403, 'Un accès administrateur est nécessaire.');
  return result.rows[0];
}
