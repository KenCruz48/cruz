const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const connectDatabase = require('../src/config/database');
const startServer = require('../src/server');
const app = require('../src/app');
const dotenv = require('dotenv');

// Las pruebas de conexión no deben cargar secretos del .env local.
test.beforeEach((t) => {
  t.mock.method(dotenv, 'config', () => ({ parsed: {} }));
});

function setUri(t, uri) {
  const previous = process.env.MONGODB_URI;
  if (uri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = uri;
  t.after(() => {
    if (previous === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previous;
  });
}

for (const uri of [undefined, '', '   ']) {
  test(`rechaza MONGODB_URI ${JSON.stringify(uri)} sin intentar conectar`, async (t) => {
    setUri(t, uri);
    const connect = t.mock.method(mongoose, 'connect', async () => {});
    await assert.rejects(connectDatabase(), /MONGODB_URI es obligatoria/);
    assert.equal(connect.mock.callCount(), 0);
  });
}

test('conecta usando exclusivamente la URI del entorno y un timeout limitado', async (t) => {
  const uri = 'mongodb://example.invalid/test';
  setUri(t, uri);
  const connect = t.mock.method(mongoose, 'connect', async () => {});
  await connectDatabase();
  assert.deepEqual(connect.mock.calls[0].arguments, [uri, { serverSelectionTimeoutMS: 10000 }]);
  assert.equal(connect.mock.callCount(), 1);
});

test('maneja el rechazo del driver sin revelar la URI ni su mensaje', async (t) => {
  setUri(t, 'uri-invalida');
  t.mock.method(mongoose, 'connect', async () => { throw new Error('detalle sensible del driver'); });
  await assert.rejects(connectDatabase(), (error) => {
    assert.match(error.message, /No se pudo conectar a MongoDB/);
    assert.doesNotMatch(error.message, /uri-invalida|detalle sensible/);
    return true;
  });
});

test('MONGODB_DB selecciona explicitamente la BD sin reescribir la URI', async t => {
  setUri(t, 'mongodb://example.invalid/test');
  const previous = process.env.MONGODB_DB;
  process.env.MONGODB_DB = 'racetrack_qa_kevin';
  t.after(() => {
    if (previous === undefined) delete process.env.MONGODB_DB;
    else process.env.MONGODB_DB = previous;
  });
  const connect = t.mock.method(mongoose, 'connect', async () => {});
  await connectDatabase();
  assert.equal(connect.mock.calls[0].arguments[0], 'mongodb://example.invalid/test');
  assert.equal(connect.mock.calls[0].arguments[1].dbName, 'racetrack_qa_kevin');
});

for (const uri of [undefined, 'uri-invalida']) {
  test(`no inicia HTTP y limpia la conexión si MongoDB falla (${uri ?? 'sin URI'})`, async (t) => {
    setUri(t, uri);
    t.mock.method(mongoose, 'connect', async () => { throw new Error('conexión fallida'); });
    const disconnect = t.mock.method(mongoose, 'disconnect', async () => {});
    const listen = t.mock.method(app, 'listen', () => assert.fail('HTTP no debe iniciarse'));
    await assert.rejects(startServer(), /MONGODB_URI|MongoDB/);
    assert.equal(listen.mock.callCount(), 0);
    assert.equal(disconnect.mock.callCount(), 1);
  });
}

test('cierra MongoDB si el arranque HTTP falla', async (t) => {
  setUri(t, 'mongodb://example.invalid/test');
  t.mock.method(mongoose, 'connect', async () => {});
  const disconnect = t.mock.method(mongoose, 'disconnect', async () => {});
  const { EventEmitter } = require('node:events');
  t.mock.method(app, 'listen', () => {
    const server = new EventEmitter();
    queueMicrotask(() => server.emit('error', new Error('puerto ocupado')));
    return server;
  });
  await assert.rejects(startServer(), /puerto ocupado/);
  assert.equal(disconnect.mock.callCount(), 1);
});
