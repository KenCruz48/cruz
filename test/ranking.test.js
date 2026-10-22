const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('../src/models/eventModel');
const service = require('../src/services/rankingService');
const id = '507f1f77bcf86cd799439011';

function mockDatabase(t, result, exists = true) {
  t.mock.method(Event, 'exists', async () => exists ? { _id: id } : null);
  return t.mock.method(mongoose.connection, 'collection', name => {
    assert.equal(name, 'results');
    return { aggregate: (pipeline, options) => {
      assert.equal(options.maxTimeMS, 10000);
      return { toArray: async () => result };
    } };
  });
}

test('ranking rechaza IDs y parametros invalidos antes de consultar la BD', async t => {
  const exists = t.mock.method(Event, 'exists', () => assert.fail('no consultar'));
  for (const [eventId, query] of [['bad', {}], [id, { category: 'bad' }], [id, { limit: '101' }], [id, { page: '0' }], [id, { category: { $ne: null } }]]) {
    await assert.rejects(service.getRanking(eventId, query), { status: 400 });
  }
  assert.equal(exists.mock.callCount(), 0);
});

test('evento inexistente produce 404 y no ejecuta agregacion', async t => {
  const collection = mockDatabase(t, [], false);
  await assert.rejects(service.getRanking(id), { status: 404 });
  assert.equal(collection.mock.callCount(), 0);
});

test('evento sin resultados devuelve ranking y podio vacios', async t => {
  mockDatabase(t, [{ ranking: [], podium: [], metadata: [] }]);
  const result = await service.getRanking(id);
  assert.equal(result.total, 0);
  assert.equal(result.podiumCount, 0);
  assert.equal(result.podiumTruncated, false);
  assert.deepEqual(result.ranking, []);
  assert.deepEqual(result.podium, []);
});

test('paginacion conserva posiciones absolutas y comunica empates extensos', async t => {
  mockDatabase(t, [{ ranking: [{ rank: 21, timeMs: 2000 }], podium: [], metadata: [{ total: 120, podiumCount: 101 }] }]);
  const result = await service.getRanking(id, { page: '2', limit: '20' });
  assert.equal(result.ranking[0].rank, 21);
  assert.equal(result.total, 120);
  assert.equal(result.podiumTruncated, true);
  assert.equal(result.rules.ties, 'competition');
});

test('pipeline vincula evento e inscripcion, deduplica y calcula puestos antes de paginar', () => {
  const pipeline = service.buildPipeline(id, id, 20, 20);
  const registration = pipeline.find(stage => stage.$lookup?.from === 'registrations').$lookup;
  assert.equal(String(registration.pipeline[0].$match.event), id);
  assert.equal(String(registration.pipeline[0].$match.category), id);
  assert.equal(registration.pipeline[0].$match.status, 'active');
  assert.ok(pipeline.find(stage => stage.$group));
  const window = pipeline.findIndex(stage => stage.$setWindowFields);
  const facet = pipeline.findIndex(stage => stage.$facet);
  assert.ok(window < facet);
  assert.deepEqual(pipeline[window].$setWindowFields.output.rank, { $rank: {} });
  assert.deepEqual(pipeline[facet].$facet.ranking, [{ $skip: 20 }, { $limit: 20 }]);
  assert.doesNotMatch(JSON.stringify(pipeline.find(stage => stage.$project).$project), /email|password/);
});

test('GET ranking usa controller-service, es publico y propaga 400/404', async t => {
  t.mock.method(service, 'getRanking', async (eventId, query) => {
    if (eventId === 'bad') throw Object.assign(new Error('ID de evento invalido'), { status: 400 });
    if (eventId !== id) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });
    assert.equal(query.page, '2');
    return { eventId, ranking: [], podium: [], page: 2 };
  });
  const server = require('../src/app').listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/events`;
  const response = await fetch(`${base}/${id}/ranking?page=2`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.page, 2);
  assert.equal((await fetch(`${base}/bad/ranking`)).status, 400);
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012/ranking`)).status, 404);
});
