import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initialCars } from './seed-data.js';
import { hashPassword } from './security.js';
import { readConfig } from './config.js';
import { createPool, transaction } from './db.js';
import { parse, registerSchema } from './validation.js';

export async function seed(pool, env = process.env) {
  if (!env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD in .env before creating the first administrator.');
  const admin = parse(registerSchema, {
    name: env.ADMIN_NAME || 'Vellum Admin', email: env.ADMIN_EMAIL || 'admin@vellum.local', password: env.ADMIN_PASSWORD
  });
  const hash = await hashPassword(admin.password);
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('vellum-seed'))");
    for (const car of initialCars) {
      await client.query(`INSERT INTO cars(id,name,category,price,seats,transmission,fuel,location,image,badge)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [car.id, car.name, car.category, car.price, car.seats, car.transmission, car.fuel, car.location, car.image, car.badge]);
    }
    const existing = await client.query('SELECT role FROM members WHERE email=$1 AND deleted_at IS NULL', [admin.email]);
    if (existing.rowCount && existing.rows[0].role !== 'admin') {
      throw new Error('ADMIN_EMAIL belongs to an existing member. Choose a different email.');
    }
    if (!existing.rowCount) {
      await client.query(`INSERT INTO members(id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,'admin')`,
        [randomUUID(), admin.name, admin.email, hash]);
      console.log('Created the administrator account.');
    }
  });
  console.log('Seed complete. Existing accounts, passwords, cars, and bookings were preserved.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createPool(readConfig());
  try { await seed(pool); } finally { await pool.end(); }
}
