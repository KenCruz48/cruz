const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../src/models/eventModel');
const Registration = require('../src/models/registrationModel');
const auth = require('../src/services/authService');
const service = require('../src/services/participantService');
const id = '507f1f77bcf86cd799439011';
function query(result) {
  const q = { lean: async () => result };
  for (const name of ['select', 'sort', 'skip', 'limit', 'populate']) q[name] = () => q;
  return q;
}

test('organizador obtiene solo inscripciones activas y nombres sin correo/hash', async t => {
  t.mock.method(Event, 'findById', () => query({ owner: id }));
  t.mock.method(Registration, 'find', filter => {
    assert.deepEqual(filter, { event: id, status: 'active' });
    return query([{ _id: id, participant: { _id: id, name: 'Runner', email: 'private', passwordHash: 'private' }, status: 'active' }]);
  });
  const result = await service.listParticipants(id, id);
  assert.deepEqual(result.participants[0].participant, { id, name: 'Runner' });
  assert.doesNotMatch(JSON.stringify(result), /private|password|email/);
});

test('rechaza no organizador y evento inexistente o ID incorrecto', async t => {
  let value = { owner: id };
  t.mock.method(Event, 'findById', () => query(value));
  await assert.rejects(service.listParticipants(id, 'other'), { status: 403 });
  value = null;
  await assert.rejects(service.listParticipants(id, id), { status: 404 });
  await assert.rejects(service.listParticipants('bad', id), { status: 400 });
});

test('endpoint requiere Bearer y respeta autenticacion y consulta por capas', async t => {
  t.mock.method(auth, 'authenticate', async token => {
    if (token !== 'valid') throw Object.assign(new Error('Credenciales invalidas'), { status: 401 });
    return { id };
  });
  t.mock.method(Event, 'findById', () => query({ owner: id }));
  t.mock.method(Registration, 'find', () => query([]));
  const server = require('../src/app').listen(0);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/v1/events/${id}/participants`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  const response = await fetch(url, { headers: { Authorization: 'Bearer valid' } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.participants, []);
});
