const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const Category = require('../src/models/categoryModel');
const app = require('../src/app');

const id = '507f1f77bcf86cd799439011';

function query(result) {
  return Object.fromEntries(
    ['select', 'sort', 'skip', 'limit'].map(name => [
      name,
      function () {
        return this;
      },
    ]).concat([
      ['lean', async () => result],
    ])
  );
}

test('POST /api/v1/categories crea una categoría y responde 201', async t => {
  t.mock.method(Category, 'findOne', () => query(null));

  t.mock.method(Category, 'create', async data => ({
    _id: id,
    name: data.name,
    description: data.description,
    status: 'active',
  }));

  t.mock.method(Category, 'findById', () =>
    query({
      _id: id,
      name: 'Atletismo',
      description: 'Pruebas de pista',
      status: 'active',
    })
  );

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Atletismo',
        description: 'Pruebas de pista',
      }),
    }
  );

  assert.equal(response.status, 201);

  const body = await response.json();

  assert.equal(body.status, 'success');
  assert.equal(body.data.name, 'Atletismo');
});

test('GET /api/v1/categories lista las categorías y responde 200', async t => {
  t.mock.method(Category, 'find', () =>
    query([{ _id: id, name: 'Atletismo', status: 'active' }])
  );

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories`
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.status, 'success');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, 'Atletismo');
});

test('GET /api/v1/categories/:id consulta una categoría existente', async t => {
  t.mock.method(Category, 'findById', key => {
    assert.equal(key, id);

    return query({
      _id: id,
      name: 'Atletismo',
      status: 'active',
    });
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories/${id}`
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.status, 'success');
  assert.equal(body.data.name, 'Atletismo');
});

test('GET /api/v1/categories/:id responde 400 ante un identificador inválido', async t => {
  const findById = t.mock.method(Category, 'findById', () => {
    assert.fail('No debe consultar MongoDB');
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories/incorrecto`
  );

  assert.equal(response.status, 400);
  assert.equal(findById.mock.callCount(), 0);
});

test('PATCH /api/v1/categories/:id actualiza una categoría', async t => {
  t.mock.method(Category, 'findOne', () => query(null));

  t.mock.method(Category, 'findByIdAndUpdate', (key, update, options) => {
    assert.equal(key, id);
    assert.deepEqual(update, { $set: { name: 'Ciclismo' } });
    assert.equal(options.returnDocument, 'after');

    return query({
      _id: id,
      name: 'Ciclismo',
      status: 'active',
    });
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ciclismo' }),
    }
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.status, 'success');
  assert.equal(body.data.name, 'Ciclismo');
});

test('PATCH /api/v1/categories/:id/deactivate desactiva una categoría', async t => {
  t.mock.method(Category, 'findByIdAndUpdate', (key, update, options) => {
    assert.equal(key, id);
    assert.deepEqual(update, { $set: { status: 'inactive' } });
    assert.equal(options.returnDocument, 'after');

    return query({
      _id: id,
      name: 'Atletismo',
      status: 'inactive',
    });
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/categories/${id}/deactivate`,
    { method: 'PATCH' }
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.status, 'success');
  assert.equal(body.data.status, 'inactive');
});