// DOM, formatting, dates, icons, and image helpers.
export const $ = (selector, root = document) => root.querySelector(selector);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const money = value => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
const icons = {
  check:'<path d="m5 12 4 4L19 6"/>',
  key:'<circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-3-3 3-3m-6 0 3-3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  support:'<path d="M4 14v-3a8 8 0 0 1 16 0v6c0 3-4 4-8 4"/><rect x="2" y="10" width="4" height="8" rx="2"/><rect x="18" y="10" width="4" height="8" rx="2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  transmission:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12-10v5H6m6-9v18"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-3-5"/>',
  fuel:'<path d="M3 21h12M5 21V4h8v17M5 10h8m0 3h3v5a2 2 0 0 0 4 0V8l-3-3"/>'
};
export function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.check}</svg>`; }
export function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
export function localDate(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function dayNumber(date) { return Date.parse(date + 'T00:00:00Z') / 86400000; }
export function validDates(start, end) { return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(dayNumber(start)) && Number.isFinite(dayNumber(end)) && start >= localDate() && end > start; }
export function prettyDate(date) { return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' }); }
export function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function photoUrl(value) { if (!value) return 'assets/hero.jpg'; try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : 'assets/hero.jpg'; } catch { return /^assets\/[a-z-]+\.jpg$/.test(value) ? value : 'assets/hero.jpg'; } }

export function localDateAfter(date) { const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
