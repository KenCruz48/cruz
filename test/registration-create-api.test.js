const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Event = require('../src/models/eventModel');
const Category = require('../src/models/categoryModel');
const Registration = require('../src/models/registrationModel');
const authService = require('../src/services/authService');

process.env.JWT_SECRET =
  'clave-secreta-pruebas-racetrack-api-123456789';

const eventId = '507f1f77bcf86cd799439011';
const participantId = '507f1f77bcf86cd799439012';
const categoryId = '507f1f77bcf86cd799439013';
const registrationId = '507f1f77bcf86cd799439014';

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

function mockAuthenticatedUser(t) {
  t.mock.method(
    authService,
    'authenticate',
    async token => {
      assert.equal(token, 'token-valido-prueba');

      return {
        id: participantId,
        name: 'Alexis Erazo',
        email: 'alexis@example.com',
      };
    }
  );
}

test(
  'POST /api/v1/registrations crea una inscripción válida y responde 201',
  async t => {
    const session = {};

    mockAuthenticatedUser(t);

    t.mock.method(
      Registration,
      'exists',
      async filter => {
        assert.deepEqual(filter, {
          event: eventId,
          participant: participantId,
          status: 'active',
        });

        return null;
      }
    );

    t.mock.method(Category, 'findById', id => {
      assert.equal(id, categoryId);

      return queryResult({
        _id: categoryId,
        status: 'active',
      });
    });

    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback => callback(session)
    );

    t.mock.method(
      Event,
      'findOneAndUpdate',
      async (filter, update, options) => {
        assert.equal(filter._id, eventId);
        assert.equal(filter.status, 'active');
        assert.ok(filter.date.$gt instanceof Date);

        assert.deepEqual(
          filter.$expr,
          {
            $lt: [
              '$registeredCount',
              '$capacity',
            ],
          }
        );

        assert.deepEqual(
          update,
          {
            $inc: {
              registeredCount: 1,
            },
          }
        );

        assert.equal(
          options.session,
          session
        );

        return {
          _id: eventId,
          status: 'active',
          capacity: 100,
          registeredCount: 21,
        };
      }
    );

    t.mock.method(
      Registration,
      'create',
      async (documents, options) => {
        assert.equal(
          options.session,
          session
        );

        assert.deepEqual(
          documents[0],
          {
            event: eventId,
            participant: participantId,
            category: categoryId,
            status: 'active',
          }
        );

        return [
          {
            _id: registrationId,
            event: eventId,
            participant: participantId,
            category: categoryId,
            status: 'active',
            createdAt:
              new Date(
                '2026-10-26T12:00:00Z'
              ),
          },
        ];
      }
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          eventId,
          categoryId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      201
    );

    assert.equal(
      body.status,
      'success'
    );

    assert.equal(
      body.message,
      'Inscripción registrada correctamente'
    );

    assert.equal(
      body.data.id,
      registrationId
    );

    assert.equal(
      body.data.event,
      eventId
    );

    assert.equal(
      body.data.participant,
      participantId
    );

    assert.equal(
      body.data.category,
      categoryId
    );

    assert.equal(
      body.data.status,
      'active'
    );
  }
);

test(
  'POST /api/v1/registrations rechaza petición sin token con HTTP 401',
  async t => {
    const authenticate =
      t.mock.method(
        authService,
        'authenticate'
      );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          eventId,
          categoryId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      401
    );

    assert.equal(
      body.status,
      'error'
    );

    assert.equal(
      authenticate.mock.callCount(),
      0
    );
  }
);

test(
  'POST /api/v1/registrations rechaza campos obligatorios faltantes con HTTP 400',
  async t => {
    mockAuthenticatedUser(t);

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          eventId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      400
    );

    assert.equal(
      body.status,
      'error'
    );

    assert.equal(
      body.message,
      'Evento y categoría son obligatorios'
    );
  }
);

test(
  'POST /api/v1/registrations rechaza inscripción activa duplicada con HTTP 409',
  async t => {
    mockAuthenticatedUser(t);

    t.mock.method(
      Registration,
      'exists',
      async () => ({
        _id: registrationId,
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          eventId,
          categoryId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      409
    );

    assert.equal(
      body.status,
      'error'
    );

    assert.equal(
      body.message,
      'El participante ya tiene una inscripcion activa en este evento'
    );
  }
);

test(
  'POST /api/v1/registrations rechaza categoría inactiva con HTTP 409',
  async t => {
    mockAuthenticatedUser(t);

    t.mock.method(
      Registration,
      'exists',
      async () => null
    );

    t.mock.method(
      Category,
      'findById',
      () =>
        queryResult({
          _id: categoryId,
          status: 'inactive',
        })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          eventId,
          categoryId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      409
    );

    assert.equal(
      body.status,
      'error'
    );

    assert.equal(
      body.message,
      'La categoría no está activa'
    );
  }
);

test(
  'POST /api/v1/registrations rechaza evento sin cupo disponible con HTTP 409',
  async t => {
    const session = {};

    mockAuthenticatedUser(t);

    t.mock.method(
      Registration,
      'exists',
      async () => null
    );

    t.mock.method(
      Category,
      'findById',
      () =>
        queryResult({
          _id: categoryId,
          status: 'active',
        })
    );

    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback =>
        callback(session)
    );

    t.mock.method(
      Event,
      'findOneAndUpdate',
      async () => null
    );

    t.mock.method(
      Event,
      'findById',
      () => ({
        session(receivedSession) {
          assert.equal(
            receivedSession,
            session
          );

          return {
            lean: async () => ({
              _id: eventId,
              status: 'active',
              date: new Date(
                Date.now() + 60000
              ),
              capacity: 100,
              registeredCount: 100,
            }),
          };
        },
      })
    );

    const baseUrl = startServer(t);

    const response = await fetch(
      `${baseUrl}/api/v1/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            'Bearer token-valido-prueba',
        },
        body: JSON.stringify({
          eventId,
          categoryId,
        }),
      }
    );

    const body =
      await response.json();

    assert.equal(
      response.status,
      409
    );

    assert.equal(
      body.status,
      'error'
    );

    assert.equal(
      body.message,
      'Cupo agotado'
    );
  }
);