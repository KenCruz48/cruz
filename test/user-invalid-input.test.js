const test = require('node:test');
const assert = require('node:assert/strict');
const { registerUser } = require('../src/services/userService');

test('registro rechaza tipos y formatos inválidos antes de tocar MongoDB', async () => {
  for (const data of [null, {}, { name: 123, email: 'a@b.co', password: '12345678' },
    { name: 'QA', email: {}, password: '12345678' },
    { name: 'QA', email: 'invalid', password: '12345678' },
    { name: '  ', email: 'a@b.co', password: '12345678' },
    { name: 'QA', email: 'a@b.co', password: {} }]) {
    await assert.rejects(registerUser(data), { status: 400 });
  }
});
