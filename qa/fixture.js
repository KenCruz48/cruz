const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const User = require('../src/models/userModel');
const Event = require('../src/models/eventModel');
const Category = require('../src/models/categoryModel');
const Registration = require('../src/models/registrationModel');
const Result = require('../src/models/resultModel');

async function closeFixtureResources(server, mongo) {
  const errors = [];
  let expectedShutdownResets = 0;
  if (server?.listening) {
    try {
      server.closeAllConnections();
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    await mongoose.disconnect();
  } catch (error) {
    errors.push(error);
  }
  try {
    const originalWarn = console.warn;
    let stopped;
    console.warn = (...args) => {
      const error = args[0];
      const isShutdownSocketReset = error instanceof Error
        && error.name === 'MongoNetworkError'
        && (error.code === 'ECONNRESET' || error.cause?.code === 'ECONNRESET');
      if (isShutdownSocketReset) {
        expectedShutdownResets += 1;
        return;
      }
      originalWarn.apply(console, args);
    };
    try {
      stopped = await mongo.stop();
    } finally {
      console.warn = originalWarn;
    }
    if (!stopped || mongo.state !== 'stopped') {
      throw new Error('MongoDB temporal no confirmó el estado detenido');
    }
    if (expectedShutdownResets > 0) {
      console.info(
        `MongoDB fixture cleanup: MongoMemoryServer reported ${expectedShutdownResets} ECONNRESET on its admin shutdown socket; mongod stopped and its state was verified.`
      );
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, 'No se pudieron cerrar todos los recursos del fixture');
  return { expectedShutdownResets };
}

async function startFixture() {
  // A real, disposable replica set enables transactions without Atlas credentials.
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 } });
  let server;
  try {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = 'racetrack_qa_acceptance';
    await mongoose.connect(mongo.getUri(), { dbName: 'racetrack_qa_acceptance' });
    await Promise.all([User.init(), Event.init(), Category.init(), Registration.init(), Result.init()]);
    const userService = require('../src/services/userService');
    const password = 'RaceTrack-QA-2026!';
    const owner = await userService.registerUser({ name: 'QA Organizador', email: 'owner@example.invalid', password });
    const runner = await userService.registerUser({ name: 'QA Corredor', email: 'runner@example.invalid', password });
    const category = await Category.create({ name: 'QA Abierta', description: 'Fixture aislado' });
    const event = await Event.create({ name: 'Carrera QA 5K', date: new Date(Date.now() + 86400000),
      location: 'Pista de pruebas', distance: 5, capacity: 100, owner: owner.id });
    server = require('../src/app').listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { baseUrl: `http://127.0.0.1:${server.address().port}`, owner, runner, password, category, event,
      close() { return closeFixtureResources(server, mongo); } };
  } catch (error) {
    try {
      await closeFixtureResources(server, mongo);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Falló el inicio y también la limpieza del fixture');
    }
    throw error;
  }
}
module.exports = { startFixture };
