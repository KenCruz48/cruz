const test = require('node:test');
const assert = require('node:assert/strict');

const Category = require('../src/models/categoryModel');
const service = require('../src/services/categoryService');

const id = '507f1f77bcf86cd799439011';

function query(result, inspect = {}) {
  return Object.fromEntries(
    ['select', 'sort', 'skip', 'limit'].map(name => [
      name,
      function (value) {
        inspect[name] = value;
        return this;
      },
    ]).concat([
      ['lean', async () => result],
    ])
  );
}

test('crea una categoría válida y devuelve sus datos públicos', async t => {
  const data = {
    name: 'Atletismo',
    description: 'Pruebas de pista y campo',
  };

  t.mock.method(Category, 'findOne', () => query(null));

  t.mock.method(Category, 'create', async input => ({
    _id: id,
    ...input,
    status: 'active',
  }));

  t.mock.method(Category, 'findById', () =>
    query({
      _id: id,
      ...data,
      status: 'active',
    })
  );

  const result = await service.createCategory(data);

  assert.equal(result._id, id);
  assert.equal(result.name, 'Atletismo');
  assert.equal(result.status, 'active');
});

test('rechaza una categoría con nombre inválido', async t => {
  const findOne = t.mock.method(Category, 'findOne', () => {
    assert.fail('No debe consultar MongoDB');
  });

  await assert.rejects(
    service.createCategory({ name: 'A' }),
    { status: 400 }
  );

  assert.equal(findOne.mock.callCount(), 0);
});

test('lista categorías con paginación y filtro de estado', async t => {
  const inspected = {};

  t.mock.method(Category, 'find', filter => {
    assert.deepEqual(filter, { status: 'active' });

    return query(
      [{ _id: id, name: 'Atletismo' }],
      inspected
    );
  });

  const result = await service.listCategories({
    page: '2',
    limit: '5',
    status: 'active',
  });

  assert.equal(result.categories.length, 1);
  assert.equal(inspected.skip, 5);
  assert.equal(inspected.limit, 5);
  assert.deepEqual(inspected.sort, { name: 1, _id: 1 });
});

test('consulta una categoría existente y rechaza una inexistente', async t => {
  let value = {
    _id: id,
    name: 'Atletismo',
  };

  t.mock.method(Category, 'findById', key => {
    assert.equal(key, id);
    return query(value);
  });

  assert.equal(
    (await service.getCategory(id)).name,
    'Atletismo'
  );

  value = null;

  await assert.rejects(
    service.getCategory(id),
    { status: 404 }
  );
});

test('actualiza los campos permitidos de una categoría', async t => {
  t.mock.method(Category, 'findOne', () => query (null));

  t.mock.method(
    Category,
    'findByIdAndUpdate',
    (key, update, options) => {
      assert.equal(key, id);

      assert.deepEqual(update, {
        $set: { name: 'Ciclismo' },
      });

      assert.equal(options.new, true);

      return query({
        _id: id,
        name: 'Ciclismo',
        status: 'active',
      });
    }
  );

  const result = await service.updateCategory(id, {
    name: 'Ciclismo',
  });

  assert.equal(result.name, 'Ciclismo');
});

test('desactiva una categoría sin eliminarla', async t => {
  t.mock.method(
    Category,
    'findByIdAndUpdate',
    (key, update, options) => {
      assert.equal(key, id);

      assert.deepEqual(update, {
        $set: { status: 'inactive' },
      });

      assert.equal(options.new, true);

      return query({
        _id: id,
        name: 'Atletismo',
        status: 'inactive',
      });
    }
  );

  const result = await service.deactivateCategory(id);

  assert.equal(result.status, 'inactive');
});

test('rechaza identificadores inválidos antes de consultar MongoDB', async t => {
  const findById = t.mock.method(Category, 'findById', () => {
    assert.fail('No debe consultar MongoDB');
  });

  await assert.rejects(
    service.getCategory('incorrecto'),
    { status: 400 }
  );

  assert.equal(findById.mock.callCount(), 0);
});