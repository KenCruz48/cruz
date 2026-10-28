const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../src/app');
const { createAuthLimiter } = require('../src/middlewares/security');
const { registerUser } = require('../src/services/userService');

async function server(t) {
  const instance = app.listen(0, '127.0.0.1');
  await once(instance, 'listening');
  t.after(() => new Promise(resolve => { instance.closeAllConnections(); instance.close(resolve); }));
  return `http://127.0.0.1:${instance.address().port}`;
}
test('cabeceras restringen scripts, iframes y caché de API sin divulgar Express', async t => {
  const base = await server(t);
  const response = await fetch(base + '/health');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const api = await fetch(base + '/api/v1/not-found');
  assert.equal(api.headers.get('cache-control'), 'no-store');
});

test('readiness informa indisponibilidad cuando MongoDB no está conectado', async t => {
  const base = await server(t);
  const response = await fetch(base + '/ready');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'unavailable');
});
test('crear, actualizar y desactivar categorías requieren autenticación', async t => {
  const base = await server(t);
  for (const [method, path] of [['POST', ''], ['PATCH', '/507f1f77bcf86cd799439011'], ['PATCH', '/507f1f77bcf86cd799439011/deactivate']]) {
    const response = await fetch(base + '/api/v1/categories' + path, { method });
    assert.equal(response.status, 401);
  }
});
test('JSON malformado no refleja el cuerpo, arrays se rechazan y cuerpos grandes producen 413', async t => {
  const base = await server(t);
  const post = body => fetch(base + '/api/v1/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const malformed = await post('{"password":"secret-never-reflect",broken');
  assert.equal(malformed.status, 400); assert.doesNotMatch(await malformed.text(), /secret-never-reflect/);
  assert.equal((await post('[]')).status, 400);
  const large = await post(JSON.stringify({ data: 'x'.repeat(40000) }));
  assert.equal(large.status, 413);
});
test('el limitador bloquea tras el límite y permite después de expirar sin confiar en X-Forwarded-For', () => {
  let time = 0; let passed = 0; let status; const headers = {};
  const limiter = createAuthLimiter({ limit: 2, windowMs: 1000, now: () => time });
  const res = { set: (key, value) => { headers[key] = value; }, status: code => { status = code; return res; }, json: () => {} };
  const req = { method: 'POST', ip: '127.0.0.1', headers: { 'x-forwarded-for': 'spoofed' } };
  for (let i = 0; i < 3; i++) limiter(req, res, () => passed++);
  assert.equal(passed, 2); assert.equal(status, 429); assert.equal(headers['Retry-After'], '1');
  time = 1001; limiter(req, res, () => passed++); assert.equal(passed, 3);
});
test('registro rechaza contraseñas de más de 72 bytes para evitar truncado bcrypt', async () => {
  await assert.rejects(registerUser({ name: 'QA User', email: 'qa@example.invalid', password: 'á'.repeat(37) }), { status: 400 });
});
