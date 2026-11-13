import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { transaction } from '../db.js';
import { today } from '../config.js';
import { requireAdmin, lockActor } from '../security.js';
import { parse, carSchema, memberIdSchema, memberStatusSchema, HttpError } from '../validation.js';

export function adminRoutes(pool, config) {
  const router = Router();
  router.use(requireAdmin);

  router.post('/cars', async (req, res) => {
    const car = parse(carSchema, req.body);
    const result = await transaction(pool, async client => {
      await lockActor(client, req.user.id, true);
      return client.query(`INSERT INTO cars(id, name, category, price, seats, transmission, fuel, location, image)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [`car-${randomUUID()}`, car.name, car.category, car.price, car.seats, car.transmission, car.fuel, car.location, car.image]);
    });
    res.status(201).json({ car: result.rows[0] });
  });

  router.patch('/cars/:id', async (req, res) => {
    const car = parse(carSchema, req.body);
    const result = await transaction(pool, async client => {
      await lockActor(client, req.user.id, true);
      return client.query(`UPDATE cars SET name=$2, category=$3, price=$4, seats=$5,
        transmission=$6, fuel=$7, location=$8, image=$9 WHERE id=$1 AND NOT archived RETURNING *`,
      [req.params.id, car.name, car.category, car.price, car.seats, car.transmission, car.fuel, car.location, car.image]);
    });
    if (!result.rowCount) throw new HttpError(404, 'Véhicule introuvable.');
    res.json({ car: result.rows[0] });
  });

  router.delete('/cars/:id', async (req, res) => {
    await transaction(pool, async client => {
      await lockActor(client, req.user.id, true);
      const car = await client.query('SELECT id FROM cars WHERE id=$1 AND NOT archived FOR UPDATE', [req.params.id]);
      if (!car.rowCount) throw new HttpError(404, 'Véhicule introuvable.');
      const active = await client.query(`SELECT 1 FROM rentals WHERE car_id=$1 AND status='confirmed' AND end_date>$2 LIMIT 1`,
        [req.params.id, today(config.timezone)]);
      if (active.rowCount) throw new HttpError(409, 'Annulez les réservations en cours de ce véhicule avant de le supprimer.');
      await client.query('UPDATE cars SET archived=true WHERE id=$1', [req.params.id]);
    });
    res.status(204).end();
  });

  router.patch('/members/:id', async (req, res) => {
    const id = parse(memberIdSchema, req.params.id);
    const { suspended } = parse(memberStatusSchema, req.body);
    await transaction(pool, async client => {
      await lockActor(client, req.user.id, true);
      const updated = await client.query(`UPDATE members SET suspended=$2
        WHERE id=$1 AND role='member' AND deleted_at IS NULL RETURNING id`, [id, suspended]);
      if (!updated.rowCount) throw new HttpError(404, 'Membre introuvable. Les comptes administrateurs ne peuvent pas être modifiés ici.');
      if (suspended) await client.query('DELETE FROM sessions WHERE member_id=$1', [id]);
    });
    res.status(204).end();
  });

  router.delete('/members/:id', async (req, res) => {
    const id = parse(memberIdSchema, req.params.id);
    await transaction(pool, async client => {
      await lockActor(client, req.user.id, true);
      const updated = await client.query(`UPDATE members SET suspended=true, deleted_at=now()
        WHERE id=$1 AND role='member' AND deleted_at IS NULL RETURNING id`, [id]);
      if (!updated.rowCount) throw new HttpError(404, 'Membre introuvable. Les comptes administrateurs ne peuvent pas être supprimés ici.');
      await client.query(`UPDATE rentals SET status='cancelled', cancelled_at=now()
        WHERE member_id=$1 AND status='confirmed' AND end_date>$2`, [id, today(config.timezone)]);
      await client.query('DELETE FROM sessions WHERE member_id=$1', [id]);
    });
    res.status(204).end();
  });
  return router;
}
