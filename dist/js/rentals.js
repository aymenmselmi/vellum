// Reservation dialogs, availability validation, rental history, and cancellation.
import { $, esc, money, localDate, localDateAfter, dayNumber, validDates, prettyDate, uid, photoUrl } from './utils.js';
import { state, user, isAdmin, save, bookingStatus, isAvailable } from './store.js';
import { modal, modalState, closeModal, toast, showError, errorMarkup, confirmAction, refreshPage } from './ui.js';

export function openBooking(id) {
  const car=state.cars.find(item=>item.id===id && !item.archived);if(!car) return toast('This car is no longer in the collection.');
  if(!user()) return toast('Please sign in before booking.');
  modalState.pendingCar=id;
  modal(`<p class="eyebrow">A JOURNEY TO LOOK FORWARD TO</p><h2 id="modal-title">Make it <em>yours.</em></h2><div class="booking-car"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}"><div><h3>${esc(car.name)}</h3><p>${esc(car.location)} · ${car.seats} seats · ${esc(car.transmission)}</p></div></div><form id="booking-form" data-id="${esc(car.id)}"><div class="form-row"><div class="form-group"><label for="book-start">Pick-up date</label><input id="book-start" name="start" type="date" min="${localDate()}" value="${esc($('#pickup-date').value)}" required></div><div class="form-group"><label for="book-end">Return date</label><input id="book-end" name="end" type="date" min="${localDate(1)}" value="${esc($('#return-date').value)}" required></div></div><div class="booking-summary" id="booking-summary"></div>${errorMarkup}<button class="button dark form-submit" type="submit">Confirm reservation <span>↗</span></button><p class="small-print">Pick-up & return: ${esc(car.location)} agency. No payment is collected in this demo. You can cancel an upcoming rental in My rentals.</p></form>`);
  updateBookingSummary();
}

export function updateBookingSummary() {
  const form=$('#booking-form');if(!form)return;
  const start=form.elements.start.value,end=form.elements.end.value,car=state.cars.find(item=>item.id===form.dataset.id);
  form.elements.end.min=start && start>=localDate()?localDateAfter(start):localDate(1);
  const days=dayNumber(end)-dayNumber(start);
  $('#booking-summary').innerHTML=validDates(start,end)?`<div class="summary-line"><span>TND ${money(car.price)} × ${days} ${days===1?'day':'days'}</span><span>TND ${money(car.price*days)}</span></div><div class="summary-line"><span>Reservation fee</span><span>Included</span></div><div class="summary-line total"><span>Your total</span><span>TND ${money(car.price*days)}</span></div>`:'<p class="small-print">Choose a pick-up date and a later return date to see your total.</p>';
}

export function submitBooking(form) {
  const member=user(),car=state.cars.find(item=>item.id===form.dataset.id && !item.archived),start=form.elements.start.value,end=form.elements.end.value;
  if(!member) return showError('Please sign in again before booking.');
  if(!car) return showError('This car is no longer available.');
  if(!validDates(start,end)) return showError('Choose a pick-up date from today onward and a later return date.');
  if(!isAvailable(car.id,start,end)) return showError('This car is already reserved for part of those dates. Please try other dates.');
  const order={id:uid(),reference:'VL-'+uid().replace(/-/g,'').slice(0,6).toUpperCase(),carId:car.id,carName:car.name,carImage:car.image,memberId:member.id,memberName:member.name,memberEmail:member.email,start,end,location:car.location,dailyRate:car.price,total:car.price*(dayNumber(end)-dayNumber(start)),status:'confirmed',createdAt:new Date().toISOString()};
  state.orders.unshift(order);save();closeModal();refreshPage('rentals');toast(`You're booked. Your reservation is ${order.reference}.`);
}

export function renderRentals() {
  const member=user(); const root=$('#rentals-view');
  if(!member) {root.innerHTML='<p class="eyebrow">YOUR NEXT CHAPTER</p><h1>Journeys,<br><em>all in one place.</em></h1><div class="empty-state"><h2>Your seat is waiting.</h2><p>Sign in to see your reservations and plan your next escape.</p><button class="button dark" data-action="login">Sign in <span>↗</span></button></div>';return;}
  const orders=state.orders.filter(order=>order.memberId===member.id);
  root.innerHTML=`<div class="page-top"><div><p class="eyebrow">YOUR VELLUM JOURNEYS</p><h1>My <em>rentals.</em></h1></div><a class="text-link" href="#fleet">Find another drive <span>↗</span></a></div>${orders.length?`<div class="rental-list">${orders.map(order=>{const status=bookingStatus(order);return `<article class="rental-card"><img src="${esc(photoUrl(order.carImage))}" alt="${esc(order.carName)}"><div><p class="eyebrow">${esc(order.reference)}</p><h2>${esc(order.carName)}</h2><p>${prettyDate(order.start)} → ${prettyDate(order.end)}</p><p>Pick-up & return · ${esc(order.location)}</p></div><div class="rental-actions"><span class="status ${status}">${status==='confirmed'?'Confirmed':status==='completed'?'Completed':'Cancelled'}</span><span class="car-price"><span class="currency">TND</span>${money(order.total)}</span>${status==='confirmed' && order.start>localDate()?`<button class="danger-link" data-action="cancel-order" data-id="${esc(order.id)}">Cancel reservation</button>`:''}</div></article>`;}).join('')}</div>`:'<div class="empty-state"><h2>A blank page. An open road.</h2><p>Your reservations will appear here. Let’s find your first drive.</p><a href="#fleet" class="button dark">Explore the collection <span>↗</span></a></div>'}`;
}

export function cancelOrder(id) {
  const order=state.orders.find(item=>item.id===id),member=user();
  if(!order || !member || (!isAdmin() && (order.memberId!==member.id || order.start<=localDate())) || bookingStatus(order)!=='confirmed') return toast('This reservation cannot be cancelled.');
  confirmAction('A change of plans?',`Cancel ${order.reference} for ${order.carName}? The dates will be released back to the collection.`,'Cancel reservation',()=>{
    if(!user() || (!isAdmin() && (order.memberId!==user().id || order.start<=localDate())))return toast('You no longer have permission to cancel this reservation.');
    order.status='cancelled';save();closeModal();refreshPage();toast('Reservation cancelled. There’s always another journey.');
  });
}
