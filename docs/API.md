# API reference

The frontend and API share one origin. All endpoints are under `/api`. Responses are JSON except successful `204` responses. User-facing errors are in French.

## Authentication and CSRF

Register with `POST /api/auth/register`, or sign in with `POST /api/auth/login`. The server sets an HttpOnly, SameSite=Strict session cookie named `vellum_session`. In production the cookie also uses Secure. The browser sends it automatically on same-origin requests.

After signing in, request `GET /api/bootstrap`. Its `csrfToken` must be sent in `X-CSRF-Token` on authenticated mutations. Keep it in memory; the existing frontend handles this in `dist/js/api.js`.

Every mutation requires `Content-Type: application/json`, including DELETE requests without a body. Requests from another browser origin are rejected. Registration/login do not require a prior session CSRF token. CORS access from a separate frontend origin is not configured.

## Routes

| Method | Endpoint | Access | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | `{ "status": "ok" }` when PostgreSQL is available |
| GET | `/api/bootstrap` | Public, scoped by session | Cars, date availability, current user, own rentals; admin account/order data for admins |
| POST | `/api/auth/register` | Public | Create a member, set session, return `{user}` with status 201 |
| POST | `/api/auth/login` | Public | Check credentials, set session, return `{user}` |
| POST | `/api/auth/logout` | Session | Remove session and cookie; status 204 |
| POST | `/api/rentals` | Signed in | Create reservation, return `{order}` with status 201 |
| PATCH | `/api/rentals/:id/cancel` | Owner or admin | Return cancelled `{order}` |
| POST | `/api/admin/cars` | Admin | Create car, return `{car}` with status 201 |
| PATCH | `/api/admin/cars/:id` | Admin | Replace editable car details, return `{car}` |
| DELETE | `/api/admin/cars/:id` | Admin | Archive an eligible car; status 204 |
| PATCH | `/api/admin/members/:id` | Admin | Suspend/reactivate a member; status 204 |
| DELETE | `/api/admin/members/:id` | Admin | Soft-delete member and cancel active reservations; status 204 |

## Request bodies

### Register

```json
{
  "name": "Example Member",
  "email": "member@example.test",
  "password": "your-unique-password"
}
```

Names contain 2–60 characters, email addresses at most 120, and new passwords 8–128. Email is trimmed and normalized to lowercase. Registration cannot set an administrator role.

### Login

```json
{
  "email": "member@example.test",
  "password": "your-unique-password",
  "admin": false
}
```

`admin` is optional. If true, a non-administrator account is rejected; it cannot grant that account a role.

### Create a reservation

```json
{
  "carId": "car-bmw",
  "start": "2030-06-10",
  "end": "2030-06-13"
}
```

Use real calendar dates in `YYYY-MM-DD` format, with pick-up on/after the current agency date and a duration of 1–365 days. The authenticated account determines the member. The database rate determines the total; additional identity/price/role fields are rejected.

The return date is exclusive. A conflicting confirmed reservation returns 409.

### Create/edit a car

```json
{
  "name": "Example City Car",
  "category": "Compact",
  "price": 190,
  "seats": 4,
  "transmission": "Automatic",
  "fuel": "Petrol",
  "location": "Tunis",
  "image": "https://example.com/car.jpg"
}
```

| Field | Accepted values |
| --- | --- |
| `name` | 2–60 characters |
| `category` | `Sedan`, `SUV`, `Sport`, `Compact` |
| `price` | Integer 1–100000, TND per day |
| `seats` | Integer 1–9 |
| `transmission` | `Automatic`, `Manual` |
| `fuel` | `Petrol`, `Diesel`, `Electric`, `Hybrid` |
| `location` | `Tunis`, `La Marsa`, `Sousse` |
| `image` | Optional http(s) URL or a supported local `assets/*.jpg` path |

PATCH expects the full editable-car body, not an arbitrary partial SQL update. The website displays French labels while these stored/API values stay unchanged.

### Suspend or reactivate a member

```json
{"suspended": true}
```

Use `false` to reactivate. Suspension revokes existing sessions. Administrator accounts cannot be suspended or deleted through the member endpoints.

Cancellation accepts an empty JSON object. Logout accepts an empty JSON object. DELETE requests need the JSON content-type and CSRF header but do not need a body.

## Bootstrap privacy

Anonymous visitors receive active cars and their availability date ranges, with empty member/order arrays. Signed-in members receive only their own rental history. Administrators receive member lists and all rental orders. Password hashes and stored session token hashes are never included.

Bootstrap includes `today` in the agency's timezone and a session `csrfToken` when authenticated. The frontend uses this data for display; the server remains authoritative for permissions, rates, and availability.

## Error responses

```json
{"error":"Veuillez vous connecter pour continuer."}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON, fields, record reference, or dates |
| 401 | Missing, expired, or inactive-account session; invalid login |
| 403 | Insufficient role, suspended login, invalid origin, or missing CSRF token |
| 404 | Missing resource or a reservation not accessible to the requester |
| 409 | Duplicate account, overlapping reservation, or operation incompatible with reservation state |
| 413 | JSON request exceeds the size limit |
| 415 | Mutation is not sent as `application/json` |
| 429 | Request/login rate limit exceeded |
| 500 | Unexpected server failure; details are not returned to the client |
| 503 | Database unavailable on the health endpoint |
