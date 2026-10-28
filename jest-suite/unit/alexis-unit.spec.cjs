const { escapeRegex } = require('../../src/utils/regexUtils');
const Event = require('../../src/models/eventModel');
const eventService = require('../../src/services/eventService');

const ownerId = '507f1f77bcf86cd799439011';

describe('RACE-46 - Pruebas unitarias Jest - Alexis Erazo', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. escapa caracteres especiales de una expresión regular', () => {
    expect(
      escapeRegex('Carrera (10) + Atletismo.')
    ).toBe('Carrera \\(10\\) \\+ Atletismo\\.');
  });

  test('2. permite buscar caracteres especiales literalmente', () => {
    const value = 'A+B';
    const regex = new RegExp(`^${escapeRegex(value)}$`);

    expect(regex.test('A+B')).toBe(true);
    expect(regex.test('AAAB')).toBe(false);
  });

  test('3. devuelve cadena vacía cuando recibe cadena vacía', () => {
    expect(escapeRegex('')).toBe('');
  });

  test('4. rechaza valores que no son cadenas de texto', () => {
    expect(() => escapeRegex(123)).toThrow(TypeError);
  });

  test('5. crea un evento válido', async () => {
    jest.spyOn(Event, 'create').mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      name: 'Carrera 5K Mocoa',
      date: new Date('2026-12-01T08:00:00Z'),
      location: 'Mocoa',
      distance: 5,
      capacity: 200,
      registeredCount: 0,
      status: 'active',
      owner: ownerId,
      createdAt: new Date()
    });

    const result = await eventService.createEvent(
      {
        name: 'Carrera 5K Mocoa',
        date: '2026-12-01T08:00:00Z',
        location: 'Mocoa',
        distance: 5,
        capacity: 200
      },
      ownerId
    );

    expect(result.name).toBe('Carrera 5K Mocoa');
    expect(result.status).toBe('active');
  });

  test('6. rechaza evento con campos obligatorios faltantes', async () => {
    await expect(
      eventService.createEvent(
        { name: 'Carrera incompleta' },
        ownerId
      )
    ).rejects.toMatchObject({
      status: 400
    });
  });

  test('7. rechaza una distancia inválida', async () => {
    await expect(
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 0,
          capacity: 100
        },
        ownerId
      )
    ).rejects.toMatchObject({
      status: 400
    });
  });

  test('8. rechaza un cupo inválido', async () => {
    await expect(
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 0
        },
        ownerId
      )
    ).rejects.toMatchObject({
      status: 400
    });
  });

  test('9. rechaza organizador con ID inválido', async () => {
    await expect(
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 100
        },
        'id-invalido'
      )
    ).rejects.toMatchObject({
      status: 400
    });
  });

  test('10. rechaza estado de evento inválido', async () => {
    await expect(
      eventService.createEvent(
        {
          name: 'Carrera prueba',
          date: '2026-12-01T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 100,
          status: 'estado-invalido'
        },
        ownerId
      )
    ).rejects.toMatchObject({
      status: 400
    });
  });
});