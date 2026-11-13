// Backoffice views and car, order, and member management.
import { $, esc, money, prettyDate } from './utils.js';
import { state, user, isAdmin, requireAdmin, reloadState, bookingStatus } from './store.js';
import { api } from './api.js';
import { modal, closeModal, toast, showError, errorMarkup, confirmAction } from './ui.js';
import { renderCars } from './collection.js';
import { label } from './labels.js';

let adminTab = 'cars';

export function selectAdminTab(tab) {
  if (!requireAdmin()) return;
  adminTab = tab;
  renderAdmin();
}

export function renderAdmin() {
  const root=$('#admin-view');
  if(!isAdmin()) {root.innerHTML='<p class="eyebrow">L’ESPACE D’ADMINISTRATION VELLUM</p><h1>Les coulisses de<br><em>la collection.</em></h1><div class="empty-state"><h2>Tout se joue dans les détails.</h2><p>Un accès administrateur est nécessaire pour gérer les véhicules, les réservations et les membres.</p><button class="button dark" data-action="admin-login">Connexion administrateur <span>↗</span></button></div>';return;}
  const cars=state.cars.filter(car=>!car.archived),active=state.orders.filter(order=>bookingStatus(order)==='confirmed'),members=state.members.filter(member=>member.role!=='admin');
  root.innerHTML=`<div class="page-top"><div><p class="eyebrow">L’ESPACE D’ADMINISTRATION VELLUM</p><h1>Tout sous <em>contrôle.</em></h1></div><p>Bon retour, ${esc(user().name.split(' ')[0])}.</p></div><div class="stat-grid"><div class="stat-card"><p>Véhicules dans la collection</p><strong>${String(cars.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Réservations en cours</p><strong>${String(active.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Membres inscrits</p><strong>${String(members.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Montant des réservations · TND</p><strong>${money(state.orders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.total,0))}</strong></div></div><div class="admin-tabs" role="group" aria-label="Rubriques d’administration">${['cars','orders','members'].map(tab=>`<button data-action="admin-tab" data-tab="${tab}" class="${adminTab===tab?'active':''}">${label(tab)}</button>`).join('')}</div><div id="admin-table"></div><p class="admin-notice">Chaque réservation conserve son tarif et les informations du véhicule. Annulez les réservations en cours avant de retirer un véhicule de la collection.</p>`;
  if(adminTab==='cars') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>La collection</h2><button class="button dark" data-action="add-car">Ajouter un véhicule <span>+</span></button></div>${cars.length?`<div class="table-wrap"><table><thead><tr><th>VÉHICULE</th><th>CATÉGORIE</th><th>AGENCE</th><th>TARIF JOURNALIER</th><th>ACTIONS</th></tr></thead><tbody>${cars.map(car=>`<tr><td class="table-name">${esc(car.name)}<small>${esc(label(car.transmission))} · ${car.seats} places</small></td><td>${esc(label(car.category))}</td><td>${esc(car.location)}</td><td>TND ${money(car.price)}</td><td><div class="table-actions"><button data-action="edit-car" data-id="${esc(car.id)}">Modifier</button><button class="danger-link" data-action="delete-car" data-id="${esc(car.id)}">Supprimer</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Enrichissez la collection.</h2><p>Ajoutez un véhicule pour le proposer aux membres.</p></div>'}`;
  if(adminTab==='orders') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>Réservations</h2><span>${state.orders.length} réservation${state.orders.length===1?'':'s'} au total</span></div>${state.orders.length?`<div class="table-wrap"><table><thead><tr><th>RÉSERVATION</th><th>MEMBRE</th><th>DATES</th><th>TOTAL</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>${state.orders.map(order=>{const status=bookingStatus(order);return `<tr><td class="table-name">${esc(order.carName)}<small>${esc(order.reference)}</small></td><td>${esc(order.memberName)}<small>${esc(order.memberEmail)}</small></td><td>${prettyDate(order.start)}<small>au ${prettyDate(order.end)}</small></td><td>TND ${money(order.total)}</td><td><span class="status ${status}">${esc(label(status))}</span></td><td>${status==='confirmed'?`<button class="danger-link" data-action="cancel-order" data-id="${esc(order.id)}">Annuler</button>`:'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Place à de nouveaux voyages.</h2><p>Les réservations des membres apparaîtront ici.</p></div>'}`;
  if(adminTab==='members') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>Les membres</h2><span>${members.length} membre${members.length===1?' inscrit':'s inscrits'}</span></div>${members.length?`<div class="table-wrap"><table><thead><tr><th>MEMBRE</th><th>LOCATIONS</th><th>STATUT</th><th>ACTIONS</th></tr></thead><tbody>${members.map(member=>`<tr><td class="table-name">${esc(member.name)}<small>${esc(member.email)}</small></td><td>${state.orders.filter(order=>order.memberId===member.id).length}</td><td><span class="status ${member.suspended?'suspended':''}">${member.suspended?'Suspendu':'Actif'}</span></td><td><div class="table-actions"><button data-action="toggle-member" data-id="${esc(member.id)}">${member.suspended?'Réactiver':'Suspendre'}</button><button class="danger-link" data-action="delete-member" data-id="${esc(member.id)}">Supprimer</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Une communauté qui grandit.</h2><p>Les nouveaux membres apparaîtront ici après leur inscription.</p></div>'}`;
}

export function carForm(id) {
  if(!requireAdmin())return;const car=state.cars.find(item=>item.id===id),edit=!!car;
  const options=(list,value)=>list.map(item=>`<option value="${esc(item)}" ${item===value?'selected':''}>${esc(label(item))}</option>`).join('');
  modal(`<p class="eyebrow">FAITES VIVRE LA COLLECTION</p><h2 id="modal-title">${edit?'Modifiez les':'Une nouvelle'} <em>${edit?'détails.':'arrivée.'}</em></h2><form id="car-form" data-id="${esc(car?.id||'')}"><div class="form-group"><label for="car-name">Nom du véhicule</label><input id="car-name" name="name" required maxlength="60" value="${esc(car?.name||'')}" placeholder="Ex. Mercedes-Benz Classe E"></div><div class="form-row"><div class="form-group"><label for="car-category">Catégorie</label><select id="car-category" name="category">${options(['Sedan','SUV','Sport','Compact'],car?.category)}</select></div><div class="form-group"><label for="car-location">Agence</label><select id="car-location" name="location">${options(['Tunis','La Marsa','Sousse'],car?.location)}</select></div></div><div class="form-row"><div class="form-group"><label for="car-price">Tarif journalier (TND)</label><input id="car-price" name="price" type="number" required min="1" max="100000" step="1" value="${car?.price||''}" placeholder="240"></div><div class="form-group"><label for="car-seats">Places</label><input id="car-seats" name="seats" type="number" required min="1" max="9" step="1" value="${car?.seats||5}"></div></div><div class="form-row"><div class="form-group"><label for="car-transmission">Transmission</label><select id="car-transmission" name="transmission">${options(['Automatic','Manual'],car?.transmission)}</select></div><div class="form-group"><label for="car-fuel">Carburant</label><select id="car-fuel" name="fuel">${options(['Petrol','Diesel','Electric','Hybrid'],car?.fuel)}</select></div></div><div class="form-group"><label for="car-image">Adresse de la photo (facultatif)</label><input id="car-image" name="image" type="url" placeholder="https://exemple.tn/voiture.jpg" value="${car?.image?.startsWith('http')?esc(car.image):''}"></div>${errorMarkup}<button class="button dark form-submit" type="submit">${edit?'Enregistrer les modifications':'Ajouter à la collection'} <span>↗</span></button></form>`);
}

export async function submitCar(form) {
  if(!requireAdmin())return;const data=new FormData(form),name=data.get('name').trim(),price=Number(data.get('price')),seats=Number(data.get('seats')),image=data.get('image').trim();
  if(name.length<2 || !Number.isInteger(price)||price<1||price>100000||!Number.isInteger(seats)||seats<1||seats>9)return showError('Indiquez un nom, un tarif entier entre 1 et 100 000 TND et un nombre de places entre 1 et 9.');
  if(image && !/^https?:\/\//i.test(image))return showError('Utilisez une adresse de photo commençant par http ou https.');
  if(!['Sedan','SUV','Sport','Compact'].includes(data.get('category')) || !['Tunis','La Marsa','Sousse'].includes(data.get('location')))return showError('Choisissez une catégorie et une agence dans les listes.');
  const existing=state.cars.find(car=>car.id===form.dataset.id);
  const values={name,price,seats,category:data.get('category'),location:data.get('location'),transmission:data.get('transmission'),fuel:data.get('fuel'),image:image||existing?.image||'assets/hero.jpg'};
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api(existing ? `/admin/cars/${encodeURIComponent(existing.id)}` : '/admin/cars', {
      method: existing ? 'PATCH' : 'POST', body: values
    });
    await reloadState();closeModal();renderCars();renderAdmin();toast(existing?'Les informations du véhicule ont été mises à jour.':'Un nouveau véhicule rejoint la collection.');
  } catch (error) { showError(error.message); }
  finally { if (button.isConnected) button.disabled = false; }
}

export function deleteCar(id) {
  if(!requireAdmin())return;const car=state.cars.find(item=>item.id===id);if(!car)return;
  if(state.orders.some(order=>order.carId===id&&bookingStatus(order)==='confirmed'))return toast('Annulez les réservations en cours de ce véhicule avant de le supprimer.');
  confirmAction('Retirer ce véhicule ?',`Retirer ${car.name} de la collection ? L’historique des locations sera conservé.`,'Supprimer le véhicule',async()=>{
    await api(`/admin/cars/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reloadState();closeModal();renderCars();renderAdmin();toast('Le véhicule a été retiré de la collection.');
  });
}

export function manageMember(id,remove=false) {
  if(!requireAdmin())return;const member=state.members.find(item=>item.id===id&&item.role!=='admin');if(!member)return;
  if(remove)confirmAction('Supprimer ce membre ?',`Supprimer le compte de ${member.name} et annuler ses réservations en cours ? L’historique des locations restera accessible dans l’administration.`,'Supprimer le membre',async()=>{
    await api(`/admin/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reloadState();closeModal();renderAdmin();toast('Le membre a été supprimé et ses réservations en cours ont été annulées.');
  });
  else confirmAction(member.suspended?'Réactiver ce compte ?':'Suspendre ce compte ?',member.suspended?`Rétablir l’accès de ${member.name} à son compte ?`:`Suspendre la connexion et les nouvelles réservations de ${member.name} ? Les réservations existantes seront conservées.` ,member.suspended?'Réactiver le membre':'Suspendre le membre',async()=>{
    const suspended = !member.suspended;
    await api(`/admin/members/${encodeURIComponent(id)}`, { method: 'PATCH', body: { suspended } });
    await reloadState();closeModal();renderAdmin();toast(suspended?'Le compte a été suspendu.':'Le compte a été réactivé.');
  });
}
