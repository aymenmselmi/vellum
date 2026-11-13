import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { startFixture, client, futureDate } from './helpers.js';

let fixture;
before(async () => { fixture = await startFixture(); });
after(async () => { if (fixture) await fixture.close(); });

test('anonymous bootstrap lists cars without exposing members, orders, or credentials', async () => {
  const visitor = client(fixture.base);
  const data = await visitor.bootstrap();
  assert.equal(data.cars.length, 6);
  assert.equal(data.user, null);
  assert.deepEqual(data.members, []);
  assert.deepEqual(data.orders, []);
  assert.doesNotMatch(JSON.stringify(data), /password_hash|scrypt\$/);
  assert.equal((await visitor.request('/health')).status, 200);
  assert.equal((await fetch(`${fixture.base}/.env`)).status, 404);
});

test('client-facing authorization and validation errors are in French', async () => {
  const visitor = client(fixture.base);
  const unauthorized = await visitor.request('/rentals', { method: 'POST', body: {} });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.data.error, 'Veuillez vous connecter pour continuer.');
  const invalidEmail = await visitor.request('/auth/register', { method: 'POST', body: {
    name: 'Test Français', email: 'adresse-invalide', password: 'Good-Password-2026!'
  } });
  assert.equal(invalidEmail.status, 400);
  assert.match(invalidEmail.data.error, /adresse e-mail valide/);
  await visitor.login();
  const invalidCategory = await visitor.request('/admin/cars', { method: 'POST', body: {
    name: 'Voiture de test', category: 'unknown', location: 'Tunis', price: 190,
    seats: 4, transmission: 'Automatic', fuel: 'Petrol'
  } });
  assert.equal(invalidCategory.status, 400);
  assert.equal(invalidCategory.data.error, 'Choisissez une catégorie valide.');
});

test('registration hashes passwords, sets an HttpOnly session, and rejects role injection', async () => {
  const member = client(fixture.base);
  const account = await member.register();
  const saved = await fixture.pool.query('SELECT password_hash FROM members WHERE id=$1', [account.id]);
  assert.match(saved.rows[0].password_hash, /^scrypt\$/);
  assert.ok(!saved.rows[0].password_hash.includes(account.password));
  const login = await member.login(account.email, account.password);
  assert.match(login.response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.response.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.equal((await member.bootstrap()).user.id, account.id);
  const duplicate = await member.request('/auth/register', { method:'POST', body:{name:'Duplicate',email:account.email,password:account.password} });
  assert.equal(duplicate.status,409);
  const injection = await member.request('/auth/register', { method:'POST', body:{name:'Sneaky',email:'sneaky@example.test',password:account.password,role:'admin'} });
  assert.equal(injection.status,400);
});

test('admin mutations require a real server-side administrator session', async () => {
  const visitor = client(fixture.base);
  assert.equal((await visitor.request('/admin/cars', {method:'POST',body:{}})).status,401);
  const member = client(fixture.base);
  const account = await member.register();
  assert.equal((await member.request('/admin/cars', {method:'POST',body:{}})).status,403);
  assert.equal((await member.login(account.email,account.password,true)).status,403);
});

test('CSRF protection rejects cross-origin requests, form submissions, and missing session tokens', async () => {
  const member = client(fixture.base);
  await member.register();
  assert.equal((await member.request('/auth/logout',{method:'POST',body:{},headers:{Origin:'https://other.example'}})).status,403);
  assert.equal((await member.request('/auth/logout',{method:'POST',body:{},headers:{'X-CSRF-Token':''}})).status,403);
  assert.equal((await member.request('/auth/login',{method:'POST',body:{},headers:{'Content-Type':'text/plain'}})).status,415);
});

test('booking totals come from the server and rental history belongs to the current member', async () => {
  const member=client(fixture.base), stranger=client(fixture.base);
  const account=await member.register();await stranger.register();
  const body={carId:'car-bmw',start:futureDate(10),end:futureDate(13)};
  assert.equal((await member.request('/rentals',{method:'POST',body:{...body,total:1,memberId:randomUUID()}})).status,400);
  const booking=await member.request('/rentals',{method:'POST',body});
  assert.equal(booking.status,201);assert.equal(booking.data.order.total,780);
  assert.equal(booking.data.order.memberId,account.id);
  assert.equal((await member.bootstrap()).orders.length,1);
  assert.deepEqual((await stranger.bootstrap()).orders,[]);
  assert.equal((await stranger.request(`/rentals/${booking.data.order.id}/cancel`,{method:'PATCH',body:{}})).status,404);
  assert.equal((await member.request('/rentals',{method:'POST',body:{...body,start:'2026-02-30'}})).status,400);
  assert.equal((await member.request('/rentals',{method:'POST',body:{...body,end:body.start}})).status,400);
  const cancelled=await member.request(`/rentals/${booking.data.order.id}/cancel`,{method:'PATCH',body:{}});
  assert.equal(cancelled.data.order.status,'cancelled');
});

test('concurrent overlapping reservations yield one success and one conflict; adjacent dates work', async () => {
  const first=client(fixture.base),second=client(fixture.base);
  await first.register();await second.register();
  const body={carId:'car-porsche',start:futureDate(30),end:futureDate(33)};
  const results=await Promise.all([first.request('/rentals',{method:'POST',body}),second.request('/rentals',{method:'POST',body})]);
  assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);
  const winner=results.find(result=>result.status===201).data.order;
  // Bypass the API deliberately: the PostgreSQL constraint must still reject a clash.
  await assert.rejects(fixture.pool.query(`INSERT INTO rentals
    (id,reference,car_id,member_id,start_date,end_date,daily_rate,car_name,car_image,member_name,member_email,location)
    SELECT $1,$2,car_id,member_id,start_date,end_date,daily_rate,car_name,car_image,member_name,member_email,location
    FROM rentals WHERE id=$3`,[randomUUID(),`TEST-${randomUUID().slice(0,8)}`,winner.id]),{code:'23P01'});
  assert.equal((await second.request('/rentals',{method:'POST',body:{...body,start:body.end,end:futureDate(34)}})).status,201);
});

test('admin car controls retain booked prices and protect active reservations', async () => {
  const admin=client(fixture.base),member=client(fixture.base);
  await admin.login();await member.register();
  const car={name:'Test City Car',category:'Compact',location:'Tunis',price:190,seats:4,transmission:'Automatic',fuel:'Petrol',image:'assets/hero.jpg'};
  const created=await admin.request('/admin/cars',{method:'POST',body:car});assert.equal(created.status,201);
  const id=created.data.car.id;
  const order=await member.request('/rentals',{method:'POST',body:{carId:id,start:futureDate(10),end:futureDate(13)}});
  assert.equal((await admin.request(`/admin/cars/${id}`,{method:'DELETE'})).status,409);
  assert.equal((await admin.request(`/admin/cars/${id}`,{method:'PATCH',body:{...car,price:210}})).status,200);
  assert.equal((await member.bootstrap()).orders[0].total,570);
  assert.equal((await admin.request(`/rentals/${order.data.order.id}/cancel`,{method:'PATCH',body:{}})).status,200);
  assert.equal((await admin.request(`/admin/cars/${id}`,{method:'DELETE'})).status,204);
  assert.ok(!(await admin.bootstrap()).cars.some(item=>item.id===id));
  assert.equal((await member.bootstrap()).orders[0].carName,car.name);
  assert.equal((await admin.request('/admin/cars',{method:'POST',body:{...car,image:'javascript:alert(1)'}})).status,400);
});

test('suspending a member revokes sessions; reactivation allows login; deleting cancels bookings', async () => {
  const admin=client(fixture.base),member=client(fixture.base);
  await admin.login();const account=await member.register();
  const order=await member.request('/rentals',{method:'POST',body:{carId:'car-mini',start:futureDate(50),end:futureDate(52)}});
  assert.equal((await admin.request(`/admin/members/${account.id}`,{method:'PATCH',body:{suspended:true}})).status,204);
  assert.equal((await member.bootstrap()).user,null);
  assert.equal((await member.login(account.email,account.password)).status,403);
  assert.equal((await member.request('/rentals',{method:'POST',body:{}})).status,401);
  assert.equal((await admin.request(`/admin/members/${account.id}`,{method:'PATCH',body:{suspended:false}})).status,204);
  assert.equal((await member.login(account.email,account.password)).status,200);
  assert.equal((await admin.request(`/admin/members/${account.id}`,{method:'DELETE'})).status,204);
  assert.equal((await member.bootstrap()).user,null);
  const data=await admin.bootstrap();
  assert.ok(!data.members.some(item=>item.id===account.id));
  assert.equal(data.orders.find(item=>item.id===order.data.order.id).status,'cancelled');
  assert.equal((await admin.request(`/admin/members/${data.user.id}`,{method:'DELETE'})).status,404);
});

test('logout removes the server session and expired sessions are not accepted', async () => {
  const member=client(fixture.base);
  const account=await member.register();
  const token=member.cookie.slice('vellum_session='.length);
  const records=await fixture.pool.query('SELECT token_hash FROM sessions WHERE member_id=$1',[account.id]);
  assert.notEqual(records.rows[0].token_hash,token);
  await fixture.pool.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE member_id=$1",[account.id]);
  assert.equal((await member.bootstrap()).user,null);
  await member.login(account.email,account.password);
  assert.equal((await member.request('/auth/logout',{method:'POST',body:{}})).status,204);
  assert.equal((await fixture.pool.query('SELECT 1 FROM sessions WHERE member_id=$1',[account.id])).rowCount,0);
  assert.equal((await member.bootstrap()).user,null);
});

test('a separate Node application instance can restore sessions and bookings from PostgreSQL', async () => {
  const member = client(fixture.base);
  const account = await member.register('Persistent Member');
  const booking = await member.request('/rentals', { method: 'POST', body: {
    carId: 'car-audi', start: futureDate(70), end: futureDate(72)
  } });
  const config = { ...fixture.config };
  const app = await createApp(fixture.pool, config);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const restored = await client(config.origin).request('/bootstrap', { headers: { Cookie: member.cookie } });
    assert.equal(restored.data.user.id, account.id);
    assert.equal(restored.data.orders[0].id, booking.data.order.id);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('repeated login attempts are rate limited', async () => {
  const config = { ...fixture.config, authLimit: 1 };
  const app = await createApp(fixture.pool, config);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const visitor = client(config.origin);
    const request = { method: 'POST', body: { email: 'missing@example.test', password: 'not-the-password' } };
    assert.equal((await visitor.request('/auth/login', request)).status, 401);
    assert.equal((await visitor.request('/auth/login', request)).status, 429);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
