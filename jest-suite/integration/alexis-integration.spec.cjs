const mongoose = require('mongoose');

const app = require('../../src/app');
const Event = require('../../src/models/eventModel');
const Category = require('../../src/models/categoryModel');
const Registration = require('../../src/models/registrationModel');
const authService = require('../../src/services/authService');
const registrationService = require('../../src/services/registrationService');

const eventId = '507f1f77bcf86cd799439011';
const participantId = '507f1f77bcf86cd799439012';
const categoryId = '507f1f77bcf86cd799439013';
const registrationId = '507f1f77bcf86cd799439014';

function startServer() {
  const server = app.listen(0);

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function queryResult(value) {
  return {
    select() {
      return this;
    },

    lean() {
      return Promise.resolve(value);
    }
  };
}

function mockUser() {
  jest.spyOn(authService, 'authenticate').mockResolvedValue({
    id: participantId,
    name: 'Alexis Erazo',
    email: 'alexis@example.com'
  });
}

describe('RACE-46 - Pruebas de integración Jest - Alexis Erazo', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. POST events crea evento autenticado y responde 201', async () => {
    mockUser();

    jest.spyOn(Event, 'create').mockImplementation(async data => ({
      _id: eventId,
      ...data,
      createdAt: new Date()
    }));

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido'
        },
        body: JSON.stringify({
          name: 'Carrera 10K Putumayo',
          date: '2026-12-15T08:00:00Z',
          location: 'Mocoa',
          distance: 10,
          capacity: 300
        })
      });

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.status).toBe('success');
      expect(body.data.name).toBe('Carrera 10K Putumayo');
    } finally {
      await closeServer(server);
    }
  });

  test('2. POST events sin token responde 401', async () => {
    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Carrera prueba',
          date: '2026-12-15T08:00:00Z',
          location: 'Mocoa',
          distance: 5,
          capacity: 100
        })
      });

      expect(response.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  test('3. POST registrations sin token responde 401', async () => {
    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      expect(response.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  test('4. POST registrations con campos faltantes responde 400', async () => {
    mockUser();

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-valido'
          },
          body: JSON.stringify({
            eventId
          })
        }
      );

      expect(response.status).toBe(400);
    } finally {
      await closeServer(server);
    }
  });

  test('5. rechaza inscripción duplicada con 409', async () => {
    mockUser();

    jest.spyOn(Registration, 'exists').mockResolvedValue({
      _id: registrationId
    });

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-valido'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      expect(response.status).toBe(409);
    } finally {
      await closeServer(server);
    }
  });

  test('6. rechaza categoría inactiva con 409', async () => {
    mockUser();

    jest.spyOn(Registration, 'exists').mockResolvedValue(null);

    jest.spyOn(Category, 'findById').mockImplementation(() =>
      queryResult({
        _id: categoryId,
        status: 'inactive'
      })
    );

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-valido'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      expect(response.status).toBe(409);
    } finally {
      await closeServer(server);
    }
  });

  test('7. crea inscripción válida y responde 201', async () => {
    mockUser();

    const session = {};

    jest.spyOn(Registration, 'exists').mockResolvedValue(null);

    jest.spyOn(Category, 'findById').mockImplementation(() =>
      queryResult({
        _id: categoryId,
        status: 'active'
      })
    );

    jest
      .spyOn(mongoose.connection, 'transaction')
      .mockImplementation(async callback => callback(session));

    jest.spyOn(Event, 'findOneAndUpdate').mockResolvedValue({
      _id: eventId,
      status: 'active',
      capacity: 100,
      registeredCount: 20
    });

    jest.spyOn(Registration, 'create').mockResolvedValue([
      {
        _id: registrationId,
        event: eventId,
        participant: participantId,
        category: categoryId,
        status: 'active',
        createdAt: new Date()
      }
    ]);

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-valido'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.status).toBe('success');
      expect(body.data.event).toBe(eventId);
    } finally {
      await closeServer(server);
    }
  });

  test('8. Top-down integra ruta middleware controlador y Stub', async () => {
    mockUser();

    jest
      .spyOn(registrationService, 'createRegistration')
      .mockResolvedValue({
        id: registrationId,
        event: eventId,
        participant: participantId,
        category: categoryId,
        status: 'active'
      });

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-valido'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.id).toBe(registrationId);
    } finally {
      await closeServer(server);
    }
  });

  test('9. token inválido en ruta protegida responde 401', async () => {
    jest.spyOn(authService, 'authenticate').mockRejectedValue(
      Object.assign(
        new Error('Token inválido'),
        { status: 401 }
      )
    );

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-invalido'
          },
          body: JSON.stringify({
            eventId,
            categoryId
          })
        }
      );

      expect(response.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  test('10. evento con datos inválidos responde 400', async () => {
    mockUser();

    const { server, baseUrl } = startServer();

    try {
      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido'
        },
        body: JSON.stringify({
          name: 'Carrera prueba',
          date: '2026-12-15T08:00:00Z',
          location: 'Mocoa',
          distance: 0,
          capacity: 100
        })
      });

      expect(response.status).toBe(400);
    } finally {
      await closeServer(server);
    }
  });
});