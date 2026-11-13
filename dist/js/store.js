// In-memory view data. PostgreSQL and the API are authoritative.
import { api, setCsrfToken } from './api.js';
import { localDate } from './utils.js';
import { toast } from './ui.js';

export let state = { user: null, cars: [], orders: [], members: [], availability: [] };

export async function reloadState() {
  state = await api('/bootstrap');
  setCsrfToken(state.csrfToken);
  return state;
}

export function user() { return state.user; }
export function isAdmin() { return user()?.role === 'admin'; }
export function requireAdmin() {
  if (isAdmin()) return true;
  toast('Veuillez vous connecter en tant qu’administrateur.');
  return false;
}
export function bookingStatus(order) {
  return order.status === 'cancelled' ? 'cancelled' : order.end <= (state.today || localDate()) ? 'completed' : 'confirmed';
}
export function isAvailable(carId, start, end) {
  return !state.availability.some(order => order.carId === carId && start < order.end && end > order.start);
}
