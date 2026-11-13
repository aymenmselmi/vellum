import { z } from 'zod';

// Localize fallback validation errors as well as the explicit field messages.
z.config(z.locales.fr());

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, issue?.code === 'unrecognized_keys'
      ? 'La requête contient des champs non autorisés.'
      : issue?.message || 'Requête invalide.');
  }
  return result.data;
}

const name = z.string().trim().min(2, 'Saisissez un nom d’au moins 2 caractères.').max(60);
const email = z.string().trim().toLowerCase().email('Saisissez une adresse e-mail valide.').max(120);
const password = z.string().min(8, 'Utilisez un mot de passe d’au moins 8 caractères.').max(128);
export const registerSchema = z.object({ name, email, password }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128), admin: z.boolean().optional() }).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Saisissez une date valide.');
export const rentalSchema = z.object({ carId: z.string().min(1).max(100), start: date, end: date }).strict();
export const memberIdSchema = z.string().uuid('Identifiant de membre invalide.');
export const rentalIdSchema = z.string().uuid('Identifiant de réservation invalide.');
export const memberStatusSchema = z.object({ suspended: z.boolean() }).strict();
const image = z.string().max(2000).refine(value => {
  if (/^assets\/[a-z-]+\.jpg$/.test(value)) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Utilisez une adresse de photo commençant par http ou https.');
export const carSchema = z.object({
  name,
  category: z.enum(['Sedan', 'SUV', 'Sport', 'Compact'], { error: 'Choisissez une catégorie valide.' }),
  price: z.number().int().min(1).max(100000),
  seats: z.number().int().min(1).max(9),
  transmission: z.enum(['Automatic', 'Manual'], { error: 'Choisissez un type de transmission valide.' }),
  fuel: z.enum(['Petrol', 'Diesel', 'Electric', 'Hybrid'], { error: 'Choisissez un carburant valide.' }),
  location: z.enum(['Tunis', 'La Marsa', 'Sousse'], { error: 'Choisissez une agence valide.' }),
  image: image.default('assets/hero.jpg')
}).strict();
