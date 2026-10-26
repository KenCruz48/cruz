const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/userModel');
const Event = require('../src/models/eventModel');
const Registration = require('../src/models/registrationModel');
const { withReservedCapacity } = require('../src/services/capacityService');
const connectDatabase = require('../src/config/database');

async function verify() {
  // The command is opt-in; credentials may be supplied via environment or a
  // specific local file. No production/test collection is cleared or dropped.
  if (process.env.ATLAS_ENV_FILE) {
    const parsed = dotenv.parse(fs.readFileSync(process.env.ATLAS_ENV_FILE));
    process.env.MONGODB_URI ||= parsed.MONGODB_URI || Object.values(parsed).find(v => /^mongodb(?:\+srv)?:\/\//.test(v));
  }
  const dbName = process.env.MONGODB_DB || 'racetrack_qa_kevin';
  if (!/^racetrack_qa_[a-z0-9_]+$/.test(dbName)) throw new Error('Esta prueba exige BD racetrack_qa_*');
  process.env.MONGODB_DB = dbName;
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  const runId = crypto.randomUUID();
  const userIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const eventIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const registrationIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const checks = [];
  let server;
  try {
    await connectDatabase();
    await Promise.all([Event.init(), User.init(), Registration.init()]);
    const password = crypto.randomBytes(20).toString('hex');
    const passwordHash = await bcrypt.hash(password, 4);
    await User.insertMany(userIds.map((id, i) => ({ _id: id, name: `QA Runner ${i}`, email: `${runId}-${i}@example.invalid`, passwordHash })));
    const data = { name: 'QA Race', date: new Date(Date.now() + 86400000), location: 'QA', distance: 5, capacity: 1, owner: userIds[0] };
    await Event.insertMany(eventIds.map(id => ({ ...data, _id: id })));
    server = require('../src/app').listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (endpoint, body) => fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const login = await post('/api/v1/users/login', { email: `${runId}-0@example.invalid`, password });
    assert.equal(login.status, 200);
    const auth = (await login.json()).data;
    assert.equal(auth.user.passwordHash, undefined);
    const claims = jwt.verify(auth.token, process.env.JWT_SECRET);
    assert.ok(claims.exp > claims.iat);
    checks.push('Login real, JWT firmado con expiracion y perfil sin hash');
    assert.equal((await post('/api/v1/users/login', { email: `${runId}-0@example.invalid`, password: 'incorrect' })).status, 401);
    checks.push('Credenciales incorrectas: 401');
    const list = await fetch(base + '/api/v1/events?limit=100');
    assert.equal(list.status, 200);
    const listed = (await list.json()).data.events;
    assert.ok(listed.some(event => event._id === String(eventIds[0])));
    assert.ok(listed.every(event => event.owner === undefined));
    assert.equal((await fetch(base + `/api/v1/events/${eventIds[0]}`)).status, 200);
    assert.equal((await fetch(base + '/api/v1/events/bad')).status, 400);
    assert.equal((await fetch(base + `/api/v1/events/${new mongoose.Types.ObjectId()}`)).status, 404);
    checks.push('Consultas persistidas: listado, detalle, 400 y 404');
    const attempts = await Promise.allSettled(userIds.map((participant, i) => withReservedCapacity(String(eventIds[0]), async session => {
      const [saved] = await Registration.create([{ _id: registrationIds[i], event: eventIds[0], participant }], { session });
      return saved;
    })));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal((await Event.findById(eventIds[0])).registeredCount, 1);
    assert.equal(await Registration.countDocuments({ event: eventIds[0] }), 1);
    checks.push('Dos reservas concurrentes para un cupo: una aceptada, otra 409; contador=1');
    await assert.rejects(withReservedCapacity(String(eventIds[1]), async () => { throw new Error('QA rollback'); }), /QA rollback/);
    assert.equal((await Event.findById(eventIds[1])).registeredCount, 0);
    checks.push('Fallo de persistencia revierte el cupo en MongoDB');
    const endpoint = `/api/v1/events/${eventIds[0]}/participants`;
    assert.equal((await fetch(base + endpoint)).status, 401);
    const participants = await fetch(base + endpoint, { headers: { Authorization: `Bearer ${auth.token}` } });
    assert.equal(participants.status, 200);
    const body = await participants.json();
    assert.equal(body.data.participants.length, 1);
    assert.ok(body.data.participants.every(row => row.participant.email === undefined && row.participant.passwordHash === undefined));
    const other = await post('/api/v1/users/login', { email: `${runId}-1@example.invalid`, password });
    const otherToken = (await other.json()).data.token;
    assert.equal((await fetch(base + endpoint, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 403);
    checks.push('Participantes persistidos: organizador 200, anonimo 401, otro usuario 403; sin correo/hash');
    console.log(JSON.stringify({ status: 'passed', database: dbName, checks }, null, 2));
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (mongoose.connection.readyState === 1) {
      // Remove ONLY the fixture IDs allocated by this invocation.
      await Registration.deleteMany({ _id: { $in: registrationIds } });
      await Event.deleteMany({ _id: { $in: eventIds } });
      await User.deleteMany({ _id: { $in: userIds } });
      console.log('QA_FIXTURES_CLEANED');
    }
    await mongoose.disconnect();
  }
}

verify().catch(error => {
  console.error(error instanceof assert.AssertionError ? `QA_ASSERTION_FAILED: ${error.message}` : 'QA_FAILED: revisar acceso a Atlas, transacciones y configuracion local; credenciales omitidas');
  process.exitCode = 1;
});
