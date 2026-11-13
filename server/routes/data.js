import { Router } from 'express';
import { today } from '../config.js';
import { rentalFields } from '../queries.js';

export function dataRoutes(pool, config) {
  const router = Router();
  router.get('/bootstrap', async (req, res) => {
    const date = today(config.timezone);
    const admin = req.user?.role === 'admin';
    const [cars, availability, orders, members] = await Promise.all([
      pool.query('SELECT * FROM cars WHERE NOT archived ORDER BY created_at, id'),
      pool.query(`SELECT car_id AS "carId", start_date::text AS start, end_date::text AS end
        FROM rentals WHERE status = 'confirmed' AND end_date > $1`, [date]),
      req.user ? pool.query(`SELECT ${rentalFields} FROM rentals ${admin ? '' : 'WHERE member_id = $1'}
        ORDER BY created_at DESC`, admin ? [] : [req.user.id]) : { rows: [] },
      admin ? pool.query(`SELECT id, name, email, role, suspended FROM members
        WHERE deleted_at IS NULL ORDER BY created_at`) : { rows: [] }
    ]);
    res.json({
      user: req.user,
      csrfToken: req.session?.csrfToken || null,
      today: date,
      cars: cars.rows,
      availability: availability.rows,
      orders: orders.rows,
      members: members.rows
    });
  });
  return router;
}
