
const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeRegex } = require('../src/utils/regexUtils');

test('escapa los caracteres especiales de una expresión regular', () => {
  const value = 'Carrera (10) + Atletismo.';
  const escaped = escapeRegex(value);

  assert.equal(escaped, 'Carrera \\(10\\) \\+ Atletismo\\.');
  assert.equal(new RegExp(`^${escaped}$`).test(value), true);
});

test('permite buscar texto que contiene caracteres especiales literalmente', () => {
  const value = 'A+B';
  const regex = new RegExp(`^${escapeRegex(value)}$`);

  assert.equal(regex.test('A+B'), true);
  assert.equal(regex.test('AAAB'), false);
});

test('devuelve una cadena vacía cuando recibe una cadena vacía', () => {
  assert.equal(escapeRegex(''), '');
});

test('rechaza valores que no son cadenas de texto', () => {
  assert.throws(() => escapeRegex(123), TypeError);
  assert.throws(() => escapeRegex(null), TypeError);
  assert.throws(() => escapeRegex(undefined), TypeError);
});
