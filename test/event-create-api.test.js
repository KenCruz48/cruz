const test = require('node:test');
const assert = require('node:assert/strict');

const Event = require('../src/models/eventModel');
const authService = require('../src/services/authService');

process.env.JWT_SECRET =
  'clave-secreta-pruebas-racetrack-api-123456789';

test('POST /api/v1/events crea evento autenticado y responde 201', async (t) => {
  const ownerId = '507f1f77bcf86cd799439011';

  t.mock.method(authService, 'authenticate', async () => ({
    id: ownerId,
    name: 'Alexis Erazo',
    email: 'alexis@example.com',
  }));

  t.mock.method(Event, 'create', async (data) => ({
    _id: '507f191e810c19729de860ea',
    ...data,
    createdAt: new Date('2026-10-26T12:00:00Z'),
  }));

  delete require.cache[require.resolve('../src/app')];
  const app = require('../src/app');

  const server = app.listen(0);

  try {
    const port = server.address().port;

    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          name: 'Carrera 10K Putumayo',
          date: '2026-12-15T08:00:00Z',
          location: 'Mocoa, Putumayo',
          distance: 10,
          capacity: 300,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.status, 'success');
    assert.equal(
      body.message,
      'Evento creado correctamente'
    );
    assert.equal(body.data.name, 'Carrera 10K Putumayo');
    assert.equal(body.data.distance, 10);
    assert.equal(body.data.capacity, 300);
    assert.equal(body.data.status, 'active');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('POST /api/v1/events rechaza petición sin token', async () => {
  delete require.cache[require.resolve('../src/app')];
  const app = require('../src/app');

  const server = app.listen(0);

  try {
    const port = server.address().port;

    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Carrera prueba',
          date: '2026-12-15T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 100,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.status, 'error');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});