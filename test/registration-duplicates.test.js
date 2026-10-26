
const test = require('node:test');
const assert = require('node:assert/strict');

const Registration = require('../src/models/registrationModel');
const { assertNoActiveDuplicate } = require('../src/services/registrationService');
const errorHandler = require('../src/middlewares/errorHandler');

const eventId = '507f1f77bcf86cd799439011';
const participantId = '507f191e810c19729de860ea';

test('permite continuar cuando no existe una inscripcion activa', async t => {
  t.mock.method(Registration, 'exists', async filter => {
    assert.deepEqual(filter, {
      event: eventId,
      participant: participantId,
      status: 'active',
    });
    return null;
  });

  await assert.doesNotReject(
    assertNoActiveDuplicate(eventId, participantId),
  );
});

test('rechaza una inscripcion activa duplicada con HTTP 409', async t => {
  t.mock.method(Registration, 'exists', async () => ({ _id: eventId }));

  await assert.rejects(
    assertNoActiveDuplicate(eventId, participantId),
    {
      status: 409,
      message: 'El participante ya tiene una inscripcion activa en este evento',
    },
  );
});

test('rechaza identificadores invalidos antes de consultar la base de datos', async t => {
  let queried = false;

  t.mock.method(Registration, 'exists', async () => {
    queried = true;
    return null;
  });

  await assert.rejects(
    assertNoActiveDuplicate('incorrecto', participantId),
    { status: 400 },
  );

  assert.equal(queried, false);
});

test('el modelo declara un indice unico parcial para inscripciones activas', () => {
  const indexes = Registration.schema.indexes();

  assert.ok(indexes.some(([keys, options]) =>
    keys.event === 1 &&
    keys.participant === 1 &&
    options.unique === true &&
    options.partialFilterExpression?.status === 'active' &&
    options.name === 'unique_active_registration_per_event_participant'
  ));
});

test('el manejador convierte E11000 en HTTP 409 y JSON', () => {
  const error = Object.assign(new Error('Duplicate key'), { code: 11000 });

  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  errorHandler(error, {}, response, error => {
    throw error;
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    status: 'error',
    message: 'El participante ya tiene una inscripcion activa en este evento',
  });
});
