// Account dialogs. Mot de passe verification and sessions are handled by the server.
import { $, esc } from './utils.js';
import { api } from './api.js';
import { reloadState, user, isAdmin } from './store.js';
import { modal, modalState, closeModal, toast, showError, errorMarkup } from './ui.js';
import { openBooking } from './rentals.js';
import { route, updateHeader } from './router.js';

export function openAuth(mode='login',admin=false) {
  const signup=mode==='signup';
  modal(`<p class="eyebrow">${admin?'L’ESPACE D’ADMINISTRATION VELLUM':signup?'VOTRE VOYAGE COMMENCE ICI':'HEUREUX DE VOUS RETROUVER'}</p><h2 id="modal-title">${signup?'Bienvenue<br><em>chez vous.</em>':admin?'Les coulisses de<br><em>la collection.</em>':'Bon retour<br><em>parmi nous.</em>'}</h2><p>${signup?'Quelques informations, et la route est à vous.':admin?'Connectez-vous pour gérer les véhicules, les réservations et les membres.':'Connectez-vous pour préparer votre prochaine escapade.'}</p><form id="auth-form" data-mode="${mode}" data-admin="${admin}">${signup?'<div class="form-group"><label for="auth-name">Nom complet</label><input id="auth-name" name="name" autocomplete="name" placeholder="Votre nom complet" required minlength="2" maxlength="60"></div>':''}<div class="form-group"><label for="auth-email">Adresse e-mail</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="vous@exemple.tn" required maxlength="120"></div><div class="form-group"><label for="auth-password">Mot de passe</label><input id="auth-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" placeholder="${signup?'Au moins 8 caractères':'Votre mot de passe'}" required minlength="${signup?8:1}" maxlength="128"></div>${errorMarkup}<button class="button dark form-submit" type="submit">${signup?'Créer mon compte':'Se connecter'} <span>↗</span></button></form>${!admin?`<div class="auth-switch"><span>${signup?'Déjà membre de Vellum ?':'Nouveau sur Vellum ?'}</span><button data-action="auth-switch" data-mode="${signup?'login':'signup'}">${signup?'Se connecter':'Créer un compte'} ↗</button></div>`:''}<p class="small-print">${admin?"Utilisez le compte administrateur de votre agence.":"Retrouvez vos réservations sur votre compte, où que vous soyez."}</p>`);
}

export function openAccount() { const member=user(); if(!member) {modalState.pendingCar=null;openAuth();return;} modal(`<p class="eyebrow">VOTRE COMPTE VELLUM</p><h2 id="modal-title">Bonjour,<br><em>${esc(member.name.split(' ')[0])}.</em></h2><p>${esc(member.email)}</p><div class="account-menu"><button class="button dark" data-action="go-rentals">Mes locations <span>↗</span></button>${isAdmin()?'<button class="button" data-action="go-admin">Administration <span>↗</span></button>':''}<button class="button" data-action="logout">Se déconnecter <span>↗</span></button></div>`); }

export async function submitAuth(form) {
  const button=$('button[type="submit"]',form); button.disabled=true;
  const email=form.elements.email.value.trim().toLowerCase(),password=form.elements.password.value;
  try {
    const signup = form.dataset.mode === 'signup';
    if(form.dataset.mode==='signup') {
      const name=form.elements.name.value.trim();
      if(name.length<2 || password.length<8) throw new Error('Saisissez votre nom et un mot de passe d’au moins 8 caractères.');
      await api('/auth/register', { method: 'POST', body: { name, email, password } });
    } else {
      await api('/auth/login', { method: 'POST', body: { email, password, admin: form.dataset.admin === 'true' } });
    }
    await reloadState();
    const member = user();
    const carId=modalState.pendingCar; const admin=form.dataset.admin==='true';updateHeader();closeModal();
    toast(`${signup?'Bienvenue chez Vellum':'Bon retour'}, ${member.name.split(' ')[0]}.`);
    if(carId) openBooking(carId); else if(admin) {location.hash='admin';route();} else route();
  } catch(error) {showError(error.message);} finally {if(button.isConnected) button.disabled=false;}
}
