// Wire interface actions to feature modules and refresh server data when a tab regains focus.
import { $ } from './utils.js';
import { user, isAdmin, reloadState } from './store.js';
import { api } from './api.js';
import { modalState, closeModal, toast } from './ui.js';
import { selectCategory, resetFilters, searchCars, changeCollectionField } from './collection.js';
import { openAuth, openAccount, submitAuth } from './auth.js';
import { openBooking, submitBooking, updateBookingSummary, cancelOrder } from './rentals.js';
import { selectAdminTab, carForm, submitCar, deleteCar, manageMember } from './admin.js';
import { route } from './router.js';

export function registerEvents() {
  document.addEventListener('click',async event=>{
    const categoryButton=event.target.closest('[data-category]');if(categoryButton){selectCategory(categoryButton);return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const id=button.dataset.id;
    try { switch(button.dataset.action) {
      case 'close-modal':closeModal();break;
      case 'book':if(!user()){modalState.pendingCar=id;openAuth();}else openBooking(id);break;
      case 'login':modalState.pendingCar=null;openAuth();break;
      case 'auth-switch':openAuth(button.dataset.mode);break;
      case 'admin-login':modalState.pendingCar=null;openAuth('login',true);break;
      case 'logout':await api('/auth/logout',{method:'POST',body:{}});await reloadState();closeModal();location.hash='collection';route();toast('Vous êtes déconnecté. À bientôt sur la route.');break;
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
      case 'confirm':button.disabled=true;if(modalState.confirmCallback)await modalState.confirmCallback();break;
      case 'retry':await reloadState();route();break;
    } } catch(error) { toast(error.message); }
    finally { if(button.isConnected)button.disabled=false; }
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!['auth-form','booking-form','car-form','search-form'].includes(form.id))return;event.preventDefault();
    try {
      if(form.id==='auth-form')await submitAuth(form);
      if(form.id==='booking-form')await submitBooking(form);
      if(form.id==='car-form')await submitCar(form);
      if(form.id==='search-form')await searchCars();
    } catch(error) { toast(error.message); }
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
  async function syncAccount() {
    try {
      const previousId = user()?.id;
      await reloadState();
      if (previousId && !user()) closeModal();
      if (!$('#modal').open) route();
    } catch { /* Existing content remains visible when the connection is interrupted. */ }
  }
  window.addEventListener('focus', syncAccount);
  window.addEventListener('vellum:session-expired', syncAccount);
}
