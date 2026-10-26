const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('../src/models/eventModel');
const { withReservedCapacity } = require('../src/services/capacityService');
const id = '507f1f77bcf86cd799439011';

test('reserva en el servidor con limite atomico y entrega la misma session al escritor', async t => {
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  t.mock.method(Event, 'findOneAndUpdate', async (filter, change, options) => {
    assert.deepEqual(filter.$expr, { $lt: ['$registeredCount', '$capacity'] });
    assert.equal(filter.status, 'active');
    assert.ok(filter.date.$gt instanceof Date);
    assert.deepEqual(change, { $inc: { registeredCount: 1 } });
    assert.equal(options.session, session);
    return { _id: id, capacity: 1, registeredCount: 1 };
  });
  assert.equal(await withReservedCapacity(id, async (received, event) => {
    assert.equal(received, session);
    assert.equal(event.registeredCount, event.capacity);
    return 'persistida';
  }), 'persistida');
});

test('cupo agotado, evento cancelado, pasado o inexistente impiden escribir', async t => {
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  t.mock.method(Event, 'findOneAndUpdate', async () => null);
  for (const [event, status, message] of [
    [null, 404, 'Evento no encontrado'],
    [{ status: 'cancelled' }, 409, 'Evento cancelado'],
    [{ status: 'active', date: new Date(0) }, 409, 'Evento iniciado'],
    [{ status: 'active', date: new Date(Date.now() + 60000) }, 409, 'Cupo agotado'],
  ]) {
    const mock = t.mock.method(Event, 'findById', () => ({ session: received => {
      assert.equal(received, session); return { lean: async () => event };
    } }));
    await assert.rejects(withReservedCapacity(id, () => assert.fail('no escribir')), { status, message });
    mock.mock.restore();
  }
});

test('el fallo del escritor propaga el rechazo y aborta la transaccion', async t => {
  t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
  t.mock.method(Event, 'findOneAndUpdate', async () => ({ _id: id }));
  await assert.rejects(withReservedCapacity(id, async () => { throw new Error('fallo persistencia'); }), /fallo persistencia/);
});
