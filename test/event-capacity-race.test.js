const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../src/models/eventModel');
const { updateEvent } = require('../src/services/eventService');

test('una inscripción entre lectura y actualización no permite reducir el cupo bajo el contador', async t => {
  const id = '507f1f77bcf86cd799439011';
  const owner = '507f1f77bcf86cd799439012';
  const query = value => ({ select() { return this; }, lean: async () => value });
  t.mock.method(Event, 'findById', () => query({ owner, registeredCount: 1 }));
  // Another registration commits after the initial read, bringing the count to 2.
  t.mock.method(Event, 'findOneAndUpdate', (filter) => {
    assert.equal(filter._id, id); assert.equal(filter.owner, owner);
    assert.deepEqual(filter.registeredCount, { $lte: 1 });
    return query(null);
  });
  await assert.rejects(updateEvent(id, { capacity: 1 }, owner), { status: 409 });
});
