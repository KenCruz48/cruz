const test = require('node:test');
const assert = require('node:assert/strict');

const Event = require('../src/models/eventModel');
const authService = require('../src/services/authService');

process.env.JWT_SECRET =
  'clave-secreta-pruebas-racetrack-api-123456789';

const eventId = '507f1f77bcf86cd799439011';
const ownerId = '507f1f77bcf86cd799439012';
const otherUserId = '507f1f77bcf86cd799439013';

function queryResult(value) {
  return {
    select() {
      return this;
    },

    lean() {
      return Promise.resolve(value);
    },
  };
}

function startServer(t) {
  const app = require('../src/app');
  const server = app.listen(0);

  t.after(() =>
    new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    })
  );

  return `http://127.0.0.1:${server.address().port}`;
}

test(
  'PATCH /api/v1/events/:id actualiza un evento del organizador',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis Erazo',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', id => {
      assert.equal(id, eventId);

      return queryResult({
        _id: eventId,
        owner: ownerId,
        registeredCount: 20,
        status: 'active',
      });
    });

    t.mock.method(
      Event,
      'findOneAndUpdate',
      (filter, update, options) => {
        assert.equal(filter._id, eventId);
        assert.equal(filter.owner, ownerId);
        assert.deepEqual(filter.registeredCount, { $lte: 250 });
        assert.equal(update.$set.name, 'Carrera 10K Mocoa');
        assert.equal(update.$set.capacity, 250);
        assert.equal(options.new, true);
        assert.equal(options.runValidators, true);

        return queryResult({
          _id: eventId,
          name: 'Carrera 10K Mocoa',
          date: new Date('2026-12-20T08:00:00Z'),
          location: 'Mocoa, Putumayo',
          distance: 10,
          capacity: 250,
          registeredCount: 20,
          status: 'active',
        });
      }
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          name: 'Carrera 10K Mocoa',
          capacity: 250,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'success');
    assert.equal(
      body.message,
      'Evento actualizado correctamente'
    );
    assert.equal(body.data.name, 'Carrera 10K Mocoa');
    assert.equal(body.data.capacity, 250);
  }
);

test(
  'PATCH /api/v1/events/:id/cancel cancela un evento sin eliminarlo',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis Erazo',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', () =>
      queryResult({
        _id: eventId,
        owner: ownerId,
        status: 'active',
      })
    );

    t.mock.method(
      Event,
      'findByIdAndUpdate',
      (id, update, options) => {
        assert.equal(id, eventId);
        assert.equal(update.$set.status, 'cancelled');
        assert.equal(options.new, true);
        assert.equal(options.runValidators, true);

        return queryResult({
          _id: eventId,
          name: 'Carrera 5K Putumayo',
          status: 'cancelled',
          owner: ownerId,
        });
      }
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}/cancel`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token-valido-prueba',
        },
      }
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'success');
    assert.equal(
      body.message,
      'Evento cancelado correctamente'
    );
    assert.equal(body.data.status, 'cancelled');
  }
);

test(
  'PATCH de evento rechaza petición sin token con HTTP 401',
  async t => {
    const authenticate = t.mock.method(
      authService,
      'authenticate'
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Carrera modificada',
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.status, 'error');
    assert.equal(authenticate.mock.callCount(), 0);
  }
);

test(
  'PATCH de evento rechaza usuario que no es propietario con HTTP 403',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', () =>
      queryResult({
        _id: eventId,
        owner: otherUserId,
        registeredCount: 0,
        status: 'active',
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          name: 'Carrera modificada',
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.status, 'error');
    assert.equal(
      body.message,
      'No tienes permiso para actualizar este evento'
    );
  }
);

test(
  'PATCH de evento inexistente responde HTTP 404',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(
      Event,
      'findById',
      () => queryResult(null)
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          name: 'Carrera modificada',
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.status, 'error');
    assert.equal(
      body.message,
      'Evento no encontrado'
    );
  }
);

test(
  'PATCH rechaza cupo menor al número de inscritos con HTTP 409',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', () =>
      queryResult({
        _id: eventId,
        owner: ownerId,
        registeredCount: 100,
        status: 'active',
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          capacity: 50,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.status, 'error');
    assert.equal(
      body.message,
      'El cupo no puede ser menor al numero de inscritos'
    );
  }
);

test(
  'PATCH cancel rechaza un evento que ya está cancelado con HTTP 409',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', () =>
      queryResult({
        _id: eventId,
        owner: ownerId,
        status: 'cancelled',
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}/cancel`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token-valido-prueba',
        },
      }
    );

    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.status, 'error');
    assert.equal(
      body.message,
      'El evento ya esta cancelado'
    );
  }
);

test(
  'PATCH rechaza datos inválidos con HTTP 400',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: ownerId,
        name: 'Alexis',
        email: 'alexis@example.com',
      })
    );

    t.mock.method(Event, 'findById', () =>
      queryResult({
        _id: eventId,
        owner: ownerId,
        registeredCount: 0,
        status: 'active',
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          distance: 0,
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.status, 'error');
    assert.equal(
      body.message,
      'La distancia debe ser mayor que cero'
    );
  }
);
