'use strict';
const $ = id => document.getElementById(id);
// Tokens remain in memory and are cleared on logout/reload.
let token = null;
let registrationId = null;
let page = 1;
async function request(path, method = 'GET', body) {
  const response = await fetch(`/api/v1${path}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `Error ${response.status}`);
  return payload.data;
}
function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).classList.toggle('error', error);
}
async function action(status, button, work) {
  button.disabled = true;
  try { await work(); } catch (error) { message(status, error.message, true); }
  finally { button.disabled = false; }
}
async function account(register = false) {
  return action('account-status', $(register ? 'register' : 'login'), async () => {
    const credentials = { email: $('email').value, password: $('password').value };
    if (register) await request('/users/register', 'POST', { ...credentials, name: $('name').value });
    const data = await request('/users/login', 'POST', credentials);
    token = data.token;
    $('password').value = '';
    $('logout').hidden = false;
    message('account-status', `Sesión iniciada: ${data.user.name}`);
  });
}
$('account-form').addEventListener('submit', event => { event.preventDefault(); account(); });
$('register').addEventListener('click', () => { if ($('account-form').reportValidity()) account(true); });
$('logout').addEventListener('click', () => {
  token = null; registrationId = null; $('logout').hidden = true; $('cancel-registration').hidden = true;
  message('account-status', 'Sesión cerrada.'); message('registration-status', '');
});
function option(value, label) { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; }
async function loadEvents() {
  message('events-status', 'Cargando eventos…');
  try {
    const data = await request(`/events?status=active&page=${page}&limit=10`);
    $('events').replaceChildren(); $('event').replaceChildren(option('', 'Selecciona un evento'));
    for (const event of data.events) {
      $('event').append(option(event._id, event.name));
      const card = document.createElement('article'); card.className = 'event-card';
      const title = document.createElement('h3'); title.textContent = event.name;
      const detail = document.createElement('p'); detail.textContent = `${event.location} · ${new Date(event.date).toLocaleDateString('es')} · ${event.distance} km · ${event.registeredCount}/${event.capacity} inscritos`;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Ver clasificación';
      button.addEventListener('click', () => action('ranking-status', button, async () => {
        const result = await request(`/events/${event._id}/ranking`);
        $('ranking').replaceChildren();
        for (const row of result.ranking) {
          const item = document.createElement('li'); item.value = row.rank;
          item.textContent = `${row.participant.name} · ${row.timeMs} ms`; $('ranking').append(item);
        }
        message('ranking-status', result.total ? `${result.total} resultados · ${event.name}` : 'Todavía no hay resultados.');
      }));
      card.append(title, detail, button); $('events').append(card);
    }
    message('events-status', data.events.length ? `${data.events.length} eventos disponibles` : 'No hay eventos en esta página.');
    $('previous').disabled = page === 1; $('next').disabled = data.events.length < 10;
    $('page-number').textContent = `Página ${page}`;
  } catch (error) { message('events-status', error.message, true); }
}
async function loadCategories() {
  try {
    let categoryPage = 1;
    while (true) {
      const data = await request(`/categories?status=active&page=${categoryPage}&limit=100`);
      for (const category of data) $('category').append(option(category._id, category.name));
      if (data.length < 100) break;
      categoryPage++;
    }
  } catch (error) { message('registration-status', error.message, true); }
}
$('refresh').addEventListener('click', loadEvents);
$('previous').addEventListener('click', () => { if (page > 1) { page--; loadEvents(); } });
$('next').addEventListener('click', () => { page++; loadEvents(); });
$('registration-form').addEventListener('submit', event => {
  event.preventDefault();
  action('registration-status', $('submit-registration'), async () => {
    if (!token) throw new Error('Inicia sesión para inscribirte.');
    const data = await request('/registrations', 'POST', { eventId: $('event').value, categoryId: $('category').value });
    registrationId = data.id; $('cancel-registration').hidden = false;
    message('registration-status', `Inscripción confirmada: ${registrationId}`); await loadEvents();
  });
});
$('cancel-registration').addEventListener('click', () => action('registration-status', $('cancel-registration'), async () => {
  await request(`/registrations/${registrationId}`, 'DELETE');
  registrationId = null; $('cancel-registration').hidden = true;
  message('registration-status', 'Inscripción cancelada.'); await loadEvents();
}));
loadEvents(); loadCategories();
