// Entry point: load the demo, attach events, and show the current view.
import { $, localDate, hydrateIcons } from './js/utils.js';
import { STORAGE_KEY, initialCars, state, setState, save, readSession } from './js/store.js';
import { newMember } from './js/auth.js';
import { toast } from './js/ui.js';
import { registerEvents } from './js/events.js';
import { route } from './js/router.js';

async function init() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.cars) && Array.isArray(stored.members) && Array.isArray(stored.orders)) {
      setState(stored);
    }
  } catch {
    // Start a fresh in-memory demo if storage is blocked or empty.
  }

  if (!state) {
    setState({ cars: initialCars.map(car => ({ ...car })), members: [], orders: [] });
    try {
      state.members = await Promise.all([
        newMember('Vellum Admin', 'admin@vellum.demo', 'Vellum2026!', 'admin', 'admin-demo'),
        newMember('Alex Morgan', 'alex@vellum.demo', 'Vellum2026!', 'member', 'member-demo')
      ]);
      save();
    } catch (error) {
      toast(error.message);
    }
  }

  readSession();
  $('#year').textContent = new Date().getFullYear();
  $('#pickup-date').min = localDate();
  $('#pickup-date').value = localDate(1);
  $('#return-date').min = localDate(2);
  $('#return-date').value = localDate(4);
  hydrateIcons();
  registerEvents();
  route();
}

init();
