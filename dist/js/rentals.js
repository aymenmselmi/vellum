// Reservation dialogs, availability validation, rental history, and cancellation.
import { $, esc, money, localDate, localDateAfter, dayNumber, validDates, prettyDate, photoUrl } from './utils.js';
import { state, user, isAdmin, reloadState, bookingStatus } from './store.js';
import { api } from './api.js';
import { label } from './labels.js';
import { modal, modalState, closeModal, toast, showError, errorMarkup, confirmAction, refreshPage } from './ui.js';

export function openBooking(id) {
  const car=state.cars.find(item=>item.id===id && !item.archived);if(!car) return toast('Ce véhicule ne fait plus partie de la collection.');
  if(!user()) return toast('Veuillez vous connecter avant de réserver.');
  modalState.pendingCar=id;
  modal(`<p class="eyebrow">UNE ESCAPADE EN PERSPECTIVE</p><h2 id="modal-title">À vous <em>la route.</em></h2><div class="booking-car"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}"><div><h3>${esc(car.name)}</h3><p>${esc(car.location)} · ${car.seats} places · ${esc(label(car.transmission))}</p></div></div><form id="booking-form" data-id="${esc(car.id)}"><div class="form-row"><div class="form-group"><label for="book-start">Date de départ</label><input id="book-start" name="start" type="date" min="${localDate()}" value="${esc($('#pickup-date').value)}" required></div><div class="form-group"><label for="book-end">Date de retour</label><input id="book-end" name="end" type="date" min="${localDate(1)}" value="${esc($('#return-date').value)}" required></div></div><div class="booking-summary" id="booking-summary"></div>${errorMarkup}<button class="button dark form-submit" type="submit">Confirmer la réservation <span>↗</span></button><p class="small-print">Départ et retour : ${esc(car.location)}. Aucun paiement en ligne n’est demandé. Vous pouvez annuler une location à venir dans Mes locations.</p></form>`);
  updateBookingSummary();
}

export function updateBookingSummary() {
  const form=$('#booking-form');if(!form)return;
  const start=form.elements.start.value,end=form.elements.end.value,car=state.cars.find(item=>item.id===form.dataset.id);
  form.elements.end.min=start && start>=localDate()?localDateAfter(start):localDate(1);
  const days=dayNumber(end)-dayNumber(start);
  $('#booking-summary').innerHTML=validDates(start,end)?`<div class="summary-line"><span>TND ${money(car.price)} × ${days} ${days===1?'jour':'jours'}</span><span>TND ${money(car.price*days)}</span></div><div class="summary-line"><span>Frais de réservation</span><span>Inclus</span></div><div class="summary-line total"><span>Total</span><span>TND ${money(car.price*days)}</span></div>`:'<p class="small-print">Choisissez une date de départ et une date de retour ultérieure pour voir le total.</p>';
}

export async function submitBooking(form) {
  const member=user(),car=state.cars.find(item=>item.id===form.dataset.id && !item.archived),start=form.elements.start.value,end=form.elements.end.value;
  if(!member) return showError('Veuillez vous reconnecter avant de réserver.');
  if(!car) return showError('Ce véhicule n’est plus disponible.');
  if(!validDates(start,end)) return showError('Choisissez une date de départ à partir d’aujourd’hui et une date de retour ultérieure.');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { order } = await api('/rentals', { method: 'POST', body: { carId: car.id, start, end } });
    await reloadState();
    closeModal();refreshPage('rentals');toast(`Votre réservation ${order.reference} est confirmée.`);
  } catch (error) { showError(error.message); }
  finally { if (button.isConnected) button.disabled = false; }
}

export function renderRentals() {
  const member=user(); const root=$('#rentals-view');
  if(!member) {root.innerHTML='<p class="eyebrow">VOTRE PROCHAINE ESCAPADE</p><h1>Vos voyages,<br><em>au même endroit.</em></h1><div class="empty-state"><h2>Votre place vous attend.</h2><p>Connectez-vous pour consulter vos réservations et préparer votre prochaine escapade.</p><button class="button dark" data-action="login">Se connecter <span>↗</span></button></div>';return;}
  const orders=state.orders.filter(order=>order.memberId===member.id);
  root.innerHTML=`<div class="page-top"><div><p class="eyebrow">VOS VOYAGES AVEC VELLUM</p><h1>Mes <em>locations.</em></h1></div><a class="text-link" href="#fleet">Trouver un autre véhicule <span>↗</span></a></div>${orders.length?`<div class="rental-list">${orders.map(order=>{const status=bookingStatus(order);return `<article class="rental-card"><img src="${esc(photoUrl(order.carImage))}" alt="${esc(order.carName)}"><div><p class="eyebrow">${esc(order.reference)}</p><h2>${esc(order.carName)}</h2><p>${prettyDate(order.start)} → ${prettyDate(order.end)}</p><p>Départ et retour · ${esc(order.location)}</p></div><div class="rental-actions"><span class="status ${status}">${status==='confirmed'?'Confirmée':status==='completed'?'Terminée':'Annulée'}</span><span class="car-price"><span class="currency">TND</span>${money(order.total)}</span>${status==='confirmed' && order.start>(state.today || localDate())?`<button class="danger-link" data-action="cancel-order" data-id="${esc(order.id)}">Annuler la réservation</button>`:''}</div></article>`;}).join('')}</div>`:'<div class="empty-state"><h2>Une page blanche, la route devant vous.</h2><p>Vos réservations apparaîtront ici. Trouvons votre première voiture.</p><a href="#fleet" class="button dark">Découvrir la collection <span>↗</span></a></div>'}`;
}

export function cancelOrder(id) {
  const order=state.orders.find(item=>item.id===id),member=user();
  if(!order || !member || (!isAdmin() && (order.memberId!==member.id || order.start<=(state.today || localDate()))) || bookingStatus(order)!=='confirmed') return toast('Cette réservation ne peut pas être annulée.');
  confirmAction('Un changement de programme ?',`Annuler la réservation ${order.reference} pour ${order.carName} ? Le véhicule sera de nouveau disponible à ces dates.`,'Annuler la réservation',async()=>{
    if(!user() || (!isAdmin() && (order.memberId!==user().id || order.start<=(state.today || localDate()))))return toast('Vous n’avez plus l’autorisation d’annuler cette réservation.');
    await api(`/rentals/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', body: {} });
    await reloadState();closeModal();refreshPage();toast('Réservation annulée. D’autres voyages vous attendent.');
  });
}
