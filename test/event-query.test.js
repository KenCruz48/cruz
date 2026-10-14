const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../src/models/eventModel');
const service = require('../src/services/eventService');
const id = '507f1f77bcf86cd799439011';

function query(result, inspect = {}) {
  return Object.fromEntries(['select', 'sort', 'skip', 'limit', 'session'].map(name => [name, function(value) {
    inspect[name] = value; return this;
  }]).concat([['lean', async () => result]]));
}

test('lista eventos paginados con proyeccion publica y orden estable', async t => {
  const inspected = {};
  t.mock.method(Event, 'find', filter => {
    assert.deepEqual(filter, { status: 'active' });
    return query([{ _id: id, name: 'Carrera' }], inspected);
  });
  const result = await service.listEvents({ page: '2', limit: '5', status: 'active' });
  assert.equal(result.events.length, 1);
  assert.equal(inspected.skip, 5);
  assert.equal(inspected.limit, 5);
  assert.doesNotMatch(inspected.select, /owner|password|email/);
  assert.deepEqual(inspected.sort, { date: 1, _id: 1 });
});

test('consulta individual existente y 404 para inexistente', async t => {
  let value = { _id: id, name: 'Carrera' };
  t.mock.method(Event, 'findById', key => { assert.equal(key, id); return query(value); });
  assert.equal((await service.getEvent(id)).name, 'Carrera');
  value = null;
  await assert.rejects(service.getEvent(id), { status: 404 });
});

test('rechaza identificadores, filtros y paginacion invalidos antes de consultar MongoDB', async t => {
  const find = t.mock.method(Event, 'find', () => assert.fail('no consultar'));
  const byId = t.mock.method(Event, 'findById', () => assert.fail('no consultar'));
  await assert.rejects(service.getEvent('wrong'), { status: 400 });
  for (const params of [{ page: '0' }, { limit: '101' }, { limit: { $gt: 0 } }, { page: '1.5' }, { status: { $ne: 'cancelled' } }]) {
    await assert.rejects(service.listEvents(params), { status: 400 });
  }
  assert.equal(find.mock.callCount() + byId.mock.callCount(), 0);
});

test('GET eventos/ID usa servicio-modelo y responde 200/400/404 en JSON', async t => {
  t.mock.method(Event, 'find', () => query([]));
  t.mock.method(Event, 'findById', key => query(key === id ? { _id: id, name: 'Carrera' } : null));
  const server = require('../src/app').listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/events`;
  assert.deepEqual((await (await fetch(base)).json()).data.events, []);
  assert.equal((await fetch(`${base}/${id}`)).status, 200);
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012`)).status, 404);
  assert.equal((await fetch(`${base}/bad`)).status, 400);
});

test('modelo exige datos validos y enteros para los cupos', async () => {
  const data = { name: 'Carrera', date: new Date(), location: 'Bogota', distance: 5, capacity: 2, owner: id };
  await new Event(data).validate();
  for (const capacity of [0, -1, 1.5]) await assert.rejects(new Event({ ...data, capacity }).validate());
});

module.exports = { query };
