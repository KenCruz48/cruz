'use strict';
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('es-CO');
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
let token = null;
let currentUser = null;
let sessionTimer;
let registrationId = null;
let registrationEvent = null;
let page = 1;
let events = [];
let eventVersion = 0;
let rankingVersion = 0;
let rankingSelection = null;

function message(id, text, error = false, success = false) {
  $(id).textContent = text;
  $(id).classList.toggle('error', error);
  $(id).classList.toggle('success', success && !error);
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function option(value, text) {
  const node = element('option', '', text); node.value = value; return node;
}
function resetSession(text = 'Sesión cerrada.') {
  clearTimeout(sessionTimer);
  token = null; currentUser = null; registrationId = null; registrationEvent = null;
  $('account-form').hidden = false; $('logout').hidden = true; $('cancel-registration').hidden = true;
  $('sidebar-name').textContent = 'Tu espacio deportivo'; $('sidebar-session').textContent = 'Accede a tu cuenta';
  $('sidebar-avatar').textContent = 'RT';
  $('password').value = ''; updateRegistrationSummary();
  message('account-status', text); message('registration-status', '');
}
async function request(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, { method, credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? 'La conexión tardó demasiado. Intenta de nuevo.' : 'No pudimos conectar. Comprueba la conexión e intenta de nuevo.');
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Recibimos una respuesta inesperada. Intenta de nuevo.'); }
  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/users/login')) resetSession('Tu sesión venció. Vuelve a iniciar sesión.');
    const error = new Error(payload.message || 'No pudimos completar la solicitud.');
    error.status = response.status; throw error;
  }
  return payload.data;
}
async function action(status, button, work) {
  if (button.disabled) return;
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { await work(); } catch (error) { message(status, error.message, true); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
async function account(register = false) {
  return action('account-status', $(register ? 'register' : 'login'), async () => {
    const credentials = { email: $('email').value.trim(), password: $('password').value };
    if (register && ($('name').value.trim().length < 2 || credentials.password.length < 8)) {
      throw new Error('Para crear tu cuenta, escribe tu nombre y una contraseña de al menos 8 caracteres.');
    }
    if (new TextEncoder().encode(credentials.password).length > 72) throw new Error('La contraseña supera la longitud permitida.');
    // Invalidate prior credentials and user-specific state before switching accounts.
    resetSession('Verificando tu cuenta…');
    if (register) await request('/users/register', 'POST', { ...credentials, name: $('name').value.trim() });
    const data = await request('/users/login', 'POST', credentials);
    token = data.token; currentUser = data.user;
    $('logout').hidden = false; $('account-form').hidden = true;
    $('sidebar-name').textContent = data.user.name; $('sidebar-session').textContent = 'Sesión iniciada';
    $('sidebar-avatar').textContent = data.user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    message('account-status', `Sesión iniciada: ${data.user.name}`, false, true);
    // This timer is only a UX safeguard. Authorization is always verified by the API.
    try {
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const remaining = claims.exp * 1000 - Date.now();
      sessionTimer = setTimeout(() => resetSession('Tu sesión venció. Vuelve a iniciar sesión.'), Math.max(0, Math.min(remaining, 2147483647)));
    } catch { resetSession('No pudimos abrir la sesión. Intenta de nuevo.'); }
  });
}
$('account-form').addEventListener('submit', event => { event.preventDefault(); account(); });
$('register').addEventListener('click', () => { if ($('account-form').reportValidity()) account(true); });
$('logout').addEventListener('click', () => resetSession());

function emptyState(title, description) {
  const container = element('div', 'empty-state');
  container.append(element('span', 'empty-symbol', '⚑'), element('strong', '', title), element('p', '', description));
  return container;
}
function canRegister(event) { return new Date(event.date).getTime() > Date.now() && event.registeredCount < event.capacity; }
function renderEvents() {
  const search = $('event-search').value.trim().toLocaleLowerCase('es');
  const distance = $('distance-filter').value;
  const visible = events.filter(event => {
    const matches = `${event.name} ${event.location}`.toLocaleLowerCase('es').includes(search);
    return matches && (distance === 'all' || distance === '5' && event.distance <= 5
      || distance === '10' && event.distance > 5 && event.distance <= 10 || distance === 'long' && event.distance > 10);
  });
  $('events').replaceChildren();
  if (!visible.length) {
    $('events').append(emptyState(events.length ? 'No encontramos coincidencias' : 'Tu próximo reto está por llegar',
      events.length ? 'Prueba otro nombre o cambia el filtro de distancia en esta página.' : 'Los eventos publicados aparecerán aquí. Actualiza el catálogo para consultar novedades.'));
  }
  for (const event of visible) {
    const date = new Date(event.date);
    const open = canRegister(event);
    const card = element('article', 'event-card');
    const calendar = element('div', 'event-date');
    calendar.setAttribute('aria-label', dateFormat.format(date));
    calendar.append(element('small', '', new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '')),
      element('strong', '', String(date.getDate()).padStart(2, '0')), element('span', '', String(date.getFullYear())));
    const content = element('div', 'event-content');
    const topline = element('div', 'event-topline');
    topline.append(element('span', 'event-distance', `${number.format(event.distance)} KM · CARRERA`),
      element('span', `event-badge${open ? '' : ' closed'}`, open ? 'Inscripciones abiertas' : date <= new Date() ? 'Inscripciones cerradas' : 'Cupo completo'));
    const footer = element('div', 'event-card-footer');
    const occupancy = element('div', 'event-occupancy');
    const meter = element('meter'); meter.min = 0; meter.max = Math.max(1, event.capacity); meter.value = event.registeredCount;
    meter.setAttribute('aria-label', `${event.registeredCount} inscritos de ${event.capacity} plazas`);
    occupancy.append(element('small', '', `${number.format(event.registeredCount)} / ${number.format(event.capacity)} inscritos`), meter);
    const actions = element('div', 'event-card-actions');
    const ranking = element('button', 'event-ranking', 'Ver clasificación'); ranking.type = 'button';
    ranking.addEventListener('click', () => { rankingSelection = { id: event._id, name: event.name, page: 1 }; loadRanking(); $('ranking-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const join = element('button', 'button button-outline event-join', 'Inscribirme ↗'); join.type = 'button'; join.disabled = !open;
    join.addEventListener('click', () => {
      $('event').value = event._id;
      $('registration-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('category').focus({ preventScroll: true });
      if (!token) message('registration-status', 'Inicia sesión en Mi cuenta para confirmar tu inscripción.');
    });
    actions.append(ranking, join); footer.append(occupancy, actions);
    content.append(topline, element('h3', '', event.name), element('p', 'event-location', `⌖  ${event.location}`), footer);
    card.append(calendar, content); $('events').append(card);
  }
  message('events-status', events.length ? `${visible.length} de ${events.length} eventos en esta página` : 'Catálogo actualizado');
}
async function loadEvents() {
  const version = ++eventVersion;
  const selected = $('event').value;
  const requestedPage = page;
  $('events').setAttribute('aria-busy', 'true'); $('refresh').disabled = true;
  $('previous').disabled = true; $('next').disabled = true;
  message('events-status', 'Actualizando eventos…');
  try {
    const data = await request(`/events?status=active&page=${requestedPage}&limit=10`);
    if (version !== eventVersion) return;
    events = data.events;
    $('event').replaceChildren(option('', 'Selecciona un evento'));
    for (const event of events) {
      const choice = option(event._id, event.name); choice.disabled = !canRegister(event); $('event').append(choice);
    }
    if (events.some(event => event._id === selected && canRegister(event))) $('event').value = selected;
    $('stat-events').textContent = number.format(events.length); $('nav-event-count').textContent = String(events.length);
    $('stat-places').textContent = number.format(events.reduce((sum, event) => sum + (canRegister(event) ? Math.max(0, event.capacity - event.registeredCount) : 0), 0));
    $('previous').disabled = page === 1; $('next').disabled = events.length < 10;
    $('page-number').textContent = `Página ${page}`;
    renderEvents();
  } catch (error) {
    if (version !== eventVersion) return;
    message('events-status', error.message, true);
    $('previous').disabled = page === 1;
    if (!events.length) $('events').replaceChildren(emptyState('No pudimos cargar los eventos', 'Pulsa Actualizar para intentarlo de nuevo.'));
  } finally {
    if (version === eventVersion) { $('events').setAttribute('aria-busy', 'false'); $('refresh').disabled = false; }
  }
}
async function loadCategories() {
  try {
    let categoryPage = 1;
    const categories = [];
    while (categoryPage <= 100) {
      const data = await request(`/categories?status=active&page=${categoryPage}&limit=100`);
      categories.push(...data);
      if (data.length < 100) break;
      categoryPage++;
    }
    $('category').replaceChildren(option('', categories.length ? 'Selecciona una categoría' : 'No hay categorías disponibles'));
    for (const category of categories) $('category').append(option(category._id, category.name));
    $('stat-categories').textContent = number.format(categories.length);
    if (categoryPage > 100) message('registration-status', 'Hay más categorías de las que podemos mostrar. Contacta al organizador.');
  } catch (error) { message('registration-status', error.message, true); }
}
function updateRegistrationSummary() {
  $('stat-registration').textContent = registrationId ? 'Confirmada' : 'Sin inscripción';
  $('stat-registration-note').textContent = registrationEvent?.name || 'Confirma tu siguiente reto';
}
$('refresh').addEventListener('click', loadEvents);
$('event-search').addEventListener('input', renderEvents);
$('distance-filter').addEventListener('change', renderEvents);
$('previous').addEventListener('click', () => { if (page > 1) { page--; loadEvents(); } });
$('next').addEventListener('click', () => { page++; loadEvents(); });
$('registration-form').addEventListener('submit', event => {
  event.preventDefault();
  action('registration-status', $('submit-registration'), async () => {
    if (!token) throw new Error('Inicia sesión para inscribirte.');
    const actor = currentUser.id;
    const selected = events.find(item => item._id === $('event').value);
    const data = await request('/registrations', 'POST', { eventId: $('event').value, categoryId: $('category').value });
    if (currentUser?.id !== actor) return;
    registrationId = data.id; registrationEvent = selected; $('cancel-registration').hidden = false;
    message('registration-status', 'Inscripción confirmada. Tu lugar está reservado.', false, true);
    updateRegistrationSummary(); await loadEvents();
  });
});
$('cancel-registration').addEventListener('click', () => action('registration-status', $('cancel-registration'), async () => {
  const actor = currentUser?.id;
  await request(`/registrations/${registrationId}`, 'DELETE');
  if (currentUser?.id !== actor) return;
  registrationId = null; registrationEvent = null; $('cancel-registration').hidden = true;
  updateRegistrationSummary(); message('registration-status', 'Inscripción cancelada.', false, true);
  await loadEvents(); if (rankingSelection) loadRanking();
}));

function timeLabel(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return `${hours ? String(hours).padStart(2, '0') + ':' : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
async function loadRanking() {
  if (!rankingSelection) return;
  const version = ++rankingVersion;
  const selected = { ...rankingSelection };
  $('ranking').replaceChildren(); $('ranking-empty').hidden = true; $('ranking-pagination').hidden = true;
  message('ranking-status', `Consultando ${selected.name}…`);
  try {
    const result = await request(`/events/${selected.id}/ranking?page=${selected.page}&limit=20`);
    if (version !== rankingVersion) return;
    for (const row of result.ranking) {
      const item = element('li', `ranking-row${row.rank <= 3 ? ' podium' : ''}`); item.value = row.rank;
      item.append(element('span', 'ranking-position', String(row.rank)), element('span', '', row.participant.name), element('span', 'ranking-time', timeLabel(row.timeMs)));
      $('ranking').append(item);
    }
    message('ranking-status', result.total ? `${selected.name} · ${number.format(result.total)} resultados · tiempo ascendente` : `${selected.name} · Todavía no hay resultados.`);
    $('ranking-empty').hidden = result.total !== 0;
    $('ranking-pagination').hidden = result.total <= 20;
    $('ranking-page-label').textContent = `Página ${selected.page} de ${Math.max(1, Math.ceil(result.total / 20))}`;
    $('ranking-previous').disabled = selected.page === 1;
    $('ranking-next').disabled = selected.page * 20 >= result.total;
  } catch (error) { if (version === rankingVersion) message('ranking-status', error.message, true); }
}
$('ranking-previous').addEventListener('click', () => { if (rankingSelection?.page > 1) { rankingSelection.page--; loadRanking(); } });
$('ranking-next').addEventListener('click', () => { if (rankingSelection) { rankingSelection.page++; loadRanking(); } });
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
  document.querySelectorAll('.nav-link').forEach(item => { item.classList.remove('active'); item.removeAttribute('aria-current'); });
  link.classList.add('active'); link.setAttribute('aria-current', 'location');
}));
async function checkConnection() {
  const status = $('connection-status');
  try {
    const response = await fetch('/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error();
    status.className = 'connection connected'; status.replaceChildren(element('i'), document.createTextNode('Servicio disponible'));
  } catch { status.className = 'connection disconnected'; status.replaceChildren(element('i'), document.createTextNode('Sin conexión al servicio')); }
}
$('today').textContent = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date());
$('copyright-year').textContent = String(new Date().getFullYear());
checkConnection(); loadEvents(); loadCategories();
setInterval(checkConnection, 60000);
