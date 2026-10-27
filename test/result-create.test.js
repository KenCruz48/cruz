const test = require('node:test');
const assert = require('node:assert/strict');

const Event =
  require('../src/models/eventModel');

const Registration =
  require('../src/models/registrationModel');

const Result =
  require('../src/models/resultModel');

const authService =
  require('../src/services/authService');

const resultService =
  require('../src/services/resultService');

const app =
  require('../src/app');

const eventId =
  '507f1f77bcf86cd799439011';

const registrationId =
  '507f1f77bcf86cd799439012';

const organizerId =
  '507f1f77bcf86cd799439013';

const participantId =
  '507f1f77bcf86cd799439014';

const categoryId =
  '507f1f77bcf86cd799439015';

const resultId =
  '507f1f77bcf86cd799439016';

const otherEventId =
  '507f1f77bcf86cd799439017';

const otherOrganizerId =
  '507f1f77bcf86cd799439018';

/*
 * Simula consultas Mongoose:
 *
 * Model.findById()
 *   .select()
 *   .lean()
 */
function query(value) {
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
 * Inicia Express usando un puerto libre.
 */
function startServer(t) {
  const server =
    app.listen(0);

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
 * ==========================================================
 * CA-01
 * REGISTRO VÁLIDO
 * ==========================================================
 */
test(
  'RACE-19 registra un resultado válido para un participante inscrito',
  async t => {
    t.mock.method(
      Event,
      'findById',
      id => {
        assert.equal(
          id,
          eventId
        );

        return query({
          _id: eventId,
          owner: organizerId,
          status: 'active',
        });
      }
    );

    t.mock.method(
      Registration,
      'findById',
      id => {
        assert.equal(
          id,
          registrationId
        );

        return query({
          _id: registrationId,
          event: eventId,
          participant: participantId,
          category: categoryId,
          status: 'active',
        });
      }
    );

    t.mock.method(
      Result,
      'create',
      async data => {
        assert.deepEqual(
          data,
          {
            event: eventId,
            registration: registrationId,
            timeMs: 1254300,
            status: 'finished',
          }
        );

        return {
          _id: resultId,
          ...data,
          createdAt:
            new Date(
              '2026-10-26T18:00:00Z'
            ),
          updatedAt:
            new Date(
              '2026-10-26T18:00:00Z'
            ),
        };
      }
    );

    const result =
      await resultService
        .createResult(
          {
            eventId,
            registrationId,
            timeMs: 1254300,
          },
          organizerId
        );

    assert.equal(
      result.id,
      resultId
    );

    assert.equal(
      result.event,
      eventId
    );

    assert.equal(
      result.registration,
      registrationId
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
      result.timeMs,
      1254300
    );

    assert.equal(
      result.status,
      'finished'
    );

    /*
     * El ranking existente consulta
     * precisamente la colección "results".
     */
    assert.equal(
      Result.collection.collectionName,
      'results'
    );
  }
);

/*
 * ==========================================================
 * CA-02
 * CAMPOS OBLIGATORIOS
 * ==========================================================
 */
test(
  'RACE-19 rechaza resultado cuando faltan datos obligatorios',
  async t => {
    const findEvent =
      t.mock.method(
        Event,
        'findById',
        () =>
          assert.fail(
            'No debe consultar MongoDB'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 400,
      }
    );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 400,
      }
    );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
        },
        organizerId
      ),
      {
        status: 400,
      }
    );

    assert.equal(
      findEvent.mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * CA-02
 * TIEMPOS INVÁLIDOS
 * ==========================================================
 */
test(
  'RACE-19 rechaza tiempos inválidos antes de consultar MongoDB',
  async t => {
    const findEvent =
      t.mock.method(
        Event,
        'findById',
        () =>
          assert.fail(
            'No debe consultar MongoDB'
          )
      );

    const invalidTimes = [
      0,
      -1,
      10.5,
      '1000',
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (
      const timeMs of invalidTimes
    ) {
      await assert.rejects(
        resultService.createResult(
          {
            eventId,
            registrationId,
            timeMs,
          },
          organizerId
        ),
        {
          status: 400,
        }
      );
    }

    assert.equal(
      findEvent.mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * CA-03
 * EVENTO INEXISTENTE
 * ==========================================================
 */
test(
  'RACE-19 rechaza resultado para un evento inexistente',
  async t => {
    t.mock.method(
      Event,
      'findById',
      () =>
        query(null)
    );

    const registrationQuery =
      t.mock.method(
        Registration,
        'findById',
        () =>
          assert.fail(
            'No debe consultar inscripción'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 404,
        message:
          'Evento no encontrado',
      }
    );

    assert.equal(
      registrationQuery
        .mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * SEGURIDAD
 * SOLO EL ORGANIZADOR DEL EVENTO
 * ==========================================================
 */
test(
  'RACE-19 impide que otro usuario registre resultados del evento',
  async t => {
    t.mock.method(
      Event,
      'findById',
      () =>
        query({
          _id: eventId,
          owner:
            otherOrganizerId,
          status: 'active',
        })
    );

    const registrationQuery =
      t.mock.method(
        Registration,
        'findById',
        () =>
          assert.fail(
            'No debe consultar inscripción'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 403,
      }
    );

    assert.equal(
      registrationQuery
        .mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * CA-03
 * INSCRIPCIÓN INEXISTENTE
 * ==========================================================
 */
test(
  'RACE-19 rechaza una inscripción inexistente',
  async t => {
    t.mock.method(
      Event,
      'findById',
      () =>
        query({
          _id: eventId,
          owner: organizerId,
          status: 'active',
        })
    );

    t.mock.method(
      Registration,
      'findById',
      () =>
        query(null)
    );

    const create =
      t.mock.method(
        Result,
        'create',
        () =>
          assert.fail(
            'No debe crear resultado'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 404,
        message:
          'Inscripción no encontrada',
      }
    );

    assert.equal(
      create.mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * CA-03
 * INSCRIPCIÓN DE OTRO EVENTO
 * ==========================================================
 */
test(
  'RACE-19 rechaza una inscripción que pertenece a otro evento',
  async t => {
    t.mock.method(
      Event,
      'findById',
      () =>
        query({
          _id: eventId,
          owner: organizerId,
          status: 'active',
        })
    );

    t.mock.method(
      Registration,
      'findById',
      () =>
        query({
          _id: registrationId,
          event: otherEventId,
          participant:
            participantId,
          category:
            categoryId,
          status: 'active',
        })
    );

    const create =
      t.mock.method(
        Result,
        'create',
        () =>
          assert.fail(
            'No debe crear resultado'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 409,
        message:
          'La inscripción no pertenece a este evento',
      }
    );

    assert.equal(
      create.mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * CA-01 / CA-03
 * INSCRIPCIÓN NO ACTIVA
 * ==========================================================
 */
test(
  'RACE-19 rechaza resultado para una inscripción cancelada',
  async t => {
    t.mock.method(
      Event,
      'findById',
      () =>
        query({
          _id: eventId,
          owner: organizerId,
          status: 'active',
        })
    );

    t.mock.method(
      Registration,
      'findById',
      () =>
        query({
          _id: registrationId,
          event: eventId,
          participant:
            participantId,
          category:
            categoryId,
          status: 'cancelled',
        })
    );

    const create =
      t.mock.method(
        Result,
        'create',
        () =>
          assert.fail(
            'No debe crear resultado'
          )
      );

    await assert.rejects(
      resultService.createResult(
        {
          eventId,
          registrationId,
          timeMs: 1000,
        },
        organizerId
      ),
      {
        status: 409,
        message:
          'La inscripción no está activa',
      }
    );

    assert.equal(
      create.mock.callCount(),
      0
    );
  }
);

/*
 * ==========================================================
 * API
 * POST /api/v1/results
 * ==========================================================
 */
test(
  'RACE-19 POST /api/v1/results responde 201 al registrar resultado',
  async t => {
    t.mock.method(
      authService,
      'authenticate',
      async token => {
        assert.equal(
          token,
          'token-organizador'
        );

        return {
          id: organizerId,
        };
      }
    );

    t.mock.method(
      resultService,
      'createResult',
      async (
        data,
        receivedOrganizer
      ) => {
        assert.deepEqual(
          data,
          {
            eventId,
            registrationId,
            timeMs: 1254300,
          }
        );

        assert.equal(
          receivedOrganizer,
          organizerId
        );

        return {
          id: resultId,
          event: eventId,
          registration:
            registrationId,
          participant:
            participantId,
          category:
            categoryId,
          timeMs: 1254300,
          status: 'finished',
        };
      }
    );

    const baseUrl =
      startServer(t);

    const response =
      await fetch(
        `${baseUrl}/api/v1/results`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              'Bearer token-organizador',
          },

          body:
            JSON.stringify({
              eventId,
              registrationId,
              timeMs: 1254300,
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
      resultId
    );

    assert.equal(
      body.data.status,
      'finished'
    );
  }
);

/*
 * ==========================================================
 * API
 * AUTENTICACIÓN OBLIGATORIA
 * ==========================================================
 */
test(
  'RACE-19 POST /api/v1/results rechaza petición sin token',
  async t => {
    const createResult =
      t.mock.method(
        resultService,
        'createResult',
        () =>
          assert.fail(
            'No debe llamar al servicio'
          )
      );

    const baseUrl =
      startServer(t);

    const response =
      await fetch(
        `${baseUrl}/api/v1/results`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              eventId,
              registrationId,
              timeMs: 1254300,
            }),
        }
      );

    assert.equal(
      response.status,
      401
    );

    assert.equal(
      createResult
        .mock.callCount(),
      0
    );
  }
);