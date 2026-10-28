const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeJmeter } = require('../qa/acceptance');

const endpointLabels = [
  'POST - Crear evento',
  'POST - Crear inscripción',
  'PATCH - Actualizar evento',
  'GET - Participantes',
  'POST - Registrar resultado',
];
const preparationLabels = [
  'POST - Login organizador',
  'POST - Login corredor',
  'POST - Crear categoría',
];

function sample(label, elapsed = 10) {
  return {
    label,
    success: 'true',
    elapsed: String(elapsed),
    timeStamp: '1000',
  };
}

test('rejects JTL records with unexpected labels', () => {
  const records = [
    ...endpointLabels.map(label => sample(label)),
    ...preparationLabels.map(label => sample(label)),
    sample('POST - Endpoint desconocido'),
  ];

  assert.throws(
    () => summarizeJmeter(records, 'load', 1, 1),
    /etiquetas inesperadas: POST - Endpoint desconocido/
  );
});

test('counts exactly the five business and three preparation labels', () => {
  const records = [
    ...endpointLabels.map(label => sample(label)),
    ...preparationLabels.map(label => sample(label)),
  ];

  const summary = summarizeJmeter(records, 'load', 1, 1);

  assert.equal(summary.samples, 5);
  assert.equal(summary.totalSamples, 8);
  assert.equal(summary.preparationSamples, 3);
  assert.deepEqual(summary.endpointSamples, Object.fromEntries(
    endpointLabels.map(label => [label, 1])
  ));
});
