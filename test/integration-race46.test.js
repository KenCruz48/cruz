const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../src/app');

const authService =
  require('../src/services/authService');

const registrationService =
  require('../src/services/registrationService');

const Event =
  require('../src/models/eventModel');

const Category =
  require('../src/models/categoryModel');

const Registration =
  require('../src/models/registrationModel');

const eventId =
  '507f1f77bcf86cd799439011';

const participantId =
  '507f1f77bcf86cd799439012';

const categoryId =
  '507f1f77bcf86cd799439013';

const registrationId =
  '507f1f77bcf86cd799439014';

/*
 * Inicia Express en un puerto libre.
 */
function startServer(t) {
  const server = app.listen(0);

  t.after(() =>
    new Promise((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    })
  );

  return `http://127.0.0.1:${server.address().port}`;
}

/*
 * Simula la consulta encadenada:
 *
 * Category.findById()
 *   .select()
 *   .lean()
 */
function categoryQuery(value) {
  return {
    select() {
      return this;
    },

    lean() {
      return Promise.resolve(value);
    },
  };
}

/*
 * ==========================================================
 * TOP-DOWN
 * ==========================================================
 *
 * Empezamos desde las capas superiores:
 *
 * HTTP
 *   ↓
 * Route
 *   ↓
 * authMiddleware
 *   ↓
 * Controller
 *   ↓
 * STUB del Service
 *
 * El Stub reemplaza temporalmente registrationService
 * para comprobar primero las capas superiores.
 */
test(
  'RACE-46 TOP-DOWN usa Stub del servicio y valida ruta, middleware y controlador',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async token => {
        assert.equal(
          token,
          'token-top-down'
        );

        return {
          id: participantId,
          name: 'Alexis Erazo',
        };
      }
    );

    /*
     * STUB:
     * fingimos la respuesta de la capa Service.
     */
    t.mock.method(
      registrationService,
      'createRegistration',
      async (data, receivedParticipantId) => {
        assert.deepEqual(
          data,
          {
            eventId,
            categoryId,
          }
        );

        assert.equal(
          receivedParticipantId,
          participantId
        );

        return {
          id: registrationId,
          event: eventId,
          participant: participantId,
          category: categoryId,
          status: 'active',
        };
      }
    );

    const baseUrl =
      startServer(t);

    const response =
      await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              'Bearer token-top-down',
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
      body.data.id,
      registrationId
    );

    assert.equal(
      body.data.participant,
      participantId
    );
  }
);

/*
 * ==========================================================
 * BOTTOM-UP
 * ==========================================================
 *
 * Empezamos desde las capas inferiores:
 *
 * DRIVER de prueba
 *      ↓
 * registrationService
 *      ↓
 * capacityService
 *      ↓
 * Models
 *
 * El propio test funciona como Driver:
 * llama directamente al servicio sin necesitar
 * ruta HTTP ni controlador.
 */
test(
  'RACE-46 BOTTOM-UP usa Driver para integrar servicio, capacidad y modelos',
  async t => {
    const session = {};

    let registrationPersisted = false;

    /*
     * No existe inscripción duplicada.
     */
    t.mock.method(
      Registration,
      'exists',
      async filter => {
        assert.deepEqual(
          filter,
          {
            event: eventId,
            participant: participantId,
            status: 'active',
          }
        );

        return null;
      }
    );

    /*
     * La categoría existe y está activa.
     */
    t.mock.method(
      Category,
      'findById',
      id => {
        assert.equal(
          id,
          categoryId
        );

        return categoryQuery({
          _id: categoryId,
          status: 'active',
        });
      }
    );

    /*
     * Simulamos la transacción de MongoDB.
     */
    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback =>
        callback(session)
    );

    /*
     * El evento tiene cupo disponible.
     */
    t.mock.method(
      Event,
      'findOneAndUpdate',
      async (filter, update, options) => {
        assert.equal(
          filter._id,
          eventId
        );

        assert.equal(
          filter.status,
          'active'
        );

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
          registeredCount: 25,
        };
      }
    );

    /*
     * Persistencia de la inscripción.
     */
    t.mock.method(
      Registration,
      'create',
      async (documents, options) => {
        registrationPersisted = true;

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
            ...documents[0],
            createdAt:
              new Date(
                '2026-10-26T18:00:00Z'
              ),
          },
        ];
      }
    );

    /*
     * DRIVER:
     * la prueba llama directamente al servicio.
     */
    const result =
      await registrationService
        .createRegistration(
          {
            eventId,
            categoryId,
          },
          participantId
        );

    assert.equal(
      registrationPersisted,
      true
    );

    assert.equal(
      result.id,
      registrationId
    );

    assert.equal(
      result.event,
      eventId
    );

    assert.equal(
      result.participant,
      participantId
    );

    assert.equal(
      result.category,
      categoryId
    );

    assert.equal(
      result.status,
      'active'
    );
  }
);

/*
 * ==========================================================
 * BIG BANG
 * ==========================================================
 *
 * Integramos al mismo tiempo:
 *
 * HTTP
 * ↓
 * Route
 * ↓
 * authMiddleware
 * ↓
 * Controller
 * ↓
 * registrationService
 * ↓
 * capacityService
 * ↓
 * Models
 *
 * Solamente se simula el acceso físico a MongoDB,
 * para que la prueba sea reproducible y no dependa
 * de Internet ni de Atlas.
 */
test(
  'RACE-46 BIG BANG ejecuta el flujo completo de inscripción correctamente',
  async t => {
    const session = {};

    t.mock.method(
      authService,
      'authenticate',
      async token => {
        assert.equal(
          token,
          'token-big-bang'
        );

        return {
          id: participantId,
          name: 'Alexis Erazo',
        };
      }
    );

    t.mock.method(
      Registration,
      'exists',
      async () => null
    );

    t.mock.method(
      Category,
      'findById',
      () =>
        categoryQuery({
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
      async () => ({
        _id: eventId,
        status: 'active',
        capacity: 50,
        registeredCount: 10,
      })
    );

    t.mock.method(
      Registration,
      'create',
      async (documents, options) => {
        assert.equal(
          options.session,
          session
        );

        return [
          {
            _id: registrationId,
            ...documents[0],
            createdAt:
              new Date(
                '2026-10-26T18:00:00Z'
              ),
          },
        ];
      }
    );

    const baseUrl =
      startServer(t);

    const response =
      await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              'Bearer token-big-bang',
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

/*
 * ==========================================================
 * BIG BANG - FALLO ESPERADO
 * ==========================================================
 *
 * Se demuestra que todas las capas también
 * propagan correctamente un error de negocio.
 */
test(
  'RACE-46 BIG BANG evidencia fallo esperado cuando el evento no tiene cupo',
  async t => {
    const session = {};

    let registrationCreated = false;

    t.mock.method(
      authService,
      'authenticate',
      async () => ({
        id: participantId,
      })
    );

    t.mock.method(
      Registration,
      'exists',
      async () => null
    );

    t.mock.method(
      Category,
      'findById',
      () =>
        categoryQuery({
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

    /*
     * La actualización atómica no encuentra
     * un evento con cupo disponible.
     */
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
              capacity: 50,
              registeredCount: 50,
            }),
          };
        },
      })
    );

    t.mock.method(
      Registration,
      'create',
      async () => {
        registrationCreated = true;
        return [];
      }
    );

    const baseUrl =
      startServer(t);

    const response =
      await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              'Bearer token-big-bang',
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

    /*
     * El fallo debe detener el flujo
     * antes de crear la inscripción.
     */
    assert.equal(
      registrationCreated,
      false
    );
  }
);

/*
 * ==========================================================
 * RELACIONES ENTRE COLECCIONES
 * ==========================================================
 *
 * RACE-46 pide cubrir las relaciones del
 * módulo transaccional.
 *
 * Registration relaciona:
 * - Event
 * - User
 * - Category
 */
test(
  'RACE-46 valida relaciones Registration -> Event, User y Category',
  () => {
    const eventPath =
      Registration.schema.path('event');

    const participantPath =
      Registration.schema.path('participant');

    const categoryPath =
      Registration.schema.path('category');

    assert.equal(
      eventPath.options.ref,
      'Event'
    );

    assert.equal(
      participantPath.options.ref,
      'User'
    );

    assert.equal(
      categoryPath.options.ref,
      'Category'
    );

    assert.equal(
      eventPath.options.required,
      true
    );

    assert.equal(
      participantPath.options.required,
      true
    );
  }
);