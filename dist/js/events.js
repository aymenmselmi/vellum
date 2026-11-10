// Wire user actions to feature modules once, after the initial demo data loads.
import { $ } from './utils.js';
import { STORAGE_KEY, user, isAdmin, setSession, setState } from './store.js';
import { modalState, closeModal, toast } from './ui.js';
import { selectCategory, resetFilters, searchCars, changeCollectionField } from './collection.js';
import { openAuth, openAccount, submitAuth } from './auth.js';
import { openBooking, submitBooking, updateBookingSummary, cancelOrder } from './rentals.js';
import { selectAdminTab, carForm, submitCar, deleteCar, manageMember } from './admin.js';
import { route } from './router.js';

export function registerEvents() {
  document.addEventListener('click',event=>{
    const categoryButton=event.target.closest('[data-category]');if(categoryButton){selectCategory(categoryButton);return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const id=button.dataset.id;
    switch(button.dataset.action) {
      case 'close-modal':closeModal();break;
      case 'book':if(!user()){modalState.pendingCar=id;openAuth();}else openBooking(id);break;
      case 'login':modalState.pendingCar=null;openAuth();break;
      case 'auth-switch':openAuth(button.dataset.mode);break;
      case 'admin-login':modalState.pendingCar=null;openAuth('login',true);break;
      case 'demo-login':$('#auth-email').value=button.dataset.role==='admin'?'admin@vellum.demo':'alex@vellum.demo';$('#auth-password').value='Vellum2026!';$('#auth-form button[type="submit"]').focus();break;
      case 'logout':setSession(null);closeModal();location.hash='collection';route();toast('You’re signed out. See you on the road.');break;
      case 'go-rentals':closeModal();location.hash='rentals';route();break;
      case 'go-admin':closeModal();location.hash='admin';route();break;
      case 'cancel-order':cancelOrder(id);break;
      case 'reset-filters':resetFilters();break;
      case 'admin-tab':selectAdminTab(button.dataset.tab);break;
      case 'add-car':carForm();break;
      case 'edit-car':carForm(id);break;
      case 'delete-car':deleteCar(id);break;
      case 'toggle-member':manageMember(id);break;
      case 'delete-member':manageMember(id,true);break;
      case 'confirm':if(modalState.confirmCallback)modalState.confirmCallback();break;
    }
  });
  document.addEventListener('submit',event=>{
    const form=event.target;if(!['auth-form','booking-form','car-form','search-form'].includes(form.id))return;event.preventDefault();
    if(form.id==='auth-form')submitAuth(form);
    if(form.id==='booking-form')submitBooking(form);
    if(form.id==='car-form')submitCar(form);
    if(form.id==='search-form')searchCars();
  });
  document.addEventListener('change',event=>{
    if(event.target.closest('#booking-form'))updateBookingSummary();
    if(['sort-cars','location-filter','pickup-date','return-date'].includes(event.target.id))changeCollectionField(event.target.id);
  });
  document.addEventListener('error',event=>{const image=event.target;if(image.tagName==='IMG' && !image.dataset.fallback){image.dataset.fallback='true';image.src='assets/hero.jpg';}},true);
  $('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const rect=$('#modal').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
  $('#modal').addEventListener('cancel',()=>{modalState.pendingCar=null;modalState.confirmCallback=null;});
  $('#account-button').addEventListener('click',openAccount);
  $('#admin-link').addEventListener('click',()=>{if(isAdmin()){location.hash='admin';route();}else{modalState.pendingCar=null;openAuth('login',true);}});
  window.addEventListener('hashchange',route);
  window.addEventListener('vellum:refresh',route);
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{const incoming=JSON.parse(event.newValue);if(Array.isArray(incoming.cars)&&Array.isArray(incoming.members)&&Array.isArray(incoming.orders)){setState(incoming);if(!user())setSession(null);closeModal();route();}}catch{/* Ignore invalid data from another tab. */}}});
}
