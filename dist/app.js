'use strict';

// A build-free frontend demo. Real authentication and authorization belong on a server.
const STORAGE_KEY = 'vellum-rentals-v1';
const SESSION_KEY = 'vellum-session-v1';
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const money = value => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
const icons = {
  check:'<path d="m5 12 4 4L19 6"/>',
  key:'<circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-3-3 3-3m-6 0 3-3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  support:'<path d="M4 14v-3a8 8 0 0 1 16 0v6c0 3-4 4-8 4"/><rect x="2" y="10" width="4" height="8" rx="2"/><rect x="18" y="10" width="4" height="8" rx="2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  transmission:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12-10v5H6m6-9v18"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-3-5"/>',
  fuel:'<path d="M3 21h12M5 21V4h8v17M5 10h8m0 3h3v5a2 2 0 0 0 4 0V8l-3-3"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.check}</svg>`; }
function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
function localDate(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dayNumber(date) { return Date.parse(date + 'T00:00:00Z') / 86400000; }
function validDates(start, end) { return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(dayNumber(start)) && Number.isFinite(dayNumber(end)) && start >= localDate() && end > start; }
function prettyDate(date) { return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' }); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function photoUrl(value) { if (!value) return 'assets/hero.jpg'; try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : 'assets/hero.jpg'; } catch { return /^assets\/[a-z-]+\.jpg$/.test(value) ? value : 'assets/hero.jpg'; } }
const initialCars = [
  {id:'car-mercedes',name:'Mercedes-AMG GT',category:'Sport',price:540,seats:2,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/mercedes.jpg',badge:'The extraordinary, everyday'},
  {id:'car-range',name:'Audi RS Q8',category:'SUV',price:450,seats:5,transmission:'Automatic',fuel:'Petrol',location:'La Marsa',image:'assets/range-rover.jpg',badge:'Room for possibility'},
  {id:'car-porsche',name:'Porsche Panamera',category:'Sport',price:850,seats:4,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/hero.jpg',badge:'The weekend escape'},
  {id:'car-bmw',name:'BMW 3 Series',category:'Sedan',price:260,seats:5,transmission:'Automatic',fuel:'Diesel',location:'Sousse',image:'assets/bmw.jpg',badge:'A driver’s favourite'},
  {id:'car-audi',name:'Audi RS7 Sportback',category:'Sport',price:620,seats:5,transmission:'Automatic',fuel:'Petrol',location:'Tunis',image:'assets/audi.jpg',badge:'Quietly exceptional'},
  {id:'car-mini',name:'MINI Countryman',category:'Compact',price:150,seats:5,transmission:'Automatic',fuel:'Petrol',location:'La Marsa',image:'assets/mini.jpg',badge:'Small car. Big plans.'}
];
let state, sessionId = null, category = 'all', datesFiltered = false, adminTab = 'cars', pendingCar = null, confirmCallback = null, toastTimer;
function readSession() { try { sessionId = sessionStorage.getItem(SESSION_KEY); } catch { sessionId = null; } }
function user() { return state.members.find(member => member.id === sessionId && !member.suspended); }
function isAdmin() { return user()?.role === 'admin'; }
function requireAdmin() { if (isAdmin()) return true; toast('Please sign in as an administrator.'); return false; }
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast('Browser storage is unavailable. Changes will last only for this visit.'); } }
function setSession(id) { sessionId = id; try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* In-memory sessions still work. */ } updateHeader(); }
async function passwordHash(password, salt) {
  if (!crypto.subtle) throw new Error('For account sign-in, open the app on localhost or an HTTPS address.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
}
async function newMember(name,email,password,role='member',id=uid()) { const salt=uid(); return {id,name,email,salt,password:await passwordHash(password,salt),role,suspended:false}; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),4500); }
function modal(content) { $('#modal-content').innerHTML = `<div class="modal-inner"><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>${content}</div>`; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); pendingCar = null; confirmCallback = null; }
function showError(message) { const error = $('#form-error'); if (error) { error.textContent=message; error.hidden=false; } else toast(message); }
const errorMarkup = '<p class="form-error" id="form-error" role="alert" hidden></p>';
function confirmAction(title,description,label,callback) { modal(`<p class="eyebrow">A QUICK CONFIRMATION</p><h2 id="modal-title">${esc(title)}</h2><p>${esc(description)}</p><button class="button dark form-submit" data-action="confirm">${esc(label)} <span>↗</span></button><button class="text-link" style="margin-top:20px" data-action="close-modal">Keep things as they are</button>`); confirmCallback=callback; }
function bookingStatus(order) { return order.status === 'cancelled' ? 'cancelled' : order.end <= localDate() ? 'completed' : 'confirmed'; }
function isAvailable(carId,start,end) { return !state.orders.some(order => order.carId === carId && order.status !== 'cancelled' && start < order.end && end > order.start); }
function updateHeader() {
  const member = user(); $('#account-label').textContent = member ? member.name.split(' ')[0] : 'Sign in';
  $('#rental-dot').hidden = !member || !state.orders.some(order => order.memberId === member.id && bookingStatus(order)==='confirmed');
  $('#admin-link').textContent = isAdmin() ? 'Open backoffice ↗' : 'Admin backoffice ↗';
}
function renderCars() {
  const location = $('#location-filter').value, start = $('#pickup-date').value, end = $('#return-date').value;
  let cars = state.cars.filter(car => !car.archived && (category==='all' || car.category===category) && (!location || car.location===location) && (!datesFiltered || isAvailable(car.id,start,end)));
  const sort = $('#sort-cars').value; if (sort!=='curated') cars.sort((a,b)=>sort==='price-asc'?a.price-b.price:b.price-a.price);
  const total = state.cars.filter(car=>!car.archived).length;
  $('#fleet-count').textContent=String(total).padStart(2,'0'); $('#result-count').textContent=`${cars.length} ${cars.length===1?'car':'cars'} ${datesFiltered?'available':'to discover'}`;
  $('#car-grid').innerHTML = cars.length ? cars.map((car,index)=>`<article class="car-card"><div class="car-photo"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}" loading="lazy"><span class="car-badge">${esc(car.badge || 'New to the collection')}</span><span class="photo-number">${String(index+1).padStart(2,'0')} / VELLUM</span></div><div class="car-content"><p class="car-category">${esc(car.category)} <span aria-hidden="true">·</span> ${esc(car.location)}</p><h3 class="car-title">${esc(car.name)}</h3><div class="car-specs"><span>${icon('transmission')}${esc(car.transmission)}</span><span>${icon('people')}${car.seats} seats</span><span>${icon('fuel')}${esc(car.fuel)}</span></div><div class="car-card-bottom"><div class="car-price"><span class="currency">TND</span>${money(car.price)}<small>/ day</small></div><button class="book-button" data-action="book" data-id="${esc(car.id)}" aria-label="Rent ${esc(car.name)}">Discover & rent <span>↗</span></button></div></div></article>`).join('') : '<div class="empty-state"><h2>A different route?</h2><p>No cars match this selection. Try another location, category, or set of dates.</p><button class="button dark" data-action="reset-filters">Reset filters <span>↗</span></button></div>';
}
function route() {
  const page = location.hash.replace('#','') || 'collection';
  const view = ['rentals','about','admin'].includes(page) ? page : 'collection';
  document.querySelectorAll('.view').forEach(el=>el.hidden = el.id!==`${view}-view`);
  document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));
  if(view==='rentals') renderRentals(); if(view==='admin') renderAdmin(); if(view==='collection') renderCars();
  updateHeader(); document.title = `Vellum — ${view==='collection'?'A better way to get away.':view==='admin'?'The backoffice':view==='rentals'?'My rentals':'Our approach'}`;
  if(page==='fleet') requestAnimationFrame(()=>$('#fleet').scrollIntoView({behavior:'smooth'})); else window.scrollTo({top:0,behavior:'instant'});
}
function openAuth(mode='login',admin=false) {
  const signup=mode==='signup';
  modal(`<p class="eyebrow">${admin?'THE VELLUM BACKOFFICE':signup?'YOUR JOURNEY STARTS HERE':'A FAMILIAR FACE'}</p><h2 id="modal-title">${signup?'Make yourself<br><em>at home.</em>':admin?'Behind the<br><em>collection.</em>':'Welcome<br><em>back.</em>'}</h2><p>${signup?'A few details, and the open road is yours.':admin?'Sign in to manage cars, reservations, and members.':'Sign in to find your next journey.'}</p><form id="auth-form" data-mode="${mode}" data-admin="${admin}">${signup?'<div class="form-group"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" placeholder="Your full name" required minlength="2" maxlength="60"></div>':''}<div class="form-group"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="120"></div><div class="form-group"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" placeholder="${signup?'At least 8 characters':'Your password'}" required minlength="${signup?8:1}" maxlength="128"></div>${errorMarkup}<button class="button dark form-submit" type="submit">${signup?'Create your account':'Sign in'} <span>↗</span></button></form>${!admin?`<div class="auth-switch"><span>${signup?'Already part of Vellum?':'New to Vellum?'}</span><button data-action="auth-switch" data-mode="${signup?'login':'signup'}">${signup?'Sign in':'Create an account'} ↗</button></div>`:''}<p class="demo-note">Frontend demo · Accounts stay in this browser.<br>${admin?'Admin: admin@vellum.demo / Vellum2026!':'Member: alex@vellum.demo / Vellum2026!'}<br><button data-action="demo-login" data-role="${admin?'admin':'member'}">Fill in the demo ${admin?'admin':'member'} details ↗</button></p>`);
}
function openAccount() { const member=user(); if(!member) {pendingCar=null;openAuth();return;} modal(`<p class="eyebrow">YOUR VELLUM ACCOUNT</p><h2 id="modal-title">Hello,<br><em>${esc(member.name.split(' ')[0])}.</em></h2><p>${esc(member.email)}</p><div class="account-menu"><button class="button dark" data-action="go-rentals">My rentals <span>↗</span></button>${isAdmin()?'<button class="button" data-action="go-admin">Admin backoffice <span>↗</span></button>':''}<button class="button" data-action="logout">Sign out <span>↗</span></button></div>`); }
async function submitAuth(form) {
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
    const carId=pendingCar; const admin=form.dataset.admin==='true';setSession(member.id);closeModal();
    toast(`Welcome ${form.dataset.mode==='signup'?'to Vellum':'back'}, ${member.name.split(' ')[0]}.`);
    if(carId) openBooking(carId); else if(admin) {location.hash='admin';route();} else route();
  } catch(error) {showError(error.message);} finally {if(button.isConnected) button.disabled=false;}
}
function openBooking(id) {
  const car=state.cars.find(item=>item.id===id && !item.archived);if(!car) return toast('This car is no longer in the collection.');
  if(!user()) {pendingCar=id;openAuth();return;}
  pendingCar=id;
  modal(`<p class="eyebrow">A JOURNEY TO LOOK FORWARD TO</p><h2 id="modal-title">Make it <em>yours.</em></h2><div class="booking-car"><img src="${esc(photoUrl(car.image))}" alt="${esc(car.name)}"><div><h3>${esc(car.name)}</h3><p>${esc(car.location)} · ${car.seats} seats · ${esc(car.transmission)}</p></div></div><form id="booking-form" data-id="${esc(car.id)}"><div class="form-row"><div class="form-group"><label for="book-start">Pick-up date</label><input id="book-start" name="start" type="date" min="${localDate()}" value="${esc($('#pickup-date').value)}" required></div><div class="form-group"><label for="book-end">Return date</label><input id="book-end" name="end" type="date" min="${localDate(1)}" value="${esc($('#return-date').value)}" required></div></div><div class="booking-summary" id="booking-summary"></div>${errorMarkup}<button class="button dark form-submit" type="submit">Confirm reservation <span>↗</span></button><p class="small-print">Pick-up & return: ${esc(car.location)} agency. No payment is collected in this demo. You can cancel an upcoming rental in My rentals.</p></form>`);
  updateBookingSummary();
}
function updateBookingSummary() {
  const form=$('#booking-form');if(!form)return;
  const start=form.elements.start.value,end=form.elements.end.value,car=state.cars.find(item=>item.id===form.dataset.id);
  form.elements.end.min=start && start>=localDate()?localDateAfter(start):localDate(1);
  const days=dayNumber(end)-dayNumber(start);
  $('#booking-summary').innerHTML=validDates(start,end)?`<div class="summary-line"><span>TND ${money(car.price)} × ${days} ${days===1?'day':'days'}</span><span>TND ${money(car.price*days)}</span></div><div class="summary-line"><span>Reservation fee</span><span>Included</span></div><div class="summary-line total"><span>Your total</span><span>TND ${money(car.price*days)}</span></div>`:'<p class="small-print">Choose a pick-up date and a later return date to see your total.</p>';
}
function localDateAfter(date) { const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function submitBooking(form) {
  const member=user(),car=state.cars.find(item=>item.id===form.dataset.id && !item.archived),start=form.elements.start.value,end=form.elements.end.value;
  if(!member) return showError('Please sign in again before booking.');
  if(!car) return showError('This car is no longer available.');
  if(!validDates(start,end)) return showError('Choose a pick-up date from today onward and a later return date.');
  if(!isAvailable(car.id,start,end)) return showError('This car is already reserved for part of those dates. Please try other dates.');
  const order={id:uid(),reference:'VL-'+uid().replace(/-/g,'').slice(0,6).toUpperCase(),carId:car.id,carName:car.name,carImage:car.image,memberId:member.id,memberName:member.name,memberEmail:member.email,start,end,location:car.location,dailyRate:car.price,total:car.price*(dayNumber(end)-dayNumber(start)),status:'confirmed',createdAt:new Date().toISOString()};
  state.orders.unshift(order);save();closeModal();location.hash='rentals';route();toast(`You're booked. Your reservation is ${order.reference}.`);
}
function renderRentals() {
  const member=user(); const root=$('#rentals-view');
  if(!member) {root.innerHTML='<p class="eyebrow">YOUR NEXT CHAPTER</p><h1>Journeys,<br><em>all in one place.</em></h1><div class="empty-state"><h2>Your seat is waiting.</h2><p>Sign in to see your reservations and plan your next escape.</p><button class="button dark" data-action="login">Sign in <span>↗</span></button></div>';return;}
  const orders=state.orders.filter(order=>order.memberId===member.id);
  root.innerHTML=`<div class="page-top"><div><p class="eyebrow">YOUR VELLUM JOURNEYS</p><h1>My <em>rentals.</em></h1></div><a class="text-link" href="#fleet">Find another drive <span>↗</span></a></div>${orders.length?`<div class="rental-list">${orders.map(order=>{const status=bookingStatus(order);return `<article class="rental-card"><img src="${esc(photoUrl(order.carImage))}" alt="${esc(order.carName)}"><div><p class="eyebrow">${esc(order.reference)}</p><h2>${esc(order.carName)}</h2><p>${prettyDate(order.start)} → ${prettyDate(order.end)}</p><p>Pick-up & return · ${esc(order.location)}</p></div><div class="rental-actions"><span class="status ${status}">${status==='confirmed'?'Confirmed':status==='completed'?'Completed':'Cancelled'}</span><span class="car-price"><span class="currency">TND</span>${money(order.total)}</span>${status==='confirmed' && order.start>localDate()?`<button class="danger-link" data-action="cancel-order" data-id="${esc(order.id)}">Cancel reservation</button>`:''}</div></article>`;}).join('')}</div>`:'<div class="empty-state"><h2>A blank page. An open road.</h2><p>Your reservations will appear here. Let’s find your first drive.</p><a href="#fleet" class="button dark">Explore the collection <span>↗</span></a></div>'}`;
}
function cancelOrder(id) {
  const order=state.orders.find(item=>item.id===id),member=user();
  if(!order || !member || (!isAdmin() && (order.memberId!==member.id || order.start<=localDate())) || bookingStatus(order)!=='confirmed') return toast('This reservation cannot be cancelled.');
  confirmAction('A change of plans?',`Cancel ${order.reference} for ${order.carName}? The dates will be released back to the collection.`,'Cancel reservation',()=>{
    if(!user() || (!isAdmin() && (order.memberId!==user().id || order.start<=localDate())))return toast('You no longer have permission to cancel this reservation.');
    order.status='cancelled';save();closeModal();route();toast('Reservation cancelled. There’s always another journey.');
  });
}
function renderAdmin() {
  const root=$('#admin-view');
  if(!isAdmin()) {root.innerHTML='<p class="eyebrow">THE VELLUM BACKOFFICE</p><h1>Behind the<br><em>collection.</em></h1><div class="empty-state"><h2>A place for the details.</h2><p>Administrator access is required to manage cars, orders, and members.</p><button class="button dark" data-action="admin-login">Admin sign in <span>↗</span></button></div>';return;}
  const cars=state.cars.filter(car=>!car.archived),active=state.orders.filter(order=>bookingStatus(order)==='confirmed'),members=state.members.filter(member=>member.role!=='admin');
  root.innerHTML=`<div class="page-top"><div><p class="eyebrow">THE VELLUM BACKOFFICE</p><h1>A little <em>oversight.</em></h1></div><p>Welcome back, ${esc(user().name.split(' ')[0])}.</p></div><div class="stat-grid"><div class="stat-card"><p>Cars in the collection</p><strong>${String(cars.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Active reservations</p><strong>${String(active.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Registered members</p><strong>${String(members.length).padStart(2,'0')}</strong></div><div class="stat-card"><p>Booked value · TND</p><strong>${money(state.orders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.total,0))}</strong></div></div><div class="admin-tabs" role="group" aria-label="Backoffice sections">${['cars','orders','members'].map(tab=>`<button data-action="admin-tab" data-tab="${tab}" class="${adminTab===tab?'active':''}">${tab.charAt(0).toUpperCase()+tab.slice(1)}</button>`).join('')}</div><div id="admin-table"></div><p class="admin-notice">Frontend demo · Data is saved in this browser. Member roles and demo sign-in are for exploring the interface. A production platform requires server-side authentication, permissions, and a shared database.</p>`;
  if(adminTab==='cars') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>The collection</h2><button class="button dark" data-action="add-car">Add a car <span>+</span></button></div>${cars.length?`<div class="table-wrap"><table><thead><tr><th>CAR</th><th>CATEGORY</th><th>AGENCY</th><th>DAILY RATE</th><th>ACTIONS</th></tr></thead><tbody>${cars.map(car=>`<tr><td class="table-name">${esc(car.name)}<small>${esc(car.transmission)} · ${car.seats} seats</small></td><td>${esc(car.category)}</td><td>${esc(car.location)}</td><td>TND ${money(car.price)}</td><td><div class="table-actions"><button data-action="edit-car" data-id="${esc(car.id)}">Edit</button><button class="danger-link" data-action="delete-car" data-id="${esc(car.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Start the collection.</h2><p>Add a car to make it available for members.</p></div>'}`;
  if(adminTab==='orders') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>Rental orders</h2><span>${state.orders.length} total reservations</span></div>${state.orders.length?`<div class="table-wrap"><table><thead><tr><th>RESERVATION</th><th>MEMBER</th><th>DATES</th><th>TOTAL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${state.orders.map(order=>{const status=bookingStatus(order);return `<tr><td class="table-name">${esc(order.carName)}<small>${esc(order.reference)}</small></td><td>${esc(order.memberName)}<small>${esc(order.memberEmail)}</small></td><td>${prettyDate(order.start)}<small>to ${prettyDate(order.end)}</small></td><td>TND ${money(order.total)}</td><td><span class="status ${status}">${status}</span></td><td>${status==='confirmed'?`<button class="danger-link" data-action="cancel-order" data-id="${esc(order.id)}">Cancel order</button>`:'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Room for new journeys.</h2><p>Member reservations will appear here.</p></div>'}`;
  if(adminTab==='members') $('#admin-table').innerHTML=`<div class="table-toolbar"><h2>The members</h2><span>${members.length} registered members</span></div>${members.length?`<div class="table-wrap"><table><thead><tr><th>MEMBER</th><th>RENTALS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${members.map(member=>`<tr><td class="table-name">${esc(member.name)}<small>${esc(member.email)}</small></td><td>${state.orders.filter(order=>order.memberId===member.id).length}</td><td><span class="status ${member.suspended?'suspended':''}">${member.suspended?'Suspended':'Active'}</span></td><td><div class="table-actions"><button data-action="toggle-member" data-id="${esc(member.id)}">${member.suspended?'Reactivate':'Suspend'}</button><button class="danger-link" data-action="delete-member" data-id="${esc(member.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>A community in the making.</h2><p>New members will appear here when they sign up.</p></div>'}`;
}
function carForm(id) {
  if(!requireAdmin())return;const car=state.cars.find(item=>item.id===id),edit=!!car;
  const options=(list,value)=>list.map(item=>`<option ${item===value?'selected':''}>${esc(item)}</option>`).join('');
  modal(`<p class="eyebrow">CURATE THE COLLECTION</p><h2 id="modal-title">${edit?'Refine the':'A new'} <em>${edit?'details.':'arrival.'}</em></h2><form id="car-form" data-id="${esc(car?.id||'')}"><div class="form-group"><label for="car-name">Car name</label><input id="car-name" name="name" required maxlength="60" value="${esc(car?.name||'')}" placeholder="e.g. Mercedes-Benz E-Class"></div><div class="form-row"><div class="form-group"><label for="car-category">Category</label><select id="car-category" name="category">${options(['Sedan','SUV','Sport','Compact'],car?.category)}</select></div><div class="form-group"><label for="car-location">Agency</label><select id="car-location" name="location">${options(['Tunis','La Marsa','Sousse'],car?.location)}</select></div></div><div class="form-row"><div class="form-group"><label for="car-price">Daily rate (TND)</label><input id="car-price" name="price" type="number" required min="1" max="100000" step="1" value="${car?.price||''}" placeholder="240"></div><div class="form-group"><label for="car-seats">Seats</label><input id="car-seats" name="seats" type="number" required min="1" max="9" step="1" value="${car?.seats||5}"></div></div><div class="form-row"><div class="form-group"><label for="car-transmission">Transmission</label><select id="car-transmission" name="transmission">${options(['Automatic','Manual'],car?.transmission)}</select></div><div class="form-group"><label for="car-fuel">Fuel</label><select id="car-fuel" name="fuel">${options(['Petrol','Diesel','Electric','Hybrid'],car?.fuel)}</select></div></div><div class="form-group"><label for="car-image">Photo URL (optional)</label><input id="car-image" name="image" type="url" placeholder="https://example.com/car.jpg" value="${car?.image?.startsWith('http')?esc(car.image):''}"></div>${errorMarkup}<button class="button dark form-submit" type="submit">${edit?'Save changes':'Add to collection'} <span>↗</span></button></form>`);
}
function submitCar(form) {
  if(!requireAdmin())return;const data=new FormData(form),name=data.get('name').trim(),price=Number(data.get('price')),seats=Number(data.get('seats')),image=data.get('image').trim();
  if(name.length<2 || !Number.isInteger(price)||price<1||price>100000||!Number.isInteger(seats)||seats<1||seats>9)return showError('Enter a car name, a whole-number rate from 1–100,000 TND, and 1–9 seats.');
  if(image && !/^https?:\/\//i.test(image))return showError('Use an http or https photo URL.');
  if(!['Sedan','SUV','Sport','Compact'].includes(data.get('category')) || !['Tunis','La Marsa','Sousse'].includes(data.get('location')))return showError('Please choose a listed category and agency.');
  const existing=state.cars.find(car=>car.id===form.dataset.id);
  const values={name,price,seats,category:data.get('category'),location:data.get('location'),transmission:data.get('transmission'),fuel:data.get('fuel'),image:image||existing?.image||'assets/hero.jpg'};
  if(existing)Object.assign(existing,values);else state.cars.push({id:uid(),...values,badge:'New to the collection'});
  save();closeModal();renderCars();renderAdmin();toast(existing?'Car details updated.':'A new arrival joins the collection.');
}
function deleteCar(id) {
  if(!requireAdmin())return;const car=state.cars.find(item=>item.id===id);if(!car)return;
  if(state.orders.some(order=>order.carId===id&&bookingStatus(order)==='confirmed'))return toast('Cancel this car’s active reservations before deleting it.');
  confirmAction('Leave the collection?',`Remove ${car.name} from the collection? Past rental records will be preserved.`,'Delete car',()=>{if(!requireAdmin())return;if(state.orders.some(order=>order.carId===id&&bookingStatus(order)==='confirmed'))return toast('This car now has an active reservation.');car.archived=true;save();closeModal();renderCars();renderAdmin();toast('Car removed from the collection.');});
}
function manageMember(id,remove=false) {
  if(!requireAdmin())return;const member=state.members.find(item=>item.id===id&&item.role!=='admin');if(!member)return;
  if(remove)confirmAction('Remove this member?',`Delete ${member.name}’s account and cancel their active reservations? Existing rental history will remain in the backoffice.`,'Delete member',()=>{if(!requireAdmin())return;state.orders.filter(order=>order.memberId===id&&bookingStatus(order)==='confirmed').forEach(order=>order.status='cancelled');state.members=state.members.filter(item=>item.id!==id);save();closeModal();renderAdmin();toast('Member deleted and active reservations cancelled.');});
  else confirmAction(member.suspended?'Welcome them back?':'Pause this membership?',member.suspended?`Restore ${member.name}’s access to their account?`:`Suspend ${member.name}’s sign-in and new bookings? Existing reservations will be kept.` ,member.suspended?'Reactivate member':'Suspend member',()=>{if(!requireAdmin())return;member.suspended=!member.suspended;save();closeModal();renderAdmin();toast(member.suspended?'Membership suspended.':'Membership reactivated.');});
}
function resetFilters() {category='all';datesFiltered=false;$('#location-filter').value='';$('#sort-cars').value='curated';document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('active',button.dataset.category==='all'));renderCars();}

document.addEventListener('click',event=>{
  const categoryButton=event.target.closest('[data-category]');if(categoryButton){category=categoryButton.dataset.category;document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('active',button===categoryButton));renderCars();return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const id=button.dataset.id;
  switch(button.dataset.action) {
    case 'close-modal':closeModal();break;
    case 'book':openBooking(id);break;
    case 'login':pendingCar=null;openAuth();break;
    case 'auth-switch':openAuth(button.dataset.mode);break;
    case 'admin-login':pendingCar=null;openAuth('login',true);break;
    case 'demo-login':$('#auth-email').value=button.dataset.role==='admin'?'admin@vellum.demo':'alex@vellum.demo';$('#auth-password').value='Vellum2026!';$('#auth-form button[type="submit"]').focus();break;
    case 'logout':setSession(null);closeModal();location.hash='collection';route();toast('You’re signed out. See you on the road.');break;
    case 'go-rentals':closeModal();location.hash='rentals';route();break;
    case 'go-admin':closeModal();location.hash='admin';route();break;
    case 'cancel-order':cancelOrder(id);break;
    case 'reset-filters':resetFilters();break;
    case 'admin-tab':if(requireAdmin()){adminTab=button.dataset.tab;renderAdmin();}break;
    case 'add-car':carForm();break;
    case 'edit-car':carForm(id);break;
    case 'delete-car':deleteCar(id);break;
    case 'toggle-member':manageMember(id);break;
    case 'delete-member':manageMember(id,true);break;
    case 'confirm':if(confirmCallback)confirmCallback();break;
  }
});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['auth-form','booking-form','car-form','search-form'].includes(form.id))return;event.preventDefault();
  if(form.id==='auth-form')submitAuth(form);
  if(form.id==='booking-form')submitBooking(form);
  if(form.id==='car-form')submitCar(form);
  if(form.id==='search-form'){const start=$('#pickup-date').value,end=$('#return-date').value;if(!validDates(start,end))return toast('Choose a pick-up date from today and a later return date.');datesFiltered=true;renderCars();toast('Showing cars available for your selected dates.');}
});
document.addEventListener('change',event=>{
  if(event.target.closest('#booking-form'))updateBookingSummary();
  if(event.target.id==='sort-cars')renderCars();
  if(event.target.id==='location-filter')renderCars();
  if(['pickup-date','return-date'].includes(event.target.id)){datesFiltered=false;if(event.target.id==='pickup-date'){$('#return-date').min=$('#pickup-date').value?localDateAfter($('#pickup-date').value):localDate(1);if($('#return-date').value<=$('#pickup-date').value)$('#return-date').value=localDateAfter($('#pickup-date').value);}renderCars();}
});
document.addEventListener('error',event=>{const image=event.target;if(image.tagName==='IMG' && !image.dataset.fallback){image.dataset.fallback='true';image.src='assets/hero.jpg';}},true);
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const rect=$('#modal').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
$('#modal').addEventListener('cancel',()=>{pendingCar=null;confirmCallback=null;});
$('#account-button').addEventListener('click',openAccount);
$('#admin-link').addEventListener('click',()=>{if(isAdmin()){location.hash='admin';route();}else{pendingCar=null;openAuth('login',true);}});
window.addEventListener('hashchange',route);
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{const incoming=JSON.parse(event.newValue);if(Array.isArray(incoming.cars)&&Array.isArray(incoming.members)&&Array.isArray(incoming.orders)){state=incoming;if(!user())setSession(null);closeModal();route();}}catch{/* Ignore invalid data from another tab. */}}});

async function init() {
  try { const stored=JSON.parse(localStorage.getItem(STORAGE_KEY));if(stored&&Array.isArray(stored.cars)&&Array.isArray(stored.members)&&Array.isArray(stored.orders))state=stored; } catch { /* Start a fresh in-memory demo if storage is blocked or empty. */ }
  if(!state) {
    state={cars:initialCars.map(car=>({...car})),members:[],orders:[]};
    try {state.members=await Promise.all([newMember('Vellum Admin','admin@vellum.demo','Vellum2026!','admin','admin-demo'),newMember('Alex Morgan','alex@vellum.demo','Vellum2026!','member','member-demo')]);save();}catch(error){toast(error.message);}
  }
  readSession();$('#year').textContent=new Date().getFullYear();$('#pickup-date').min=localDate();$('#pickup-date').value=localDate(1);$('#return-date').min=localDate(2);$('#return-date').value=localDate(4);hydrateIcons();route();
}
init();
