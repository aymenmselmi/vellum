import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { sessionMiddleware, mutationProtection } from './security.js';
import { authRoutes } from './routes/auth.js';
import { dataRoutes } from './routes/data.js';
import { rentalRoutes } from './routes/rentals.js';
import { adminRoutes } from './routes/admin.js';
import { HttpError } from './validation.js';

export async function createApp(pool, config) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:', 'http:'],
    connectSrc: ["'self'"],
    upgradeInsecureRequests: config.production ? [] : null
  } } }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ error: 'La base de données est indisponible.' }); }
  });
  app.use('/api', rateLimit({ windowMs: 60000, limit: config.apiLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Trop de demandes. Veuillez réessayer dans une minute.' } }));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use('/api', sessionMiddleware(pool), mutationProtection(config));
  const loginLimiter = rateLimit({ windowMs: 15 * 60000, limit: config.authLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.' } });
  app.use('/api/auth', await authRoutes(pool, config, loginLimiter));
  app.use('/api', dataRoutes(pool, config));
  app.use('/api/rentals', rentalRoutes(pool, config));
  app.use('/api/admin', adminRoutes(pool, config));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Service introuvable.' }));
  app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url)), { dotfiles: 'deny', maxAge: 0 }));
  app.use((req, res) => res.status(404).send('Page introuvable.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Le contenu de la requête doit être un JSON valide.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'La requête est trop volumineuse.' });
    if (error.code === '23505') return res.status(409).json({ error: 'Un compte ou un enregistrement avec ces informations existe déjà.' });
    if (error.code === '23P01') return res.status(409).json({ error: 'Ce véhicule est déjà réservé sur une partie de cette période.' });
    if (['23503', '23514', '22P02', '22007', '22008'].includes(error.code)) return res.status(400).json({ error: 'Les informations ou les dates sont invalides.' });
    console.error('Request failed:', error.code || error.name);
    res.status(500).json({ error: 'Une erreur est survenue. Veuillez réessayer.' });
  });
  return app;
}
