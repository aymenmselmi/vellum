export const rentalFields = `id, reference, car_id AS "carId", member_id AS "memberId",
  start_date::text AS start, end_date::text AS end, daily_rate AS "dailyRate", total,
  status, car_name AS "carName", car_image AS "carImage", member_name AS "memberName",
  member_email AS "memberEmail", location, created_at AS "createdAt"`;
