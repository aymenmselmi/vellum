// Demo account creation, password hashing, and sign-in dialogs.
import { $, esc, uid } from './utils.js';
import { state, user, isAdmin, save, setSession } from './store.js';
import { modal, modalState, closeModal, toast, showError, errorMarkup } from './ui.js';
import { openBooking } from './rentals.js';
import { route, updateHeader } from './router.js';

async function passwordHash(password, salt) {
  if (!crypto.subtle) throw new Error('For account sign-in, open the app on localhost or an HTTPS address.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
}

export async function newMember(name,email,password,role='member',id=uid()) { const salt=uid(); return {id,name,email,salt,password:await passwordHash(password,salt),role,suspended:false}; }

export function openAuth(mode='login',admin=false) {
  const signup=mode==='signup';
  modal(`<p class="eyebrow">${admin?'THE VELLUM BACKOFFICE':signup?'YOUR JOURNEY STARTS HERE':'A FAMILIAR FACE'}</p><h2 id="modal-title">${signup?'Make yourself<br><em>at home.</em>':admin?'Behind the<br><em>collection.</em>':'Welcome<br><em>back.</em>'}</h2><p>${signup?'A few details, and the open road is yours.':admin?'Sign in to manage cars, reservations, and members.':'Sign in to find your next journey.'}</p><form id="auth-form" data-mode="${mode}" data-admin="${admin}">${signup?'<div class="form-group"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" placeholder="Your full name" required minlength="2" maxlength="60"></div>':''}<div class="form-group"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="120"></div><div class="form-group"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" placeholder="${signup?'At least 8 characters':'Your password'}" required minlength="${signup?8:1}" maxlength="128"></div>${errorMarkup}<button class="button dark form-submit" type="submit">${signup?'Create your account':'Sign in'} <span>↗</span></button></form>${!admin?`<div class="auth-switch"><span>${signup?'Already part of Vellum?':'New to Vellum?'}</span><button data-action="auth-switch" data-mode="${signup?'login':'signup'}">${signup?'Sign in':'Create an account'} ↗</button></div>`:''}<p class="demo-note">Frontend demo · Accounts stay in this browser.<br>${admin?'Admin: admin@vellum.demo / Vellum2026!':'Member: alex@vellum.demo / Vellum2026!'}<br><button data-action="demo-login" data-role="${admin?'admin':'member'}">Fill in the demo ${admin?'admin':'member'} details ↗</button></p>`);
}

export function openAccount() { const member=user(); if(!member) {modalState.pendingCar=null;openAuth();return;} modal(`<p class="eyebrow">YOUR VELLUM ACCOUNT</p><h2 id="modal-title">Hello,<br><em>${esc(member.name.split(' ')[0])}.</em></h2><p>${esc(member.email)}</p><div class="account-menu"><button class="button dark" data-action="go-rentals">My rentals <span>↗</span></button>${isAdmin()?'<button class="button" data-action="go-admin">Admin backoffice <span>↗</span></button>':''}<button class="button" data-action="logout">Sign out <span>↗</span></button></div>`); }

export async function submitAuth(form) {
  const button=$('button[type="submit"]',form); button.disabled=true;
  const email=form.elements.email.value.trim().toLowerCase(),password=form.elements.password.value;
  try {
    let member;
    if(form.dataset.mode==='signup') {
      const name=form.elements.name.value.trim();
      if(name.length<2 || password.length<8) throw new Error('Enter your name and a password with at least 8 characters.');
      if(state.members.some(item=>item.email===email)) throw new Error('An account with this email already exists. Please sign in.');
      member=await newMember(name,email,password);
      // Recheck after hashing in case another sign-up finished meanwhile.
      if(state.members.some(item=>item.email===email)) throw new Error('An account with this email already exists.');
      state.members.push(member);save();
    } else {
      member=state.members.find(item=>item.email===email);
      if(!member || await passwordHash(password,member.salt)!==member.password) throw new Error('The email or password isn’t right. Please try again.');
      if(member.suspended) throw new Error('This account is suspended. Please contact your administrator.');
      if(form.dataset.admin==='true' && member.role!=='admin') throw new Error('Please use an administrator account for the backoffice.');
    }
    const carId=modalState.pendingCar; const admin=form.dataset.admin==='true';setSession(member.id);updateHeader();closeModal();
    toast(`Welcome ${form.dataset.mode==='signup'?'to Vellum':'back'}, ${member.name.split(' ')[0]}.`);
    if(carId) openBooking(carId); else if(admin) {location.hash='admin';route();} else route();
  } catch(error) {showError(error.message);} finally {if(button.isConnected) button.disabled=false;}
}
