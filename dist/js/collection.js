// Collection cards, categories, dates, locations, and sorting.
import { $, esc, money, icon, photoUrl, validDates, localDate, localDateAfter } from './utils.js';
import { state, isAvailable } from './store.js';
import { toast } from './ui.js';

let category = 'all';
let datesFiltered = false;

export function renderCars() {
  const location = $('#location-filter').value, start = $('#pickup-date').value, end = $('#return-date').value;
  let cars = state.cars.filter(car => !car.archived && (category==='all' || car.category===category) && (!location || car.location===location) && (!datesFiltered || isAvailable(car.id,start,end)));
  const sort = $('#sort-cars').value; if (sort!=='curated') cars.sort((a,b)=>sort==='price-asc'?a.price-b.price:b.price-a.price);
  const total = state.cars.filter(car=>!car.archived).length;
  $('#fleet-count').textContent=String(total).padStart(2,'0'); $('#result-count').textContent=`${cars.length} ${cars.length===1?'car':'cars'} ${datesFiltered?'available':'to discover'}`;
  $('#car-grid').innerHTML = cars.length ? cars.map((car,index)=>`<article class="car-card"><div class="car-photo"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}" loading="lazy"><span class="car-badge">${esc(car.badge || 'New to the collection')}</span><span class="photo-number">${String(index+1).padStart(2,'0')} / VELLUM</span></div><div class="car-content"><p class="car-category">${esc(car.category)} <span aria-hidden="true">·</span> ${esc(car.location)}</p><h3 class="car-title">${esc(car.name)}</h3><div class="car-specs"><span>${icon('transmission')}${esc(car.transmission)}</span><span>${icon('people')}${car.seats} seats</span><span>${icon('fuel')}${esc(car.fuel)}</span></div><div class="car-card-bottom"><div class="car-price"><span class="currency">TND</span>${money(car.price)}<small>/ day</small></div><button class="book-button" data-action="book" data-id="${esc(car.id)}" aria-label="Rent ${esc(car.name)}">Discover & rent <span>↗</span></button></div></div></article>`).join('') : '<div class="empty-state"><h2>A different route?</h2><p>No cars match this selection. Try another location, category, or set of dates.</p><button class="button dark" data-action="reset-filters">Reset filters <span>↗</span></button></div>';
}

export function resetFilters() {category='all';datesFiltered=false;$('#location-filter').value='';$('#sort-cars').value='curated';document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('active',button.dataset.category==='all'));renderCars();}

export function selectCategory(button) {
  category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('active', item === button));
  renderCars();
}

export function searchCars() {
  const start = $('#pickup-date').value;
  const end = $('#return-date').value;
  if (!validDates(start, end)) return toast('Choose a pick-up date from today and a later return date.');
  datesFiltered = true;
  renderCars();
  toast('Showing cars available for your selected dates.');
}

export function changeCollectionField(id) {
  if (['pickup-date', 'return-date'].includes(id)) {
    datesFiltered = false;
    if (id === 'pickup-date') {
      $('#return-date').min = $('#pickup-date').value ? localDateAfter($('#pickup-date').value) : localDate(1);
      if ($('#return-date').value <= $('#pickup-date').value) {
        $('#return-date').value = localDateAfter($('#pickup-date').value);
      }
    }
  }
  renderCars();
}
