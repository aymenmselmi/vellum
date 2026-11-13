// Collection cards, categories, dates, locations, and sorting.
import { $, esc, money, icon, photoUrl, validDates, localDate, localDateAfter } from './utils.js';
import { state, isAvailable, reloadState } from './store.js';
import { toast } from './ui.js';
import { label } from './labels.js';

let category = 'all';
let datesFiltered = false;

export function renderCars() {
  const location = $('#location-filter').value, start = $('#pickup-date').value, end = $('#return-date').value;
  let cars = state.cars.filter(car => !car.archived && (category==='all' || car.category===category) && (!location || car.location===location) && (!datesFiltered || isAvailable(car.id,start,end)));
  const sort = $('#sort-cars').value; if (sort!=='curated') cars.sort((a,b)=>sort==='price-asc'?a.price-b.price:b.price-a.price);
  const total = state.cars.filter(car=>!car.archived).length;
  $('#fleet-count').textContent=String(total).padStart(2,'0');
  $('#result-count').textContent=`${cars.length} véhicule${cars.length===1?'':'s'} ${datesFiltered?(cars.length===1?'disponible':'disponibles'):'à découvrir'}`;
  $('#car-grid').innerHTML = cars.length ? cars.map((car,index)=>`<article class="car-card"><div class="car-photo"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}" loading="lazy"><span class="car-badge">${esc(label(car.badge || 'New to the collection'))}</span><span class="photo-number">${String(index+1).padStart(2,'0')} / VELLUM</span></div><div class="car-content"><p class="car-category">${esc(label(car.category))} <span aria-hidden="true">·</span> ${esc(car.location)}</p><h3 class="car-title">${esc(car.name)}</h3><div class="car-specs"><span>${icon('transmission')}${esc(label(car.transmission))}</span><span>${icon('people')}${car.seats} places</span><span>${icon('fuel')}${esc(label(car.fuel))}</span></div><div class="car-card-bottom"><div class="car-price"><span class="currency">TND</span>${money(car.price)}<small>/ jour</small></div><button class="book-button" data-action="book" data-id="${esc(car.id)}" aria-label="Louer ${esc(car.name)}">Découvrir et réserver <span>↗</span></button></div></div></article>`).join('') : '<div class="empty-state"><h2>Une autre envie ?</h2><p>Aucun véhicule ne correspond à votre recherche. Essayez une autre agence, une autre catégorie ou d’autres dates.</p><button class="button dark" data-action="reset-filters">Réinitialiser les filtres <span>↗</span></button></div>';
}

export function resetFilters() {category='all';datesFiltered=false;$('#location-filter').value='';$('#sort-cars').value='curated';document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('active',button.dataset.category==='all'));renderCars();}

export function selectCategory(button) {
  category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('active', item === button));
  renderCars();
}

export async function searchCars() {
  const start = $('#pickup-date').value;
  const end = $('#return-date').value;
  if (!validDates(start, end)) return toast('Choisissez une date de départ à partir d’aujourd’hui et une date de retour ultérieure.');
  await reloadState();
  datesFiltered = true;
  renderCars();
  toast('Voici les véhicules disponibles aux dates choisies.');
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
