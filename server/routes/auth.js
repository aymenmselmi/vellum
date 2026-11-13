import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { parse, loginSchema, registerSchema, HttpError } from '../validation.js';
import { hashPassword, verifyPassword, issueSession, clearSessionCookie, publicMember } from '../security.js';

export async function authRoutes(pool, config, limiter) {
  const router = Router();
  // An expensive dummy check makes missing-account logins follow the same hashing path.
  const dummyHash = await hashPassword(randomUUID());

  router.post('/register', limiter, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const password = await hashPassword(input.password);
    const result = await pool.query(`INSERT INTO members(id, name, email, password_hash)
      VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, suspended`,
    [randomUUID(), input.name, input.email, password]);
    if (req.session) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.session.hash]);
    await issueSession(pool, res, result.rows[0].id, config);
    res.status(201).json({ user: publicMember(result.rows[0]) });
  });

  router.post('/login', limiter, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const result = await pool.query('SELECT * FROM members WHERE email = $1 AND deleted_at IS NULL', [input.email]);
    const member = result.rows[0];
    const valid = await verifyPassword(input.password, member?.password_hash || dummyHash);
    if (!member || !valid) throw new HttpError(401, 'L’adresse e-mail ou le mot de passe est incorrect. Veuillez réessayer.');
    if (member.suspended) throw new HttpError(403, 'Ce compte est suspendu. Veuillez contacter votre administrateur.');
    if (input.admin && member.role !== 'admin') throw new HttpError(403, 'Veuillez utiliser un compte administrateur pour accéder à l’administration.');
    if (req.session) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.session.hash]);
    await issueSession(pool, res, member.id, config);
    res.json({ user: publicMember(member) });
  });

  router.post('/logout', async (req, res) => {
    if (req.session) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.session.hash]);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  return router;
}
