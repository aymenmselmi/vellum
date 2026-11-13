import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { today } from '../config.js';
import { transaction } from '../db.js';
import { lockActor, requireUser } from '../security.js';
import { rentalFields } from '../queries.js';
import { HttpError, parse, rentalSchema, rentalIdSchema } from '../validation.js';

export function rentalRoutes(pool, config) {
  const router = Router();
  router.use(requireUser);

  router.post('/', async (req, res) => {
    const input = parse(rentalSchema, req.body);
    const days = (Date.parse(input.end) - Date.parse(input.start)) / 86400000;
    if (input.start < today(config.timezone) || days < 1 || days > 365) {
      throw new HttpError(400, 'Choisissez une date de départ à partir d’aujourd’hui et une durée de location de 1 à 365 jours.');
    }
    const order = await transaction(pool, async client => {
      const member = await lockActor(client, req.user.id);
      const result = await client.query('SELECT * FROM cars WHERE id = $1 AND NOT archived FOR UPDATE', [input.carId]);
      if (!result.rowCount) throw new HttpError(404, 'Ce véhicule ne fait plus partie de la collection.');
      const car = result.rows[0];
      const clash = await client.query(`SELECT 1 FROM rentals WHERE car_id = $1 AND status = 'confirmed'
        AND daterange(start_date, end_date, '[)') && daterange($2::date, $3::date, '[)') LIMIT 1`,
      [car.id, input.start, input.end]);
      if (clash.rowCount) throw new HttpError(409, 'Ce véhicule est déjà réservé sur une partie de cette période. Choisissez d’autres dates.');
      const reference = `VL-${randomBytes(6).toString('hex').toUpperCase()}`;
      const inserted = await client.query(`INSERT INTO rentals
        (id, reference, car_id, member_id, start_date, end_date, daily_rate,
         car_name, car_image, member_name, member_email, location)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${rentalFields}`,
      [randomUUID(), reference, car.id, member.id, input.start, input.end, car.price,
        car.name, car.image, member.name, member.email, car.location]);
      return inserted.rows[0];
    });
    res.status(201).json({ order });
  });

  router.patch('/:id/cancel', async (req, res) => {
    const id = parse(rentalIdSchema, req.params.id);
    const date = today(config.timezone);
    const order = await transaction(pool, async client => {
      const member = await lockActor(client, req.user.id);
      const result = await client.query(`SELECT ${rentalFields} FROM rentals WHERE id = $1 FOR UPDATE`, [id]);
      const rental = result.rows[0];
      if (!rental || (member.role !== 'admin' && rental.memberId !== member.id)) {
        throw new HttpError(404, 'Réservation introuvable.');
      }
      if (rental.status === 'cancelled') return rental;
      if (rental.end <= date || (member.role !== 'admin' && rental.start <= date)) {
        throw new HttpError(409, 'Cette réservation ne peut plus être annulée.');
      }
      const updated = await client.query(`UPDATE rentals SET status = 'cancelled', cancelled_at = now()
        WHERE id = $1 RETURNING ${rentalFields}`, [id]);
      return updated.rows[0];
    });
    res.json({ order });
  });
  return router;
}
