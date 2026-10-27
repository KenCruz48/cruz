const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('../src/models/eventModel');
const Registration = require('../src/models/registrationModel');
const { withReservedCapacity } = require('../src/services/capacityService');

async function runSystem(fixture) {
  const checks = [];
  const api = async (route, method = 'GET', body, token) => {
    const response = await fetch(fixture.baseUrl + '/api/v1' + route, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const login = email => api('/users/login', 'POST', { email, password: fixture.password });
  const ownerToken = (await login('owner@example.invalid')).body.data.token;
  const runnerToken = (await login('runner@example.invalid')).body.data.token;
  const created = await api('/events', 'POST', { name: 'Flujo completo QA', date: new Date(Date.now() + 172800000).toISOString(),
    location: 'Pista QA', distance: 10, capacity: 2 }, ownerToken);
  assert.equal(created.status, 201); const eventId = created.body.data.id; checks.push('Creación HTTP de evento');
  const registration = await api('/registrations', 'POST', { eventId, categoryId: String(fixture.category._id) }, runnerToken);
  assert.equal(registration.status, 201); const registrationId = registration.body.data.id; checks.push('Inscripción transaccional HTTP');
  assert.equal((await api(`/events/${eventId}/participants`, 'GET', null, runnerToken)).status, 403);
  const participants = await api(`/events/${eventId}/participants`, 'GET', null, ownerToken);
  assert.equal(participants.status, 200); assert.doesNotMatch(JSON.stringify(participants.body), /passwordHash|runner@example/);
  checks.push('Privacidad y dueño de participantes');
  assert.equal((await api('/results', 'POST', { eventId, registrationId, timeMs: 123456 }, runnerToken)).status, 403);
  assert.equal((await api('/results', 'POST', { eventId, registrationId, timeMs: 123456 }, ownerToken)).status, 201);
  const ranking = await api(`/events/${eventId}/ranking`);
  assert.equal(ranking.status, 200); assert.equal(ranking.body.data.total, 1);
  assert.equal(ranking.body.data.ranking[0].rank, 1); assert.equal(ranking.body.data.ranking[0].timeMs, 123456);
  checks.push('Escritura de resultados → ranking/podio real');
  assert.equal((await api(`/registrations/${registrationId}`, 'DELETE', null, runnerToken)).status, 200);
  assert.equal((await api(`/events/${eventId}/ranking`)).body.data.total, 0);
  assert.equal((await Event.findById(eventId)).registeredCount, 0); checks.push('Cancelación libera cupo y retira resultado');
  const concurrencyEvent = await Event.create({ name: 'Concurrencia QA', date: new Date(Date.now() + 86400000), location: 'QA', distance: 5, capacity: 3, owner: fixture.owner.id });
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => withReservedCapacity(String(concurrencyEvent._id),
    async session => Registration.create([{ event: concurrencyEvent._id, participant: new mongoose.Types.ObjectId() }], { session }))));
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 3);
  assert.equal((await Event.findById(concurrencyEvent._id)).registeredCount, 3); checks.push('12 reservas concurrentes / 3 cupos exactos');
  const before = (await Event.findById(eventId)).registeredCount;
  await assert.rejects(withReservedCapacity(eventId, async () => { throw new Error('QA rollback'); }), /QA rollback/);
  assert.equal((await Event.findById(eventId)).registeredCount, before); checks.push('Rollback real del contador');
  assert.equal((await api('/events/not-an-id')).status, 400);
  assert.equal((await api(`/events/${new mongoose.Types.ObjectId()}`)).status, 404); checks.push('Errores 400/404 controlados');
  return checks;
}
module.exports = { runSystem };
