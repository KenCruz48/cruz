
const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../src/services/authService');
const participantService = require('../src/services/participantService');

const eventId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

function startServer(t) {
  const app = require('../src/app');
  const server = app.listen(0);

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  }));

  return `http://127.0.0.1:${server.address().port}`;
}

test('rechaza la petición si falta Authorization', async t => {
  const authenticate = t.mock.method(authService, 'authenticate');
  const baseUrl = startServer(t);

  const response = await fetch(
    `${baseUrl}/api/v1/events/${eventId}/participants`
  );

  assert.equal(response.status, 401);
  assert.equal(authenticate.mock.callCount(), 0);
});

test('rechaza encabezados Bearer mal formados', async t => {
  const authenticate = t.mock.method(authService, 'authenticate');
  const baseUrl = startServer(t);

  for (const authorization of [
    'Basic abc123',
    'Bearer',
    'Bearer token con espacios',
    'Bearer ',
  ]) {
    const response = await fetch(
      `${baseUrl}/api/v1/events/${eventId}/participants`,
      {
        headers: { Authorization: authorization },
      }
    );

    assert.equal(response.status, 401, `Falló con: ${authorization}`);
  }

  assert.equal(authenticate.mock.callCount(), 0);
});

test('rechaza un token inválido con HTTP 401', async t => {
  t.mock.method(authService, 'authenticate', async () => {
    throw Object.assign(
      new Error('Credenciales invalidas'),
      { status: 401 }
    );
  });

  const baseUrl = startServer(t);

  const response = await fetch(
    `${baseUrl}/api/v1/events/${eventId}/participants`,
    {
      headers: { Authorization: 'Bearer invalid-token' },
    }
  );

  assert.equal(response.status, 401);

  const body = await response.json();

  assert.equal(body.status, 'error');
  assert.equal(body.message, 'Credenciales invalidas');
  assert.equal(JSON.stringify(body).includes('stack'), false);
});

test('acepta un token válido y pasa el usuario al controlador', async t => {
  t.mock.method(authService, 'authenticate', async token => {
    assert.equal(token, 'valid-token');

    return {
      id: userId,
      name: 'Runner',
      email: 'runner@example.com',
    };
  });

  const listParticipants = t.mock.method(
    participantService,
    'listParticipants',
    async (id, actorId, query) => {
      assert.equal(id, eventId);
      assert.equal(actorId, userId);
      assert.deepEqual({ ...query }, {});

      return {
        participants: [],
        page: 1,
        limit: 10,
      };
    }
  );

  const baseUrl = startServer(t);

  const response = await fetch(
    `${baseUrl}/api/v1/events/${eventId}/participants`,
    {
      headers: { Authorization: 'Bearer valid-token' },
    }
  );

  const responseBody = await response.json();

  assert.equal(response.status, 200, JSON.stringify(responseBody));
  assert.equal(responseBody.status, 'success');
  assert.deepEqual(responseBody.data.participants, []);
  assert.equal(listParticipants.mock.callCount(), 1);
});

test('el login sigue siendo público', async t => {
  const baseUrl = startServer(t);

  const response = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 401);

  const body = await response.json();

  assert.equal(body.message, 'Credenciales invalidas');
});
