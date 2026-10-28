const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const root = path.resolve(__dirname, '..');
let configPath = path.join(root, '.env.demo');
const accountPath = path.join(root, '.demo-credentials.json');
const statePath = path.join(root, 'evidence/generated/demo-state.json');

function loadConfig() {
  if (!fs.existsSync(configPath)) throw new Error('Primero ejecuta npm run demo:prepare -- RUTA_DEL_ARCHIVO_ATLAS');
  dotenv.config({ path: configPath, override: true, quiet: true });
  if (!/^racetrack_demo_[a-z0-9_]+$/.test(process.env.MONGODB_DB || '')) throw new Error('La demo exige una BD racetrack_demo_*');
  if (!process.env.MONGODB_URI || (process.env.JWT_SECRET || '').length < 32) throw new Error('Completa la configuracion privada de demo');
  process.env.NODE_ENV = 'development';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto de demo invalido');
  return `http://localhost:${port}`;
}

async function prepare(sourceFile) {
  if (!fs.existsSync(configPath)) {
    const parsed = sourceFile ? dotenv.parse(fs.readFileSync(path.resolve(sourceFile))) : {};
    const uri = parsed.MONGODB_URI || Object.values(parsed).find(value => /^mongodb(?:\+srv)?:\/\//.test(value)) || process.env.MONGODB_URI;
    if (!uri || /[\r\n]/.test(uri) || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Proporciona el archivo privado con la URI de Atlas');
    fs.writeFileSync(configPath, `NODE_ENV=development\nPORT=3000\nMONGODB_URI=${JSON.stringify(uri)}\nMONGODB_DB=racetrack_demo_kevin\nJWT_SECRET=${crypto.randomBytes(48).toString('hex')}\nJWT_EXPIRES_IN=1h\n`, { mode: 0o600 });
  }
  const url = loadConfig();
  if (!fs.existsSync(path.join(root, '.env.development'))) fs.copyFileSync(configPath, path.join(root, '.env.development'));
  if (!fs.existsSync(accountPath)) {
    const accounts = ['organizador', 'corredor', 'corredor2', 'corredor3'].map(role => ({
      role, email: `${role}@racetrack.demo.invalid`, password: crypto.randomBytes(12).toString('base64url'),
    }));
    fs.writeFileSync(accountPath, JSON.stringify({ accounts }, null, 2), { mode: 0o600 });
  }
  const { accounts } = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  const User = require('../src/models/userModel');
  const Event = require('../src/models/eventModel');
  const Category = require('../src/models/categoryModel');
  const Registration = require('../src/models/registrationModel');
  const Result = require('../src/models/resultModel');
  try {
    await require('../src/config/database')();
    await Promise.all([User.init(), Event.init(), Category.init(), Registration.init(), Result.init()]);
    const users = [];
    for (const account of accounts) {
      if (!/^\w+@racetrack\.demo\.invalid$/.test(account.email) || typeof account.password !== 'string' || account.password.length < 12) throw new Error('Cuenta de demo invalida');
      users.push(await User.findOneAndUpdate({ email: account.email }, { $set: {
        name: account.role === 'organizador' ? 'Kevin Organizador Demo' : `Participante Demo ${users.length}`,
        active: true, passwordHash: await bcrypt.hash(account.password, 12),
      } }, { upsert: true, returnDocument: 'after', runValidators: true }));
    }
    const category = await Category.findOneAndUpdate({ name: 'Abierta Demo' }, { $set: { description: 'Categoria de sustentacion', status: 'active' } }, { upsert: true, returnDocument: 'after', runValidators: true });
    const events = [];
    for (const name of ['Carrera Demo Inscripciones 5K', 'Carrera Demo Podio 5K']) {
      events.push(await Event.findOneAndUpdate({ name, owner: users[0]._id }, { $set: {
        date: new Date(Date.now() + 30 * 86400000), location: 'Pista de demostracion', distance: 5, capacity: 100, status: 'active',
      }, $setOnInsert: { registeredCount: 0 } }, { upsert: true, returnDocument: 'after', runValidators: true }));
    }
    // Reset only the reserved demo runners, preserving their cancellation history.
    await Registration.updateMany({ event: events[0]._id, participant: { $in: users.slice(1).map(user => user._id) }, status: 'active' }, { $set: { status: 'cancelled' } });
    for (let index = 1; index < users.length; index++) {
      const registration = await Registration.findOneAndUpdate({ event: events[1]._id, participant: users[index]._id, status: 'active' }, { $set: { category: category._id } }, { upsert: true, returnDocument: 'after', runValidators: true });
      await Result.findOneAndUpdate({ event: events[1]._id, registration: registration._id }, { $set: { timeMs: index < 3 ? 1200000 : 1320000, status: 'finished' } }, { upsert: true, returnDocument: 'after', runValidators: true });
    }
    for (const event of events) await Event.updateOne({ _id: event._id }, { $set: { registeredCount: await Registration.countDocuments({ event: event._id, status: 'active' }) } });
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ preparedAt: new Date().toISOString(), database: process.env.MONGODB_DB, url,
      eventId: String(events[0]._id), podiumEventId: String(events[1]._id), categoryId: String(category._id) }, null, 2));
    console.log(`Demo preparada en ${url}. BD: ${process.env.MONGODB_DB}. Credenciales locales: .demo-credentials.json`);
  } finally { await mongoose.disconnect(); }
}

async function verify() {
  const url = loadConfig();
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.database !== process.env.MONGODB_DB || state.url !== url) throw new Error('El perfil activo no coincide con los datos preparados; usa verify-local para la demo local');
  const { accounts } = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  const assert = require('node:assert/strict');
  const checks = [];
  async function request(route, method = 'GET', body, token) {
    const response = await fetch(url + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request('/health')).status, 200);
  const event = await request(`/api/v1/events/${state.eventId}`);
  assert.equal(event.status, 200);
  assert.equal(event.body.data.name, 'Carrera Demo Inscripciones 5K');
  const podium = await request(`/api/v1/events/${state.podiumEventId}/ranking`);
  assert.equal(podium.status, 200);
  assert.deepEqual(podium.body.data.ranking.map(row => row.rank), [1, 1, 3]);
  checks.push('Servidor, MongoDB, catalogo y podio con empates disponibles');
  const owner = await request('/api/v1/users/login', 'POST', accounts[0]);
  const runner = await request('/api/v1/users/login', 'POST', accounts[1]);
  assert.equal(owner.status, 200); assert.equal(runner.status, 200);
  const ownerToken = owner.body.data.token, runnerToken = runner.body.data.token;
  checks.push('Login de organizador y participante aprobado');
  let registrationId;
  try {
    const data = { eventId: state.eventId, categoryId: state.categoryId };
    const created = await request('/api/v1/registrations', 'POST', data, runnerToken);
    assert.equal(created.status, 201); registrationId = created.body.data.id;
    assert.equal((await request('/api/v1/registrations', 'POST', data, runnerToken)).status, 409);
    const result = await request('/api/v1/results', 'POST', { eventId: state.eventId, registrationId, timeMs: 1500000 }, ownerToken);
    assert.equal(result.status, 201);
    const ranking = await request(`/api/v1/events/${state.eventId}/ranking`);
    assert.ok(ranking.body.data.ranking.some(row => String(row.registrationId) === registrationId));
    checks.push('Inscripcion, duplicado 409, resultado y clasificacion integrados');
  } finally {
    if (registrationId) assert.equal((await request(`/api/v1/registrations/${registrationId}`, 'DELETE', null, runnerToken)).status, 200);
  }
  const after = await request(`/api/v1/events/${state.eventId}`);
  assert.equal(after.body.data.registeredCount, event.body.data.registeredCount);
  checks.push('Cancelacion devuelve el cupo y deja la demo lista para repetir');
  const report = { status: 'passed', generatedAt: new Date().toISOString(), url, database: state.database, checks };
  fs.writeFileSync(path.join(root, 'evidence/generated/demo-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') return prepare(process.argv[3]);
  if (mode === 'verify-local') {
    configPath = path.join(root, '.env.demo.local');
    return verify();
  }
  if (mode === 'verify') return verify();
  if (!['start', 'local'].includes(mode)) throw new Error('Usa prepare, start, local, verify o verify-local');
  let mongo;
  if (mode === 'local') {
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 } });
    configPath = path.join(root, '.env.demo.local');
    fs.writeFileSync(configPath, `NODE_ENV=development\nPORT=3000\nMONGODB_URI=${JSON.stringify(mongo.getUri())}\nMONGODB_DB=racetrack_demo_local\nJWT_SECRET=${crypto.randomBytes(48).toString('hex')}\nJWT_EXPIRES_IN=1h\n`, { mode: 0o600 });
    try { await prepare(); } catch (error) { await mongo.stop(); throw error; }
    console.log('MODO LOCAL: replica MongoDB real y desechable. Los datos se reinician al cerrar.');
  }
  const url = loadConfig();
  let server;
  try { server = await require('../src/server')(); } catch (error) { if (mongo) await mongo.stop(); throw error; }
  console.log(`Demostracion disponible en ${url}. Usa Ctrl+C para detener.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    server.closeAllConnections(); server.close(); await mongoose.disconnect(); if (mongo) await mongo.stop(); process.exit(0);
  });
}

main().catch(() => { console.error('No se pudo completar la demo. Revisa configuracion privada, puerto disponible, acceso a Atlas y preparacion de los datos. No se muestran credenciales.'); process.exitCode = 1; });
