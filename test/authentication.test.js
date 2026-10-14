const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/userModel');
const auth = require('../src/services/authService');
const secret = 'test-only-secret-with-at-least-32-bytes';
const id = '507f1f77bcf86cd799439011';
function configureSecret(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
}

test('login normaliza correo, firma JWT y excluye el hash', async t => {
  configureSecret(t);
  const passwordHash = await bcrypt.hash('CorrectPassword', 4);
  t.mock.method(User, 'findOne', filter => {
    assert.equal(filter.email, 'runner@example.com');
    return { select: async () => ({ _id: id, active: true, name: 'Runner', email: filter.email, passwordHash }) };
  });
  const result = await auth.login({ email: ' Runner@EXAMPLE.com ', password: 'CorrectPassword' });
  assert.equal(jwt.verify(result.token, secret).sub, id);
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(result.user.password, undefined);
});

test('rechaza usuario inexistente, inactivo o clave incorrecta con el mismo error', async t => {
  const passwordHash = await bcrypt.hash('CorrectPassword', 4);
  for (const user of [null, { active: false, passwordHash }, { active: true, passwordHash }]) {
    const mocked = t.mock.method(User, 'findOne', () => ({ select: async () => user }));
    await assert.rejects(auth.login({ email: 'runner@example.com', password: 'wrong' }), { status: 401, message: 'Credenciales invalidas' });
    mocked.mock.restore();
  }
});

test('rechaza JWT vencido, firma incorrecta y algoritmo diferente', async t => {
  configureSecret(t);
  for (const token of [
    jwt.sign({}, secret, { subject: id, expiresIn: -1, issuer: 'racetrack-api', audience: 'racetrack-client' }),
    jwt.sign({}, 'another-secret', { subject: id, issuer: 'racetrack-api', audience: 'racetrack-client' }),
    jwt.sign({}, secret, { subject: id, algorithm: 'HS384', issuer: 'racetrack-api', audience: 'racetrack-client' }),
  ]) await assert.rejects(auth.authenticate(token), { status: 401 });
});

test('valida un token correcto y rechaza usuario desactivado', async t => {
  configureSecret(t);
  let active = true;
  t.mock.method(User, 'findById', async () => ({ _id: id, active, name: 'Runner', email: 'runner@example.com' }));
  const token = jwt.sign({}, secret, { subject: id, issuer: 'racetrack-api', audience: 'racetrack-client', expiresIn: '1h' });
  assert.deepEqual(await auth.authenticate(token), { id, name: 'Runner', email: 'runner@example.com' });
  active = false;
  await assert.rejects(auth.authenticate(token), { status: 401 });
});

test('POST login respeta las capas, responde 200/401 y no expone secretos', async t => {
  const mocked = t.mock.method(auth, 'login', async body => {
    assert.equal(body.email, 'runner@example.com');
    return { token: 'signed-token', user: { id } };
  });
  const server = require('../src/app').listen(0);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/v1/users/login`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'runner@example.com' }) };
  const response = await fetch(url, options);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.token, 'signed-token');
  mocked.mock.restore();
  const failed = await fetch(url, options);
  assert.equal(failed.status, 401);
  assert.equal((await failed.json()).message, 'Credenciales invalidas');
});

test('JWT rechaza issuer/audience/sub incorrectos y secreto ausente', async t => {
  configureSecret(t);
  for (const options of [
    { subject: id, issuer: 'other', audience: 'racetrack-client' },
    { subject: id, issuer: 'racetrack-api', audience: 'other' },
    { subject: 'not-an-id', issuer: 'racetrack-api', audience: 'racetrack-client' },
  ]) await assert.rejects(auth.authenticate(jwt.sign({}, secret, options)), { status: 401 });
  delete process.env.JWT_SECRET;
  await assert.rejects(auth.authenticate('token'), /JWT_SECRET/);
});
