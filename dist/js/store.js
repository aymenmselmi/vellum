// Browser-local demo data and sessions. Production permissions belong on a server.
import { localDate } from './utils.js';
import { toast } from './ui.js';

export const STORAGE_KEY = 'vellum-rentals-v1';
const SESSION_KEY = 'vellum-session-v1';
export let state;
let sessionId = null;

export function setState(value) {
  state = value;
}

export const initialCars = [
  {id:'car-mercedes',name:'Mercedes-AMG GT',category:'Sport',price:540,seats:2,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/mercedes.jpg',badge:'The extraordinary, everyday'},
  {id:'car-range',name:'Audi RS Q8',category:'SUV',price:450,seats:5,transmission:'Automatic',fuel:'Petrol',location:'La Marsa',image:'assets/range-rover.jpg',badge:'Room for possibility'},
  {id:'car-porsche',name:'Porsche Panamera',category:'Sport',price:850,seats:4,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/hero.jpg',badge:'The weekend escape'},
  {id:'car-bmw',name:'BMW 3 Series',category:'Sedan',price:260,seats:5,transmission:'Automatic',fuel:'Diesel',location:'Sousse',image:'assets/bmw.jpg',badge:'A driver’s favourite'},
  {id:'car-audi',name:'Audi RS7 Sportback',category:'Sport',price:620,seats:5,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/audi.jpg',badge:'Quietly exceptional'},
  {id:'car-mini',name:'MINI Countryman',category:'Compact',price:150,seats:5,transmission:'Automatic',fuel:'Petrol',location:'La Marsa',image:'assets/mini.jpg',badge:'Small car. Big plans.'}
];

export function readSession() { try { sessionId = sessionStorage.getItem(SESSION_KEY); } catch { sessionId = null; } }

export function user() { return state.members.find(member => member.id === sessionId && !member.suspended); }

export function isAdmin() { return user()?.role === 'admin'; }

export function requireAdmin() { if (isAdmin()) return true; toast('Please sign in as an administrator.'); return false; }

export function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast('Browser storage is unavailable. Changes will last only for this visit.'); } }

export function setSession(id) { sessionId = id; try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* In-memory sessions still work. */ } }

export function bookingStatus(order) { return order.status === 'cancelled' ? 'cancelled' : order.end <= localDate() ? 'completed' : 'confirmed'; }

export function isAvailable(carId,start,end) { return !state.orders.some(order => order.carId === carId && order.status !== 'cancelled' && start < order.end && end > order.start); }
