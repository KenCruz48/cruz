const assert = require('node:assert/strict');
const fs = require('node:fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../src/models/userModel');
const Event = require('../src/models/eventModel');
const Registration = require('../src/models/registrationModel');
const connectDatabase = require('../src/config/database');

async function verify() {
  if (process.env.ATLAS_ENV_FILE) {
    const parsed = dotenv.parse(fs.readFileSync(process.env.ATLAS_ENV_FILE));
    process.env.MONGODB_URI ||= parsed.MONGODB_URI || Object.values(parsed).find(value => /^mongodb(?:\+srv)?:\/\//.test(value));
  }
  const dbName = process.env.MONGODB_DB || 'racetrack_qa_ranking';
  if (!/^racetrack_qa_[a-z0-9_]+$/.test(dbName)) throw new Error('Esta prueba exige BD racetrack_qa_*');
  process.env.MONGODB_DB = dbName;
  const ids = count => Array.from({ length: count }, () => new mongoose.Types.ObjectId());
  const users = ids(6), events = ids(3), registrations = ids(8), results = ids(14), categories = ids(2);
  const checks = [];
  let server;
  try {
    await connectDatabase();
    await Promise.all([User.init(), Event.init(), Registration.init()]);
    await User.insertMany(users.map((id, index) => ({ _id: id, name: `QA Ranking ${index}`, email: `${id}@example.invalid`, passwordHash: 'fixture-not-a-login-account' })));
    const event = { name: 'QA Ranking', date: new Date(), location: 'QA', distance: 5, capacity: 10, owner: users[0] };
    await Event.insertMany(events.map(id => ({ ...event, _id: id })));
    await Registration.insertMany(registrations.map((id, index) => ({
      _id: id, event: index === 7 ? events[1] : events[0],
      participant: index === 6 ? new mongoose.Types.ObjectId() : users[index % users.length],
      status: index === 5 ? 'cancelled' : 'active', category: index === 2 ? categories[1] : categories[0],
    })));
    const times = [1000, 1000, 2000, 3000, -5, 500, 400, 300, 1500.5, '500', 9000, 100, 50, [1]];
    await mongoose.connection.collection('results').insertMany(results.map((id, index) => ({
      _id: id, event: events[0], registration: index === 11 ? [registrations[0], registrations[1]] : registrations[index < 8 ? index : index === 10 ? 0 : 4],
      status: 'finished', timeMs: times[index], updatedAt: index === 12 ? 'invalid-date' : new Date(index === 10 ? 0 : Date.now()),
    })));
    server = require('../src/app').listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/v1/events`;
    const get = suffix => fetch(`${base}/${events[0]}/ranking${suffix || ''}`);
    const response = await get();
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.deepEqual(data.ranking.map(row => row.rank), [1, 1, 3, 4]);
    assert.deepEqual(data.ranking.map(row => row.timeMs), [1000, 1000, 2000, 3000]);
    assert.equal(data.total, 4);
    assert.equal(data.podiumCount, 3);
    assert.deepEqual(data.podium.map(row => row.rank), [1, 1, 3]);
    assert.doesNotMatch(JSON.stringify(data), /passwordHash|email|fixture-not/);
    checks.push('Clasificacion 1,1,3,4 y podio con empates; proyeccion publica segura');
    checks.push('Excluye negativos, fracciones, texto/arrays, referencias no escalares, fecha invalida, cancelados y referencias cruzadas');
    checks.push('Un resultado vigente por inscripcion: no duplica ni utiliza el tiempo anterior');
    const page = (await (await get('?page=2&limit=2')).json()).data;
    assert.deepEqual(page.ranking.map(row => row.rank), [3, 4]);
    assert.equal(page.total, 4);
    assert.equal(page.podiumCount, 3);
    const category = (await (await get(`?category=${categories[1]}`)).json()).data;
    assert.equal(category.total, 1);
    assert.equal(category.ranking[0].rank, 1);
    assert.equal(category.ranking[0].timeMs, 2000);
    checks.push('Paginacion mantiene posiciones absolutas y filtro de categoria recalcula su ranking');
    const empty = await fetch(`${base}/${events[2]}/ranking`);
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).data.ranking, []);
    assert.equal((await fetch(`${base}/${new mongoose.Types.ObjectId()}/ranking`)).status, 404);
    assert.equal((await fetch(`${base}/bad/ranking`)).status, 400);
    assert.equal((await get('?category=bad')).status, 400);
    assert.equal((await get('?limit=101')).status, 400);
    checks.push('Sin resultados: 200 vacio; evento inexistente: 404; parametros invalidos: 400');
    console.log(JSON.stringify({ status: 'passed', database: dbName, checks }, null, 2));
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.collection('results').deleteMany({ _id: { $in: results } });
      await Registration.deleteMany({ _id: { $in: registrations } });
      await Event.deleteMany({ _id: { $in: events } });
      await User.deleteMany({ _id: { $in: users } });
      console.log('QA_RANKING_FIXTURES_CLEANED');
    }
    await mongoose.disconnect();
  }
}

verify().catch(error => {
  console.error(error instanceof assert.AssertionError ? `QA_RANKING_ASSERTION_FAILED: ${error.message}` : 'QA_RANKING_FAILED: revisar acceso y configuracion; detalles privados omitidos');
  process.exitCode = 1;
});
