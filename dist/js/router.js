// Hash-based view switching and account status in the shared header.
import { $ } from './utils.js';
import { state, user, isAdmin, bookingStatus } from './store.js';
import { renderCars } from './collection.js';
import { renderRentals } from './rentals.js';
import { renderAdmin } from './admin.js';

export function updateHeader() {
  const member = user(); $('#account-label').textContent = member ? member.name.split(' ')[0] : 'Sign in';
  $('#rental-dot').hidden = !member || !state.orders.some(order => order.memberId === member.id && bookingStatus(order)==='confirmed');
  $('#admin-link').textContent = isAdmin() ? 'Open backoffice ↗' : 'Admin backoffice ↗';
}

export function route() {
  const page = location.hash.replace('#','') || 'collection';
  const view = ['rentals','about','admin'].includes(page) ? page : 'collection';
  document.querySelectorAll('.view').forEach(el=>el.hidden = el.id!==`${view}-view`);
  document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));
  if(view==='rentals') renderRentals(); if(view==='admin') renderAdmin(); if(view==='collection') renderCars();
  updateHeader(); document.title = `Vellum — ${view==='collection'?'A better way to get away.':view==='admin'?'The backoffice':view==='rentals'?'My rentals':'Our approach'}`;
  if(page==='fleet') requestAnimationFrame(()=>$('#fleet').scrollIntoView({behavior:'smooth'})); else window.scrollTo({top:0,behavior:'instant'});
}
