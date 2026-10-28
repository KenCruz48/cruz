
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Registration = require('../src/models/registrationModel');
const Event = require('../src/models/eventModel');
const { cancelRegistration } = require('../src/services/registrationCancellationService');

const registrationId = '507f1f77bcf86cd799439011';
const participantId = '507f1f77bcf86cd799439012';
const otherParticipantId = '507f1f77bcf86cd799439013';
const eventId = '507f1f77bcf86cd799439014';

function registrationFixture(overrides = {}) {
  return {
    _id: registrationId,
    event: eventId,
    participant: participantId,
    category: null,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function mockRegistrationLookup(t, registration) {
  t.mock.method(Registration, 'findById', () => ({
    session: session => ({
      lean: async () => registration,
    }),
  }));
}

test('cancela una inscripción activa sin eliminar el registro', async t => {
  const session = {};
  const registration = registrationFixture();
  const cancelled = registrationFixture({
    status: 'cancelled',
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });

  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  mockRegistrationLookup(t, registration);

  t.mock.method(Registration, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, {
      _id: registrationId,
      participant: participantId,
      status: 'active',
    });
    assert.deepEqual(update, { $set: { status: 'cancelled' } });
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    assert.equal(options.returnDocument, 'after');
    return cancelled;
  });

  t.mock.method(Event, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, {
      _id: eventId,
      registeredCount: { $gt: 0 },
    });
    assert.deepEqual(update, { $inc: { registeredCount: -1 } });
    assert.equal(options.session, session);
    assert.equal(options.returnDocument, 'after');
    return { _id: eventId, registeredCount: 0 };
  });

  const result = await cancelRegistration(registrationId, participantId);

  assert.equal(String(result.id), registrationId);
  assert.equal(result.status, 'cancelled');
  assert.equal(String(result.event), eventId);
});

test('rechaza un identificador de inscripción inválido', async () => {
  await assert.rejects(
    cancelRegistration('incorrecto', participantId),
    { status: 400, message: 'ID de inscripción invalido' },
  );
});

test('rechaza un identificador de participante inválido', async () => {
  await assert.rejects(
    cancelRegistration(registrationId, 'incorrecto'),
    { status: 400, message: 'ID de participante invalido' },
  );
});

test('responde 404 si la inscripción no existe', async t => {
  t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
  mockRegistrationLookup(t, null);

  await assert.rejects(
    cancelRegistration(registrationId, participantId),
    { status: 404, message: 'Inscripción no encontrada' },
  );
});

test('impide cancelar una inscripción de otro participante', async t => {
  t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
  mockRegistrationLookup(t, registrationFixture());

  await assert.rejects(
    cancelRegistration(registrationId, otherParticipantId),
    { status: 403, message: 'No puedes cancelar la inscripción de otro participante' },
  );
});

test('impide cancelar una inscripción que ya está cancelada', async t => {
  t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
  mockRegistrationLookup(t, registrationFixture({ status: 'cancelled' }));

  await assert.rejects(
    cancelRegistration(registrationId, participantId),
    { status: 409, message: 'La inscripción ya está cancelada' },
  );
});

test('rechaza si la inscripción deja de estar activa antes de actualizarla', async t => {
  const session = {};

  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  mockRegistrationLookup(t, registrationFixture());
  t.mock.method(Registration, 'findOneAndUpdate', async () => null);

  await assert.rejects(
    cancelRegistration(registrationId, participantId),
    { status: 409, message: 'La inscripción ya no está activa' },
  );
});

test('propaga el error si no puede actualizar el contador del evento', async t => {
  const session = {};

  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  mockRegistrationLookup(t, registrationFixture());
  t.mock.method(Registration, 'findOneAndUpdate', async () =>
    registrationFixture({ status: 'cancelled' }),
  );
  t.mock.method(Event, 'findOneAndUpdate', async () => null);

  await assert.rejects(
    cancelRegistration(registrationId, participantId),
    /No se pudo actualizar el contador/,
  );
});
