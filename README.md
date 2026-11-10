# Vellum car rental

A responsive car-rental frontend inspired by the supplied Vellum reference. Built with plain HTML, CSS, and JavaScript. No build step or packages are required to run it.

## Run locally

From this folder, run:

```powershell
python -m http.server 8080 --directory dist --bind 127.0.0.1
```

Open http://localhost:8080. Use localhost or HTTPS so the browser's Web Crypto API is available for demo password hashing.

JavaScript uses native ES modules with explicit imports. Serve the app using the command above; opening `index.html` directly as a file will not load the modules. No bundler is needed.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Member | alex@vellum.demo | Vellum2026! |
| Administrator | admin@vellum.demo | Vellum2026! |

The sign-in dialogs have buttons to fill these credentials. Member accounts can also be created through Sign in → Create an account. The footer opens the admin sign-in.

## Included

- A responsive collection with category, agency, date-availability, and price filters.
- Member sign-up/sign-in, reservations with daily totals, booking history, and upcoming rental cancellation.
- A backoffice for adding/editing/deleting cars, cancelling rental orders, and suspending/reactivating/deleting members.
- Reservation conflict checks. Return dates are exclusive, so a car can be picked up on another reservation's return day. A minimum rental is one day.
- Cars with active reservations cannot be deleted until those reservations are cancelled. Deleted cars retain past rental history. Deleting a member cancels their active reservations and preserves order records.
- Browser-local persistence and per-tab demo sessions. Suspended members cannot sign in or book. The demo also refreshes when another tab changes its data.

## Frontend limitations

This is a prototype, not production authentication. PBKDF2 hashes keep literal passwords out of local storage, but all data, permissions, and code remain accessible to the browser user. Use only fictional information. Accounts, inventory, and reservations are shared only within this browser's local storage on the same origin; no server, database, payment processing, emails, or genuine access control is included. A backend must enforce authentication, admin permissions, and availability atomically before a public launch.

Photographs are downloaded from Unsplash. Fonts load from Google Fonts, with local font fallbacks when offline. Prices and cars are illustrative.

## Files

- `dist/index.html`: page structure and navigation.
- `dist/styles.css`: responsive layouts and visual design.
- `dist/app.js`: startup, demo data initialization, and event registration.
- `dist/js/auth.js`: sign-up, sign-in, accounts, and password hashing.
- `dist/js/collection.js`: car cards, filters, date search, and sorting.
- `dist/js/rentals.js`: booking forms, totals, rental history, and cancellation.
- `dist/js/admin.js`: backoffice views and car/member management.
- `dist/js/store.js`: shared demo data, browser storage, sessions, and availability checks.
- `dist/js/ui.js`: dialogs, notifications, and shared modal state.
- `dist/js/router.js`: view navigation and header status.
- `dist/js/events.js`: click, form, change, navigation, and storage event handlers.
- `dist/js/utils.js`: date, formatting, icon, DOM, and image helpers.
- `dist/assets/`: local car photography.

To reset the demo, clear this site's browser storage. Demo accounts are recreated on the next visit.
