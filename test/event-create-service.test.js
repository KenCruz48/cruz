const test = require('node:test');
const assert = require('node:assert/strict');

const Event = require('../src/models/eventModel');
const eventService = require('../src/services/eventService');

const ownerId = '507f1f77bcf86cd799439011';

test('crea un evento valido y lo persiste mediante el modelo', async (t) => {
  let datosGuardados;

  t.mock.method(Event, 'create', async (data) => {
    datosGuardados = data;

    return {
      _id: '507f191e810c19729de860ea',
      ...data,
      createdAt: new Date('2026-10-26T12:00:00Z'),
    };
  });

  const result = await eventService.createEvent(
    {
      name: 'Carrera 5K Mocoa',
      date: '2026-12-01T08:00:00Z',
      location: 'Mocoa, Putumayo',
      distance: 5,
      capacity: 200,
    },
    ownerId
  );

  assert.equal(datosGuardados.name, 'Carrera 5K Mocoa');
  assert.equal(datosGuardados.distance, 5);
  assert.equal(datosGuardados.capacity, 200);
  assert.equal(datosGuardados.registeredCount, 0);
  assert.equal(datosGuardados.status, 'active');
  assert.equal(datosGuardados.owner, ownerId);

  assert.equal(result.name, 'Carrera 5K Mocoa');
  assert.equal(result.status, 'active');
});

test('rechaza un evento cuando faltan campos obligatorios', async () => {
  await assert.rejects(
    () =>
      eventService.createEvent(
        {
          name: 'Carrera incompleta',
        },
        ownerId
      ),
    {
      status: 400,
    }
  );
});

test('rechaza distancia y cupo invalidos', async () => {
  await assert.rejects(
    () =>
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 0,
          capacity: 100,
        },
        ownerId
      ),
    {
      status: 400,
      message: 'La distancia debe ser mayor que cero',
    }
  );

  await assert.rejects(
    () =>
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 0,
        },
        ownerId
      ),
    {
      status: 400,
      message: 'El cupo debe ser un numero entero mayor que cero',
    }
  );
});

test('rechaza un organizador con ID invalido', async () => {
  await assert.rejects(
    () =>
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 100,
        },
        'id-invalido'
      ),
    {
      status: 400,
      message: 'ID del organizador invalido',
    }
  );
});