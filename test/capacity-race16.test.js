const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Event = require('../src/models/eventModel');
const {
  withReservedCapacity,
} = require('../src/services/capacityService');

const eventId = '507f1f77bcf86cd799439011';

test(
  'RACE-16 permite consumir el último cupo disponible sin superar la capacidad',
  async t => {
    const session = {};
    let writerCalled = 0;

    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback => callback(session)
    );

    t.mock.method(
      Event,
      'findOneAndUpdate',
      async (filter, update, options) => {
        // El servidor decide el cupo usando los datos almacenados.
        assert.equal(filter._id, eventId);
        assert.equal(filter.status, 'active');

        assert.deepEqual(
          filter.$expr,
          {
            $lt: [
              '$registeredCount',
              '$capacity',
            ],
          }
        );

        assert.ok(
          filter.date.$gt instanceof Date
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

        /*
         * Simulamos que antes había 49/50.
         * Después de reservar el último cupo,
         * MongoDB devuelve 50/50.
         */
        return {
          _id: eventId,
          status: 'active',
          capacity: 50,
          registeredCount: 50,
        };
      }
    );

    const result =
      await withReservedCapacity(
        eventId,
        async (receivedSession, event) => {
          writerCalled += 1;

          assert.equal(
            receivedSession,
            session
          );

          assert.equal(
            event.capacity,
            50
          );

          assert.equal(
            event.registeredCount,
            50
          );

          assert.equal(
            event.registeredCount,
            event.capacity
          );

          return 'inscripcion-creada';
        }
      );

    assert.equal(
      result,
      'inscripcion-creada'
    );

    assert.equal(
      writerCalled,
      1
    );
  }
);

test(
  'RACE-16 rechaza la inscripción cuando el evento ya alcanzó el cupo máximo',
  async t => {
    const session = {};
    let writerCalled = 0;

    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback => callback(session)
    );

    /*
     * MongoDB no actualiza el evento porque
     * registeredCount ya no es menor que capacity.
     */
    t.mock.method(
      Event,
      'findOneAndUpdate',
      async () => null
    );

    t.mock.method(
      Event,
      'findById',
      id => {
        assert.equal(id, eventId);

        return {
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
        };
      }
    );

    await assert.rejects(
      withReservedCapacity(
        eventId,
        async () => {
          writerCalled += 1;
        }
      ),
      {
        status: 409,
        message: 'Cupo agotado',
      }
    );

    /*
     * Si no hay cupo, jamás debe llegar
     * a guardar la inscripción.
     */
    assert.equal(
      writerCalled,
      0
    );
  }
);

test(
  'RACE-16 valida la capacidad únicamente en el backend',
  async t => {
    const session = {};

    t.mock.method(
      mongoose.connection,
      'transaction',
      async callback => callback(session)
    );

    t.mock.method(
      Event,
      'findOneAndUpdate',
      async (filter, update) => {
        /*
         * La condición depende de los campos
         * registradosCount y capacity de MongoDB,
         * no de una capacidad enviada por cliente.
         */
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
          Object.hasOwn(
            filter,
            'clientCapacity'
          ),
          false
        );

        return {
          _id: eventId,
          capacity: 100,
          registeredCount: 1,
          status: 'active',
        };
      }
    );

    const result =
      await withReservedCapacity(
        eventId,
        async () => 'ok'
      );

    assert.equal(result, 'ok');
  }
);